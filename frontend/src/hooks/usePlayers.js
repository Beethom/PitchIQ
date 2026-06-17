import { useState, useEffect, useCallback } from 'react'
import { playerService } from '../services/playerService'
import { enrichPlayer, enrichPlayers } from '../utils/playerMetrics'
import { dedupePlayers } from '../utils/dedupePlayers'

export function usePlayers(filters = {}) {
  const [players, setPlayers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const filtersKey = JSON.stringify(filters)

  const fetch = useCallback(async (options = {}) => {
    // Quiet (background) refreshes update the data in place without flashing
    // the full-page loader, so the leaderboard auto-updates seamlessly.
    const { quiet = false, ...fetchOptions } = options
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const data = await playerService.getAll(JSON.parse(filtersKey), fetchOptions)
      // Skip dedup when filtering by a specific league — we want those exact rows
      const parsed = JSON.parse(filtersKey)
      const enriched = enrichPlayers(data)
      const next = parsed.league ? enriched : dedupePlayers(enriched)
      setPlayers((prev) => {
        // Only swap (and bump updatedAt) when the data actually changed.
        if (samePlayers(prev, next)) return prev
        setUpdatedAt(new Date())
        return next
      })
    } catch (err) {
      if (!quiet) setError(err.message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [filtersKey])

  useEffect(() => { fetch() }, [fetch])

  return { players, loading, error, updatedAt, refetch: fetch }
}

function playerSignature(p) {
  const s = p.stats ?? {}
  return [
    p.id,
    s.goals ?? 0,
    s.assists ?? 0,
    s.minutesPlayed ?? 0,
    s.appearances ?? 0,
    s.rating ?? 0,
  ].join(':')
}

function samePlayers(a, b) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (playerSignature(a[i]) !== playerSignature(b[i])) return false
  }
  return true
}

export function usePlayer(id) {
  const [player, setPlayer]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback((options = {}) => {
    if (!id) return
    const { quiet = false } = options
    if (!quiet) setLoading(true)
    setError(null)
    playerService
      .getById(id)
      .then((data) => setPlayer(enrichPlayer(data)))
      .catch((err) => { if (!quiet) setError(err.message) })
      .finally(() => { if (!quiet) setLoading(false) })
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  // When the server reports it kicked off a background refresh for this player
  // (e.g. a World Cup player whose tournament data was stale), quietly re-fetch
  // a few seconds later so the view lands on the freshly synced numbers.
  useEffect(() => {
    if (!player?.sync_pending) return undefined
    const timer = setTimeout(() => fetch({ quiet: true }), 6000)
    return () => clearTimeout(timer)
  }, [player?.sync_pending, fetch])

  return { player, loading, error, refetch: fetch }
}
