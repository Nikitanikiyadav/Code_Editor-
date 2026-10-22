import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


# A "group" is a named set of connections. group_send reaches all of them,
# even across server processes (this is what Redis is for).
def file_group(file_id):
    return f"yjs_file_{file_id}"


def room_group(room_id):
    return f"room_{room_id}"


def member_group(room_id, user_id):
    return f"room_{room_id}_user_{user_id}"


def _notify(group, message_type):
    """Called from normal (sync) Django views."""
    try:
        async_to_sync(get_channel_layer().group_send)(group, {"type": message_type})
    except Exception:  # never let a messaging problem break the REST request
        logger.exception("Could not notify group %s", group)


def kick_user(room_id, user_id):
    """Close this user's open sockets in this room (they left or were removed)."""
    _notify(member_group(room_id, user_id), "force.close")


def close_room(room_id):
    _notify(room_group(room_id), "force.close")


def close_file(file_id):
    _notify(file_group(file_id), "force.close")