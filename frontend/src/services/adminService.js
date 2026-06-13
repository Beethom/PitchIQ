import api from './api'

export const adminService = {
  async getSyncStatus() {
    const { data } = await api.get('/admin/sync/status')
    return data
  },

  async startIncrementalSync(payload = {}) {
    const { data } = await api.post('/admin/sync', payload)
    return data
  },

  async startFullSync(payload = {}) {
    const { data } = await api.post('/admin/sync/full', payload)
    return data
  },

  async startNationalMatchBackfill(payload = {}) {
    const { data } = await api.post('/admin/sync/national-matches', payload)
    return data
  },
}
