import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Crosshair,
  Download,
  Gauge,
  GitCompare,
  Globe2,
  Layers3,
  Route,
  Shield,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerAvatar from '../components/player/PlayerAvatar'
import PlayerStatGrid from '../components/player/PlayerStatGrid'
import ShortlistButton from '../components/player/ShortlistButton'
import FormTrendChart from '../components/charts/FormTrendChart'
import ChartCard from '../components/charts/ChartCard'
import ClubLogo from '../components/common/ClubLogo'
import CountryFlag from '../components/common/CountryFlag'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import { usePlayer } from '../hooks/usePlayers'
import { POSITION_COLORS } from '../utils/constants'
import { playerService } from '../services/playerService'
import { enrichPlayer, enrichPlayers, enrichStats } from '../utils/playerMetrics'
import { formatStat } from '../utils/formatStat'
import { toPer90 } from '../utils/per90'
import { benchmarkRole } from '../utils/positionRoles'
import { trackRecentlyViewed } from '../utils/recentlyViewed'
import { savePlayerProfileImage } from '../utils/savePlayerProfileImage'
import { saveMatchCard } from '../utils/saveMatchCard'
import { buildPerformanceCaption } from '../utils/performanceCaption'

// Qualifiers come through labelled "World Cup Qual. <confed>", which reads as
// another World Cup. Show them by confederation instead.
function competitionDisplayName(name) {
  if (!name) return name
  const qual = name.match(/World Cup Qual\.?\s*(.*)/i)
  if (qual) {
    const confed = (qual[1] || '').trim()
    return confed ? `${confed} Qualifiers` : 'Qualifiers'
  }
  return name
}

const STAT_SUM_KEYS = [
  'appearances', 'starts', 'minutesPlayed', 'goals', 'assists', 'shots',
  'shotsOnTarget', 'keyPasses', 'totalPasses', '_accuratePasses', 'touches',
  'accurateCrosses', 'crosses', 'finalThirdPasses', 'throughPasses', 'dribbles',
  'possessionLost', 'dispossessed', 'miscontrols', 'recoveries', 'tackles',
  'successfulTackles', 'fouls', 'interceptions', 'aerialDuelsWon', 'yellowCards',
  'redCards', 'xG', 'xA', 'bigChancesCreated', 'bigChancesMissed', 'missedChances',
  'clearances', 'saves', 'goalsConceded', 'totalShotsFaced', 'punches', 'runOuts',
  'highClaims', 'cleanSheets',
]

function scopeValueForCompetition(competition) {
  const name = competitionDisplayName(competition.competition)
  return `competition:${name}:${competition.season ?? ''}`
}

function scopeValueForOpponent(opponent) {
  return `opponent:${opponent}`
}

// Aggregate a player's per-match stat lines (from match_log) into a single
// totals object so we can scope a performance to "vs a specific team".
function aggregateOpponentStats(profile, matches) {
  const totals = {}
  STAT_SUM_KEYS.forEach((key) => {
    totals[key] = matches.reduce((acc, m) => acc + ((m.stats ?? {})[key] ?? 0), 0)
  })
  totals.appearances = matches.length
  totals.starts = matches.filter((m) => ((m.stats ?? {}).minutesPlayed ?? 0) >= 45).length || matches.length

  let ratingSum = 0
  let ratingCount = 0
  matches.forEach((m) => {
    const r = Number(m.rating ?? (m.stats ?? {}).rating)
    if (Number.isFinite(r) && r > 0) { ratingSum += r; ratingCount += 1 }
  })
  if (ratingCount) totals.rating = Math.round((ratingSum / ratingCount) * 10) / 10

  const passAccuracy = totals._accuratePasses && totals.totalPasses
    ? (totals._accuratePasses / totals.totalPasses) * 100
    : profile.stats?.passAccuracy
  return enrichStats({ ...totals, passAccuracy }, profile.position)
}

function buildScopedPlayer(profile, scope) {
  if (!profile) return null
  if (!scope || scope === 'all') return enrichPlayer(profile)

  if (scope.startsWith('opponent:')) {
    const opponent = scope.slice('opponent:'.length)
    const matches = (profile.match_log || []).filter((m) => m.opponent === opponent)
    if (!matches.length) return enrichPlayer(profile)
    const scopedForm = matches.map((m) => ({
      match: `vs ${opponent}`,
      rating: Number(m.rating ?? (m.stats ?? {}).rating ?? 0) || 0,
      goals: (m.stats ?? {}).goals ?? 0,
      assists: (m.stats ?? {}).assists ?? 0,
      date: m.date || '',
      competition: m.competition || profile.league,
    }))
    return enrichPlayer({
      ...profile,
      league: `vs ${opponent}`,
      stats: aggregateOpponentStats(profile, matches),
      form: scopedForm,
      selected_competition: `vs ${opponent}`,
    })
  }

  const selectedCompetitions = (profile.competitions || []).filter(
    (competition) => scopeValueForCompetition(competition) === scope,
  )
  const selected = selectedCompetitions[0]
  if (!selected) return enrichPlayer(profile)

  const scopedForm = (profile.form || []).filter(
    (item) => selectedCompetitions.some((competition) => item.competition === competition.competition),
  )
  const scopedStats = selectedCompetitions.length > 1
    ? aggregateCompetitionStats(profile, selectedCompetitions, 'All')
    : selected.stats

  return enrichPlayer({
    ...profile,
    club: selected.club ?? profile.club,
    league: selected.competition,
    season: selected.season ?? profile.season,
    stats: scopedStats,
    form: scopedForm,
    selected_competition: selected.competition,
  })
}

function buildScopeOptions(profile) {
  if (!profile) return [{ value: 'all', label: 'All Competitions' }]
  const options = new Map()
  for (const competition of profile.competitions || []) {
    const value = scopeValueForCompetition(competition)
    if (options.has(value)) continue
    options.set(value, {
      value,
      label: competition.season ? `${competitionDisplayName(competition.competition)} · ${competition.season}` : competitionDisplayName(competition.competition),
    })
  }
  // Per-opponent scopes from the match log (most recent opponent first).
  const opponents = new Map()
  for (const m of profile.match_log || []) {
    if (!m.opponent || opponents.has(m.opponent)) continue
    opponents.set(m.opponent, {
      value: scopeValueForOpponent(m.opponent),
      label: `vs ${m.opponent}`,
    })
  }

  return [
    { value: 'all', label: 'All Competitions' },
    ...options.values(),
    ...opponents.values(),
  ]
}

