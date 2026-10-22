import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def file_group(file_id):
    return f"yjs_file_{file_id}"


def room_group(room_id):
    return f"room_{room_id}"


def member_group(room_id, user_id):
    return f"room_{room_id}_user_{user_id}"


def _notify(group, message_type, **extra):
    """Called from normal (sync) Django views. Never breaks the REST request."""
    try:
        async_to_sync(get_channel_layer().group_send)(
            group, {"type": message_type, **extra}
        )
    except Exception:
        logger.exception("Could not notify group %s", group)


def kick_user(room_id, user_id):
    _notify(member_group(room_id, user_id), "force.close")


def close_room(room_id):
    _notify(room_group(room_id), "force.close")


def close_file(file_id):
    _notify(file_group(file_id), "force.close")


def notify_saved(file_id, username):
    """Tell everyone editing this file that someone saved a snapshot."""
    _notify(file_group(file_id), "file.saved", by=username)


def notify_files_changed(room_id):
    """Tell everyone in the room to reload the file list."""
    _notify(room_group(room_id), "files.changed")