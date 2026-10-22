import { useEffect, useState } from 'react'
import api from './services/api'

function App() {
  const [status, setStatus] = useState('Checking backend...')

  useEffect(() => {
    api.get('/health/')
      .then((res) => setStatus(`${res.data.status}: ${res.data.message}`))
      .catch((err) => setStatus(`Failed: ${err.message}`))
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h1>{import.meta.env.VITE_APP_NAME || 'CodeArena'}</h1>
      <p>Backend status: {status}</p>
    </div>
  )
}

export default App