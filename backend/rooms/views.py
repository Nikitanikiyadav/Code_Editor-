from django.db import transaction
from django.db.models import Count, F, FilteredRelation, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import Room, RoomParticipant
from .permissions import IsRoomOwner
from .serializers import JoinRoomSerializer, RoomSerializer, RoomWriteSerializer


class RoomViewSet(viewsets.GenericViewSet):
    throttle_scope = None                 # lets @action(throttle_scope=...) work
    lookup_field = "code"                 # URLs look like /api/rooms/ABC123/
    lookup_value_regex = "[A-Za-z0-9]+"

    def get_permissions(self):
        if self.action in ("partial_update", "destroy"):
            return [IsAuthenticated(), IsRoomOwner()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """THE security rule: only rooms where the current user is a participant.
        Every endpoint below starts from this queryset, so a non-member can
        never reach someone else's room."""
        user = self.request.user
        return (
            Room.objects.select_related("owner")
            .annotate(
                mine=FilteredRelation(
                    "participants", condition=Q(participants__user=user)
                )
            )
            .filter(mine__isnull=False)
            .annotate(
                my_role=F("mine__role"),
                my_last_opened=F("mine__last_opened_at"),
                participant_count=Count("participants", distinct=True),
            )
        )

    def get_object(self):
        self.kwargs["code"] = self.kwargs["code"].upper()
        return super().get_object()

    def _room_response(self, room, status_code=status.HTTP_200_OK):
        """Re-fetch through get_queryset so annotations are included."""
        fresh = self.get_queryset().get(pk=room.pk)
        return Response(RoomSerializer(fresh).data, status=status_code)

    # GET /api/rooms/?search=&language=&scope=owned|shared
    def list(self, request):
        rooms = self.get_queryset()
        search = request.query_params.get("search", "").strip()
        language = request.query_params.get("language", "").strip()
        scope = request.query_params.get("scope", "").strip()

        if search:
            rooms = rooms.filter(name__icontains=search)
        if language:
            rooms = rooms.filter(language=language)
        if scope == "owned":
            rooms = rooms.filter(owner=request.user)
        elif scope == "shared":
            rooms = rooms.exclude(owner=request.user)

        return Response(RoomSerializer(rooms, many=True).data)

    # POST /api/rooms/
    def create(self, request):
        serializer = RoomWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # atomic = both rows are created, or neither (no half-finished room)
        with transaction.atomic():
            room = serializer.save(owner=request.user)
            RoomParticipant.objects.create(
                room=room,
                user=request.user,
                role=RoomParticipant.Role.OWNER,
                last_opened_at=timezone.now(),
            )
        return self._room_response(room, status.HTTP_201_CREATED)

    # GET /api/rooms/<code>/   (also records "recently opened")
    def retrieve(self, request, code=None):
        room = self.get_object()
        RoomParticipant.objects.filter(room=room, user=request.user).update(
            last_opened_at=timezone.now()
        )
        return self._room_response(room)

    # PATCH /api/rooms/<code>/   (owner only)
    def partial_update(self, request, code=None):
        room = self.get_object()  # also runs the IsRoomOwner check
        serializer = RoomWriteSerializer(room, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self._room_response(room)

    # DELETE /api/rooms/<code>/   (owner only)
    def destroy(self, request, code=None):
        room = self.get_object()
        room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET /api/rooms/recent/
    @action(detail=False, methods=["get"])
    def recent(self, request):
        rooms = (
            self.get_queryset()
            .filter(my_last_opened__isnull=False)
            .order_by(F("my_last_opened").desc())[:5]
        )
        return Response(RoomSerializer(rooms, many=True).data)

    # POST /api/rooms/join/   body: {"code": "ABC123XY"}
    # Rate limited so nobody can brute-force guess room codes.
    @action(
        detail=False,
        methods=["post"],
        throttle_classes=[ScopedRateThrottle],
        throttle_scope="room_join",
    )
    def join(self, request):
        serializer = JoinRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]

        try:
            room = Room.objects.get(code=code)
        except Room.DoesNotExist:
            return Response(
                {"detail": "No room found with that code."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # get_or_create = joining twice is harmless
        RoomParticipant.objects.get_or_create(
            room=room,
            user=request.user,
            defaults={"role": RoomParticipant.Role.EDITOR},
        )
        return self._room_response(room)

    # POST /api/rooms/<code>/leave/
    @action(detail=True, methods=["post"])
    def leave(self, request, code=None):
        room = self.get_object()
        if room.owner_id == request.user.id:
            return Response(
                {"detail": "Owners can't leave their own room. Delete it instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        RoomParticipant.objects.filter(room=room, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)