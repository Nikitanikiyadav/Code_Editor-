import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CreateRoomModal from '../components/CreateRoomModal'
import JoinRoomModal from '../components/JoinRoomModal'
import Navbar from '../components/Navbar'
import RoomCard from '../components/RoomCard'
import { LANGUAGES } from '../constants/languages'
import useAuth from '../hooks/useAuth'
import useDebounce from '../hooks/useDebounce'
import useToast from '../hooks/useToast'
import { listRecentRooms, listRooms } from '../services/rooms'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [rooms, setRooms] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('')
  const [scope, setScope] = useState('all')
  const [modal, setModal] = useState(null) // 'create' | 'join' | null

  const debouncedSearch = useDebounce(search, 300)
  const filtersActive = Boolean(debouncedSearch.trim() || language || scope !== 'all')

  // Reload the room list whenever a filter changes
  useEffect(() => {
    let ignore = false // prevents an old, slow response from overwriting a newer one

    async function load() {
      setLoading(true)
      setError('')
      const params = {}
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
      if (language) params.language = language
      if (scope !== 'all') params.scope = scope
      try {
        const data = await listRooms(params)
        if (!ignore) setRooms(Array.isArray(data) ? data : [])
      } catch {
        if (!ignore) setError('Could not load your rooms. Please try again.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [debouncedSearch, language, scope])

  // Recently opened rooms: load once
  useEffect(() => {
    listRecentRooms()
      .then((data) => setRecent(Array.isArray(data) ? data : []))
      .catch(() => setRecent([]))
  }, [])

  const handleCreated = (room) => {
    setModal(null)
    toast.success(`Room "${room.name}" created. Code: ${room.code}`)
    navigate(`/room/${room.code}`)
  }

  const handleJoined = (room) => {
    setModal(null)
    toast.success(`Joined "${room.name}"`)
    navigate(`/room/${room.code}`)
  }

  return (
    <>
      <Navbar />
      <main className="container">
        <section className="dashboard-header">
          <div>
            <h1>Welcome, {user.username}!</h1>
            <p className="muted">Create a room or join one to start coding together.</p>
          </div>
          <div className="button-row">
            <button className="btn btn-secondary" onClick={() => setModal('join')}>
              Join Room
            </button>
            <button className="btn btn-primary" onClick={() => setModal('create')}>
              + Create New Room
            </button>
          </div>
        </section>

        {recent.length > 0 && (
          <section aria-labelledby="recent-title">
            <h2 id="recent-title">Recently opened</h2>
            <div className="grid">
              {recent.map((room) => <RoomCard key={room.id} room={room} />)}
            </div>
          </section>
        )}

        <section aria-labelledby="rooms-title">
          <h2 id="rooms-title">Your rooms</h2>

          <div className="toolbar">
            <input
              type="search"
              placeholder="Search rooms by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search rooms"
            />
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
                    aria-label="Filter by language">
              <option value="">All languages</option>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <select value={scope} onChange={(e) => setScope(e.target.value)}
                    aria-label="Filter by ownership">
              <option value="all">All rooms</option>
              <option value="owned">Created by me</option>
              <option value="shared">Shared with me</option>
            </select>
          </div>

          {loading && <p className="muted">Loading rooms...</p>}
          {error && <div className="error-box" role="alert">{error}</div>}

          {!loading && !error && rooms.length === 0 && (
            <div className="empty-state">
              {filtersActive ? (
                <p>No rooms match your search or filters.</p>
              ) : (
                <>
                  <h3>No rooms yet</h3>
                  <p className="muted">
                    Create your first room, or join a friend's with their code.
                  </p>
                  <button className="btn btn-primary" onClick={() => setModal('create')}>
                    + Create New Room
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && rooms.length > 0 && (
            <div className="grid">
              {rooms.map((room) => <RoomCard key={room.id} room={room} />)}
            </div>
          )}
        </section>
      </main>

      {modal === 'create' && (
        <CreateRoomModal onClose={() => setModal(null)} onCreated={handleCreated} />
      )}
      {modal === 'join' && (
        <JoinRoomModal onClose={() => setModal(null)} onJoined={handleJoined} />
      )}
    </>
  )
}