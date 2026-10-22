import * as Y from 'yjs'
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'

// Must match backend/editor/protocol.py
const MSG = { SYNC_REQUEST: 0, UPDATE: 1, AWARENESS: 2, SYNCED: 3, AWARENESS_QUERY: 4 }
const FATAL_CLOSE_CODES = new Set([4401, 4403, 4404]) // don't retry these
const MAX_BACKOFF_MS = 10000

// [type byte][payload bytes]
function frame(type, payload) {
  const body = payload ?? new Uint8Array(0)
  const out = new Uint8Array(body.length + 1)
  out[0] = type
  out.set(body, 1)
  return out
}

export default class YjsProvider {
  constructor({ roomCode, fileId, doc, awareness, onStatus, onSynced }) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    this.url = `${scheme}://${window.location.host}/ws/rooms/${roomCode}/files/${fileId}/`
    this.doc = doc
    this.awareness = awareness
    this.onStatus = onStatus
    this.onSynced = onSynced
    this.ws = null
    this.timer = null
    this.attempts = 0
    this.destroyed = false

    // Local edit -> send it. Edits that came FROM the server carry origin === this,
    // and are skipped: that is what prevents infinite update loops.
    this.handleDocUpdate = (update, origin) => {
      if (origin !== this) this.send(frame(MSG.UPDATE, update))
    }
    this.handleAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin !== 'local') return // only send changes made by this user
      const changed = [...added, ...updated, ...removed]
      this.send(frame(MSG.AWARENESS, encodeAwarenessUpdate(awareness, changed)))
    }
    doc.on('update', this.handleDocUpdate)
    awareness.on('update', this.handleAwarenessUpdate)

    this.connect()
  }

  setStatus(status) {
    if (!this.destroyed) this.onStatus?.(status)
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(data)
  }

  sendAwareness() {
    if (this.awareness.getLocalState() !== null) {
      this.send(
        frame(MSG.AWARENESS, encodeAwarenessUpdate(this.awareness, [this.doc.clientID])),
      )
    }
  }

  connect() {
    if (this.destroyed) return
    this.setStatus('connecting')
    const ws = new WebSocket(this.url)
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return
      this.attempts = 0
      this.setStatus('connected')
      // Tell the server what we have. This also uploads edits made while offline.
      this.send(frame(MSG.SYNC_REQUEST, Y.encodeStateVector(this.doc)))
      this.sendAwareness()
    }

    ws.onmessage = (event) => {
      if (this.ws !== ws) return
      try {
        this.handleMessage(new Uint8Array(event.data))
      } catch (err) {
        console.error('Bad collaboration message', err)
      }
    }

    ws.onclose = (event) => {
      if (this.ws !== ws) return
      this.ws = null

      // Remote cursors would be stale now, so remove them
      const others = Array.from(this.awareness.getStates().keys()).filter(
        (id) => id !== this.doc.clientID,
      )
      removeAwarenessStates(this.awareness, others, this)

      if (this.destroyed) return
      if (FATAL_CLOSE_CODES.has(event.code)) {
        this.setStatus('denied') // not logged in / removed / not a member
        return
      }
      this.setStatus('disconnected')
      // Exponential backoff with jitter: ~0.5s, 1s, 2s, 4s ... max 10s
      const base = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts)
      this.attempts += 1
      this.timer = setTimeout(() => this.connect(), base * (0.5 + Math.random() / 2))
    }
  }

  handleMessage(data) {
    const type = data[0]
    const payload = data.subarray(1)
    switch (type) {
      case MSG.SYNC_REQUEST:
        // The server asks what it is missing: reply with only the difference
        this.send(frame(MSG.UPDATE, Y.encodeStateAsUpdate(this.doc, payload)))
        break
      case MSG.UPDATE:
        Y.applyUpdate(this.doc, payload, this) // origin = this, so we don't echo it back
        break
      case MSG.AWARENESS:
        applyAwarenessUpdate(this.awareness, payload, this)
        break
      case MSG.SYNCED:
        this.onSynced?.()
        break
      case MSG.AWARENESS_QUERY:
        this.sendAwareness()
        break
      default:
        break
    }
  }

  destroy() {
    this.destroyed = true
    clearTimeout(this.timer)
    // Announce "I'm gone" so others remove our cursor immediately
    this.awareness.setLocalState(null)
    this.doc.off('update', this.handleDocUpdate)
    this.awareness.off('update', this.handleAwarenessUpdate)
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
  }
}