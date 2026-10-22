import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { getErrorMessages } from '../services/errors'
import '../styles/auth.css'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = location.state?.from?.pathname || '/dashboard'

  if (user) return <Navigate to={redirectTo} replace /> // already logged in

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault() // stop the browser from reloading the page
    setErrors([])
    setSubmitting(true)
    try {
      await login(form)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setErrors(getErrorMessages(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="muted">Log in to CodeArena</p>

        {errors.length > 0 && (
          <div className="error-box" role="alert">
            {errors.map((m) => <p key={m}>{m}</p>)}
          </div>
        )}

        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={form.username}
               onChange={handleChange} autoComplete="username" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" value={form.password}
               onChange={handleChange} autoComplete="current-password" required />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>

        <p className="muted">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  )
}