import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Clock, ListOrdered, Search, Trophy } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import EmptyState from '../components/common/EmptyState'
import CountryFlag from '../components/common/CountryFlag'
import PlayerAvatar from '../components/player/PlayerAvatar'
import { playerService } from '../services/playerService'
import { useLanguage } from '../i18n/LanguageProvider'
import { FR_TRANSLATIONS } from '../i18n/translations'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'inprogress', label: 'Live' },
  { key: 'notstarted', label: 'Upcoming' },
  { key: 'finished', label: 'Finished' },
]

export default function WorldCupMatches() {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const [fixtures, setFixtures] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(Date.now())

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [fixtureRows, matchRows] = await Promise.all([
        playerService.getWorldCupFixtures(80, { force: quiet }),
        playerService.getWorldCupMatches(40),
      ])
      setFixtures(fixtureRows)
      setMatches(matchRows)
    } catch (err) {
      setError(err.message || 'Could not load World Cup matches.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const syncedByFixture = useMemo(() => {
    return new Map(matches.map((match) => [String(match.fixture_id), match]))
  }, [matches])

  const rows = useMemo(() => {
    const fixtureIds = new Set(fixtures.map((fixture) => String(fixture.fixture_id)))
    const mergedFixtures = fixtures.map((fixture) => ({
      ...fixture,
      syncedMatch: syncedByFixture.get(String(fixture.fixture_id)) || null,
    }))

    const syncedOnly = matches
      .filter((match) => !fixtureIds.has(String(match.fixture_id)))
      .map((match) => ({
        fixture_id: match.fixture_id,
        date: match.date,
        timestamp: null,
        status: 'Synced',
        status_type: 'finished',
        group: 'World Cup',
        home: toFixtureTeam(match.teams?.[0]),
        away: toFixtureTeam(match.teams?.[1]),
        syncedMatch: match,
      }))

    return [...mergedFixtures, ...syncedOnly]
  }, [fixtures, matches, syncedByFixture])

  const groups = useMemo(() => {
    const values = rows
      .map((row) => row.group)
      .filter(Boolean)
      .filter((group) => group !== 'World Cup')
    return ['all', ...Array.from(new Set(values)).sort()]
  }, [rows])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sortMatchesByDate(rows).filter((row) => {
      const statusType = effectiveStatusType(row, now)
      if (statusFilter === 'today' && !isTodayMatch(row)) return false
      if (!['all', 'today'].includes(statusFilter) && statusType !== statusFilter) return false
      if (groupFilter !== 'all' && row.group !== groupFilter) return false
      if (!needle) return true

      const haystack = [
        row.home?.name,
        row.home?.short_name,
        row.away?.name,
        row.away?.short_name,
        row.group,
        ...(row.syncedMatch?.top_performers ?? []).map((player) => player.name),
      ].filter(Boolean).join(' ').toLowerCase()

      return haystack.includes(needle)
    })
  }, [rows, statusFilter, groupFilter, query, now])

  const summary = useMemo(() => ({
    today: rows.filter((row) => isTodayMatch(row)).length,
    live: rows.filter((row) => effectiveStatusType(row, now) === 'inprogress').length,
    upcoming: rows.filter((row) => effectiveStatusType(row, now) === 'notstarted').length,
    finished: rows.filter((row) => effectiveStatusType(row, now) === 'finished').length,
    synced: rows.filter((row) => row.syncedMatch).length,
  }), [rows, now])

  useEffect(() => {
    if (summary.live <= 0) return undefined
    const timer = setInterval(() => loadData({ quiet: true }), 60000)
    return () => clearInterval(timer)
  }, [loadData, summary.live])

  useEffect(() => {
    if (!rows.some((row) => effectiveStatusType(row, Date.now()) === 'notstarted' && row.timestamp)) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [rows])

  return (
    <div className="flex-1 min-w-0 bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <Link
            to="/world-cup"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={15} />
            World Cup home
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                <Trophy size={13} />
                Fixtures and Live Score
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                World Cup Match Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Track live scores, upcoming fixtures, finished matches, and synced top performers in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <PageContainer>
        <div className="space-y-6">
          <WorldCupCategoryNav active="matches" />

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Today" value={summary.today} />
            <SummaryTile label="Live" value={summary.live} />
            <SummaryTile label="Upcoming" value={summary.upcoming} />
            <SummaryTile label="Finished" value={summary.finished} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setStatusFilter(filter.key)}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                      statusFilter === filter.key
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
                <select
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-sky-300"
                >
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group === 'all' ? 'All groups' : group}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 xl:w-80">
                <Search size={15} className="shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search teams or players"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
          </section>

          {loading && <Loader />}
          {error && <ErrorMessage message={error} onRetry={() => loadData()} />}
          {!loading && !error && filteredRows.length === 0 && (
            <EmptyState
              title="No matches found"
              message="Try another filter, or refresh when the provider publishes the next fixtures."
            />
          )}

          {!loading && !error && filteredRows.length > 0 && (
            <section className="grid gap-4 xl:grid-cols-2">
              {filteredRows.map((fixture) => (
                <MatchCard
                  key={fixture.fixture_id}
                  fixture={fixture}
                  now={now}
                  language={language}
                  onOpen={() => navigate(`/world-cup/matches/${fixture.fixture_id}`)}
                />
              ))}
            </section>
          )}
        </div>
      </PageContainer>
    </div>
  )
}

