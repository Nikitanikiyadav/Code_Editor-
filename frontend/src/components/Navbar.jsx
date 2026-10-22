import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import useToast from '../hooks/useToast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close the dropdown on outside click or Escape
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      toast.error('Could not log out. Please try again.')
    }
  }

  return (
    <header className="navbar">
      <Link to="/dashboard" className="brand">
        &lt;/&gt; CodeArena
      </Link>

      <div className="user-menu" ref={menuRef}>
        <button
          className="btn btn-secondary"
          onClick={() => setOpen(!open)}
          aria-haspopup="true"
          aria-expanded={open}
        >
          {user.username} ▾
        </button>
        {open && (
          <div className="dropdown">
            <p className="dropdown-name">{user.username}</p>
            <p className="muted small">{user.email}</p>
            <button className="btn btn-secondary full" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}