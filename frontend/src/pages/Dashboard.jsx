import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome, {user.username}!</h1>
      <p>Email: {user.email}</p>
      <p>(Real dashboard coming in Phase 5)</p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  )
}