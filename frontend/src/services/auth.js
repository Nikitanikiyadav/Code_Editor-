import api from './api'

export const getCsrf = () => api.get('/auth/csrf/')

export const fetchMe = async () => (await api.get('/auth/me/')).data

export const login = async (credentials) =>
  (await api.post('/auth/login/', credentials)).data

export const register = async (payload) =>
  (await api.post('/auth/register/', payload)).data

export const logout = () => api.post('/auth/logout/')

export const updateProfile = async (payload) =>
  (await api.patch('/auth/me/', payload)).data