export default function PlayerDetails() {
  const { id }                       = useParams()
  const [searchParams] = useSearchParams()
  const fixtureId = searchParams.get('fixture')
  const navigate = useNavigate()
  const location = useLocation()
  // Go back to wherever the user came from (e.g. a match lineup) when there's
  // in-app history; otherwise fall back to the dashboard.
  const cameFromApp = location.key !== 'default'
  const goBack = () => { if (cameFromApp) navigate(-1); else navigate('/') }
  const backLabel = cameFromApp ? 'Back' : 'Back to Dashboard'
  const { player: rawPlayer, loading, error } = usePlayer(id)
  const [scope, setScope] = useState('all')
  const [fixtureStats, setFixtureStats] = useState(null)
  const [fixtureLoading, setFixtureLoading] = useState(false)
  const [fixtureError, setFixtureError] = useState('')
  const scopeOptions = useMemo(() => buildScopeOptions(rawPlayer), [rawPlayer])
  const scopedPlayer = useMemo(() => buildScopedPlayer(rawPlayer, scope), [rawPlayer, scope])
  const player = useMemo(() => {
    if (!scopedPlayer || !fixtureStats) return scopedPlayer
    const stats = fixtureStats.stats ?? {}
    const rating = Number(stats.rating ?? fixtureStats.rating ?? 0)
    return enrichPlayer({
      ...scopedPlayer,
      league: fixtureStats.competition || scopedPlayer.league,
      season: fixtureStats.fixture_date || scopedPlayer.season,
      stats,
      form: [{
        match: fixtureStats.opponent ? `vs ${fixtureStats.opponent}` : 'This match',
        rating: Number.isFinite(rating) ? rating : 0,
        goals: stats.goals ?? 0,
        assists: stats.assists ?? 0,
        date: fixtureStats.fixture_date || '',
        competition: fixtureStats.competition || scopedPlayer.league,
      }],
      selected_competition: 'Match Stats',
    })
  }, [scopedPlayer, fixtureStats])

  // Default the competition filter to the tournament the user navigated in
  // through (the route id matches one competition row), so the profile shows
  // that tournament's stats instead of the combined "All Competitions" totals.
  // Only set the default once per player so a background re-fetch (or the user
  // changing the dropdown) doesn't clobber the current selection.
  const scopeDefaultedFor = useRef(null)
  useEffect(() => {
    if (fixtureId) return
    if (!rawPlayer) return
    if (scopeDefaultedFor.current === id) return
    scopeDefaultedFor.current = id
    const match = (rawPlayer.competitions || []).find(
      (competition) => String(competition.id) === String(id),
    )
    setScope(match ? scopeValueForCompetition(match) : 'all')
  }, [fixtureId, id, rawPlayer])

  useEffect(() => {
    if (!fixtureId) {
      setFixtureStats(null)
      setFixtureError('')
      setFixtureLoading(false)
      return undefined
    }

    let active = true
    setFixtureLoading(true)
    setFixtureError('')
    playerService.getFixtureStats(id, fixtureId)
      .then((data) => {
        if (active) setFixtureStats(data)
      })
      .catch((err) => {
        if (active) {
          setFixtureStats(null)
          setFixtureError(err?.response?.data?.detail || err?.message || 'Match stats are not available yet.')
        }
      })
      .finally(() => {
        if (active) setFixtureLoading(false)
      })

    return () => {
      active = false
    }
  }, [fixtureId, id])
  const [savingImage, setSavingImage] = useState(false)
  const [imageSaveError, setImageSaveError] = useState('')
  const [stickyVisible, setStickyVisible] = useState(false)
  const heroRef = useRef(null)

  useEffect(() => {
    if (player) trackRecentlyViewed(player)
  }, [player])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [player])

  if (loading) return <PageContainer><Loader /></PageContainer>
  if (error)   return <PageContainer><ErrorMessage message={error} /></PageContainer>
  if (!player) return null

  const avgRating = player.stats.rating != null
    ? Number(player.stats.rating).toFixed(1)
    : (player.form.reduce((s, f) => s + f.rating, 0) / Math.max(player.form.length, 1)).toFixed(1)
  const competitions = player.competitions ?? []
  const displayLeague = !fixtureId && player.league === 'All Competitions'
    ? player.primary_league || player.league
    : player.league
  const hasEstimatedForm = (player.form ?? []).some((item) => item.estimated)
  const hasExactForm = (player.form ?? []).length >= 5 && !hasEstimatedForm

  async function handleSaveImage() {
    setSavingImage(true)
    setImageSaveError('')
    try {
      await savePlayerProfileImage(player)
    } catch (err) {
      setImageSaveError(err?.message || 'Could not save profile image')
    } finally {
      setSavingImage(false)
    }
  }

  // The match card uses real per-match positional data, which only exists for a
  // single fixture view.
  const isMatchScope = Boolean(fixtureId) && Boolean(fixtureStats)
  async function handleSaveMatchCard() {
    setSavingImage(true)
    setImageSaveError('')
    try {
      await saveMatchCard(player, {
        opponent: fixtureStats?.opponent,
        competition: fixtureStats?.competition || player.league,
        date: fixtureStats?.fixture_date,
        heatmap: fixtureStats?.heatmap || [],
        shots: fixtureStats?.shots || [],
        incidents: fixtureStats?.match_incidents || [],
        isMotm: fixtureStats?.is_motm || false,
        playerSourceId: fixtureStats?.source_player_id,
        event: fixtureStats?.event_meta || {},
      })
    } catch (err) {
      setImageSaveError(err?.message || 'Could not save match card')
    } finally {
      setSavingImage(false)
    }
  }

  return (
    <div className="flex-1 min-w-0">
      {/* Sticky compact header */}
      <motion.div
        initial={false}
        animate={{ opacity: stickyVisible ? 1 : 0, y: stickyVisible ? 0 : -8 }}
        transition={{ duration: 0.18 }}
        className="sticky top-16 z-40 pointer-events-none"
        style={{ pointerEvents: stickyVisible ? 'auto' : 'none' }}
      >
        <div className="border-b border-slate-200/80 bg-white/90 px-4 py-2.5 backdrop-blur-xl shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <button type="button" onClick={goBack} className="text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <PlayerAvatar player={player} size="sm" />
            <span className="font-black text-slate-950 text-sm">{player.name}</span>
            <span className={`badge text-xs ${POSITION_COLORS[player.position] ?? 'bg-slate-100 text-slate-600'}`}>{player.position}</span>
            <span className="text-slate-400 text-xs hidden sm:inline">{player.club}</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-slate-400 text-xs hidden sm:inline">{competitionDisplayName(displayLeague)}</span>
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500 font-semibold">
              {player.position === 'GK' ? (
                <>
                  <span>{player.stats.saves ?? '—'} saves</span>
                  <span className="hidden sm:inline">{player.stats.goalsConceded ?? '—'} conceded</span>
                </>
              ) : ['CB', 'LB', 'RB'].includes(player.position) ? (
                <>
                  <span>{player.stats.recoveries ?? '—'} rec</span>
                  <span className="hidden sm:inline">{player.stats.interceptions ?? '—'} int</span>
                  <span className="hidden sm:inline">{player.stats.clearances ?? '—'} clr</span>
                </>
              ) : (
                <>
                  <span>{player.stats.goals ?? 0}G</span>
                  <span>{player.stats.assists ?? 0}A</span>
                </>
              )}
              <span className="hidden sm:inline">{player.stats.appearances ?? 0} apps</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gradient header */}
      <motion.div
        ref={heroRef}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 text-white px-4 sm:px-6 lg:px-8 py-8"
      >
        <div className="max-w-7xl mx-auto">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-5 transition-colors"
          >
            <ArrowLeft size={15} /> {backLabel}
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <PlayerAvatar player={player} size="xl" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Name + position badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">{player.name}</h1>
                <span
                  className={`badge ${
                    POSITION_COLORS[player.position] ?? 'bg-white/20 text-white'
                  }`}
                >
                  {player.position}
                </span>
              </div>

              {/* Nationality + flag */}
              <div className="flex items-center gap-2 mt-2">
                <CountryFlag
                  code={player.flag_code}
                  nationality={player.nationality}
                  size="md"
                />
                <span className="text-sky-100/90 text-sm">{player.nationality}</span>
                <span className="text-white/30">·</span>
                <span className="text-sky-100/90 text-sm">Age {player.age}</span>
                <span className="text-white/30">·</span>
                <span className="text-sky-100/90 text-sm">{player.season}</span>
              </div>

              {/* Club + logo */}
              <div className="flex items-center gap-2 mt-2">
                <div className="p-1 bg-white/10 rounded-lg">
                  <ClubLogo url={player.club_logo_url} club={player.club} size="md" />
                </div>
                <div>
                  <p className="font-semibold text-white">{player.club}</p>
                  <p className="text-xs text-white/60">{competitionDisplayName(displayLeague)}</p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!fixtureId && scopeOptions.length > 1 && (
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  aria-label="Filter by competition"
                  className="rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-slate-900"
                >
                  {scopeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleSaveImage}
                disabled={savingImage}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm backdrop-blur disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={14} /> {savingImage ? 'Saving...' : 'Save scout card'}
              </button>
              {isMatchScope && (
                <button
                  type="button"
                  onClick={handleSaveMatchCard}
                  disabled={savingImage}
                  className="flex items-center gap-2 bg-white text-slate-900 hover:bg-white/90 font-bold px-4 py-2 rounded-xl transition-colors text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={14} /> Match card
                </button>
              )}
              <Link
                to="/compare"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm backdrop-blur"
              >
                <GitCompare size={14} /> Compare
              </Link>
              <ShortlistButton player={player} />
            </div>
          </div>

          {imageSaveError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {imageSaveError}
            </p>
          )}

          {/* Quick stats bar */}
          {(!fixtureId || fixtureStats) && (
            <div className="grid grid-cols-3 sm:grid-cols-8 gap-4 mt-7 pt-6 border-t border-white/20">
              {(player.position === 'GK' ? [
              { label: 'Scope',       value: player.league },
              { label: 'Apps',        value: player.stats.appearances },
              { label: 'Saves',       value: player.stats.saves ?? '—' },
              { label: 'Shots Faced', value: player.stats.totalShotsFaced ?? '—' },
              { label: 'Save %',      value: player.stats.totalShotsFaced
                  ? `${Math.round(((player.stats.saves ?? 0) / player.stats.totalShotsFaced) * 100)}%`
                  : '—' },
              { label: 'Conceded',    value: player.stats.goalsConceded ?? '—' },
              { label: 'Pass Acc.',   value: player.stats.passAccuracy != null
                  ? `${player.stats.passAccuracy.toFixed(1)}%`
                  : '—' },
              { label: 'Avg Rating',  value: avgRating },
            ] : ['CB', 'LB', 'RB'].includes(player.position) ? [
              { label: 'Scope',         value: player.league },
              { label: 'Apps',          value: player.stats.appearances },
              { label: 'Recoveries',    value: player.stats.recoveries ?? '—' },
              { label: 'Interceptions', value: player.stats.interceptions ?? '—' },
              { label: 'Clearances',    value: player.stats.clearances ?? '—' },
              { label: 'Aerial Won',    value: player.stats.aerialDuelsWon ?? '—' },
              { label: 'Pass Acc.',     value: player.stats.passAccuracy != null
                  ? `${player.stats.passAccuracy.toFixed(1)}%`
                  : '—' },
              { label: 'Avg Rating',    value: avgRating },
            ] : [
              { label: 'Scope',       value: player.league },
              { label: 'Apps',        value: player.stats.appearances },
              { label: 'Goals',       value: player.stats.goals },
              { label: 'Assists',     value: player.stats.assists },
              { label: 'G+A',         value: player.stats.goalContributions },
              { label: 'xG',          value: (player.stats.xG ?? 0).toFixed(2) },
              { label: 'xA',          value: (player.stats.xA ?? 0).toFixed(2) },
              { label: 'Avg Rating',  value: avgRating },
            ]).map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/60 mt-0.5 uppercase tracking-wider">{label}</p>
              </div>
              ))}
            </div>
          )}

        </div>
      </motion.div>

      <PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-8"
        >
          <SharePerformance player={player} />

          {!fixtureId && (
            <>
              <ChartCard title="Recent Form" subtitle="Match rating over last 5 appearances">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {hasExactForm ? 'Exact last-five form synced' : hasEstimatedForm ? 'Estimated form is showing' : 'Recent form needs sync'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {player.last_synced_at ? `Last synced ${new Date(player.last_synced_at).toLocaleString()}` : 'No exact form sync recorded yet'}
                    </p>
                  </div>
                </div>
                <FormTrendChart player={player} />
              </ChartCard>

              <CompetitionOverview player={player} competitions={competitions} />

              <PlayerReportCard player={player} competitions={competitions} />

              {/* Competition breakdown */}
              <div>
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-900">Competition Rows</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Domestic, European, and international rows stay separate underneath the combined profile.
                  </p>
                </div>
                <CompetitionBreakdown competitions={competitions} />
              </div>

              <PlayerMatchLog matches={player.match_log ?? []} />
            </>
          )}

          {/* Detailed totals */}
          <div>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                {fixtureId && fixtureStats?.opponent
                  ? `${player.name} vs ${fixtureStats.opponent}`
                  : fixtureId
                    ? `${player.name} Match Stats`
                    : 'All Competitions Total'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {fixtureId
                  ? fixtureStats?.opponent
                    ? 'Stats from this match only.'
                    : 'Only this fixture.'
                  : 'Combined stats across every tournament — the number that matters for transfer comparisons'}
              </p>
            </div>
            {fixtureLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-500 shadow-sm">
                Loading match stats...
              </div>
            ) : fixtureError ? (
              <ErrorMessage message={fixtureError} />
            ) : (
              <PlayerStatGrid stats={player.stats} position={player.position} />
            )}
          </div>

        </motion.div>
      </PageContainer>
    </div>
  )
}

