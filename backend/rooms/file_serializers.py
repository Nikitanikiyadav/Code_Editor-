import re

from rest_framework import serializers

from .models import MAX_FILE_CHARS, CodeVersion, Room, RoomFile

FILENAME_RE = re.compile(r"^[A-Za-z0-9_\-. ]+$")


def clean_filename(value):
    value = value.strip()
    if not value or value in (".", ".."):
        raise serializers.ValidationError("Enter a valid file name.")
    if not FILENAME_RE.match(value):
        raise serializers.ValidationError(
            "Use only letters, numbers, spaces, dots, dashes and underscores."
        )
    return value


class FileSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomFile
        fields = ["id", "name", "language", "updated_at"]


class FileDetailSerializer(serializers.ModelSerializer):
    updated_by = serializers.SerializerMethodField()

    class Meta:
        model = RoomFile
        fields = ["id", "name", "language", "content", "updated_by", "updated_at"]

    def get_updated_by(self, obj):
        return obj.updated_by.username if obj.updated_by else None


class FileCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    language = serializers.ChoiceField(choices=Room.Language.choices, required=False)

    def validate_name(self, value):
        return clean_filename(value)


class FileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False)
    language = serializers.ChoiceField(choices=Room.Language.choices, required=False)

    def validate_name(self, value):
        return clean_filename(value)


class SaveSerializer(serializers.Serializer):
    # trim_whitespace=False is IMPORTANT: by default DRF strips leading and
    # trailing spaces and newlines, which would silently damage the user's code.
    content = serializers.CharField(
        allow_blank=True, trim_whitespace=False, max_length=MAX_FILE_CHARS
    )


class VersionSummarySerializer(serializers.ModelSerializer):
    saved_by = serializers.SerializerMethodField()
    size = serializers.IntegerField(read_only=True)  # annotated in the view

    class Meta:
        model = CodeVersion
        fields = ["id", "saved_by", "created_at", "size"]

    def get_saved_by(self, obj):
        return obj.saved_by.username if obj.saved_by else "Unknown"


class VersionDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeVersion
        fields = ["id", "content", "created_at"]