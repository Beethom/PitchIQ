import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, ListOrdered, Trophy, Swords } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import CountryFlag from '../components/common/CountryFlag'
import { directSofaScoreImageUrl, localMediaUrl } from '../utils/mediaUrl'
import { playerService } from '../services/playerService'
import { useLanguage } from '../i18n/LanguageProvider'
import { FR_TRANSLATIONS } from '../i18n/translations'

const FEATURED_STATS = [
  'Ball possession',
  'Expected goals',
  'Total shots',
  'Shots on target',
  'Big chances',
  'Corner kicks',
  'Fouls',
  'Passes',
  'Accurate passes',
  'Interceptions',
  'Clearances',
  'Goalkeeper saves',
]

export default function WorldCupMatchDetail() {
  const { fixtureId } = useParams()
  const { language } = useLanguage()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const loadDetail = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      setError('')
      const live = effectiveStatusType(detail?.fixture, Date.now()) === 'inprogress'
      const force = quiet && live
      const ttlMs = live ? 8 * 1000 : 5 * 60 * 1000
      setDetail(await playerService.getWorldCupMatchDetail(fixtureId, { force, ttlMs }))
    } catch (err) {
      setError(err.message || 'Could not load match detail.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [detail?.fixture?.status_type, fixtureId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const effectiveDetailStatus = effectiveStatusType(detail?.fixture, now)

  useEffect(() => {
    if (effectiveDetailStatus !== 'inprogress') return undefined
    const timer = setInterval(() => loadDetail({ quiet: true }), 10000)
    return () => clearInterval(timer)
  }, [effectiveDetailStatus, loadDetail])

  useEffect(() => {
    if (!['notstarted', 'inprogress'].includes(effectiveDetailStatus)) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [effectiveDetailStatus])

  const rawFixture = detail?.fixture
  const statusType = effectiveDetailStatus
  const fixture = useMemo(() => {
    if (!rawFixture) return null
    return {
      ...rawFixture,
      status_type: statusType,
      status: displayStatus(rawFixture, statusType),
    }
  }, [rawFixture, statusType])
  const title = fixture ? `${fixture.home?.short_name || fixture.home?.name} vs ${fixture.away?.short_name || fixture.away?.name}` : 'World Cup Match'
  const stats = useMemo(() => prioritizeStats(detail?.stats ?? []), [detail?.stats])

  return (
    <div className="flex-1 min-w-0 bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <Link
            to="/world-cup/matches"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"
          >
            <ArrowLeft size={15} />
            Match Center
          </Link>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                <Trophy size={13} />
                Match Detail
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
              {fixture && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {translateText(fixture.group || 'World Cup', language)} · {formatFixtureDate(fixture.timestamp, fixture.date, language)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                to="/world-cup/matches"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft size={15} />
                Back to Match Center
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PageContainer>
        <div className="space-y-6">
          <Link
            to="/world-cup/matches"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={15} />
            Back to Match Center
          </Link>

          <WorldCupCategoryNav active="matches" />

          {loading && <Loader />}
          {error && <ErrorMessage message={error} onRetry={() => loadDetail()} />}

          {!loading && !error && fixture && (
            <>
              <Scoreboard fixture={fixture} now={now} language={language} />

              {statusType === 'notstarted' && (
                <InfoPanel
                  title="Upcoming Match"
                  icon={CalendarDays}
                  text="Probable lineups are shown when available. Confirmed lineups and live stats will update when the match feed publishes them."
                />
              )}

              {statusType === 'inprogress' && (
                <InfoPanel
                  title="Live Match"
                  icon={Clock}
                  text={stats.length ? 'Live match data refreshes every 10 seconds from the provider feed.' : 'The match is live. Stats will appear as soon as the provider publishes them.'}
                  live
                />
              )}

              {statusType === 'finished' && (
                <InfoPanel
                  title="Finished Match"
                  icon={Trophy}
                  text={detail.synced_match ? 'Final score and synced player performers are available.' : 'Final score is available. Admin refresh is available in Data Control once player stats are published.'}
                />
              )}

              <MatchTimeline incidents={detail.incidents ?? []} fixture={fixture} />

              <PressureGraph
                incidents={detail.incidents ?? []}
                stats={stats}
                momentum={detail.momentum ?? []}
                fixture={fixture}
                live={statusType === 'inprogress'}
                now={now}
                language={language}
              />

              {stats.length > 0 && (
                <BallTracking stats={stats} fixture={fixture} live={statusType === 'inprogress'} language={language} />
              )}

              {(detail.shotmap ?? []).length > 0 && (
                <MatchShotMap shots={detail.shotmap} fixture={fixture} language={language} />
              )}

              {detail.lineups && <Lineups lineups={detail.lineups} fixture={fixture} incidents={detail.incidents ?? []} />}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  )
}

function Scoreboard({ fixture, now, language }) {
  const hasStarted = fixture.status_type !== 'notstarted'
  const countdown = !hasStarted ? formatCountdown(fixture.timestamp, now) : null
  const liveClock = providerClock(fixture, now)

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-lg">
      {/* Top meta bar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <span className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
          {translateText(fixture.group || 'World Cup', language)}
        </span>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
          fixture.status_type === 'inprogress' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/70'
        }`}>
          {fixture.status_type === 'inprogress' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
          {fixture.status_type === 'inprogress' ? (isHalftime(fixture) ? translateText('Half-Time', language) : translateText('Live', language)) : translateText(hasStarted ? 'Full Time' : 'Scheduled', language)}
        </span>
      </div>

      {/* Scoreline */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-7 sm:px-8 sm:py-9">
        <TeamBlock team={fixture.home} align="left" />

        <div className="flex flex-col items-center px-2">
          {hasStarted ? (
            <div className="flex items-end gap-3 sm:gap-4">
              <span className="text-5xl font-black tabular-nums leading-none sm:text-6xl">{fixture.home?.score ?? 0}</span>
              <span className="pb-1 text-2xl font-black text-white/30 sm:text-3xl">:</span>
              <span className="text-5xl font-black tabular-nums leading-none sm:text-6xl">{fixture.away?.score ?? 0}</span>
            </div>
          ) : (
            <span className="text-3xl font-black text-white/40">{translateText('vs', language)}</span>
          )}
          {fixture.status_type === 'inprogress' && liveClock && (
            <span className="mt-3 rounded-full bg-red-500 px-3 py-1 text-xs font-black tabular-nums text-white shadow">
              {liveClock.main}
            </span>
          )}
          {fixture.status_type !== 'inprogress' && (
            <span className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
              {hasStarted ? translateText('Full Time', language) : formatKickoffTime(fixture.timestamp, fixture.date, language)}
            </span>
          )}
        </div>

        <TeamBlock team={fixture.away} align="right" />
      </div>

      {countdown && (
        <div className="border-t border-white/10 bg-black/20 px-5 py-3 text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">{translateText('Kickoff in', language)} </span>
          <span className="text-lg font-black tabular-nums text-white">{countdown.main}</span>
          {countdown.sub && <span className="ml-2 text-xs font-bold uppercase tracking-[0.14em] text-white/50">{countdown.sub}</span>}
        </div>
      )}
    </section>
  )
}

function TeamBlock({ team, align }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-3 text-center`}>
      <div className="rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15">
        <CountryFlag code={team?.flag_code} nationality={team?.name} size="lg" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-black sm:text-xl">{team?.name || 'TBD'}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{team?.short_name || team?.name || 'Team'}</p>
      </div>
    </div>
  )
}

function InfoPanel({ title, text, icon: Icon, live = false }) {
  return (
    <section className={`rounded-xl border p-4 shadow-sm ${live ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${live ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className={`font-black ${live ? 'text-red-950' : 'text-slate-950'}`}>{title}</p>
          <p className={`mt-1 text-sm leading-5 ${live ? 'text-red-700' : 'text-slate-500'}`}>{text}</p>
        </div>
      </div>
    </section>
  )
}

function buildPlayerIncidentMap(incidents = []) {
  const map = new Map()
  const ensure = (id) => {
    if (id == null) return null
    if (!map.has(id)) map.set(id, { goals: 0, penalties: 0, ownGoals: 0, assists: 0, yellow: 0, red: 0, subbedIn: false, subbedOut: false })
    return map.get(id)
  }
  incidents.forEach((inc) => {
    if (inc.type === 'goal') {
      const entry = ensure(inc.player_id)
      if (entry) {
        if (inc.subtype === 'ownGoal') entry.ownGoals += 1
        else if (inc.subtype === 'penalty') entry.penalties += 1
        else entry.goals += 1
      }
      const assistEntry = ensure(inc.assist_id)
      if (assistEntry) assistEntry.assists += 1
    } else if (inc.type === 'card') {
      const entry = ensure(inc.player_id)
      if (entry) {
        if (inc.subtype === 'red' || inc.subtype === 'yellowRed') entry.red += 1
        else entry.yellow += 1
      }
    } else if (inc.type === 'substitution') {
      const outEntry = ensure(inc.player_out_id)
      if (outEntry) outEntry.subbedOut = true
      const inEntry = ensure(inc.player_in_id)
      if (inEntry) inEntry.subbedIn = true
    }
  })
  return map
}

function PlayerBadges({ stats }) {
  if (!stats) return null
  const items = []
  const goalTotal = stats.goals + stats.penalties + stats.ownGoals
  if (goalTotal > 0) {
    items.push(
      <span key="goals" title="Goals" className="inline-flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-900 shadow-sm">
        <span>⚽</span>
        {goalTotal > 1 && <span>{goalTotal}</span>}
      </span>
    )
  }
  if (stats.subbedIn) items.push(<span key="sub-in" title="Subbed on" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-emerald-600 shadow-sm">↗</span>)
  if (stats.subbedOut) items.push(<span key="sub-out" title="Subbed off" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-red-600 shadow-sm">↙</span>)
  for (let i = 0; i < stats.assists; i++) items.push(<span key={`a${i}`} title="Assist" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-700 shadow-sm">A</span>)
  for (let i = 0; i < stats.yellow; i++) items.push(<span key={`y${i}`} className="inline-block h-3 w-2.5 rounded-sm bg-yellow-400" title="Yellow Card" />)
  for (let i = 0; i < stats.red; i++) items.push(<span key={`r${i}`} className="inline-block h-3 w-2.5 rounded-sm bg-red-600" title="Red Card" />)
  if (!items.length) return null
  return <span className="flex min-h-5 items-center justify-center gap-0.5 text-[10px] leading-none">{items}</span>
}

function avgRating(players = []) {
  const ratings = players.map((p) => Number(p.rating)).filter((r) => Number.isFinite(r) && r > 0)
  if (!ratings.length) return null
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
}

function Lineups({ lineups, fixture, incidents = [] }) {
  const confirmed = Boolean(lineups.confirmed)
  const incidentMap = useMemo(() => buildPlayerIncidentMap(incidents), [incidents])
  const home = lineups.home ?? {}
  const away = lineups.away ?? {}
  const homeRating = avgRating(home.starters)
  const awayRating = avgRating(away.starters)

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-xl font-black text-slate-950">{confirmed ? 'Confirmed Lineups' : 'Probable Lineups'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {confirmed ? 'Official starters and bench from the match feed.' : 'Expected starters from the provider. This can change before kickoff.'}
          </p>
        </div>
        <span className={`hidden w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] sm:inline-flex ${
          confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {confirmed ? 'Confirmed' : 'Probable'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 bg-white px-8 py-5">
            <LineupTeamHeader team={fixture.home} rating={homeRating} />
            <div className="flex items-end gap-12">
              <FormationKit formation={home.formation} color="home" />
              <FormationKit formation={away.formation} color="away" />
            </div>
            <LineupTeamHeader team={fixture.away} rating={awayRating} align="right" />
          </div>

          <SharedFormationPitch home={home} away={away} incidentMap={incidentMap} fixtureId={fixture?.fixture_id} />
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{fixture.home?.short_name || fixture.home?.name || 'Home'} Bench</p>
          {(home.bench ?? []).length > 0 ? (
            <PlayerList players={home.bench} compact incidentMap={incidentMap} fixtureId={fixture?.fixture_id} />
          ) : (
            <p className="text-sm text-slate-500">Bench not available yet.</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{fixture.away?.short_name || fixture.away?.name || 'Away'} Bench</p>
          {(away.bench ?? []).length > 0 ? (
            <PlayerList players={away.bench} compact incidentMap={incidentMap} fixtureId={fixture?.fixture_id} />
          ) : (
            <p className="text-sm text-slate-500">Bench not available yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function LineupTeamHeader({ team, rating, align = 'left' }) {
  const content = (
    <>
      {align !== 'right' && <CountryFlag code={team?.flag_code} nationality={team?.name} size="sm" />}
      <span className="truncate text-2xl font-black text-slate-950">{team?.name || 'TBD'}</span>
      {rating != null && (
        <span className={`flex h-8 min-w-[48px] items-center justify-center rounded-md px-2 text-lg font-black text-white ${ratingColor(rating)}`}>
          {rating.toFixed(2)}
        </span>
      )}
      {align === 'right' && <CountryFlag code={team?.flag_code} nationality={team?.name} size="sm" />}
    </>
  )

  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {content}
    </div>
  )
}

function FormationKit({ formation, color }) {
  const kitClass = color === 'home'
    ? 'from-red-900 via-red-700 to-red-950'
    : 'from-emerald-100 via-emerald-50 to-emerald-200'
  const sleeveClass = color === 'home' ? 'bg-slate-100' : 'bg-emerald-200'

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-2xl font-black tracking-tight text-slate-950">{formation || 'TBC'}</span>
      <span className="relative h-12 w-12 rounded-xl bg-slate-100 shadow-sm ring-1 ring-slate-200">
        <span className={`absolute left-1 top-2 h-5 w-3 -rotate-12 rounded-sm ${sleeveClass}`} />
        <span className={`absolute right-1 top-2 h-5 w-3 rotate-12 rounded-sm ${sleeveClass}`} />
        <span className={`absolute inset-x-3 bottom-1 top-1 rounded-b-lg rounded-t-sm bg-gradient-to-b ${kitClass}`} />
      </span>
    </div>
  )
}

function SharedFormationPitch({ home, away, incidentMap, fixtureId }) {
  const homeRows = buildFormationRows(home.starters ?? [], home.formation)
  const awayRows = [...buildFormationRows(away.starters ?? [], away.formation)].reverse()
  if (!homeRows.length && !awayRows.length) return null

  return (
    <div className="relative overflow-hidden border-y border-emerald-700/30 bg-[#3f8768] shadow-inner">
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_10%,transparent_10%,transparent_20%)]" />
      <div className="pointer-events-none absolute inset-0 border-[3px] border-white/35" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35" />

      <div className="pointer-events-none absolute left-0 top-1/2 h-48 w-16 -translate-y-1/2 border-y-[3px] border-r-[3px] border-white/30" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-28 w-8 -translate-y-1/2 border-y-[3px] border-r-[3px] border-white/30" />
      <div className="pointer-events-none absolute left-16 top-1/2 h-28 w-16 -translate-y-1/2 rounded-r-full border-y-[3px] border-r-[3px] border-white/20" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-48 w-16 -translate-y-1/2 border-y-[3px] border-l-[3px] border-white/30" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-28 w-8 -translate-y-1/2 border-y-[3px] border-l-[3px] border-white/30" />
      <div className="pointer-events-none absolute right-16 top-1/2 h-28 w-16 -translate-y-1/2 rounded-l-full border-y-[3px] border-l-[3px] border-white/20" />

      <div className="pointer-events-none absolute -left-5 -top-5 h-10 w-10 rounded-full border-[3px] border-white/30" />
      <div className="pointer-events-none absolute -right-5 -top-5 h-10 w-10 rounded-full border-[3px] border-white/30" />
      <div className="pointer-events-none absolute -bottom-5 -left-5 h-10 w-10 rounded-full border-[3px] border-white/30" />
      <div className="pointer-events-none absolute -bottom-5 -right-5 h-10 w-10 rounded-full border-[3px] border-white/30" />

      <div className="relative z-10 flex min-h-[560px]">
        <div className="flex flex-1 pr-4">
          {homeRows.map((row) => (
            <PitchColumn key={row.label} row={row} incidentMap={incidentMap} fixtureId={fixtureId} />
          ))}
        </div>
        <div className="flex flex-1 pl-4">
          {awayRows.map((row) => (
            <PitchColumn key={row.label} row={row} incidentMap={incidentMap} fixtureId={fixtureId} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PitchColumn({ row, incidentMap, fixtureId }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-around gap-4 py-8">
      {row.players.map((player) => (
        <PitchPlayer
          key={player.source_player_id || `${player.name}-${player.shirt_number}`}
          player={player}
          badges={incidentMap?.get(player.source_player_id)}
          fixtureId={fixtureId}
        />
      ))}
    </div>
  )
}

function ratingColor(rating) {
  const value = Number(rating)
  if (!Number.isFinite(value)) return 'bg-slate-500'
  if (value >= 8) return 'bg-emerald-600'
  if (value >= 7) return 'bg-emerald-500'
  if (value >= 6) return 'bg-amber-500'
  return 'bg-red-500'
}

function PitchPlayer({ player, badges, fixtureId }) {
  const rating = player.rating != null ? Number(player.rating) : null
  const cardColor = badges?.red ? 'bg-red-600' : badges?.yellow ? 'bg-yellow-400' : null
  const isGk = player.position === 'G' || player.position === 'GK'
  const content = (
    <div className="group relative mx-auto flex min-w-0 max-w-[112px] flex-col items-center gap-1">
      <div className="relative">
        <LineupPlayerPhoto player={player} isGk={isGk} />
        {player.captain && (
          <span
            className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-black text-slate-900 shadow ring-1 ring-white"
            title="Captain"
          >
            C
          </span>
        )}
        {cardColor && (
          <span className={`absolute -right-0.5 top-0 h-4 w-3 rounded-sm border border-white ${cardColor} shadow-sm`} />
        )}
      </div>
      {rating != null && (
        <span className={`relative z-10 -mt-4 flex h-6 min-w-[38px] items-center justify-center rounded px-1.5 text-xs font-black text-white shadow-sm ring-1 ring-white/80 ${ratingColor(rating)}`}>
          {rating.toFixed(1)}
        </span>
      )}
      <span className="w-full truncate text-center text-sm font-black leading-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
        {player.shirt_number ? `${player.shirt_number} ` : ''}{player.short_name || player.name}
      </span>
      <PlayerBadges stats={badges} />
    </div>
  )

  if (player.id) {
    const profileUrl = fixtureId ? `/player/${player.id}?fixture=${fixtureId}` : `/player/${player.id}`
    return (
      <Link to={profileUrl} className="min-w-0 rounded-lg outline-none ring-white/50 hover:scale-[1.03] focus:ring-2">
        {content}
      </Link>
    )
  }

  return <div className="min-w-0">{content}</div>
}

function LineupPlayerPhoto({ player, isGk = false, size = 'h-14 w-14' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [useDirectImage, setUseDirectImage] = useState(false)
  const sourcePhotoUrl = player.photo_url || (player.source_player_id ? `/api/media/player/${player.source_player_id}/image` : '')
  const localPhotoUrl = localMediaUrl(sourcePhotoUrl)
  const directPhotoUrl = directSofaScoreImageUrl(sourcePhotoUrl)
  const photoUrl = useDirectImage && directPhotoUrl ? directPhotoUrl : localPhotoUrl
  const ring = isGk ? 'border-amber-300' : 'border-white'

  return (
    <div className={`relative ${size} overflow-hidden rounded-full border-[3px] ${ring} bg-slate-100 shadow-[0_3px_10px_rgba(15,23,42,0.25)]`}>
      {photoUrl && !imgFailed ? (
        <img
          src={photoUrl}
          alt={player.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
          onError={() => {
            if (!useDirectImage && directPhotoUrl) {
              setUseDirectImage(true)
              return
            }
            setImgFailed(true)
          }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-black text-slate-600">
          {initials(player.short_name || player.name)}
        </span>
      )}
    </div>
  )
}

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

function buildFormationRows(starters = [], formation = '') {
  if (!starters.length) return []

  const gkIndex = starters.findIndex((player) => player.position === 'G' || player.position === 'GK')
  const goalkeeper = starters[gkIndex >= 0 ? gkIndex : 0]
  const outfield = starters.filter((_, index) => index !== (gkIndex >= 0 ? gkIndex : 0))
  const shape = String(formation || '').match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? []

  if (shape.length && shape.reduce((sum, count) => sum + count, 0) === outfield.length) {
    const rows = [{ label: 'GK', players: [goalkeeper] }]
    let cursor = 0
    shape.forEach((count, index) => {
      rows.push({ label: `L${index + 1}`, players: outfield.slice(cursor, cursor + count) })
      cursor += count
    })
    return rows
  }

  const byPosition = {
    GK: [goalkeeper],
    DEF: outfield.filter((player) => player.position === 'D'),
    MID: outfield.filter((player) => player.position === 'M'),
    ATT: outfield.filter((player) => player.position === 'F'),
  }
  const used = new Set([goalkeeper.source_player_id || goalkeeper.name])
  Object.values(byPosition).flat().forEach((player) => used.add(player.source_player_id || player.name))
  const other = outfield.filter((player) => !used.has(player.source_player_id || player.name))

  return [
    { label: 'GK', players: byPosition.GK },
    { label: 'DEF', players: byPosition.DEF },
    { label: 'MID', players: byPosition.MID },
    { label: 'ATT', players: [...byPosition.ATT, ...other] },
  ].filter((row) => row.players.length)
}

function PlayerList({ players, compact = false, incidentMap, fixtureId }) {
  if (!players.length) return <p className="text-sm text-slate-500">Lineup not available yet.</p>

  return (
    <div className={compact ? 'grid gap-1.5 sm:grid-cols-2' : 'space-y-1.5'}>
      {players.map((player) => {
        const badges = incidentMap?.get(player.source_player_id)
        const rating = player.rating != null ? Number(player.rating) : null
        const content = (
          <>
            <div className="relative shrink-0">
              <LineupPlayerPhoto player={player} size="h-9 w-9" />
              {player.shirt_number != null && (
                <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-black text-white ring-1 ring-white">
                  {player.shirt_number}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950">{player.short_name || player.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {player.position || 'POS'}
              </p>
            </div>
            <PlayerBadges stats={badges} />
            {rating != null && (
              <span className={`flex h-5 min-w-[34px] items-center justify-center rounded px-1 text-[11px] font-black text-white ${ratingColor(rating)}`}>
                {rating.toFixed(1)}
              </span>
            )}
          </>
        )

        if (player.id) {
          const profileUrl = fixtureId ? `/player/${player.id}?fixture=${fixtureId}` : `/player/${player.id}`
          return (
            <Link
              key={player.source_player_id || `${player.name}-${player.shirt_number}`}
              to={profileUrl}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white"
            >
              {content}
            </Link>
          )
        }

        return (
          <div
            key={player.source_player_id || `${player.name}-${player.shirt_number}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5"
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}

function MatchShotMap({ shots, fixture, language }) {
  const homeName = fixture.home?.short_name || fixture.home?.name || 'Home'
  const awayName = fixture.away?.short_name || fixture.away?.name || 'Away'
  const dotColor = (type) => (
    type === 'goal' ? 'bg-emerald-500' : type === 'save' ? 'bg-amber-400' : type === 'block' ? 'bg-orange-500' : type === 'post' ? 'bg-white' : 'bg-red-500'
  )

  // Home attacks left→right (placed on left half), away right→left (right half).
  const place = (shot) => {
    if (shot.x == null || shot.y == null) return null
    const lengthPct = shot.is_home ? shot.x / 2 : 100 - shot.x / 2
    const widthPct = shot.is_home ? shot.y : 100 - shot.y
    return { left: `${lengthPct}%`, top: `${widthPct}%` }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Swords size={18} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-950">{translateText('Shot Map', language)}</h2>
          <p className="mt-1 text-sm text-slate-500">Every shot in the match with its pitch location.</p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs font-black text-slate-500">
        <span className="text-sky-600">← {homeName}</span>
        <span className="text-emerald-600">{awayName} →</span>
      </div>
      <div className="relative aspect-[2/1] overflow-hidden rounded-xl border border-emerald-700/30 bg-emerald-700">
        <div className="pointer-events-none absolute inset-3 rounded-lg border-2 border-white/40" />
        <div className="pointer-events-none absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 bg-white/40" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[26%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
        <div className="pointer-events-none absolute left-3 top-1/2 h-[42%] w-[10%] -translate-y-1/2 border-y-2 border-r-2 border-white/40" />
        <div className="pointer-events-none absolute right-3 top-1/2 h-[42%] w-[10%] -translate-y-1/2 border-y-2 border-l-2 border-white/40" />
        {shots.map((shot, i) => {
          const pos = place(shot)
          if (!pos) return null
          return (
            <span
              key={i}
              className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow ${dotColor(shot.type)} ${shot.type === 'goal' ? 'ring-2 ring-white' : ''}`}
              style={pos}
              title={`${shot.player ?? ''} ${shot.minute ?? ''}' · ${shot.type} · xG ${Number(shot.xg ?? 0).toFixed(2)}`}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" /> Goal</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> On target</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Off target</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Blocked</span>
      </div>
    </section>
  )
}

function BallTracking({ stats, fixture, live, language }) {
  // Show every stat the provider returns, grouped by category. Keep only the
  // full-match (ALL) period rows, de-duplicated by name.
  const allRows = []
  const seen = new Set()
  for (const stat of stats) {
    if (stat.period && stat.period !== 'ALL') continue
    const name = stat.name
    if (!name || seen.has(name)) continue
    if (stat.home == null && stat.away == null) continue
    seen.add(name)
    allRows.push({
      label: name,
      group: stat.group || 'Other',
      home: stat.home,
      away: stat.away,
      homeValue: numericValue(stat.home_raw ?? stat.home),
      awayValue: numericValue(stat.away_raw ?? stat.away),
    })
  }

  const possession = allRows.find((row) => normalize(row.label).includes('ball possession'))
  const homePossession = possession?.homeValue ?? 50
  const awayPossession = possession?.awayValue ?? Math.max(0, 100 - homePossession)
  const totalPossession = Math.max(1, homePossession + awayPossession)
  const homePct = (homePossession / totalPossession) * 100
  const awayPct = 100 - homePct
  const homeName = fixture.home?.short_name || fixture.home?.name || 'Home'
  const awayName = fixture.away?.short_name || fixture.away?.name || 'Away'

  // Preserve provider group order while bucketing rows by category.
  const groupOrder = []
  const grouped = new Map()
  for (const row of allRows) {
    if (normalize(row.label).includes('ball possession')) continue
    if (!grouped.has(row.group)) {
      grouped.set(row.group, [])
      groupOrder.push(row.group)
    }
    grouped.get(row.group).push(row)
  }

  const renderRow = (row) => {
    const total = row.homeValue + row.awayValue
    const rowHomePct = total > 0 ? (row.homeValue / total) * 100 : 50
    const rowAwayPct = total > 0 ? (row.awayValue / total) * 100 : 50
    return (
      <div key={row.label} className="py-1.5">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <span className="text-xs font-black tabular-nums text-slate-950">{formatStatValue(row.home)}</span>
          <span className="truncate text-center text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{translateText(row.label, language)}</span>
          <span className="text-right text-xs font-black tabular-nums text-slate-950">{formatStatValue(row.away)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-slate-100">
            <div className="h-1 rounded-l-full bg-sky-500" style={{ width: `${Math.max(4, rowHomePct)}%` }} />
          </div>
          <div className="flex-1 overflow-hidden rounded-r-full bg-slate-100">
            <div className="h-1 rounded-r-full bg-emerald-500" style={{ width: `${Math.max(4, rowAwayPct)}%` }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${live ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
          <Swords size={18} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-950">{translateText('Match Statistics', language)}</h2>
          <p className="mt-1 text-sm text-slate-500">{live ? 'Live full match statistics from the match feed.' : 'Full match statistics from the provider feed.'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
          <span className="truncate">{homeName}</span>
          <span className="text-slate-400">{translateText('Ball possession', language)}</span>
          <span className="truncate text-right">{awayName}</span>
        </div>
        <div className="flex h-5 overflow-hidden rounded-full bg-white shadow-inner">
          <div className="bg-sky-500" style={{ width: `${homePct}%` }} />
          <div className="bg-emerald-500" style={{ width: `${awayPct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm font-black text-slate-950">
          <span>{Math.round(homePct)}%</span>
          <span>{Math.round(awayPct)}%</span>
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-3 lg:grid-cols-2">
        {groupOrder.map((group) => (
          <div key={group} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <h3 className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{translateText(group, language)}</h3>
            <div className="divide-y divide-slate-100">
              {grouped.get(group).map(renderRow)}
            </div>
          </div>
        ))}
      </div>

      {!allRows.length && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">Match statistics not available yet.</p>
      )}
    </section>
  )
}

function findStat(stats, label) {
  const wanted = normalize(label)
  return stats.find((stat) => normalize(stat.name).includes(wanted))
}

function MatchTimeline({ incidents, fixture }) {
  const events = incidents.filter((i) => ['goal', 'card', 'substitution', 'var', 'corner'].includes(i.type))

  function minuteLabel(inc) {
    const base = inc.minute ?? 0
    const added = inc.added_time ?? 0
    return added > 0 ? `${base}+${added}'` : `${base}'`
  }

  function IncidentIcon({ type, subtype }) {
    if (type === 'goal') {
      if (subtype === 'ownGoal') return <span title="Own Goal" className="text-base">⚽️</span>
      if (subtype === 'penalty') return <span title="Penalty" className="text-base">🥅</span>
      return <span title="Goal" className="text-base">⚽️</span>
    }
    if (type === 'card') {
      if (subtype === 'red' || subtype === 'yellowRed') return <span className="inline-block h-4 w-3 rounded-sm bg-red-600" title="Red Card" />
      return <span className="inline-block h-4 w-3 rounded-sm bg-yellow-400" title="Yellow Card" />
    }
    if (type === 'substitution') return <span title="Substitution" className="text-base">🔄</span>
    if (type === 'var') return <span title="VAR" className="text-[11px] font-black text-violet-600">VAR</span>
    if (type === 'corner') return <span title="Corner Kick" className="text-base">▰</span>
    return null
  }

  function IncidentText({ inc }) {
    if (inc.type === 'goal') {
      return (
        <span>
          <span className="font-black text-slate-950">{inc.player}</span>
          {inc.subtype === 'penalty' && <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">(pen)</span>}
          {inc.subtype === 'ownGoal' && <span className="ml-1 text-[10px] font-bold uppercase text-red-500">(og)</span>}
          {inc.assist && <span className="text-slate-400"> · {inc.assist}</span>}
        </span>
      )
    }
    if (inc.type === 'card') return <span className="font-semibold text-slate-700">{inc.player}</span>
    if (inc.type === 'substitution') return (
      <span>
        <span className="text-emerald-600 font-semibold">↑ {inc.player_in}</span>
        <span className="text-slate-400 mx-1">/</span>
        <span className="text-red-500 font-semibold">↓ {inc.player_out}</span>
      </span>
    )
    if (inc.type === 'var') return <span className="text-slate-500">{inc.description || 'VAR review'}</span>
    if (inc.type === 'corner') return <span className="font-semibold text-slate-700">{inc.description || 'Corner kick'}</span>
    return null
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Swords size={18} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-950">Match Events</h2>
          <p className="text-sm text-slate-500">Goals, corners, cards, substitutions and VAR decisions</p>
        </div>
      </div>

      <div className="space-y-1">
        {events.map((inc, idx) => {
          const isHome = inc.is_home
          return (
            <div key={idx} className={`grid grid-cols-[1fr_60px_1fr] items-center gap-2 rounded-lg px-2 py-2 ${inc.type === 'goal' ? 'bg-slate-50' : ''}`}>
              {/* Home side */}
              <div className={`flex items-center gap-2 ${isHome ? '' : 'opacity-0 pointer-events-none'}`}>
                <IncidentIcon type={inc.type} subtype={inc.subtype} />
                <span className="text-sm"><IncidentText inc={inc} /></span>
              </div>
              {/* Minute */}
              <div className="text-center">
                <span className="text-xs font-black tabular-nums text-slate-400">{minuteLabel(inc)}</span>
              </div>
              {/* Away side */}
              <div className={`flex items-center justify-end gap-2 ${!isHome ? '' : 'opacity-0 pointer-events-none'}`}>
                <span className="text-sm text-right"><IncidentText inc={inc} /></span>
                <IncidentIcon type={inc.type} subtype={inc.subtype} />
              </div>
            </div>
          )
        })}
        {events.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">No events yet</p>
        )}
      </div>
    </section>
  )
}

function PressureGraph({ incidents = [], stats = [], momentum = [], fixture, live, now, language }) {
  const real = momentum.length > 0
  const buckets = useMemo(() => {
    if (real) {
      const max = Math.max(1, ...momentum.map((p) => Math.abs(Number(p.value) || 0)))
      return momentum.map((p, index) => ({
        index,
        minute: Number(p.minute) || 0,
        diffPct: Math.max(-100, Math.min(100, ((Number(p.value) || 0) / max) * 100)),
      }))
    }
    return buildMomentumBuckets(stats, incidents)
  }, [real, momentum, incidents, stats])

  const homeName = fixture.home?.short_name || fixture.home?.name || translateText('Home', language)
  const awayName = fixture.away?.short_name || fixture.away?.name || translateText('Away', language)
  const summary = real
    ? (live ? 'Live attack momentum from the match feed.' : 'Attack momentum from the match feed.')
    : (live ? 'Attacking pressure estimated from match events and control stats.' : 'Match pressure estimated from events and control stats.')

  const minute = live ? providerClock(fixture, now)?.minute ?? 0 : fixture.status_type === 'finished' ? 90 : 0
  const nowPct = Math.max(0, Math.min(100, (minute / 90) * 100))
  const elapsedBuckets = real
    ? buckets.filter((b) => b.minute <= minute || !live).length
    : Math.max(0, Math.min(buckets.length, Math.ceil((minute / 90) * buckets.length)))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${live ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
          <Swords size={18} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-950">{translateText('Attack Momentum', language)}</h2>
          <p className="mt-1 text-sm text-slate-500">{translateText(summary, language)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
          <span className="truncate text-emerald-600">{homeName}</span>
          <span className="text-slate-400">{translateText('Attacking pressure', language)}</span>
          <span className="truncate text-right text-blue-700">{awayName}</span>
        </div>
        <div className="relative h-40 rounded-lg bg-white">
          {/* elapsed shading */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-50"
            style={{ width: `${nowPct}%` }}
            aria-hidden="true"
          />
          {/* center baseline */}
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-300" aria-hidden="true" />
          {/* bars */}
          <div
            className="absolute inset-0 grid items-stretch gap-[2px] px-px"
            style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
          >
            {buckets.map((bucket, index) => {
              const isHomeUp = bucket.diffPct >= 0
              const magnitude = Math.abs(bucket.diffPct)
              const isPast = index < elapsedBuckets
              return (
                <div
                  key={bucket.index}
                  className="group relative flex min-w-0 flex-col justify-center"
                >
                  <div className="flex h-1/2 items-end justify-center">
                    {isHomeUp && (
                      <div
                        className={`w-full rounded-t-sm ${isPast ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                        style={{ height: `${magnitude}%` }}
                      />
                    )}
                  </div>
                  <div className="flex h-1/2 items-start justify-center">
                    {!isHomeUp && (
                      <div
                        className={`w-full rounded-b-sm ${isPast ? 'bg-blue-700' : 'bg-blue-200'}`}
                        style={{ height: `${magnitude}%` }}
                      />
                    )}
                  </div>
                  <div className="absolute inset-0 cursor-default" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] font-black text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {real ? `${bucket.minute}'` : `${bucket.minute}'–${Math.min(90, bucket.minute + 5)}'`}
                  </div>
                </div>
              )
            })}
          </div>
          {/* live "now" marker */}
          {live && (
            <div
              className="absolute inset-y-0 w-px bg-red-500"
              style={{ left: `${nowPct}%` }}
              aria-hidden="true"
            >
              <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
              <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          <span>0'</span>
          <span className="text-center">HT</span>
          <span className="text-right">90'</span>
        </div>
      </div>
    </section>
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

function buildMomentumBuckets(stats = [], incidents = []) {
  const bucketCount = 18
  const values = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    minute: index * 5,
    home: 0,
    away: 0,
  }))

  const possession = findStat(stats, 'Ball possession')
  const shots = findStat(stats, 'Total shots')
  const shotsOnTarget = findStat(stats, 'Shots on target')
  const xg = findStat(stats, 'Expected goals')
  const finalThird = findStat(stats, 'Final third passes')
  const corners = findStat(stats, 'Corner kicks')
  const bigChances = findStat(stats, 'Big chances')

  const homeControl =
    numericValue(possession?.home_raw ?? possession?.home) * 0.028 +
    numericValue(shots?.home_raw ?? shots?.home) * 0.18 +
    numericValue(shotsOnTarget?.home_raw ?? shotsOnTarget?.home) * 0.38 +
    numericValue(xg?.home_raw ?? xg?.home) * 1.35 +
    numericValue(finalThird?.home_raw ?? finalThird?.home) * 0.03 +
    numericValue(corners?.home_raw ?? corners?.home) * 0.18 +
    numericValue(bigChances?.home_raw ?? bigChances?.home) * 0.55
  const awayControl =
    numericValue(possession?.away_raw ?? possession?.away) * 0.028 +
    numericValue(shots?.away_raw ?? shots?.away) * 0.18 +
    numericValue(shotsOnTarget?.away_raw ?? shotsOnTarget?.away) * 0.38 +
    numericValue(xg?.away_raw ?? xg?.away) * 1.35 +
    numericValue(finalThird?.away_raw ?? finalThird?.away) * 0.03 +
    numericValue(corners?.away_raw ?? corners?.away) * 0.18 +
    numericValue(bigChances?.away_raw ?? bigChances?.away) * 0.55

  const controlBias = Math.max(-2, Math.min(2, ((homeControl || 1.8) - (awayControl || 1.8)) * 0.15))
  values.forEach((bucket) => {
    const wave = Math.sin((bucket.index / bucketCount) * Math.PI * 2 + 0.6)
    bucket.home = 1.6 + Math.max(0, controlBias) + Math.max(0, wave) * 2.4
    bucket.away = 1.6 + Math.max(0, -controlBias) + Math.max(0, -wave) * 2.4
  })

  incidents.forEach((incident) => {
    const minute = Number(incident.minute ?? 0)
    if (!Number.isFinite(minute)) return
    const index = Math.max(0, Math.min(bucketCount - 1, Math.floor(minute / 5)))
    const type = normalize(incident.type)
    const subtype = normalize(incident.subtype)
    const weight =
      type === 'goal' ? 4.8 :
        subtype.includes('penalty') ? 3.4 :
          type === 'var' ? 2.4 :
            type === 'card' ? 0.9 :
              type === 'substitution' ? 0.45 : 1.4

    ;[-1, 0, 1].forEach((offset) => {
      const targetIndex = index + offset
      if (targetIndex < 0 || targetIndex >= bucketCount) return
      const falloff = offset === 0 ? 1 : 0.42
      if (incident.is_home) values[targetIndex].home += weight * falloff
      else values[targetIndex].away += weight * falloff
    })
  })

  const max = Math.max(1, ...values.flatMap((bucket) => [bucket.home, bucket.away]))
  const maxDiff = Math.max(1, ...values.map((bucket) => Math.abs(bucket.home - bucket.away)))
  return values.map((bucket) => ({
    ...bucket,
    homePct: Math.max(8, (bucket.home / max) * 100),
    awayPct: Math.max(8, (bucket.away / max) * 100),
    diffPct: Math.max(-100, Math.min(100, ((bucket.home - bucket.away) / maxDiff) * 100)),
  }))
}

function matchProgress(fixture, nowMs) {
  if (fixture.status_type === 'finished') return 100
  if (fixture.status_type === 'notstarted') return 0
  if (isHalftime(fixture)) return 50
  const minute = providerClock(fixture, nowMs)?.minute ?? 0
  return Math.max(0, Math.min(100, (minute / 90) * 100))
}

function isHalftime(fixture) {
  const status = normalize(fixture?.status || '')
  return status.includes('halftime') || status.includes('half time') || status === 'ht'
}

function providerClock(fixture, nowMs) {
  if (fixture.status_type === 'notstarted') return { main: '00:00', minute: 0, seconds: 0 }
  if (fixture.status_type === 'finished') return { main: '90:00', minute: 90, seconds: 0 }
  if (isHalftime(fixture)) return { main: 'HT', minute: 45, seconds: 0 }

  const periodStart = Number(fixture.current_period_start_timestamp)
  if (Number.isFinite(periodStart) && periodStart > 0) {
    const elapsedSeconds = Math.max(0, Math.floor(nowMs / 1000 - periodStart))
    const seconds = elapsedSeconds % 60
    const elapsedMinutes = Math.floor(elapsedSeconds / 60)
    const providerMinute = fixture.current_minute != null && Number.isFinite(Number(fixture.current_minute))
      ? Number(fixture.current_minute)
      : null
    const periodBase = providerMinute == null ? periodMinuteBase(fixture) : Math.max(0, providerMinute - elapsedMinutes)
    const minute = Math.max(0, periodBase + elapsedMinutes)
    return {
      main: `${String(minute).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      minute,
      seconds,
    }
  }

  if (fixture.current_minute != null && Number.isFinite(Number(fixture.current_minute))) {
    const minute = Math.max(0, Number(fixture.current_minute))
    return { main: `${minute}'`, minute, seconds: 0 }
  }

  return null
}

function periodMinuteBase(fixture) {
  const status = normalize(`${fixture.status} ${fixture.status_type}`)
  if (status.includes('extra')) return 90
  if (status.includes('2nd') || status.includes('second') || status.includes('halftime')) return 45
  return 0
}

function formatKickoffTime(timestamp, fallback, language = 'en') {
  const locale = language === 'fr' ? 'fr-FR' : undefined
  const date = timestamp
    ? new Date(timestamp * 1000)
    : fallback
      ? new Date(`${fallback}T12:00:00`)
      : null

  if (!date || Number.isNaN(date.getTime())) return translateText('Kickoff', language)
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function prioritizeStats(stats) {
  const allPeriod = stats.filter((stat) => !stat.period || stat.period === 'ALL')
  const source = allPeriod.length ? allPeriod : stats
  const normalized = source.map((stat, index) => ({ ...stat, _index: index, _name: normalize(stat.name) }))
  return normalized.sort((a, b) => {
    const ai = FEATURED_STATS.findIndex((name) => a._name.includes(normalize(name)))
    const bi = FEATURED_STATS.findIndex((name) => b._name.includes(normalize(name)))
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a._index - b._index
  })
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace('%', '').split('/')[0].trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatStatValue(value) {
  if (value == null || value === '') return '-'
  return String(value)
}

function statusClass(statusType) {
  if (statusType === 'inprogress') return 'bg-red-50 text-red-700'
  if (statusType === 'finished') return 'bg-slate-200 text-slate-700'
  return 'bg-emerald-50 text-emerald-700'
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

function translateText(value, language) {
  const source = String(value ?? '')
  return language === 'fr' ? FR_TRANSLATIONS[source] || source : source
}
