import json
import logging
import uuid

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from rooms.models import RoomFile, RoomParticipant

from . import docs
from .protocol import (
    AWARENESS,
    AWARENESS_QUERY,
    CLOSE_NOT_FOUND,
    CLOSE_REVOKED,
    CLOSE_UNAUTHENTICATED,
    MAX_MESSAGE_BYTES,
    SYNC_REQUEST,
    SYNCED,
    UPDATE,
)
from .utils import file_group, member_group, room_group

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_access(user, code, file_id):
    """Return (room_id, role) if the user is a member and the file is in that room."""
    membership = (
        RoomParticipant.objects.filter(room__code=code.upper(), user=user)
        .select_related("room")
        .first()
    )
    if membership is None:
        return None
    if not RoomFile.objects.filter(pk=file_id, room_id=membership.room_id).exists():
        return None
    return membership.room_id, membership.role


class FileSyncConsumer(AsyncWebsocketConsumer):
    live = None
    joined = ()
    can_write = False
    conn_id = None          # random public id for this connection
    me = None               # {"id":..., "username":...} taken from the session
    room_group_name = None

    async def connect(self):
        await self.accept()

        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return

        kwargs = self.scope["url_route"]["kwargs"]
        file_id = int(kwargs["file_id"])

        access = await get_access(user, kwargs["code"], file_id)
        if access is None:
            await self.close(code=CLOSE_NOT_FOUND)
            return
        room_id, role = access
        self.can_write = role != RoomParticipant.Role.VIEWER

        try:
            self.live = await docs.acquire(file_id)
        except RoomFile.DoesNotExist:
            await self.close(code=CLOSE_NOT_FOUND)
            return

        # Identity comes from the authenticated session, NEVER from the client
        self.conn_id = uuid.uuid4().hex[:12]
        self.me = {"id": user.id, "username": user.username}

        self.group = file_group(file_id)
        self.room_group_name = room_group(room_id)
        groups = [self.group, self.room_group_name, member_group(room_id, user.id)]
        for group in groups:
            await self.channel_layer.group_add(group, self.channel_name)
        self.joined = groups

        await self.send(bytes_data=bytes([SYNC_REQUEST]) + self.live.doc.get_state())
        await self.channel_layer.group_send(
            self.group, {"type": "peer.joined", "sender": self.channel_name}
        )
        # Presence: announce myself to the whole room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence.hello",
                "channel": self.channel_name,
                "conn": self.conn_id,
                "user": self.me,
            },
        )

    async def disconnect(self, code):
        for group in self.joined:
            await self.channel_layer.group_discard(group, self.channel_name)
        if self.room_group_name:
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "presence.bye", "conn": self.conn_id},
            )
        if self.live is not None:
            await docs.release(self.live.file_id)
            self.live = None

    async def receive(self, text_data=None, bytes_data=None):
        if not bytes_data or self.live is None:
            return  # text frames from the client are ignored
        if len(bytes_data) > MAX_MESSAGE_BYTES:
            await self.close(code=1009)
            return

        kind, payload = bytes_data[0], bytes_data[1:]

        if kind == SYNC_REQUEST:
            diff = self.live.doc.get_update(payload)
            await self.send(bytes_data=bytes([UPDATE]) + diff)
            await self.send(bytes_data=bytes([SYNCED]))

        elif kind == UPDATE:
            if not self.can_write:
                return
            try:
                self.live.doc.apply_update(payload)
            except Exception:
                logger.warning("Rejected a malformed update", exc_info=True)
                return
            docs.mark_dirty(self.live)
            await self._relay(bytes_data)

        elif kind == AWARENESS:
            await self._relay(bytes_data)

    async def _relay(self, data):
        await self.channel_layer.group_send(
            self.group,
            {"type": "relay", "data": data, "sender": self.channel_name},
        )

    async def _send_json(self, payload):
        await self.send(text_data=json.dumps(payload))

    # ---- Yjs relay ----
    async def relay(self, event):
        if event["sender"] == self.channel_name or self.live is None:
            return
        data = event["data"]
        if data[0] == UPDATE:
            try:
                self.live.doc.apply_update(data[1:])
            except Exception:
                pass
        await self.send(bytes_data=data)

    async def peer_joined(self, event):
        if event["sender"] != self.channel_name:
            await self.send(bytes_data=bytes([AWARENESS_QUERY]))

    # ---- presence ----
    async def presence_hello(self, event):
        """Someone new arrived in the room."""
        if event["conn"] == self.conn_id:
            return
        await self._send_json(
            {"type": "presence_join", "conn": event["conn"], "user": event["user"]}
        )
        # Answer the newcomer directly so they learn that we are here too
        await self.channel_layer.send(
            event["channel"],
            {"type": "presence.here", "conn": self.conn_id, "user": self.me},
        )

    async def presence_here(self, event):
        """A direct reply to our own 'hello': someone who was already here."""
        await self._send_json(
            {"type": "presence_here", "conn": event["conn"], "user": event["user"]}
        )

    async def presence_bye(self, event):
        if event["conn"] == self.conn_id:
            return
        await self._send_json({"type": "presence_leave", "conn": event["conn"]})

    # ---- other live events ----
    async def file_saved(self, event):
        await self._send_json({"type": "saved", "by": event["by"]})

    async def files_changed(self, event):
        await self._send_json({"type": "files_changed"})

    async def force_close(self, event):
        await self.close(code=CLOSE_REVOKED)