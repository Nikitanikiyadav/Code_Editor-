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

export default api