function playerGroup(player) {
  const league = player?.league ?? ''
  if (league === 'MLS') return 'mls'
  if (competitionGroup(league).label === 'Europe') return 'europe'
  if (competitionGroup(league).label === 'International') return 'national'
  return 'leagues'
}

function aggregateCompetitionStats(player, competitions, scope) {
  if (!competitions.length) return player.stats ?? {}

  const relevant = scope === 'All'
    ? competitions
    : competitions.filter((comp) => competitionGroup(comp.competition).label === scope)
  if (!relevant.length) return null

  const sumKeys = STAT_SUM_KEYS

  const totals = {}
  sumKeys.forEach((key) => {
    totals[key] = relevant.reduce((acc, comp) => acc + ((comp.stats ?? {})[key] ?? 0), 0)
  })

  // Weighted average only over competitions that actually have the stat
  const weightedAverage = (key) => {
    const eligible = relevant.filter((comp) => (comp.stats ?? {})[key] != null)
    if (!eligible.length) return null
    const totalMinutes = eligible.reduce((acc, comp) => acc + ((comp.stats ?? {}).minutesPlayed ?? 0), 0)
    if (!totalMinutes) return null
    const weighted = eligible.reduce((acc, comp) => {
      const stats = comp.stats ?? {}
      return acc + ((stats[key] ?? 0) * (stats.minutesPlayed ?? 0))
    }, 0)
    return weighted / totalMinutes
  }

  // Recompute percentage stats from raw totals when possible
  const passAccuracy = totals._accuratePasses && totals.totalPasses
    ? (totals._accuratePasses / totals.totalPasses) * 100
    : weightedAverage('passAccuracy')
  const dribbleSuccess = weightedAverage('dribbleSuccess')

  return enrichStats({
    ...totals,
    passAccuracy: passAccuracy == null ? player.stats?.passAccuracy : passAccuracy,
    dribbleSuccess: dribbleSuccess == null ? player.stats?.dribbleSuccess : dribbleSuccess,
  }, player.position)
}

