import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { getErrorMessages } from '../services/errors'
import '../styles/auth.css'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '',
  })
  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors([])

    // Quick frontend check for a better experience. The server still validates everything.
    if (form.password !== form.confirm) {
      setErrors(['Passwords do not match.'])
      return
    }

    setSubmitting(true)
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrors(getErrorMessages(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p className="muted">Start coding together</p>

        {errors.length > 0 && (
          <div className="error-box" role="alert">
            {errors.map((m) => <p key={m}>{m}</p>)}
          </div>
        )}

        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={form.username}
               onChange={handleChange} autoComplete="username" required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" value={form.email}
               onChange={handleChange} autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" value={form.password}
               onChange={handleChange} autoComplete="new-password" required />

        <label htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" value={form.confirm}
               onChange={handleChange} autoComplete="new-password" required />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Sign up'}
        </button>

        <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  )
}