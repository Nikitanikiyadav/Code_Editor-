import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { languageLabel } from '../constants/languages'
import useToast from '../hooks/useToast'
import { deleteRoom, getRoom, leaveRoom } from '../services/rooms'
import { getErrorMessages } from '../services/errors'
import { formatDate } from '../utils/format'

export default function Room() {
  const { code } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setNotFound(false)
    getRoom(code)
      .then((data) => !ignore && setRoom(data))
      .catch(() => !ignore && setNotFound(true))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [code])

  const copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('Could not copy automatically. Please copy it manually.')
    }
  }

  const handleLeave = async () => {
    if (!window.confirm('Leave this room? You can rejoin later with the code.')) return
    try {
      await leaveRoom(code)
      toast.info('You left the room.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this room for everyone? This cannot be undone.')) return
    try {
      await deleteRoom(code)
      toast.success('Room deleted.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    }
  }

  if (loading) {
    return (<><Navbar /><main className="container"><p className="muted">Loading room...</p></main></>)
  }

  // Same message whether the room doesn't exist OR you aren't a member (no information leak)
  if (notFound) {
    return (
      <>
        <Navbar />
        <main className="container">
          <div className="empty-state">
            <h2>Room not found</h2>
            <p className="muted">It may not exist, or you don't have access. Ask the owner for the code.</p>
            <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
          </div>
        </main>
      </>
    )
  }

  const inviteLink = `${window.location.origin}/join/${room.code}`
  const isOwner = room.role === 'owner'

  return (
    <>
      <Navbar />
      <main className="container">
        <section className="dashboard-header">
          <div>
            <h1>{room.name}</h1>
            <p className="muted">
              {languageLabel(room.language)} · {room.participant_count} member(s) ·
              Updated {formatDate(room.updated_at)}
            </p>
          </div>
          <div className="button-row">
            <button className="btn btn-secondary" onClick={() => copy(room.code, 'Room code copied')}>
              Copy code: {room.code}
            </button>
            <button className="btn btn-secondary" onClick={() => copy(inviteLink, 'Invite link copied')}>
              Copy invite link
            </button>
            {isOwner ? (
              <button className="btn btn-danger" onClick={handleDelete}>Delete room</button>
            ) : (
              <button className="btn btn-secondary" onClick={handleLeave}>Leave room</button>
            )}
          </div>
        </section>

        <div className="empty-state">
          <h3>Editor coming in Phase 6</h3>
          <p className="muted">The Monaco code editor will appear here.</p>
        </div>
      </main>
    </>
  )
}