import api from './api'

export const listRooms = async (params = {}) =>
  (await api.get('/rooms/', { params })).data

export const listRecentRooms = async () => (await api.get('/rooms/recent/')).data

export const createRoom = async (payload) =>
  (await api.post('/rooms/', payload)).data

export const joinRoom = async (code) =>
  (await api.post('/rooms/join/', { code })).data

export const getRoom = async (code) => (await api.get(`/rooms/${code}/`)).data

export const updateRoom = async (code, payload) =>
  (await api.patch(`/rooms/${code}/`, payload)).data

export const deleteRoom = (code) => api.delete(`/rooms/${code}/`)

export const leaveRoom = (code) => api.post(`/rooms/${code}/leave/`)