function availableReportScopes(competitions) {
  const scopes = new Set(['All'])
  competitions.forEach((comp) => scopes.add(competitionGroup(comp.competition).label))
  return ['All', 'Domestic', 'Europe', 'International'].filter((scope) => scopes.has(scope))
}

function percentileFor(value, values) {
  const clean = values.filter((item) => Number.isFinite(item)).sort((a, b) => a - b)
  if (!Number.isFinite(value) || clean.length < 8) return null
  const below = clean.filter((item) => item < value).length
  const equal = clean.filter((item) => item === value).length
  const percentile = Math.round(((below + equal / 2) / clean.length) * 100)
  return Math.max(1, Math.min(99, percentile))
}

function metricValue(stats, key) {
  switch (key) {
    case 'goalsP90':
      return toPer90(stats.goals ?? 0, stats.minutesPlayed)
    case 'assistsP90':
      return toPer90(stats.assists ?? 0, stats.minutesPlayed)
    case 'shotsP90':
      return toPer90(stats.shots ?? 0, stats.minutesPlayed)
    case 'chancesP90':
      return toPer90(stats.chancesCreated ?? stats.keyPasses ?? 0, stats.minutesPlayed)
    case 'dribblesP90':
      return toPer90(stats.dribbles ?? 0, stats.minutesPlayed)
    case 'progressivePassesP90':
      return toPer90(stats.progressivePasses ?? 0, stats.minutesPlayed)
    case 'tacklesP90':
      return toPer90(stats.tackles ?? 0, stats.minutesPlayed)
    case 'interceptionsP90':
      return toPer90(stats.interceptions ?? 0, stats.minutesPlayed)
    case 'aerialP90':
      return toPer90(stats.aerialDuelsWon ?? 0, stats.minutesPlayed)
    case 'recoveriesP90':
      return toPer90(stats.recoveries ?? 0, stats.minutesPlayed)
    case 'possessionLostP90':
      return toPer90(stats.possessionLost ?? 0, stats.minutesPlayed)
    case 'possessionLostPerMatch':
      return stats.possessionLostPerMatch
    case 'touchesPerMatch':
      return stats.touchesPerMatch
    case 'ga':
      return (stats.goals ?? 0) + (stats.assists ?? 0)
    case 'savesP90':
      return toPer90(stats.saves ?? 0, stats.minutesPlayed)
    case 'savesPct': {
      const faced = stats.totalShotsFaced ?? 0
      return faced > 0 ? ((stats.saves ?? 0) / faced) * 100 : null
    }
    case 'goalsConcededP90':
      return toPer90(stats.goalsConceded ?? 0, stats.minutesPlayed)
    default:
      return stats[key]
  }
}

function hasExactDefensiveData(stats = {}) {
  return (
    (stats.recoveries ?? 0)
    + (stats.successfulTackles ?? 0)
    + (stats.fouls ?? 0)
  ) > 0
}

function isComparableMetricValue(stats = {}, metric, value) {
  if (!Number.isFinite(value)) return false
  const minutes = stats.minutesPlayed ?? 0
  if (metric.rate && minutes <= 0) return false

  switch (metric.key) {
    case 'shotConversion':
      return (stats.shots ?? 0) >= 8
    case 'passAccuracy':
      return (stats.totalPasses ?? 0) >= 80
    case 'dribbleSuccess':
      return (stats.dribblesAttempted ?? stats._totalDribbles ?? stats.dribbles ?? 0) >= 8
    case 'recoveriesP90':
      return (stats.recoveries ?? 0) > 0 || hasExactDefensiveData(stats)
    case 'defensiveWorkrate':
      return minutes > 0
    case 'savesP90':
      return (stats.totalShotsFaced ?? 0) >= 10
    case 'savesPct':
      return (stats.totalShotsFaced ?? 0) >= 10
    case 'goalsConcededP90':
      return (stats.totalShotsFaced ?? 0) >= 10
    default:
      return true
  }
}

