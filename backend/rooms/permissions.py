from rest_framework.permissions import BasePermission


class IsRoomOwner(BasePermission):
    """Object-level permission: only the room's owner may pass."""

    message = "Only the room owner can do this."

    def has_object_permission(self, request, view, obj):
        return obj.owner_id == request.user.id