from rest_framework.exceptions import NotFound, PermissionDenied

from .models import RoomParticipant


def get_membership(user, code):
    """Return the user's membership in the room, or 404.
    404 (not 403) so we never reveal that a room exists."""
    try:
        return RoomParticipant.objects.select_related("room").get(
            room__code=code.upper(), user=user
        )
    except RoomParticipant.DoesNotExist:
        raise NotFound("Room not found.")


def require_editor(membership):
    """Viewers are read-only. Owners and editors may write."""
    if membership.role == RoomParticipant.Role.VIEWER:
        raise PermissionDenied("You have read-only access to this room.")