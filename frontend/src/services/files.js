import api from './api'

const base = (code) => `/rooms/${code}/files`

export const listFiles = async (code) => (await api.get(`${base(code)}/`)).data

export const getFile = async (code, id) =>
  (await api.get(`${base(code)}/${id}/`)).data

export const createFile = async (code, payload) =>
  (await api.post(`${base(code)}/`, payload)).data

export const updateFile = async (code, id, payload) =>
  (await api.patch(`${base(code)}/${id}/`, payload)).data

export const deleteFile = (code, id) => api.delete(`${base(code)}/${id}/`)

export const saveFile = async (code, id, content) =>
  (await api.post(`${base(code)}/${id}/save/`, { content })).data

export const listVersions = async (code, id) =>
  (await api.get(`${base(code)}/${id}/versions/`)).data

export const getVersion = async (code, id, versionId) =>
  (await api.get(`${base(code)}/${id}/versions/${versionId}/`)).data