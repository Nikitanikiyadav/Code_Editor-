import axios from 'axios'

// One shared Axios instance for the whole app
const api = axios.create({
  baseURL: '/api',          // goes through the Vite proxy to Django
  withCredentials: true,    // send the session cookie with every request
  xsrfCookieName: 'csrftoken',    // Django's CSRF cookie name
  xsrfHeaderName: 'X-CSRFToken',  // header Django expects
})

export default api