function WorldCupCategoryNav({ active }) {
  const categories = [
    {
      key: 'leaderboards',
      to: '/world-cup',
      label: 'Player Leaderboards',
      description: 'In-form players, tournament leaders, positions, and groups.',
      icon: ListOrdered,
    },
    {
      key: 'matches',
      to: '/world-cup/matches',
      label: 'Match Center',
      description: 'Fixtures, live scores, finished matches, and top performers.',
      icon: CalendarDays,
    },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {categories.map(({ key, to, label, description, icon: Icon }) => (
        <Link
          key={key}
          to={to}
          className={`rounded-xl border p-4 shadow-sm transition-colors ${
            active === key
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${active === key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className={`font-black ${active === key ? 'text-white' : 'text-slate-950'}`}>{label}</p>
              <p className={`mt-1 text-sm leading-5 ${active === key ? 'text-white/70' : 'text-slate-500'}`}>
                {description}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </section>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function MatchCard({ fixture, now, language, onOpen }) {
  const statusType = effectiveStatusType(fixture, now)
  const hasStarted = statusType !== 'notstarted'
  const performers = fixture.syncedMatch?.top_performers ?? []
  const countdown = statusType === 'notstarted' ? formatCountdown(fixture.timestamp, now) : null
  const statusLabel = displayStatus(fixture, statusType)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClass(statusType)}`}>
              {statusLabel}
            </span>
            {isTodayMatch(fixture) && (
              <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">
                Today
              </span>
            )}
          </div>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {translateText(fixture.group || 'World Cup', language)} · {formatFixtureDate(fixture.timestamp, fixture.date, language)}
          </p>
        </div>
        {fixture.syncedMatch && (
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
            Player stats
          </span>
        )}
      </div>

      {countdown && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Clock size={15} className="shrink-0 text-sky-700" />
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Kickoff in</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-black tabular-nums text-slate-950">{countdown.main}</p>
            {countdown.sub && <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">{countdown.sub}</p>}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <FixtureTeam team={fixture.home} showScore={hasStarted} />
        <FixtureTeam team={fixture.away} showScore={hasStarted} />
      </div>

      {performers.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Top performers</p>
          <div className="space-y-2">
            {performers.slice(0, 4).map((player) => (
              <Link
                key={`${fixture.fixture_id}-${player.source_player_id || player.id || player.name}`}
                to={player.id ? `/player/${player.id}` : '#'}
                onClick={(event) => event.stopPropagation()}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 hover:border-sky-200 hover:bg-sky-50"
              >
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
                  <p className="truncate text-xs text-slate-500">{player.club} · {player.position}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-950">
                    {player.stats?.rating ? Number(player.stats.rating).toFixed(1) : '-'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {player.stats?.goals ?? 0}G {player.stats?.assists ?? 0}A
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {statusType === 'finished' && !performers.length && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          Finished. Admin refresh is available in Data Control once player stats are published.
        </p>
      )}

      <div className="mt-4 flex items-center justify-end">
        <span className="inline-flex items-center gap-2 text-xs font-black text-sky-700">
          View match <ArrowRight size={13} />
        </span>
      </div>
    </article>
  )
}

function FixtureTeam({ team, showScore }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <CountryFlag code={team?.flag_code} nationality={team?.name} size="xs" />
        <span className="truncate text-sm font-black text-slate-950">{team?.short_name || team?.name || 'TBD'}</span>
      </div>
      <span className="text-xl font-black text-slate-950">{showScore ? team?.score ?? 0 : '-'}</span>
    </div>
  )
}

function toFixtureTeam(team = {}) {
  return {
    name: team.name || 'TBD',
    short_name: team.short_name || team.name || 'TBD',
    flag_code: team.flag_code || null,
    score: team.goals ?? team.score ?? 0,
  }
}

function statusClass(statusType) {
  if (statusType === 'inprogress') return 'bg-red-50 text-red-700'
  if (statusType === 'finished') return 'bg-slate-200 text-slate-700'
  return 'bg-emerald-50 text-emerald-700'
}

function effectiveStatusType(fixture, nowMs = Date.now()) {
  if (!fixture) return undefined
  if (fixture.status_type !== 'notstarted') return fixture.status_type
  if (!fixture.timestamp) return fixture.status_type
  const elapsedSeconds = Math.floor(nowMs / 1000 - fixture.timestamp)
  if (elapsedSeconds < 0) return 'notstarted'
  if (elapsedSeconds > 150 * 60) return 'finished'
  return 'inprogress'
}

function displayStatus(fixture, statusType) {
  if (fixture.status_type !== 'notstarted') return fixture.status
  if (statusType === 'inprogress') return 'LIVE'
  if (statusType === 'finished') return 'FINISHED'
  return fixture.status
}

function sortMatchesByDate(matches) {
  return [...matches].sort((a, b) => {
    const aToday = isTodayMatch(a)
    const bToday = isTodayMatch(b)
    if (aToday !== bToday) return aToday ? -1 : 1

    const aRank = statusDateRank(a)
    const bRank = statusDateRank(b)
    if (aRank !== bRank) return aRank - bRank

    const aTime = matchTime(a)
    const bTime = matchTime(b)
    if (effectiveStatusType(a) === 'finished' && effectiveStatusType(b) === 'finished') return bTime - aTime
    return aTime - bTime
  })
}

function statusDateRank(match) {
  const statusType = effectiveStatusType(match)
  if (isTodayMatch(match)) {
    if (statusType === 'inprogress') return 0
    if (statusType === 'notstarted') return 1
    if (statusType === 'finished') return 2
    return 3
  }
  if (statusType === 'inprogress') return 4
  if (statusType === 'notstarted') return 5
  if (statusType === 'finished') return 6
  return 7
}

function isTodayMatch(match) {
  return localDateKey(match.timestamp, match.date) === todayKey()
}

function todayKey() {
  return localDateKey(Math.floor(Date.now() / 1000))
}

function localDateKey(timestamp, fallback) {
  const date = timestamp
    ? new Date(timestamp * 1000)
    : fallback
      ? new Date(`${fallback}T12:00:00`)
      : new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function matchTime(match) {
  if (match.timestamp) return match.timestamp
  const parsed = Date.parse(`${match.date || ''}T12:00:00`)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0
}

function formatCountdown(timestamp, nowMs = Date.now()) {
  if (!timestamp) return null
  const totalSeconds = Math.floor((timestamp * 1000 - nowMs) / 1000)
  if (totalSeconds <= 0) return null

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return {
      main: `${days}d ${String(hours).padStart(2, '0')}h`,
      sub: `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
    }
  }

  return {
    main: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    sub: 'hrs min sec',
  }
}

function formatFixtureDate(timestamp, fallback, language = 'en') {
  const locale = language === 'fr' ? 'fr-FR' : undefined
  const date = timestamp
    ? new Date(timestamp * 1000)
    : fallback
      ? new Date(`${fallback}T12:00:00`)
      : null

  if (!date || Number.isNaN(date.getTime())) return translateText('TBD', language)
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function translateText(value, language) {
  const source = String(value ?? '')
  return language === 'fr' ? FR_TRANSLATIONS[source] || source : source
}
