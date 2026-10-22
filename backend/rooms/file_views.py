from django.db import IntegrityError, transaction
from django.db.models.functions import Length
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .access import get_membership, require_editor
from .file_serializers import (
    FileCreateSerializer,
    FileDetailSerializer,
    FileSummarySerializer,
    FileUpdateSerializer,
    SaveSerializer,
    VersionDetailSerializer,
    VersionSummarySerializer,
)
from .models import (
    MAX_FILES_PER_ROOM,
    MAX_VERSIONS_PER_FILE,
    CodeVersion,
    Room,
    RoomFile,
    default_filename,
    language_from_filename,
)

DUPLICATE_NAME = {"name": ["A file with this name already exists in this room."]}


def get_file(membership, file_id):
    # Looked up INSIDE the user's room, so IDs from other rooms give 404 (no IDOR).
    return get_object_or_404(RoomFile, pk=file_id, room=membership.room)


class FileListCreateView(APIView):
    """GET /api/rooms/<code>/files/    POST /api/rooms/<code>/files/"""

    def get(self, request, code):
        room = get_membership(request.user, code).room
        if not room.files.exists():
            # Rooms from Phase 5 have no files yet, so create a starter file.
            RoomFile.objects.get_or_create(
                room=room,
                name=default_filename(room.language),
                defaults={"language": room.language},
            )
        return Response(FileSummarySerializer(room.files.all(), many=True).data)

    def post(self, request, code):
        membership = get_membership(request.user, code)
        require_editor(membership)
        room = membership.room

        serializer = FileCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]

        if room.files.count() >= MAX_FILES_PER_ROOM:
            return Response(
                {"detail": f"A room can have at most {MAX_FILES_PER_ROOM} files."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if room.files.filter(name__iexact=name).exists():
            return Response(DUPLICATE_NAME, status=status.HTTP_400_BAD_REQUEST)

        language = serializer.validated_data.get("language") or language_from_filename(
            name, room.language
        )
        try:
            file = RoomFile.objects.create(
                room=room, name=name, language=language, updated_by=request.user
            )
        except IntegrityError:  # two people created the same name at once
            return Response(DUPLICATE_NAME, status=status.HTTP_400_BAD_REQUEST)
        return Response(FileSummarySerializer(file).data, status=status.HTTP_201_CREATED)


class FileDetailView(APIView):
    """GET (with content), PATCH (rename / change language), DELETE."""

    def get(self, request, code, file_id):
        file = get_file(get_membership(request.user, code), file_id)
        return Response(FileDetailSerializer(file).data)

    def patch(self, request, code, file_id):
        membership = get_membership(request.user, code)
        require_editor(membership)
        file = get_file(membership, file_id)

        serializer = FileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "name" in data:
            taken = (
                membership.room.files.filter(name__iexact=data["name"])
                .exclude(pk=file.pk)
                .exists()
            )
            if taken:
                return Response(DUPLICATE_NAME, status=status.HTTP_400_BAD_REQUEST)
            file.name = data["name"]
        if "language" in data:
            file.language = data["language"]
        file.save()
        return Response(FileSummarySerializer(file).data)

    def delete(self, request, code, file_id):
        membership = get_membership(request.user, code)
        require_editor(membership)
        file = get_file(membership, file_id)
        if membership.room.files.count() <= 1:
            return Response(
                {"detail": "A room needs at least one file."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileSaveView(APIView):
    """POST /api/rooms/<code>/files/<id>/save/   body: {"content": "..."}"""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "file_save"

    def post(self, request, code, file_id):
        membership = get_membership(request.user, code)
        require_editor(membership)

        serializer = SaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data["content"]

        with transaction.atomic():
            # select_for_update locks this row until the block ends, so two
            # simultaneous saves can't create inconsistent versions.
            file = get_object_or_404(
                RoomFile.objects.select_for_update(),
                pk=file_id,
                room=membership.room,
            )
            if content != file.content:  # no change = no new version
                file.content = content
                file.updated_by = request.user
                file.save()
                CodeVersion.objects.create(
                    file=file, content=content, saved_by=request.user
                )
                # Keep only the newest MAX_VERSIONS_PER_FILE versions
                old_ids = list(
                    file.versions.values_list("id", flat=True)[MAX_VERSIONS_PER_FILE:]
                )
                if old_ids:
                    CodeVersion.objects.filter(id__in=old_ids).delete()
                # Make the room show "updated just now" on the dashboard
                Room.objects.filter(pk=membership.room_id).update(
                    updated_at=timezone.now()
                )

        return Response(FileDetailSerializer(file).data)


class VersionListView(APIView):
    """GET /api/rooms/<code>/files/<id>/versions/"""

    def get(self, request, code, file_id):
        file = get_file(get_membership(request.user, code), file_id)
        versions = (
            file.versions.select_related("saved_by")
            .defer("content")                      # don't load big text for a list
            .annotate(size=Length("content"))      # but still report the size
        )
        return Response(VersionSummarySerializer(versions, many=True).data)


class VersionDetailView(APIView):
    """GET /api/rooms/<code>/files/<id>/versions/<vid>/   (includes content)"""

    def get(self, request, code, file_id, version_id):
        file = get_file(get_membership(request.user, code), file_id)
        version = get_object_or_404(CodeVersion, pk=version_id, file=file)
        return Response(VersionDetailSerializer(version).data)