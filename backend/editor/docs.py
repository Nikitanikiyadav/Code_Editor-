"""One live Yjs document per open file, shared by all connections in this process."""
import asyncio

from channels.db import database_sync_to_async
from django.db import transaction
from pycrdt import Doc, Text

from rooms.models import RoomFile

from .protocol import TEXT_KEY

SAVE_DELAY = 2.0  # seconds to wait after an edit before writing to the database


class LiveDoc:
    def __init__(self, file_id, doc):
        self.file_id = file_id
        self.doc = doc
        self.clients = 0          # how many connections use this document
        self.dirty = False        # changed since the last database save?
        self.save_task = None
        self.lock = asyncio.Lock()


_docs = {}                        # file_id -> LiveDoc
_registry_lock = asyncio.Lock()   # stops two connections loading the same doc twice


# ---------- database work (runs in a thread via database_sync_to_async) ----------
def _load_state_sync(file_id):
    with transaction.atomic():
        # Lock the row so two processes can't both create the initial state
        file = RoomFile.objects.select_for_update().get(pk=file_id)
        doc = Doc()
        text = doc.get(TEXT_KEY, type=Text)
        if file.yjs_state:
            doc.apply_update(bytes(file.yjs_state))
        else:
            # First time this file is opened collaboratively:
            # start from the text saved in Phase 6.
            if file.content:
                text += file.content
            file.yjs_state = doc.get_update()
            file.save(update_fields=["yjs_state"])
        return doc


def _save_state_sync(file_id, update_bytes):
    with transaction.atomic():
        file = RoomFile.objects.select_for_update().filter(pk=file_id).first()
        if file is None:  # file was deleted meanwhile
            return
        merged = Doc()
        merged.get(TEXT_KEY, type=Text)
        if file.yjs_state:
            merged.apply_update(bytes(file.yjs_state))
        # CRDT merge: order doesn't matter, so this can never lose anyone's edits
        merged.apply_update(update_bytes)
        file.yjs_state = merged.get_update()
        file.save(update_fields=["yjs_state"])


# ---------- registry ----------
async def acquire(file_id):
    async with _registry_lock:
        live = _docs.get(file_id)
        if live is None:
            doc = await database_sync_to_async(_load_state_sync)(file_id)
            live = _docs[file_id] = LiveDoc(file_id, doc)
        live.clients += 1
        return live


async def release(file_id):
    live = _docs.get(file_id)
    if live is None:
        return
    live.clients -= 1
    if live.clients <= 0:
        await flush(live)              # save immediately when the last user leaves
        if live.clients <= 0:          # nobody joined while we were saving
            _docs.pop(file_id, None)   # free the memory


async def flush(live):
    async with live.lock:
        if not live.dirty:
            return
        live.dirty = False
        update = live.doc.get_update()  # the full state as one update
        await database_sync_to_async(_save_state_sync)(live.file_id, update)


async def _save_loop(live):
    while live.dirty:
        await asyncio.sleep(SAVE_DELAY)
        await flush(live)


def mark_dirty(live):
    """Debounced save: many keystrokes in 2 seconds become one database write."""
    live.dirty = True
    if live.save_task is None or live.save_task.done():
        live.save_task = asyncio.create_task(_save_loop(live))