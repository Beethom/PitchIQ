import api from './api'

export const compareService = {
  async compare(idA, idB) {
    const { data } = await api.get('/compare/', { params: { player_a: idA, player_b: idB } })
    return data
  },
}
