import { createContext, useEffect, useState } from 'react'
import * as authService from '../services/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true while we check the session

  // When the app first loads: get the CSRF cookie, then ask "am I logged in?"
  useEffect(() => {
    async function init() {
      try {
        await authService.getCsrf()
        setUser(await authService.fetchMe())
      } catch {
        setUser(null) // not logged in
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const login = async (credentials) => setUser(await authService.login(credentials))
  const register = async (payload) => setUser(await authService.register(payload))
  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}