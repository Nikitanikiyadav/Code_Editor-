import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Room from './pages/Room'
import JoinByLink from './pages/JoinByLink'
import api from './services/api'
import './styles/app.css'

function Home() {
  const [status, setStatus] = useState('Checking backend...')

  useEffect(() => {
    api.get('/health/')
      .then((res) => setStatus(res.data.message))
      .catch(() => setStatus('Cannot reach backend. Is Django running?'))
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>CodeArena</h1>
      <p>Backend status: {status}</p>
      <p>
        <Link to="/login">Log in</Link> | <Link to="/register">Register</Link> |{' '}
        <Link to="/dashboard">Dashboard</Link>
      </p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/room/:code" element={<ProtectedRoute><Room /></ProtectedRoute>} />
            <Route path="/join/:code" element={<ProtectedRoute><JoinByLink /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}