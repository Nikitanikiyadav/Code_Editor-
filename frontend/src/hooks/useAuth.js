import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

// A small custom hook so components write useAuth() instead of useContext(AuthContext)
export default function useAuth() {
  return useContext(AuthContext)
}