function percentileForMetric(metric, stats, peers) {
  const value = metricValue(stats, metric.key)
  if (!isComparableMetricValue(stats, metric, value)) {
    return { value, percentile: null, peerCount: 0 }
  }

  const peerValues = peers
    .map((peer) => {
      const peerStats = peer.stats ?? {}
      const peerValue = metricValue(peerStats, metric.key)
      if (metric.key === 'recoveriesP90') {
        return Number.isFinite(peerValue) && (peerStats.minutesPlayed ?? 0) > 0 ? peerValue : null
      }
      return isComparableMetricValue(peerStats, metric, peerValue) ? peerValue : null
    })
    .filter((item) => Number.isFinite(item))

  const percentile = metric.lowerBetter
    ? percentileFor(-value, peerValues.map((item) => -item))
    : percentileFor(value, peerValues)

  const comparable = metric.lowerBetter
    ? peerValues.map((item) => -item)
    : peerValues
  const comparableValue = metric.lowerBetter ? -value : value
  const better = comparable.filter((item) => item > comparableValue).length
  const rank = percentile == null ? null : better + 1

  return { value, percentile, peerCount: peerValues.length, rank }
}

function metricFormat(metric, value) {
  if (!Number.isFinite(value)) return '0'
  if (metric.type === 'pct') return `${Math.round(value)}%`
  if (metric.type === 'rating') return value.toFixed(2)
  if (metric.rate) return value.toFixed(2)
  if (value < 10 && !Number.isInteger(value)) return value.toFixed(2)
  return Math.round(value).toLocaleString()
}

function positionFamily(position) {
  if (position === 'GK') return 'Goalkeepers'
  if (['CB', 'LB', 'RB'].includes(position)) return 'Defenders'
  if (['CDM', 'CM', 'CAM'].includes(position)) return 'Midfielders'
  return 'Attackers'
}

const REPORT_METRICS = {
  Goalkeepers: [
    { key: 'savesP90', label: 'Saves per90', rate: true },
    { key: 'savesPct', label: 'Save %', type: 'pct' },
    { key: 'goalsConcededP90', label: 'Goals Conceded per90', rate: true, lowerBetter: true },
    { key: 'interceptionsP90', label: 'Sweeper Actions per90', rate: true },
    { key: 'passAccuracy', label: 'Pass Accuracy', type: 'pct' },
  ],
  Defenders: [
    { key: 'defensiveWorkrate', label: 'Defensive Work', type: 'pct' },
    { key: 'tacklesP90', label: 'Tackles per90', rate: true },
    { key: 'interceptionsP90', label: 'Interceptions per90', rate: true },
    { key: 'passAccuracy', label: 'Pass Accuracy', type: 'pct' },
    { key: 'progressivePassesP90', label: 'Progressive Passes per90', rate: true },
  ],
  Midfielders: [
    { key: 'chancesP90', label: 'Chances Created per90', rate: true },
    { key: 'progressivePassesP90', label: 'Progressive Passes per90', rate: true },
    { key: 'assistsP90', label: 'Assists per90', rate: true },
    { key: 'passAccuracy', label: 'Pass Accuracy', type: 'pct' },
    { key: 'defensiveWorkrate', label: 'Defensive Work', type: 'pct' },
  ],
  Attackers: [
    { key: 'ga', label: 'Goal Contributions', noRanking: true },
    { key: 'goalsP90', label: 'Goals per90', rate: true },
    { key: 'assistsP90', label: 'Assists per90', rate: true },
    { key: 'shotsP90', label: 'Shots per90', rate: true },
    { key: 'chancesP90', label: 'Chances Created per90', rate: true },
    { key: 'dribblesP90', label: 'Dribbles per90', rate: true },
    { key: 'shotConversion', label: 'Shot Conversion', type: 'pct' },
  ],
}

const REPORT_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart3,
    title: 'Measured Snapshot',
    note: 'Peer context built from measurable production, involvement, and per-90 output.',
    metrics: [
      { key: 'ga', label: 'Goal Contributions', noRanking: true },
      { key: 'goalsP90', label: 'Goals per90', rate: true },
      { key: 'assistsP90', label: 'Assists per90', rate: true },
      { key: 'chancesP90', label: 'Chances per90', rate: true },
      { key: 'dribblesP90', label: 'Dribbles per90', rate: true },
      { key: 'defensiveWorkrate', label: 'Defensive Work', type: 'pct' },
    ],
  },
  {
    id: 'shooting',
    label: 'Shooting',
    icon: Crosshair,
    title: 'Shooting Report',
    note: 'Shot map and goalpost placement need event coordinates. This view uses volume, efficiency, and xG aggregates.',
    metrics: [
      { key: 'goals', label: 'Goals', noRanking: true },
      { key: 'shots', label: 'Shots', noRanking: true },
      { key: 'shotsP90', label: 'Shots per90', rate: true },
      { key: 'xG', label: 'xG', noRanking: true },
      { key: 'shotConversion', label: 'Shot Conversion', type: 'pct' },
      { key: 'goalsP90', label: 'Goals per90', rate: true },
    ],
  },
  {
    id: 'creation',
    label: 'Creation',
    icon: Sparkles,
    title: 'Chance Creation',
    note: 'Passing maps need event locations. This view focuses on chance volume, assists, xA, and progressive passing.',
    metrics: [
      { key: 'assists', label: 'Assists', noRanking: true },
      { key: 'xA', label: 'xA', noRanking: true },
      { key: 'chancesP90', label: 'Chances per90', rate: true },
      { key: 'keyPasses', label: 'Key Passes', noRanking: true },
      { key: 'finalThirdPasses', label: 'Final-third Passes', noRanking: true },
      { key: 'throughPasses', label: 'Through Passes', noRanking: true },
      { key: 'crosses', label: 'Crosses', noRanking: true },
      { key: 'progressivePassesP90', label: 'Progressive Passes per90', rate: true },
      { key: 'passAccuracy', label: 'Pass Accuracy', type: 'pct' },
    ],
  },
  {
    id: 'carrying',
    label: 'Carrying',
    icon: Route,
    title: 'Ball Carrying',
    note: 'Carry maps need event start/end points. This view uses dribble output, progression estimate, and ball security.',
    metrics: [
      { key: 'dribbles', label: 'Successful Dribbles', noRanking: true },
      { key: 'dribblesP90', label: 'Dribbles per90', rate: true },
      { key: 'dribbleSuccess', label: 'Dribble Success', type: 'pct' },
      { key: 'progressivePassesP90', label: 'Progression per90', rate: true },
      { key: 'possessionLostP90', label: 'Possession Lost per90', rate: true, lowerBetter: true },
      { key: 'possessionLostPerMatch', label: 'Poss. Lost per Match', rate: true, lowerBetter: true },
      { key: 'touchesPerMatch', label: 'Touches per Match', rate: true },
      { key: 'possessionLost', label: 'Possession Lost', lowerBetter: true, noRanking: true },
    ],
  },
  {
    id: 'defending',
    label: 'Defending',
    icon: Shield,
    title: 'Defensive Activity',
    note: 'Defensive workrate is a custom 0-100 blend of defensive actions per90 with a position adjustment.',
    metrics: [
      { key: 'defensiveWorkrate', label: 'Defensive Work', type: 'pct' },
      { key: 'tacklesP90', label: 'Tackles per90', rate: true },
      { key: 'interceptionsP90', label: 'Interceptions per90', rate: true },
      { key: 'aerialP90', label: 'Aerial Wins per90', rate: true },
      { key: 'recoveriesP90', label: 'Recoveries per90', rate: true },
      { key: 'possessionLostP90', label: 'Possession Lost per90', rate: true, lowerBetter: true },
    ],
  },
  {
    id: 'pressure',
    label: 'Under Pressure',
    icon: Gauge,
    title: 'Pressure Proxy',
    note: 'True under-pressure actions need event tags. This proxy combines ball security, dribbling, passing, and defensive work.',
    metrics: [
      { key: 'passAccuracy', label: 'Pass Accuracy', type: 'pct' },
      { key: 'dribblesP90', label: 'Escape Dribbles per90', rate: true },
      { key: 'possessionLostP90', label: 'Possession Lost per90', rate: true, lowerBetter: true },
      { key: 'defensiveWorkrate', label: 'Counter-Pressure Proxy', type: 'pct' },
      { key: 'progressivePassesP90', label: 'Progression per90', rate: true },
      { key: 'chancesP90', label: 'Chance Creation per90', rate: true },
    ],
  },
]

