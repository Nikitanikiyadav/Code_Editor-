import axios from 'axios'

// One shared Axios instance for the whole app
const api = axios.create({
  // Dev: '/api' goes through the Vite proxy to Django.
  // Production: set VITE_API_URL to the deployed backend, e.g. https://api.example.com/api
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,    // send the session cookie with every request
  xsrfCookieName: 'csrftoken',    // Django's CSRF cookie name
  xsrfHeaderName: 'X-CSRFToken',  // header Django expects
})

// If the API URL isn't a real backend (e.g. on Netlify without VITE_API_URL),
// the SPA fallback answers with index.html. Treat any non-JSON body as an error
// so the app never mistakes an HTML page for a user or a list of rooms.
api.interceptors.response.use((response) => {
  const type = response.headers?.['content-type'] || ''
  const isEmpty = response.status === 204 || response.data === ''
  if (!isEmpty && !type.includes('application/json')) {
    const error = new Error('API did not return JSON. Is the backend URL configured?')
    error.response = { ...response, status: 502 }
    return Promise.reject(error)
  }
  return response
})

export default api