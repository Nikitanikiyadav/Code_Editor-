import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>

  // Not logged in: go to /login, and remember where they wanted to go
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  return children
}