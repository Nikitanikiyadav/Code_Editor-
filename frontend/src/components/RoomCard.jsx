import { Link } from 'react-router-dom'
import { languageLabel } from '../constants/languages'
import { formatDate } from '../utils/format'

export default function RoomCard({ room }) {
  return (
    <Link to={`/room/${room.code}`} className="room-card">
      <div className="room-card-top">
        <h3>{room.name}</h3>
        <span className="badge">{languageLabel(room.language)}</span>
      </div>
      <p className="muted small">
        {room.role === 'owner' ? 'Created by you' : `Owner: ${room.owner}`} ·{' '}
        {room.participant_count} {room.participant_count === 1 ? 'member' : 'members'}
      </p>
      <p className="muted small">Updated {formatDate(room.updated_at)}</p>
      <p className="code-chip">{room.code}</p>
    </Link>
  )
}