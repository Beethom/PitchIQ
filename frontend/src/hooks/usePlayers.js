import { useState, useEffect, useCallback } from 'react'
import { playerService } from '../services/playerService'
import { enrichPlayer, enrichPlayers } from '../utils/playerMetrics'
import { dedupePlayers } from '../utils/dedupePlayers'

export function usePlayers(filters = {}) {
  const [players, setPlayers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const filtersKey = JSON.stringify(filters)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await playerService.getAll(JSON.parse(filtersKey))
      // Skip dedup when filtering by a specific league — we want those exact rows
      const parsed = JSON.parse(filtersKey)
      const enriched = enrichPlayers(data)
      setPlayers(parsed.league ? enriched : dedupePlayers(enriched))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filtersKey])

  useEffect(() => { fetch() }, [fetch])

  return { players, loading, error, refetch: fetch }
}

export function usePlayer(id) {
  const [player, setPlayer]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    playerService
      .getById(id)
      .then((data) => setPlayer(enrichPlayer(data)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { player, loading, error, refetch: fetch }
}
