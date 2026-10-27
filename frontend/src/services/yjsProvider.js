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

function frame(type, payload) {
  const body = payload ?? new Uint8Array(0)
  const out = new Uint8Array(body.length + 1)
  out[0] = type
  out.set(body, 1)
  return out
}

export default class YjsProvider {
  constructor({
    roomCode, fileId, doc, awareness,
    onStatus, onSynced, onOpen, onClose, onText,
  }) {
    // Dev: same host (Vite proxies /ws). Production: set VITE_WS_URL, e.g. wss://api.example.com
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsBase = import.meta.env.VITE_WS_URL || `${scheme}://${window.location.host}`
    this.url = `${wsBase.replace(/\/$/, '')}/ws/rooms/${roomCode}/files/${fileId}/`
    this.doc = doc
    this.awareness = awareness
    this.onStatus = onStatus
    this.onSynced = onSynced
    this.onOpen = onOpen
    this.onClose = onClose
    this.onText = onText // JSON events: presence, saved, files_changed
    this.ws = null
    this.timer = null
    this.attempts = 0
    this.destroyed = false
    this.denied = false

    this.handleDocUpdate = (update, origin) => {
      if (origin !== this) this.send(frame(MSG.UPDATE, update))
    }
    this.handleAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin !== 'local') return
      const changed = [...added, ...updated, ...removed]
      this.send(frame(MSG.AWARENESS, encodeAwarenessUpdate(awareness, changed)))
    }
    // When the internet comes back, reconnect immediately instead of waiting
    this.handleOnline = () => this.reconnectNow()

    doc.on('update', this.handleDocUpdate)
    awareness.on('update', this.handleAwarenessUpdate)
    window.addEventListener('online', this.handleOnline)

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

  // Used by the "Retry now" button and the browser's "online" event
  reconnectNow() {
    if (this.destroyed || this.denied) return
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return // already trying
    clearTimeout(this.timer)
    this.attempts = 0
    this.connect()
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
      this.onOpen?.() // clears the old presence list; the server re-sends it
      this.send(frame(MSG.SYNC_REQUEST, Y.encodeStateVector(this.doc)))
      this.sendAwareness()
    }

    ws.onmessage = (event) => {
      if (this.ws !== ws) return
      try {
        if (typeof event.data === 'string') {
          this.onText?.(JSON.parse(event.data)) // JSON event
        } else {
          this.handleMessage(new Uint8Array(event.data)) // binary Yjs message
        }
      } catch (err) {
        console.error('Bad collaboration message', err)
      }
    }

    ws.onclose = (event) => {
      if (this.ws !== ws) return
      this.ws = null
      this.onClose?.()

      const others = Array.from(this.awareness.getStates().keys()).filter(
        (id) => id !== this.doc.clientID,
      )
      removeAwarenessStates(this.awareness, others, this)

      if (this.destroyed) return
      if (FATAL_CLOSE_CODES.has(event.code)) {
        this.denied = true
        this.setStatus('denied')
        return
      }
      this.setStatus('disconnected')
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
        this.send(frame(MSG.UPDATE, Y.encodeStateAsUpdate(this.doc, payload)))
        break
      case MSG.UPDATE:
        Y.applyUpdate(this.doc, payload, this)
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
    window.removeEventListener('online', this.handleOnline)
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