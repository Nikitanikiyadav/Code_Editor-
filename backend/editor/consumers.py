import logging

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

    async def connect(self):
        # Accept first, then close with a code if rejected. A close *before*
        # accept shows up in the browser as a generic failure, so the client
        # couldn't tell "no access" from "network down".
        await self.accept()

        user = self.scope["user"]  # filled in from the session cookie
        if not user.is_authenticated:
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return

        kwargs = self.scope["url_route"]["kwargs"]
        file_id = int(kwargs["file_id"])

        access = await get_access(user, kwargs["code"], file_id)
        if access is None:  # same answer for "doesn't exist" and "not a member"
            await self.close(code=CLOSE_NOT_FOUND)
            return
        room_id, role = access
        self.can_write = role != RoomParticipant.Role.VIEWER

        try:
            self.live = await docs.acquire(file_id)
        except RoomFile.DoesNotExist:
            await self.close(code=CLOSE_NOT_FOUND)
            return

        self.group = file_group(file_id)
        groups = [self.group, room_group(room_id), member_group(room_id, user.id)]
        for group in groups:
            await self.channel_layer.group_add(group, self.channel_name)
        self.joined = groups

        # Step 1 of the sync: tell the client what the server already has
        await self.send(bytes_data=bytes([SYNC_REQUEST]) + self.live.doc.get_state())
        # Ask everyone else to resend their cursor so the newcomer sees them
        await self.channel_layer.group_send(
            self.group, {"type": "peer.joined", "sender": self.channel_name}
        )

    async def disconnect(self, code):
        for group in self.joined:
            await self.channel_layer.group_discard(group, self.channel_name)
        if self.live is not None:
            await docs.release(self.live.file_id)
            self.live = None

    async def receive(self, text_data=None, bytes_data=None):
        if not bytes_data or self.live is None:
            return
        if len(bytes_data) > MAX_MESSAGE_BYTES:
            await self.close(code=1009)  # "message too big"
            return

        kind, payload = bytes_data[0], bytes_data[1:]

        if kind == SYNC_REQUEST:
            # Client sent its state; reply with only what it is missing
            diff = self.live.doc.get_update(payload)
            await self.send(bytes_data=bytes([UPDATE]) + diff)
            await self.send(bytes_data=bytes([SYNCED]))

        elif kind == UPDATE:
            if not self.can_write:  # viewers can never change the document
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

    # ---- handlers for messages that arrive from the channel layer ----
    async def relay(self, event):
        if event["sender"] == self.channel_name or self.live is None:
            return  # don't echo to the sender
        data = event["data"]
        if data[0] == UPDATE:
            # Keeps this process's document current when connections are spread
            # over several server processes. Applying twice is harmless.
            try:
                self.live.doc.apply_update(data[1:])
            except Exception:
                pass
        await self.send(bytes_data=data)

    async def peer_joined(self, event):
        if event["sender"] != self.channel_name:
            await self.send(bytes_data=bytes([AWARENESS_QUERY]))

    async def force_close(self, event):
        await self.close(code=CLOSE_REVOKED)