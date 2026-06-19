import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Activity,
  Shield,
  Sparkles,
  Trophy,
  Wand2,
  Radar,
  Gauge,
  Bookmark,
  Clock3,
} from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import ErrorMessage from '../components/common/ErrorMessage'
import EmptyState from '../components/common/EmptyState'
import SectionTitle from '../components/common/SectionTitle'
import PlayerAvatar from '../components/player/PlayerAvatar'
import PlayerSearch from '../components/player/PlayerSearch'
import ClubLogo from '../components/common/ClubLogo'
import CountryFlag from '../components/common/CountryFlag'
import Seo from '../components/common/Seo'
import { usePlayers } from '../hooks/usePlayers'
import { playerService } from '../services/playerService'
import { formatStat } from '../utils/formatStat'
import { summarizeRoleStrengths } from '../utils/playerMetrics'
import { toPer90 } from '../utils/per90'
import { getShortlists } from '../utils/shortlists'
import { getRecentlyViewed } from '../utils/recentlyViewed'

function averageRating(form = []) {
  if (!form.length) return 0
  return form.reduce((sum, item) => sum + item.rating, 0) / form.length
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getRoleLabel(key) {
  return {
    finishing: 'Finishing',
    creation: 'Chance Creation',
    ballProgression: 'Ball Progression',
    defending: 'Defending',
  }[key] ?? key
}

function latestFormItem(player) {
  const form = player?.form ?? []
  return [...form]
    .filter((item) => item?.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || form[0] || null
}

function latestFormDateMs(player) {
  const item = latestFormItem(player)
  const time = item?.date ? new Date(item.date).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function lastSyncedMs(player) {
  const time = player?.last_synced_at ? new Date(player.last_synced_at).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function exactDefenceTotal(player) {
  const stats = player?.stats ?? {}
  return (stats.recoveries ?? 0) + (stats.successfulTackles ?? 0) + (stats.fouls ?? 0)
}

function buildRecentGameRows(players) {
  return [...players]
    .map((player) => ({ player, match: latestFormItem(player), dateMs: latestFormDateMs(player) }))
    .filter((row) => row.match && row.dateMs)
    .sort((a, b) => (
      b.dateMs - a.dateMs
      || (b.match.rating ?? 0) - (a.match.rating ?? 0)
      || (b.player.stats.rating ?? 0) - (a.player.stats.rating ?? 0)
    ))
    .slice(0, 8)
}

function getSpotlightNarrative(player) {
  if (!player) return ''

  const strengths = summarizeRoleStrengths(player)
  const topStrength = strengths[0]
  const goalsP90 = toPer90(player.stats.goals ?? 0, player.stats.minutesPlayed)
  const chancesP90 = toPer90(player.stats.chancesCreated ?? 0, player.stats.minutesPlayed)

  if (topStrength?.key === 'finishing') {
    return `${player.name} is setting the pace as a volume finisher with ${goalsP90?.toFixed(2) ?? '0.00'} goals per 90 and ${formatStat('shotConversion', player.stats.shotConversion)} conversion.`
  }

  if (topStrength?.key === 'creation') {
    return `${player.name} is driving chance creation with ${chancesP90?.toFixed(2) ?? '0.00'} chances created per 90 and ${player.stats.bigChancesCreated ?? 0} big chances created.`
  }

  if (topStrength?.key === 'defending') {
    return `${player.name} is anchoring defensive phases with a ${formatStat('defensiveWorkrate', player.stats.defensiveWorkrate)} work rate and strong duel volume.`
  }

  return `${player.name} is standing out as an all-phase performer, combining ${player.stats.progressivePasses ?? 0} progressive passes with ${player.stats.dribbles ?? 0} successful dribbles.`
}

function buildLeaders(players) {
  const by = (selector) => [...players].sort((a, b) => selector(b) - selector(a))

  return {
    topScorer: by((player) => player.stats.goals ?? 0)[0],
    topContributor: by((player) => player.stats.goalContributions ?? 0)[0],
    topCreator: by((player) => player.stats.chancesCreated ?? 0)[0],
    topProgressor: by((player) => player.stats.progressivePasses ?? 0)[0],
    topDefender: by((player) => player.stats.defensiveWorkrate ?? 0)[0],
    bestForm: by((player) => averageRating(player.form))[0],
  }
}

function WorldCupPulse() {
  const [fixtures, setFixtures] = useState([])
  const [topScorer, setTopScorer] = useState(null)

  useEffect(() => {
    let active = true
    playerService.getWorldCupFixtures(40)
      .then((data) => { if (active) setFixtures(data ?? []) })
      .catch(() => {})
    playerService.getAll({ league: 'FIFA World Cup', season: '2026', sort: 'goals', limit: 5 })
      .then((data) => {
        if (!active) return
        const best = (data ?? []).filter((p) => (p.stats?.goals ?? 0) > 0)
          .sort((a, b) => (b.stats?.goals ?? 0) - (a.stats?.goals ?? 0))[0]
        setTopScorer(best ?? null)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const order = { inprogress: 0, halftime: 0, notstarted: 1, finished: 2 }
  const sorted = [...fixtures].sort((a, b) => {
    const oa = order[a.status_type] ?? 3
    const ob = order[b.status_type] ?? 3
    if (oa !== ob) return oa - ob
    return (a.timestamp ?? 0) - (b.timestamp ?? 0)
  }).slice(0, 12)

  if (!sorted.length && !topScorer) return null

  return (
    <div className="border-b border-slate-200 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="flex shrink-0 items-center gap-2 pr-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-300">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            World Cup
          </span>

          {topScorer && (
            <Link
              to="/world-cup"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-white transition hover:bg-amber-400/20"
            >
              <span className="text-base">🥇</span>
              <span className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-amber-300">Golden Boot</span>
                <span className="block truncate text-xs font-bold">{topScorer.name} · {topScorer.stats?.goals ?? 0}</span>
              </span>
            </Link>
          )}

          {sorted.map((f) => {
            const live = f.status_type === 'inprogress'
            const done = f.status_type === 'finished'
            return (
              <Link
                key={f.fixture_id}
                to={`/world-cup/matches/${f.fixture_id}`}
                className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CountryFlag code={f.home?.flag_code} nationality={f.home?.name} size="xs" />
                    <span className="w-16 truncate text-xs font-bold text-white">{f.home?.short_name || f.home?.name}</span>
                    {(live || done) && <span className="ml-auto text-xs font-black tabular-nums text-white">{f.home?.score ?? 0}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <CountryFlag code={f.away?.flag_code} nationality={f.away?.name} size="xs" />
                    <span className="w-16 truncate text-xs font-bold text-white">{f.away?.short_name || f.away?.name}</span>
                    {(live || done) && <span className="ml-auto text-xs font-black tabular-nums text-white">{f.away?.score ?? 0}</span>}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                  live ? 'bg-red-500 text-white' : done ? 'bg-white/10 text-slate-300' : 'bg-sky-500/20 text-sky-200'
                }`}>
                  {live ? (f.minute ? `${f.minute}'` : 'LIVE') : done ? 'FT' : formatKickoffShort(f)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatKickoffShort(f) {
  const ts = f.timestamp ? f.timestamp * 1000 : (f.date ? new Date(f.date).getTime() : 0)
  if (!ts) return 'TBD'
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ts))
  } catch {
    return 'TBD'
  }
}

const POPULAR_SEARCHES = [
  { label: 'Messi', query: 'Lionel Messi', hint: 'MLS creator-finisher' },
  { label: 'Yamal', query: 'Lamine Yamal', hint: 'U23 wide creator' },
  { label: 'Doku', query: 'Jérémy Doku', hint: '1v1 winger' },
  { label: 'Saka', query: 'Bukayo Saka', hint: 'RW output' },
]

const COMPETITION_GROUPS = [
  { id: 'leagues', label: 'Leagues', season: '25/26' },
  { id: 'europe', label: 'Europe', season: '25/26' },
  { id: 'mls', label: 'MLS', season: '2026' },
  { id: 'world_cup_2026', label: 'World Cup 2026', season: '2026' },
  { id: 'national', label: 'National', season: '2026' },
]

const POSITION_GROUPS = [
  { id: '', label: 'All', positions: [] },
  { id: 'gk', label: 'GK', positions: ['GK'] },
  { id: 'defenders', label: 'Defenders', positions: ['CB', 'LB', 'RB'] },
  { id: 'midfielders', label: 'Midfielders', positions: ['CDM', 'CM', 'CAM'] },
  { id: 'attackers', label: 'Attackers', positions: ['LW', 'RW', 'ST'] },
]

const SORT_OPTIONS = [
  { id: 'rating', label: 'Rating', value: (player) => player.stats.rating ?? 0 },
  { id: 'goals', label: 'Goals', value: (player) => player.stats.goals ?? 0 },
  { id: 'assists', label: 'Assists', value: (player) => player.stats.assists ?? 0 },
  { id: 'xg', label: 'xG', value: (player) => player.stats.xG ?? 0 },
  { id: 'xa', label: 'xA', value: (player) => player.stats.xA ?? 0 },
  { id: 'chances', label: 'Chances', value: (player) => player.stats.chancesCreated ?? 0 },
  { id: 'defending', label: 'Defending', value: (player) => player.stats.defensiveWorkrate ?? 0 },
]

export default function Dashboard({ mode = 'live' }) {
  const navigate = useNavigate()
  const isWorldCupMode = mode === 'worldCup'
  const [competitionGroup, setCompetitionGroup] = useState(isWorldCupMode ? 'world_cup_2026' : 'leagues')
  const [league, setLeague] = useState('')
  const [season, setSeason] = useState(isWorldCupMode ? '2026' : '25/26')
  const [position, setPosition] = useState('')
  const [positionGroup, setPositionGroup] = useState('')
  const [minApps, setMinApps] = useState(1)
  const [minMinutes, setMinMinutes] = useState(0)
  const [maxAge, setMaxAge] = useState(40)
  const [sortBy, setSortBy] = useState(isWorldCupMode ? 'goals' : 'rating')
  const [searchingPick, setSearchingPick] = useState('')
  const [recentPlayers, setRecentPlayers] = useState(() => getRecentlyViewed())
  const [watchlistPlayers, setWatchlistPlayers] = useState(() => getShortlists().Watchlist || [])

  useEffect(() => {
    const refreshRecent = () => setRecentPlayers(getRecentlyViewed())
    const refreshShortlists = () => setWatchlistPlayers(getShortlists().Watchlist || [])

    window.addEventListener('pitchiq:recently-viewed-updated', refreshRecent)
    window.addEventListener('pitchiq:shortlists-updated', refreshShortlists)
    window.addEventListener('storage', refreshRecent)
    window.addEventListener('storage', refreshShortlists)

    return () => {
      window.removeEventListener('pitchiq:recently-viewed-updated', refreshRecent)
      window.removeEventListener('pitchiq:shortlists-updated', refreshShortlists)
      window.removeEventListener('storage', refreshRecent)
      window.removeEventListener('storage', refreshShortlists)
    }
  }, [])

  const openPlayer = (player) => {
    if (player?.id) navigate(`/player/${player.id}`)
  }

  const openPopularPick = async (pick) => {
    setSearchingPick(pick.label)
    try {
      const results = await playerService.search(pick.query)
      const match = results.find((player) =>
        player.name.toLowerCase() === pick.query.toLowerCase(),
      ) || results[0]
      openPlayer(match)
    } finally {
      setSearchingPick('')
    }
  }

  useEffect(() => {
    if (!isWorldCupMode) return
    setLeague('')
    setCompetitionGroup('world_cup_2026')
    setSeason('2026')
    setSortBy((current) => current || 'goals')
  }, [isWorldCupMode])

  const filters = {}
  if (league) filters.league = league
  else if (competitionGroup) filters.group = competitionGroup
  if (season) filters.season = season
  if (position) filters.position = position
  else if (positionGroup) filters.position_group = positionGroup
  filters.min_starts = minApps
  filters.min_minutes = minMinutes
  if (maxAge < 40) filters.max_age = maxAge
  filters.sort = sortBy
  filters.limit = 1000

  const { players, loading, error, refetch } = usePlayers(filters)
  const selectedPositionGroup = POSITION_GROUPS.find((group) => group.id === positionGroup)
  const selectedSort = SORT_OPTIONS.find((option) => option.id === sortBy) ?? SORT_OPTIONS[0]
  const visible = useMemo(
    () => players.filter((player) =>
      (player.stats.starts ?? player.stats.appearances ?? 0) >= minApps
      && (player.stats.minutesPlayed ?? 0) >= minMinutes
      && player.age <= maxAge
      && (!selectedPositionGroup?.positions.length || selectedPositionGroup.positions.includes(player.position)),
    ),
    [players, minApps, minMinutes, maxAge, selectedPositionGroup],
  )
  const sortedVisible = useMemo(
    () => [...visible].sort((a, b) => selectedSort.value(b) - selectedSort.value(a)),
    [visible, selectedSort],
  )
  const dashboard = useMemo(() => {
    const source = sortedVisible.length ? sortedVisible : players
    const leaders = buildLeaders(source)
    const recentGameRows = buildRecentGameRows(source)
    const recentlyUpdated = [...source]
      .filter((player) => lastSyncedMs(player))
      .sort((a, b) => lastSyncedMs(b) - lastSyncedMs(a))
      .slice(0, 8)
    const freshDefence = [...source]
      .filter((player) => exactDefenceTotal(player) > 0)
      .sort((a, b) => exactDefenceTotal(b) - exactDefenceTotal(a))
      .slice(0, 6)
    const spotlight = recentGameRows[0]?.player || recentlyUpdated[0] || leaders.topCreator || leaders.topScorer || source[0] || null
    const eliteProfiles = source.filter((player) =>
      Object.values(player.scores ?? {}).some((score) => score >= 80),
    ).length
    const syncedLast24h = source.filter((player) => {
      const synced = lastSyncedMs(player)
      return synced && Date.now() - synced <= 24 * 60 * 60 * 1000
    }).length
    const withRecentMatches = recentGameRows.length

    const overview = [
      {
        label: 'Live Player Pool',
        value: source.length,
        sub: `${eliteProfiles} high-signal profiles`,
        icon: Radar,
        tone: 'from-emerald-400/25 via-emerald-300/10 to-transparent',
      },
      {
        label: 'Recent Matches',
        value: withRecentMatches,
        sub: 'profiles with match-form dates',
        icon: Clock3,
        tone: 'from-amber-400/25 via-amber-300/10 to-transparent',
      },
      {
        label: 'Updated Profiles',
        value: syncedLast24h,
        sub: 'synced in the last 24h',
        icon: Activity,
        tone: 'from-sky-400/25 via-sky-300/10 to-transparent',
      },
      {
        label: 'Exact Defence',
        value: freshDefence.length,
        sub: 'profiles with lineup defence',
        icon: Shield,
        tone: 'from-fuchsia-400/25 via-fuchsia-300/10 to-transparent',
      },
    ]

    return {
      source,
      spotlight,
      leaders,
      overview,
      recentGameRows,
      recentlyUpdated,
      freshDefence,
    }
  }, [players, sortedVisible])

  const hasPlayers = !loading && !error && visible.length > 0
  const spotlight = dashboard.spotlight

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <Seo
        title="Football Player Analytics & World Cup 2026 Stats"
        description="PitchVision — football player analytics with ratings, leaderboards, scouting tools, shareable scout cards, and live FIFA World Cup 2026 stats."
        path="/"
      />
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-visible bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(244,114,182,0.18),_transparent_22%),linear-gradient(135deg,_#07111f_0%,_#0e1b34_45%,_#151c47_100%)] text-white"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:34px_34px] opacity-25" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10">
          <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-6 items-stretch">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">
                <Sparkles size={13} />
                  {isWorldCupMode ? 'World Cup Mode' : 'PitchVision Live Desk'}
              </div>

              <div className="max-w-3xl">
                <h1 className="font-black text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-tight">
                  {isWorldCupMode ? 'World Cup 2026 player watch.' : 'Fresh player signals from the latest games.'}
                </h1>
                <p className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-slate-200/90">
                  {isWorldCupMode
                    ? 'Tournament-period mode narrows the app to the 48 World Cup nations, national-team rows, qualifier context, and match signals as they arrive.'
                    : 'The dashboard now adapts around recently updated profiles, match-form dates, and exact lineup stats so the first screen shows what changed most recently.'}
                </p>
              </div>

              <div className="max-w-4xl rounded-[28px] border border-white/12 bg-white/10 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur">
                <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
                  <div className="min-w-0 flex-1 2xl:min-w-[320px]">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                      Find a player
                    </p>
                    <div className="[&_.input]:h-13 [&_.input]:rounded-2xl [&_.input]:border-white/20 [&_.input]:bg-white [&_.input]:text-base [&_.input]:font-semibold [&_.input]:text-slate-950 [&_.input]:placeholder:text-slate-400">
                      <PlayerSearch
                        onSelect={openPlayer}
                        placeholder="Search Messi, Yamal, Doku, Saka..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:w-[420px]">
                    {POPULAR_SEARCHES.map((pick) => (
                      <button
                        key={pick.label}
                        type="button"
                        onClick={() => openPopularPick(pick)}
                        className="min-h-[62px] rounded-2xl border border-white/12 bg-slate-950/20 px-3 py-2 text-left transition hover:bg-white/12 disabled:opacity-60"
                        disabled={searchingPick === pick.label}
                      >
                        <span className="block text-sm font-black text-white">
                          {searchingPick === pick.label ? 'Opening...' : pick.label}
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-300">{pick.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to={isWorldCupMode ? '/scouting-board?group=world_cup_2026&season=2026&min_starts=1&sort=goals' : '/compare'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-2xl shadow-sky-950/30 transition-transform hover:-translate-y-0.5"
                >
                  {isWorldCupMode ? 'Open World Cup Board' : 'Compare Players'}
                  <ArrowRight size={15} />
                </Link>
                {isWorldCupMode && (
                  <Link
                    to="/compare"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-slate-100 backdrop-blur transition hover:bg-white/14"
                  >
                    Compare Players
                    <ArrowRight size={15} />
                  </Link>
                )}
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-slate-200 backdrop-blur">
                  <Gauge size={15} className="text-sky-300" />
                  {dashboard.source.length} current profiles
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-slate-200 backdrop-blur">
                  Scope: {isWorldCupMode ? '48 World Cup nations' : 'top leagues + domestic cups'}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {dashboard.overview.map(({ label, value, sub, icon: Icon, tone }) => (
                  <div
                    key={label}
                    className={`rounded-3xl border border-white/10 bg-gradient-to-br ${tone} bg-white/6 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{label}</p>
                      <Icon size={14} className="text-slate-200" />
                    </div>
                    <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
                    <p className="mt-1 text-xs text-slate-300">{sub}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/8 p-5 shadow-2xl shadow-slate-950/35 backdrop-blur">
              {spotlight ? (
                <SpotlightPanel player={spotlight} />
              ) : (
                <div className="h-full min-h-64 rounded-[26px] border border-white/10 bg-slate-950/20 p-6 text-sm text-slate-300">
                  Player spotlight will appear as soon as the live pool loads.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <WorldCupPulse />

      <PageContainer>
        <DashboardFilters
          isWorldCupMode={isWorldCupMode}
          competitionGroup={competitionGroup}
          onCompetitionGroupChange={(groupId) => {
            const group = COMPETITION_GROUPS.find((item) => item.id === groupId)
            setLeague('')
            setCompetitionGroup(groupId)
            setSeason(group?.season ?? '')
          }}
          positionGroup={positionGroup}
          onPositionGroupChange={(groupId) => {
            setPosition('')
            setPositionGroup(groupId)
          }}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          minApps={minApps}
          onMinAppsChange={setMinApps}
          maxAge={maxAge}
          onMaxAgeChange={setMaxAge}
        />

        {loading && <DashboardSkeleton />}
        {error && <ErrorMessage message={error} onRetry={refetch} />}
        {!loading && !error && visible.length === 0 && (
          <EmptyState title="No players match" message="Try broadening the filters or lowering the minimum starts threshold." />
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <DashboardPlayerPanel
                title="Continue Watching"
                subtitle="Recently opened profiles"
                icon={Clock3}
                players={recentPlayers.slice(0, 5)}
                emptyTitle="No recent players yet"
                emptyText="Open a player profile and it will appear here."
                actionLabel="View Shortlists"
                actionTo="/shortlists"
              />
              <DashboardPlayerPanel
                title="Watchlist"
                subtitle="Saved players ready for review"
                icon={Bookmark}
                players={watchlistPlayers.slice(0, 5)}
                emptyTitle="Watchlist is empty"
                emptyText="Save players from profiles or cards to keep them close."
                actionLabel="View Shortlists"
                actionTo="/shortlists"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
              <LeaderboardPanel
                title="Market Leaders"
                subtitle="The fastest read on who is dictating the current player pool."
                items={[
                  {
                    label: 'Scoring leader',
                    player: dashboard.leaders.topScorer,
                    value: dashboard.leaders.topScorer ? `${dashboard.leaders.topScorer.stats.goals} goals` : '—',
                    icon: Trophy,
                    color: 'from-amber-400 to-orange-500',
                  },
                  {
                    label: 'G+A leader',
                    player: dashboard.leaders.topContributor,
                    value: dashboard.leaders.topContributor ? `${dashboard.leaders.topContributor.stats.goalContributions} goal contributions` : '—',
                    icon: Sparkles,
                    color: 'from-fuchsia-500 to-pink-500',
                  },
                  {
                    label: 'Creative leader',
                    player: dashboard.leaders.topCreator,
                    value: dashboard.leaders.topCreator ? `${dashboard.leaders.topCreator.stats.chancesCreated} chances created` : '—',
                    icon: Wand2,
                    color: 'from-sky-400 to-cyan-500',
                  },
                  {
                    label: 'Progression leader',
                    player: dashboard.leaders.topProgressor,
                    value: dashboard.leaders.topProgressor ? `${dashboard.leaders.topProgressor.stats.progressivePasses} progressive passes` : '—',
                    icon: Activity,
                    color: 'from-violet-500 to-indigo-500',
                  },
                  {
                    label: 'Defensive leader',
                    player: dashboard.leaders.topDefender,
                    value: dashboard.leaders.topDefender ? formatStat('defensiveWorkrate', dashboard.leaders.topDefender.stats.defensiveWorkrate) : '—',
                    icon: Shield,
                    color: 'from-emerald-500 to-teal-500',
                  },
                ]}
              />

              <NarrativePanel player={spotlight} />
            </div>

            <div className="space-y-6">
              <SectionTitle
                title="Latest Signals"
                subtitle="Recent match standouts, newly updated profiles, and players with exact lineup defensive data."
              />

              <div className="grid grid-cols-1 2xl:grid-cols-[1.2fr_0.8fr] gap-5">
                <RecentMatchPanel rows={dashboard.recentGameRows} />
                <div className="space-y-5">
                  <UpdatedProfilesPanel players={dashboard.recentlyUpdated} />
                  <ExactDefencePanel players={dashboard.freshDefence} />
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  )
}

function DashboardFilters({
  isWorldCupMode,
  competitionGroup,
  onCompetitionGroupChange,
  positionGroup,
  onPositionGroupChange,
  sortBy,
  onSortByChange,
  minApps,
  onMinAppsChange,
  maxAge,
  onMaxAgeChange,
}) {
  return (
    <section className="mb-6 rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_-50px_rgba(15,23,42,0.5)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Competition</p>
            <div className="flex flex-wrap gap-2">
              {COMPETITION_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onCompetitionGroupChange(group.id)}
                  disabled={isWorldCupMode && group.id !== 'world_cup_2026'}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    competitionGroup === group.id
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950'
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Position</p>
            <div className="flex flex-wrap gap-2">
              {POSITION_GROUPS.map((group) => (
                <button
                  key={group.id || 'all'}
                  type="button"
                  onClick={() => onPositionGroupChange(group.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                    positionGroup === group.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950'
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-300"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Starts</span>
            <input
              type="number"
              min="0"
              max="50"
              value={minApps}
              onChange={(event) => onMinAppsChange(Math.max(0, Number(event.target.value) || 0))}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Max Age</span>
            <select
              value={maxAge}
              onChange={(event) => onMaxAgeChange(Number(event.target.value))}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-300"
            >
              <option value={40}>All</option>
              <option value={23}>U23</option>
              <option value={21}>U21</option>
              <option value={19}>U19</option>
            </select>
          </label>
        </div>
      </div>
    </section>
  )
}

function DashboardPlayerPanel({ title, subtitle, icon: Icon, players, emptyTitle, emptyText, actionLabel, actionTo }) {
  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-950 p-3 text-white">
            <Icon size={18} />
          </div>
          <div>
            <h3 className="font-black tracking-tight text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <Link to={actionTo} className="text-xs font-bold text-sky-700 hover:text-slate-950">
          {actionLabel}
        </Link>
      </div>

      {players.length ? (
        <div className="mt-5 divide-y divide-slate-100">
          {players.map((player) => (
            <Link
              key={player.id}
              to={`/player/${player.id}`}
              className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <PlayerAvatar player={player} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950 group-hover:text-sky-700">{player.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {player.club} · {player.position} · Age {player.age}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
                <p className="text-sm font-black text-slate-950">{player.stats?.rating ? Number(player.stats.rating).toFixed(1) : '—'}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Rating</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="font-bold text-slate-800">{emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{emptyText}</p>
        </div>
      )}
    </div>
  )
}

function SpotlightPanel({ player }) {
  const strengths = summarizeRoleStrengths(player)

  return (
    <div className="h-full rounded-[26px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Spotlight Profile</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">{player.name}</h2>
        </div>
        <PlayerAvatar player={player} size="xl" />
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap text-sm text-slate-200">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
          <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
          {player.nationality}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1">
          <ClubLogo url={player.club_logo_url} club={player.club} size="xs" />
          {player.club}
        </span>
        <span className="inline-flex rounded-full bg-white/8 px-3 py-1">{player.position}</span>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-200/90">
        {getSpotlightNarrative(player)}
      </p>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <SpotlightStat label="Chances Created" value={player.stats.chancesCreated} />
        <SpotlightStat label="Progressive Passes" value={player.stats.progressivePasses} />
        <SpotlightStat label="Shot Conversion" value={formatStat('shotConversion', player.stats.shotConversion)} />
        <SpotlightStat label="Def Work Rate" value={formatStat('defensiveWorkrate', player.stats.defensiveWorkrate)} />
      </div>

      <div className="mt-5 space-y-3">
        {(strengths.length ? strengths : [{ key: 'creation', score: player.scores?.creation ?? 0, label: 'Model' }]).map(({ key, score, label }) => (
          <MetricRail
            key={key}
            label={getRoleLabel(key)}
            value={score}
            suffix={label}
            dark
          />
        ))}
      </div>
    </div>
  )
}

function SpotlightStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  )
}

function LeaderboardPanel({ title, subtitle, items }) {
  return (
    <div className="rounded-[30px] border border-slate-200/70 bg-slate-950 p-5 text-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.65)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <Link to="/compare" className="text-xs font-semibold text-sky-300 hover:text-white">Compare top profiles</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {items.map(({ label, player, value, icon: Icon, color }) => (
          <div key={label} className="rounded-[24px] border border-white/8 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className={`rounded-2xl bg-gradient-to-br ${color} p-2.5 shadow-lg`}>
                <Icon size={16} className="text-white" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {player ? <PlayerAvatar player={player} size="md" /> : null}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{player?.name ?? 'Not available'}</p>
                <p className="truncate text-xs text-slate-400">{player?.club ?? 'Waiting for data'}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function NarrativePanel({ player }) {
  const strengths = summarizeRoleStrengths(player)

  return (
    <div className="rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] p-5 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.45)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Scout Notes</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
        Build shortlists around roles, not just box-score totals.
      </h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        The dashboard now weights chance creation, progression, shot efficiency, and defensive work rate so you can
        spot the difference between production, profile, and tactical fit at a glance.
      </p>

      {player && (
        <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar player={player} size="md" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-950">{player.name}</p>
              <p className="truncate text-xs text-slate-500">{player.club} · {player.league}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(strengths.length ? strengths : [{ key: 'creation', score: player.scores?.creation ?? 0, label: 'Model' }]).map(({ key, score, label }) => (
              <MetricRail
                key={key}
                label={getRoleLabel(key)}
                value={score}
                suffix={label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RecentMatchPanel({ rows }) {
  return (
    <div className="rounded-[30px] border border-slate-200/70 bg-white p-5 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Recent Games</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Latest Match Standouts</h3>
        </div>
        <div className="rounded-2xl bg-slate-950 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
          Live
        </div>
      </div>

      {rows.length ? (
        <div className="mt-5 divide-y divide-slate-100">
          {rows.map(({ player, match }) => (
            <Link
              key={`${player.id}-${match.date}-${match.match}`}
              to={`/player/${player.id}`}
              className="group grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <PlayerAvatar player={player} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-slate-950 group-hover:text-sky-700">{player.name}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {player.position}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {match.match || 'Recent match'} · {match.competition || player.league}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {match.date ? new Date(match.date).toLocaleDateString() : 'Date unavailable'} · {player.club}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
                <p className="text-xl font-black">{Number(match.rating ?? 0).toFixed(1)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Rating</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="font-bold text-slate-800">No recent match dates yet</p>
          <p className="mt-1 text-sm text-slate-500">Sync player form to populate this live feed.</p>
        </div>
      )}
    </div>
  )
}

function UpdatedProfilesPanel({ players }) {
  return (
    <SignalPanel
      title="Recently Updated"
      subtitle="Profiles touched by the latest syncs"
      players={players}
      value={(player) => player.last_synced_at ? new Date(player.last_synced_at).toLocaleDateString() : '—'}
      label="Synced"
      empty="No recent sync timestamps yet"
    />
  )
}

function ExactDefencePanel({ players }) {
  return (
    <SignalPanel
      title="Exact Defence Ready"
      subtitle="Recoveries, won tackles, and fouls from lineup data"
      players={players}
      value={(player) => exactDefenceTotal(player)}
      label="Actions"
      empty="No exact defensive rows in this pool yet"
    />
  )
}

function SignalPanel({ title, subtitle, players, value, label, empty }) {
  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.4)]">
      <div>
        <h3 className="font-black tracking-tight text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {players.length ? (
        <div className="mt-5 space-y-3">
          {players.slice(0, 5).map((player) => (
            <Link
              key={`${title}-${player.id}`}
              to={`/player/${player.id}`}
              className="group flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 transition hover:bg-white hover:shadow-md"
            >
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950 group-hover:text-sky-700">{player.name}</p>
                <p className="truncate text-xs text-slate-500">{player.club} · {player.position}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                <p className="text-sm font-black text-slate-950">{value(player)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-bold text-slate-800">{empty}</p>
        </div>
      )}
    </div>
  )
}

function MetricRail({ label, value, suffix, dark = false }) {
  return (
    <div>
      <div className={`flex items-center justify-between text-xs ${dark ? 'text-slate-200' : 'text-slate-500'}`}>
        <span className="font-semibold uppercase tracking-[0.16em]">{label}</span>
        <span>{value} percentile{suffix ? ` · ${suffix}` : ''}</span>
      </div>
      <div className={`mt-2 h-2 rounded-full ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>
        <div
          className={`h-2 rounded-full ${dark ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-white' : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500'}`}
          style={{ width: `${Math.max(6, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  )
}

function Sk({ className }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-[28px] border border-slate-200/70 bg-white p-5">
            <div className="flex items-center gap-3 mb-5">
              <Sk className="h-11 w-11 rounded-2xl" />
              <div className="space-y-2 flex-1">
                <Sk className="h-4 w-32" />
                <Sk className="h-3 w-48" />
              </div>
            </div>
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center gap-3 py-3 border-t border-slate-100 first:border-0">
                <Sk className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Sk className="h-3.5 w-28" />
                  <Sk className="h-3 w-40" />
                </div>
                <Sk className="h-10 w-14 rounded-2xl" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 space-y-4">
          <div className="space-y-2">
            <Sk className="h-5 w-40" />
            <Sk className="h-3 w-64" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <Sk className="h-8 w-8 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3 w-24" />
                <Sk className="h-3 w-36" />
              </div>
              <Sk className="h-10 w-10 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 space-y-4">
          <Sk className="h-5 w-32" />
          <Sk className="h-28 w-full rounded-2xl" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="flex justify-between mb-1.5">
                  <Sk className="h-3 w-20" />
                  <Sk className="h-3 w-12" />
                </div>
                <Sk className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-1">
          <Sk className="h-5 w-36" />
          <Sk className="h-3 w-80" />
        </div>
        <div className="grid grid-cols-1 2xl:grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 space-y-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <Sk className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Sk className="h-3.5 w-28" />
                  <Sk className="h-3 w-44" />
                </div>
                <Sk className="h-8 w-16 rounded-xl" />
              </div>
            ))}
          </div>
          <div className="space-y-5">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-[28px] border border-slate-200/70 bg-white p-5 space-y-3">
                <Sk className="h-4 w-40" />
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Sk className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Sk className="h-3 w-24" />
                      <Sk className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
