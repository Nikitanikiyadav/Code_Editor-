# First byte of every binary WebSocket message
SYNC_REQUEST = 0
UPDATE = 1
AWARENESS = 2
SYNCED = 3
AWARENESS_QUERY = 4

# Name of the shared text inside the Yjs document (frontend must use the same)
TEXT_KEY = "content"

MAX_MESSAGE_BYTES = 1_000_000  # reject anything larger than ~1 MB

# Custom WebSocket close codes (4000-4999 are free for applications)
CLOSE_UNAUTHENTICATED = 4401
CLOSE_REVOKED = 4403   # you were removed or the room was deleted
CLOSE_NOT_FOUND = 4404  # no such room/file, or you aren't a member