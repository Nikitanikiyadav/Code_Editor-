from rest_framework import serializers

from .models import Room


class RoomSerializer(serializers.ModelSerializer):
    """What the frontend receives. The my_* and participant_count fields
    come from annotations added in the view's queryset."""

    owner = serializers.CharField(source="owner.username", read_only=True)
    role = serializers.CharField(source="my_role", read_only=True)
    last_opened_at = serializers.DateTimeField(source="my_last_opened", read_only=True)
    participant_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Room
        fields = [
            "id", "name", "code", "language", "owner", "role",
            "participant_count", "last_opened_at", "created_at", "updated_at",
        ]


class RoomWriteSerializer(serializers.ModelSerializer):
    """Validates data for creating or renaming a room."""

    class Meta:
        model = Room
        fields = ["name", "language"]

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Room name must be at least 3 characters.")
        return value


class JoinRoomSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)

    def validate_code(self, value):
        return value.strip().upper()