function barTone(percentile) {
  if (percentile == null) return 'bg-slate-400'
  if (percentile >= 80) return 'bg-emerald-600'
  if (percentile >= 60) return 'bg-lime-600'
  if (percentile >= 40) return 'bg-amber-500'
  return 'bg-orange-500'
}

function SharePerformance({ player }) {
  const [copied, setCopied] = useState(false)
  const caption = useMemo(() => buildPerformanceCaption(player), [player])

  if (!caption.lines.length) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-black text-slate-950">Share Performance</h2>
          <p className="mt-0.5 text-sm text-slate-500">Ready-to-post highlight summary for this scope.</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
            copied ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white hover:bg-slate-800'
          }`}
        >
          {copied ? 'Copied!' : 'Copy caption'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap px-5 py-4 font-sans text-[15px] leading-7 text-slate-800">
        <span className="font-black text-slate-950">{caption.header}</span>
        {'\n\n'}
        {caption.lines.join('\n')}
        {caption.verdict ? `\n\n${caption.verdict}` : ''}
      </pre>
    </section>
  )
}

function PlayerReportCard({ player, competitions }) {
  const scopes = useMemo(() => availableReportScopes(competitions), [competitions])
  const [scope, setScope] = useState(scopes[0] ?? 'All')
  const [activeTab, setActiveTab] = useState('overview')
  const [peers, setPeers] = useState([])
  const [loadingPeers, setLoadingPeers] = useState(false)

  useEffect(() => {
    if (!scopes.includes(scope)) setScope(scopes[0] ?? 'All')
  }, [scope, scopes])

  useEffect(() => {
    let active = true
    setLoadingPeers(true)
    playerService
      .getAll({ group: playerGroup(player), season: player.season, limit: 2000 })
      .then((data) => {
        if (active) setPeers(enrichPlayers(data))
      })
      .catch(() => {
        if (active) setPeers([])
      })
      .finally(() => {
        if (active) setLoadingPeers(false)
      })
    return () => { active = false }
  }, [player])

  const reportStats = useMemo(
    () => aggregateCompetitionStats(player, competitions, scope),
    [player, competitions, scope],
  )

  if (!reportStats) return null

  const family = positionFamily(player.position)
  const metrics = REPORT_METRICS[family] ?? REPORT_METRICS.Attackers
  const role = benchmarkRole(player.position)
  const peerPool = peers.filter((peer) => (
    benchmarkRole(peer.position) === role
    && (peer.stats?.minutesPlayed ?? 0) >= 450
  ))

  const rows = metrics.map((metric) => {
    const { value, percentile, peerCount, rank } = percentileForMetric(metric, reportStats, peerPool)
    return {
      ...metric,
      value,
      percentile,
      peerCount,
      rank,
    }
  })

  const headline = rows
    .filter((row) => row.percentile != null)
    .sort((a, b) => b.percentile - a.percentile)[0]

  const tab = REPORT_TABS.find((item) => item.id === activeTab) ?? REPORT_TABS[0]
  const tabRows = tab.metrics.map((metric) => {
    const { value, percentile, peerCount, rank } = percentileForMetric(metric, reportStats, peerPool)
    return {
      ...metric,
      value,
      percentile,
      peerCount,
      rank,
    }
  })
  const displayLeague = player.league === 'All Competitions'
    ? player.primary_league || player.league
    : player.league

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Player Report
              </p>
              <h2 className="text-2xl font-black leading-tight text-slate-950">
                {player.name}
              </h2>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {player.club} · {competitionDisplayName(displayLeague)} · {player.season} · benchmarked vs {role}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {scopes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setScope(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                scope === item
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {REPORT_TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activeTab === item.id
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Icon size={14} />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.25fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Standout
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {headline?.percentile ?? '--'}
                <span className="text-base font-semibold text-slate-400"> percentile</span>
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                vs {role}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {headline?.label ?? 'Peer context loading'}
              </p>
            </div>
            <Activity className="mt-1 text-emerald-600" size={24} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <ReportMiniStat label="Apps" value={reportStats.appearances ?? 0} />
            <ReportMiniStat label="Minutes" value={(reportStats.minutesPlayed ?? 0).toLocaleString()} />
            <ReportMiniStat label="Goals" value={reportStats.goals ?? 0} />
            <ReportMiniStat label="Assists" value={reportStats.assists ?? 0} />
          </div>

        </div>

        <ReportTabPanel
          tab={tab}
          rows={activeTab === 'overview' ? rows : tabRows}
          stats={reportStats}
          loading={loadingPeers}
          role={role}
          peerPool={peerPool}
          currentPlayer={player}
        />
      </div>

    </section>
  )
}

function ReportTabPanel({ tab, rows, stats, loading, role, onOpenPeers }) {
  const Icon = tab.icon

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-950">{tab.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{tab.note}</p>
          </div>
        </div>

        <ReportVisual tabId={tab.id} stats={stats} />
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <PercentileRow key={row.key} row={row} loading={loading} role={role} onOpenPeers={onOpenPeers} />
        ))}
      </div>
    </div>
  )
}

function ReportVisual({ tabId, stats }) {
  if (tabId === 'shooting') {
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        <VisualStat label="Shots" value={stats.shots ?? 0} />
        <VisualStat label="On Target" value={stats.shotsOnTarget ?? 0} />
        <VisualStat label="Conversion" value={`${Math.round(stats.shotConversion ?? 0)}%`} />
      </div>
    )
  }

  if (tabId === 'creation') {
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        <VisualStat label="Key Passes" value={stats.keyPasses ?? 0} />
        <VisualStat label="Chances" value={stats.chancesCreated ?? 0} />
        <VisualStat label="xA" value={(stats.xA ?? 0).toFixed(2)} />
      </div>
    )
  }

  if (tabId === 'carrying') {
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        <VisualStat label="Dribbles" value={stats.dribbles ?? 0} />
        <VisualStat label="Prog. Passes" value={stats.progressivePasses ?? 0} />
        <VisualStat label="Lost" value={stats.possessionLost ?? 0} />
      </div>
    )
  }

  if (tabId === 'defending' || tabId === 'pressure') {
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        <VisualStat label="Tackles" value={stats.tackles ?? 0} />
        <VisualStat label="Interceptions" value={stats.interceptions ?? 0} />
        <VisualStat label="Workrate" value={`${Math.round(stats.defensiveWorkrate ?? 0)}/100`} />
      </div>
    )
  }

  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      <VisualStat label="Apps" value={stats.appearances ?? 0} />
      <VisualStat label="G+A" value={stats.goalContributions ?? 0} />
      <VisualStat label="Minutes" value={(stats.minutesPlayed ?? 0).toLocaleString()} />
    </div>
  )
}

function VisualStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 text-center shadow-sm">
      <p className="text-lg font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  )
}

function ReportMiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3">
      <p className="text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  )
}

function PercentileRow({ row, loading, role, onOpenPeers }) {
  const percentile = row.percentile
  const width = percentile == null ? 0 : percentile
  const canOpen = row.rank != null && onOpenPeers && !row.noRanking

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{row.label}: {metricFormat(row, row.value)}</p>
        <div className="text-right">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black text-white ${barTone(percentile)}`}>
            {loading && percentile == null ? '...' : percentile ?? '--'}
          </span>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            vs {role}
          </p>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barTone(percentile)}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function PeerRankingModal({ row, peerPool, currentPlayer, currentValue, role, onClose }) {
  const ranked = useMemo(() => {
    const peers = peerPool
      .filter((peer) => peer.id !== currentPlayer.id)
      .map((peer) => {
        const peerStats = peer.stats ?? {}
        const value = metricValue(peerStats, row.key)
        if (!Number.isFinite(value)) return null
        if (!isComparableMetricValue(peerStats, row, value)) return null
        return { peer, value }
      })
      .filter(Boolean)

    // Inject current player using their full-season stats (same basis as peers)
    const currentStats = currentPlayer.stats ?? {}
    const currentFullValue = metricValue(currentStats, row.key)
    if (Number.isFinite(currentFullValue) && isComparableMetricValue(currentStats, row, currentFullValue)) {
      peers.push({ peer: currentPlayer, value: currentFullValue, isCurrent: true })
    }

    peers.sort((a, b) => row.lowerBetter ? a.value - b.value : b.value - a.value)
    return peers
  }, [peerPool, row, currentPlayer, currentValue])

  const currentRank = ranked.findIndex((r) => r.peer.id === currentPlayer.id) + 1

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={handleBackdrop}
    >
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">{role} ranking</p>
            <h3 className="text-base font-black text-slate-950">{row.label}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto">
          {ranked.map(({ peer, value, isCurrent }, idx) => {
            const rank = idx + 1
            return (
              <div
                key={peer.id}
                className={`flex items-center gap-3 border-b border-slate-50 px-5 py-3 ${isCurrent ? 'bg-emerald-50' : ''}`}
              >
                <span className={`w-7 shrink-0 text-right text-sm font-black ${isCurrent ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-emerald-700' : 'text-slate-800'}`}>
                    {peer.name}
                    {isCurrent && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">you</span>}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{peer.club}</p>
                </div>
                <span className={`shrink-0 text-sm font-black ${isCurrent ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {metricFormat(row, value)}
                </span>
              </div>
            )
          })}
          {ranked.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No peer data available</p>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-center text-xs text-slate-400">
            {currentRank > 0 ? `${currentPlayer.name} ranks #${currentRank} of ${ranked.length} ${role}s` : `${ranked.length} ${role}s compared`}
            {' · '}full season stats
          </p>
        </div>
      </div>
    </div>
  )
}

function competitionGroup(competition = '') {
  if (competition.includes('UEFA Champions') || competition.includes('UEFA Europa') || competition.includes('UEFA Conference')) {
    return { label: 'Europe', icon: Trophy, tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  }
  if (
    competition.includes('World Cup')
    || competition.includes('Nations League')
    || competition.includes('Gold Cup')
    || competition.includes('Copa América')
    || competition.includes('Friendl')
    || competition.includes('CONCACAF')
    || competition.includes('Copa America')
  ) {
    return { label: 'International', icon: Globe2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  }
  return { label: 'Domestic', icon: Layers3, tone: 'bg-sky-50 text-sky-700 border-sky-200' }
}

function sortedCompetitions(competitions = []) {
  const rank = { Domestic: 0, Europe: 1, International: 2 }
  return [...competitions].sort((a, b) => {
    const aGroup = competitionGroup(a.competition).label
    const bGroup = competitionGroup(b.competition).label
    return (rank[aGroup] ?? 9) - (rank[bGroup] ?? 9)
      || a.competition.localeCompare(b.competition)
  })
}

function CompetitionOverview({ player, competitions }) {
  if (!competitions.length) return null

  const ordered = sortedCompetitions(competitions)
  const stats = player.stats ?? {}

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Same Player Across Competitions</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          One profile combines the player&apos;s rows, while each tournament remains available for context.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.35fr] gap-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">All Competitions</p>
              <h3 className="mt-1 text-xl font-black text-indigo-950">{player.name}</h3>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 text-indigo-700">
              <Layers3 size={20} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <OverviewStat label="Apps" value={stats.appearances ?? 0} />
            <OverviewStat label="Goals" value={stats.goals ?? 0} />
            <OverviewStat label="Assists" value={stats.assists ?? 0} />
            <OverviewStat label="G+A" value={stats.goalContributions ?? 0} />
            <OverviewStat label="xG" value={(stats.xG ?? 0).toFixed(2)} />
            <OverviewStat label="xA" value={(stats.xA ?? 0).toFixed(2)} />
          </div>

          <p className="mt-4 text-xs leading-5 text-indigo-700">
            Combined from {competitions.length} tournament row{competitions.length !== 1 ? 's' : ''}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ordered.map((comp) => {
            const s = comp.stats ?? {}
            const group = competitionGroup(comp.competition)
            const Icon = group.icon
            return (
              <div key={comp.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950">{competitionDisplayName(comp.competition)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{comp.club} · {comp.season}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${group.tone}`}>
                    <Icon size={11} />
                    {group.label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <MiniStat label="Apps" value={s.appearances ?? 0} />
                  <MiniStat label="G" value={s.goals ?? 0} />
                  <MiniStat label="A" value={s.assists ?? 0} />
                  <MiniStat label="G+A" value={(s.goals ?? 0) + (s.assists ?? 0)} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OverviewStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/75 px-3 py-3 text-center">
      <p className="text-lg font-black text-indigo-950">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-400">{label}</p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
      <p className="font-black text-slate-950">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  )
}

function CompetitionBreakdown({ competitions }) {
  if (!competitions.length) return null

  const ordered = sortedCompetitions(competitions)

  const cols = [
    { label: 'Apps',      key: 'appearances',   fmt: (v) => v ?? 0 },
    { label: 'Min',       key: 'minutesPlayed', fmt: (v) => v ?? 0 },
    { label: 'Goals',     key: 'goals',         fmt: (v) => v ?? 0 },
    { label: 'Assists',   key: 'assists',       fmt: (v) => v ?? 0 },
    { label: 'G+A', key: '_ga', fmt: (_, s) => (s.goals ?? 0) + (s.assists ?? 0), highlight: true },
    { label: 'xG',        key: 'xG',            fmt: (v) => (v ?? 0).toFixed(2) },
    { label: 'xA',        key: 'xA',            fmt: (v) => (v ?? 0).toFixed(2) },
    { label: 'Shots',     key: 'shots',         fmt: (v) => v ?? 0 },
    { label: 'Key Pass',  key: 'keyPasses',     fmt: (v) => v ?? 0 },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 min-w-[180px]">
                Competition
              </th>
              {cols.map(({ label }) => (
                <th
                  key={label}
                  className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((comp) => {
              const s = comp.stats ?? {}
              return (
                <tr
                  key={comp.id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900 leading-tight">{competitionDisplayName(comp.competition)}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{comp.club} · {comp.season}</p>
                  </td>
                  {cols.map(({ key, fmt, highlight }) => (
                    <td
                      key={key}
                      className={`text-center px-3 py-3.5 font-semibold tabular-nums ${
                        highlight ? 'text-indigo-600 font-bold' : 'text-slate-800'
                      }`}
                    >
                      {fmt(s[key], s)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          {ordered.length > 1 && (
            <tfoot>
              <TotalRow competitions={ordered} cols={cols} />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function TotalRow({ competitions, cols }) {
  const sum = (key) =>
    competitions.reduce((acc, c) => acc + ((c.stats ?? {})[key] ?? 0), 0)

  const totals = {
    appearances:   sum('appearances'),
    minutesPlayed: sum('minutesPlayed'),
    goals:         sum('goals'),
    assists:       sum('assists'),
    _ga:           sum('goals') + sum('assists'),
    xG:            competitions.reduce((acc, c) => acc + ((c.stats ?? {}).xG ?? 0), 0),
    xA:            competitions.reduce((acc, c) => acc + ((c.stats ?? {}).xA ?? 0), 0),
    shots:         sum('shots'),
    keyPasses:     sum('keyPasses'),
  }

  return (
    <tr className="bg-indigo-50 border-t-2 border-indigo-200">
      <td className="px-4 py-3">
        <p className="font-bold text-indigo-900 text-sm">Total</p>
        <p className="text-xs text-indigo-500">{competitions.length} competitions</p>
      </td>
      {cols.map(({ key, fmt, highlight }) => (
        <td
          key={key}
          className={`text-center px-3 py-3 font-bold tabular-nums text-sm ${
            highlight ? 'text-indigo-700' : 'text-indigo-900'
          }`}
        >
          {fmt(totals[key], totals)}
        </td>
      ))}
    </tr>
  )
}

function PlayerMatchLog({ matches }) {
  if (!matches.length) return null

  const cols = [
    { label: 'Min', key: 'minutesPlayed', fmt: (v) => v ?? 0 },
    { label: 'Rating', key: 'rating', fmt: (v) => v != null ? Number(v).toFixed(1) : '—', highlight: true },
    { label: 'G', key: 'goals', fmt: (v) => v ?? 0 },
    { label: 'A', key: 'assists', fmt: (v) => v ?? 0 },
    { label: 'xG', key: 'xG', detail: true, fmt: (v) => v != null ? formatStat('xG', v) : '—' },
    { label: 'xA', key: 'xA', detail: true, fmt: (v) => v != null ? formatStat('xA', v) : '—' },
    { label: 'Big Created', key: 'bigChancesCreated', detail: true, fmt: (v) => v ?? '—' },
    { label: 'Touches', key: 'touches', detail: true, fmt: (v) => v ?? '—' },
    { label: 'Passes', key: 'totalPasses', detail: true, fmt: (v) => v ?? '—' },
    { label: 'Tackles', key: 'tackles', detail: true, fmt: (v) => v ?? '—' },
  ]

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Match Log</h2>
        <p className="text-sm text-slate-500 mt-0.5">Fixture-by-fixture evidence behind the totals.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="min-w-[220px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Match
                </th>
                {cols.map(({ label }) => (
                  <th key={label} className="whitespace-nowrap px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const stats = match.stats ?? {}
                return (
                  <tr key={`${match.fixture_id}-${match.date}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{match.opponent ? `vs ${match.opponent}` : 'Match'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {match.date || 'Date TBD'} · {competitionDisplayName(match.competition)}
                      </p>
                    </td>
                    {cols.map(({ key, fmt, highlight, detail }) => (
                      <td
                        key={key}
                        className={`px-3 py-3.5 text-center font-semibold tabular-nums ${
                          highlight ? 'text-indigo-600' : 'text-slate-800'
                        }`}
                      >
                        {fmt(detail && !match.has_detailed_stats ? undefined : stats[key] ?? (key === 'rating' ? match.rating : undefined))}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
