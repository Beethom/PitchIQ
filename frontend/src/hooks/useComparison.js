import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { playerService } from '../services/playerService'
import { enrichPlayer } from '../utils/playerMetrics'

function scopeValueForCompetition(competition) {
  return `competition:${competition.id}`
}

function buildScopedPlayer(profile, scope) {
  if (!profile) return null
  if (!scope || scope === 'all') return enrichPlayer(profile)

  const selected = (profile.competitions || []).find(
    (competition) => scopeValueForCompetition(competition) === scope,
  )

  if (!selected) return enrichPlayer(profile)

  const scopedForm = (profile.form || []).filter(
    (item) => item.competition === selected.competition,
  )

  return enrichPlayer({
    ...profile,
    club: selected.club,
    league: selected.competition,
    season: selected.season,
    stats: selected.stats,
    form: scopedForm,
    selected_competition: selected.competition,
  })
}

function buildScopeOptions(profile) {
  if (!profile) return []
  return [
    { value: 'all', label: `All Competitions · ${profile.season}` },
    ...(profile.competitions || []).map((competition) => ({
      value: scopeValueForCompetition(competition),
      label: `${competition.competition} · ${competition.season}`,
    })),
  ]
}

export function useComparison() {
  const [searchParams] = useSearchParams()
  const [profileA, setProfileA] = useState(null)
  const [profileB, setProfileB] = useState(null)
  const [scopeA, setScopeA] = useState('all')
  const [scopeB, setScopeB] = useState('all')
  const [per90, setPer90]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const playerA = useMemo(() => buildScopedPlayer(profileA, scopeA), [profileA, scopeA])
  const playerB = useMemo(() => buildScopedPlayer(profileB, scopeB), [profileB, scopeB])
  const scopeOptionsA = useMemo(() => buildScopeOptions(profileA), [profileA])
  const scopeOptionsB = useMemo(() => buildScopeOptions(profileB), [profileB])

  async function loadPlayerProfile(id, setter, scopeSetter) {
    setLoading(true)
    setError(null)
    try {
      const data = await playerService.getById(id)
      setter(data)
      scopeSetter('all')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectPlayerA = (player) => loadPlayerProfile(player.id, setProfileA, setScopeA)
  const selectPlayerB = (player) => loadPlayerProfile(player.id, setProfileB, setScopeB)
  const clearPlayerA  = () => {
    setProfileA(null)
    setScopeA('all')
  }
  const clearPlayerB  = () => {
    setProfileB(null)
    setScopeB('all')
  }

  useEffect(() => {
    const idA = searchParams.get('playerA')
    const idB = searchParams.get('playerB')
    if (idA && (!profileA || String(profileA.id) !== String(idA))) {
      loadPlayerProfile(idA, setProfileA, setScopeA)
    }
    if (idB && (!profileB || String(profileB.id) !== String(idB))) {
      loadPlayerProfile(idB, setProfileB, setScopeB)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return {
    playerA,
    playerB,
    scopeA,
    scopeB,
    scopeOptionsA,
    scopeOptionsB,
    per90,
    loading,
    error,
    selectPlayerA,
    selectPlayerB,
    clearPlayerA,
    clearPlayerB,
    setScopeA,
    setScopeB,
    togglePer90: () => setPer90((v) => !v),
  }
}
