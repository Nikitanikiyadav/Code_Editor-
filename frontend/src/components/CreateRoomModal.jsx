import { useState } from 'react'
import { LANGUAGES } from '../constants/languages'
import { createRoom } from '../services/rooms'
import { getErrorMessages } from '../services/errors'
import Modal from './Modal'

export default function CreateRoomModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('python')
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors([])
    setSubmitting(true)
    try {
      const room = await createRoom({ name, language })
      onCreated(room)
    } catch (err) {
      setErrors(getErrorMessages(err))
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Create new room" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        {errors.length > 0 && (
          <div className="error-box" role="alert">
            {errors.map((m) => <p key={m}>{m}</p>)}
          </div>
        )}

        <label htmlFor="room-name">Room name</label>
        <input id="room-name" value={name} onChange={(e) => setName(e.target.value)}
               maxLength={80} placeholder="e.g. Two Sum practice" required autoFocus />

        <label htmlFor="room-language">Programming language</label>
        <select id="room-language" value={language}
                onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create room'}
          </button>
        </div>
      </form>
    </Modal>
  )
}