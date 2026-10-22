import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { joinRoom } from '../services/rooms'
import { getErrorMessages } from '../services/errors'

export default function JoinByLink() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    joinRoom(code.toUpperCase())
      .then((room) => navigate(`/room/${room.code}`, { replace: true }))
      .catch((err) => setError(getErrorMessages(err)[0]))
  }, [code, navigate])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Couldn't join</h1>
          <div className="error-box" role="alert"><p>{error}</p></div>
          <Link to="/dashboard">Back to dashboard</Link>
        </div>
      </div>
    )
  }
  return <p style={{ padding: '2rem' }}>Joining room...</p>
}