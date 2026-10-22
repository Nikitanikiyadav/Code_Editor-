import { useState } from 'react'
import { joinRoom } from '../services/rooms'
import { getErrorMessages } from '../services/errors'
import Modal from './Modal'

export default function JoinRoomModal({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors([])
    setSubmitting(true)
    try {
      const room = await joinRoom(code.trim().toUpperCase())
      onJoined(room)
    } catch (err) {
      setErrors(getErrorMessages(err))
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Join existing room" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        {errors.length > 0 && (
          <div className="error-box" role="alert">
            {errors.map((m) => <p key={m}>{m}</p>)}
          </div>
        )}

        <label htmlFor="join-code">Room code</label>
        <input id="join-code" value={code} onChange={(e) => setCode(e.target.value)}
               maxLength={20} placeholder="e.g. K7M2QX9A" required autoFocus
               autoComplete="off" />

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Joining...' : 'Join room'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
