import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, ListOrdered, Trophy, Swords, Users } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts'
import PageContainer from '../components/layout/PageContainer'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import CountryFlag from '../components/common/CountryFlag'
import PlayerAvatar from '../components/player/PlayerAvatar'
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
      const force = quiet && detail?.fixture?.status_type === 'inprogress'
      const ttlMs = detail?.fixture?.status_type === 'inprogress' ? 20 * 1000 : 5 * 60 * 1000
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

  useEffect(() => {
    if (detail?.fixture?.status_type !== 'inprogress') return undefined
    const timer = setInterval(() => loadDetail({ quiet: true }), 30000)
    return () => clearInterval(timer)
  }, [detail?.fixture?.status_type, loadDetail])

  useEffect(() => {
    if (detail?.fixture?.status_type !== 'notstarted' || !detail?.fixture?.timestamp) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [detail?.fixture?.status_type, detail?.fixture?.timestamp])

  const fixture = detail?.fixture
  const statusType = fixture?.status_type
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
                  text={stats.length ? 'Live team stats are refreshing every 30 seconds.' : 'The match is live. Stats will appear as soon as the provider publishes them.'}
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

              {detail.incidents?.length > 0 && (
                <MatchTimeline incidents={detail.incidents} fixture={fixture} />
              )}

              {stats.length > 0 && (
                <TeamRadar stats={stats} fixture={fixture} live={statusType === 'inprogress'} />
              )}

              {detail.lineups && (
                <PlayerMinutes
                  lineups={detail.lineups}
                  incidents={detail.incidents ?? []}
                  fixture={fixture}
                  currentMinute={fixture.current_minute}
                  live={statusType === 'inprogress'}
                />
              )}

              {detail.lineups && <Lineups lineups={detail.lineups} fixture={fixture} />}

              {stats.length > 0 && <TeamStats stats={stats} fixture={fixture} live={statusType === 'inprogress'} language={language} />}

              {detail.synced_match?.top_performers?.length > 0 && (
                <TopPerformers players={detail.synced_match.top_performers} />
              )}
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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClass(fixture.status_type)}`}>
          {fixture.status}
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{translateText('Fixture', language)} {fixture.fixture_id}</span>
      </div>
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <TeamBlock team={fixture.home} align="left" />
        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-center text-white">
          {fixture.status_type === 'inprogress' && (
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Live</span>
              {fixture.current_minute != null && (
                <span className="text-[10px] font-bold text-white/50">{fixture.current_minute}'</span>
              )}
            </div>
          )}
          <p className="text-4xl font-black tabular-nums">
            {hasStarted ? `${fixture.home?.score ?? 0} - ${fixture.away?.score ?? 0}` : '-'}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
            {fixture.status_type === 'inprogress' ? fixture.status : hasStarted ? 'Full Time' : 'Kickoff'}
          </p>
        </div>
        <TeamBlock team={fixture.away} align="right" />
      </div>
      {countdown && (
        <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Kickoff in</p>
          <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{countdown.main}</p>
          {countdown.sub && <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-sky-700">{countdown.sub}</p>}
        </div>
      )}
    </section>
  )
}

function TeamBlock({ team, align }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align !== 'right' && <CountryFlag code={team?.flag_code} nationality={team?.name} size="md" />}
      <div className="min-w-0">
        <p className="truncate text-xl font-black text-slate-950">{team?.name || 'TBD'}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{team?.short_name || team?.name || 'Team'}</p>
      </div>
      {align === 'right' && <CountryFlag code={team?.flag_code} nationality={team?.name} size="md" />}
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

function Lineups({ lineups, fixture }) {
  const confirmed = Boolean(lineups.confirmed)
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">{confirmed ? 'Confirmed Lineups' : 'Probable Lineups'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {confirmed ? 'Official starters and bench from the match feed.' : 'Expected starters from the provider. This can change before kickoff.'}
          </p>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
          confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {confirmed ? 'Confirmed' : 'Probable'}
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TeamLineup team={fixture.home} lineup={lineups.home} />
        <TeamLineup team={fixture.away} lineup={lineups.away} />
      </div>
    </section>
  )
}

function TeamLineup({ team, lineup = {} }) {
  const starters = lineup.starters ?? []
  const bench = lineup.bench ?? []

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CountryFlag code={team?.flag_code} nationality={team?.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{team?.name || 'TBD'}</p>
            <p className="text-xs font-semibold text-slate-400">{lineup.formation || 'Formation TBC'}</p>
          </div>
        </div>
        <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          XI
        </span>
      </div>

      <FormationPitch team={team} starters={starters} formation={lineup.formation} />

      <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Starters</p>
      <PlayerList players={starters} />

      {bench.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Bench</p>
          <PlayerList players={bench} compact />
        </div>
      )}
    </div>
  )
}

function FormationPitch({ team, starters = [], formation }) {
  const rows = buildFormationRows(starters, formation)
  if (!rows.length) return null

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-700/30 bg-emerald-700 p-3 shadow-inner">
      <div className="pointer-events-none absolute inset-3 rounded-lg border border-white/40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />
      <div className="pointer-events-none absolute left-3 right-3 top-1/2 border-t border-white/25" />
      <div className="pointer-events-none absolute left-1/2 top-3 h-16 w-28 -translate-x-1/2 rounded-b-xl border-x border-b border-white/30" />
      <div className="pointer-events-none absolute bottom-3 left-1/2 h-16 w-28 -translate-x-1/2 rounded-t-xl border-x border-t border-white/30" />

      <div className="relative z-10 mb-3 flex items-center justify-between gap-3 px-1 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <CountryFlag code={team?.flag_code} nationality={team?.name} size="xs" />
          <span className="truncate text-xs font-black">{team?.short_name || team?.name || 'Team'}</span>
        </div>
        <span className="text-xs font-black">{formation || 'Shape TBC'}</span>
      </div>

      <div className="relative z-10 flex min-h-[390px] flex-col justify-between gap-4 py-5">
        {[...rows].reverse().map((row) => (
          <div
            key={row.label}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.max(row.players.length, 1)}, minmax(0, 1fr))` }}
          >
            {row.players.map((player) => (
              <PitchPlayer key={player.source_player_id || `${player.name}-${player.shirt_number}`} player={player} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function PitchPlayer({ player }) {
  const content = (
    <div className="mx-auto flex min-w-0 max-w-[96px] flex-col items-center gap-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white text-xs font-black text-emerald-800 shadow-sm">
        {player.shirt_number || '-'}
      </span>
      <span className="w-full truncate rounded-md bg-emerald-950/55 px-1.5 py-0.5 text-center text-[10px] font-black leading-4 text-white shadow-sm">
        {player.short_name || player.name}
      </span>
    </div>
  )

  if (player.id) {
    return (
      <Link to={`/player/${player.id}`} className="min-w-0 rounded-lg outline-none ring-white/50 hover:scale-[1.03] focus:ring-2">
        {content}
      </Link>
    )
  }

  return <div className="min-w-0">{content}</div>
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

function PlayerList({ players, compact = false }) {
  if (!players.length) return <p className="text-sm text-slate-500">Lineup not available yet.</p>

  return (
    <div className={compact ? 'grid gap-1.5 sm:grid-cols-2' : 'space-y-1.5'}>
      {players.map((player) => {
        const content = (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-500">
              {player.shirt_number || '-'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950">{player.short_name || player.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {player.position || 'POS'}{player.rating ? ` · ${Number(player.rating).toFixed(1)}` : ''}
              </p>
            </div>
            {(player.goals || player.assists) ? (
              <span className="text-[10px] font-black text-slate-500">
                {player.goals || 0}G {player.assists || 0}A
              </span>
            ) : null}
          </>
        )

        if (player.id) {
          return (
            <Link
              key={player.source_player_id || `${player.name}-${player.shirt_number}`}
              to={`/player/${player.id}`}
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

function TeamStats({ stats, fixture, live, language }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">{live ? 'Live Stats' : 'Match Stats'}</h2>
          <p className="mt-1 text-sm text-slate-500">Team comparison from the provider feed.</p>
        </div>
      </div>
      <div className="space-y-4">
        {stats.slice(0, 14).map((stat) => (
          <StatRow key={`${stat.period}-${stat.group}-${stat.key || stat.name}`} stat={stat} home={fixture.home} away={fixture.away} language={language} />
        ))}
      </div>
    </section>
  )
}

function StatRow({ stat, home, away, language }) {
  const homeValue = numericValue(stat.home_raw ?? stat.home)
  const awayValue = numericValue(stat.away_raw ?? stat.away)
  const total = homeValue + awayValue
  const homePct = total > 0 ? (homeValue / total) * 100 : 50
  const awayPct = total > 0 ? (awayValue / total) * 100 : 50

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="truncate text-sm font-black text-slate-950">{formatStatValue(stat.home)}</p>
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{translateText(stat.name, language)}</p>
        <p className="truncate text-right text-sm font-black text-slate-950">{formatStatValue(stat.away)}</p>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex justify-end rounded-l-full bg-slate-100">
          <div
            className="h-2 rounded-l-full bg-sky-500"
            title={home?.name}
            style={{ width: `${Math.max(8, homePct)}%` }}
          />
        </div>
        <div className="rounded-r-full bg-slate-100">
          <div
            className="h-2 rounded-r-full bg-emerald-500"
            title={away?.name}
            style={{ width: `${Math.max(8, awayPct)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function TopPerformers({ players }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">Top Performers</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {players.map((player) => (
          <Link
            key={player.source_player_id || player.id || player.name}
            to={player.id ? `/player/${player.id}` : '#'}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-sky-200 hover:bg-sky-50"
          >
            <PlayerAvatar player={player} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
              <p className="truncate text-xs text-slate-500">{player.club} · {player.position}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-slate-950">{player.stats?.rating ? Number(player.stats.rating).toFixed(1) : '-'}</p>
              <p className="text-[10px] text-slate-400">{player.stats?.goals ?? 0}G {player.stats?.assists ?? 0}A</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function MatchTimeline({ incidents, fixture }) {
  const events = incidents.filter((i) => ['goal', 'card', 'substitution', 'var'].includes(i.type))

  function minuteLabel(inc) {
    const base = inc.minute ?? 0
    const added = inc.added_time ?? 0
    return added > 0 ? `${base}+${added}'` : `${base}'`
  }

  function IncidentIcon({ type, subtype }) {
    if (type === 'goal') {
      if (subtype === 'ownGoal') return <span title="Own Goal" className="text-base">⚽️</span>
      if (subtype === 'penalty') return <span title="Penalty" className="text-base">🎯</span>
      return <span title="Goal" className="text-base">⚽️</span>
    }
    if (type === 'card') {
      if (subtype === 'red' || subtype === 'yellowRed') return <span className="inline-block h-4 w-3 rounded-sm bg-red-600" title="Red Card" />
      return <span className="inline-block h-4 w-3 rounded-sm bg-yellow-400" title="Yellow Card" />
    }
    if (type === 'substitution') return <span title="Substitution" className="text-base">🔄</span>
    if (type === 'var') return <span title="VAR" className="text-[11px] font-black text-violet-600">VAR</span>
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
    return null
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Swords size={18} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-950">Match Events</h2>
          <p className="text-sm text-slate-500">Goals, cards, substitutions and VAR decisions</p>
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

// ── Radar chart ──────────────────────────────────────────────────────────────
const RADAR_KEYS = [
  { key: 'Ball possession',   label: 'Possession', max: 100 },
  { key: 'Total shots',       label: 'Shots',      max: 25 },
  { key: 'Shots on target',   label: 'On Target',  max: 12 },
  { key: 'Expected goals',    label: 'xG',         max: 3 },
  { key: 'Passes',            label: 'Passes',     max: 700 },
  { key: 'Corner kicks',      label: 'Corners',    max: 12 },
  { key: 'Fouls',             label: 'Fouls',      max: 20 },
]

function TeamRadar({ stats, fixture, live }) {
  const data = useMemo(() => {
    const allPeriod = stats.filter((s) => !s.period || s.period === 'ALL')
    const source = allPeriod.length ? allPeriod : stats

    return RADAR_KEYS.map(({ key, label, max }) => {
      const row = source.find((s) => normalize(s.name).includes(normalize(key)))
      const homeVal = row ? numericValue(row.home_raw ?? row.home) : 0
      const awayVal = row ? numericValue(row.away_raw ?? row.away) : 0
      return {
        subject: label,
        [fixture.home?.short_name || 'Home']: Math.round((homeVal / max) * 100),
        [fixture.away?.short_name || 'Away']: Math.round((awayVal / max) * 100),
      }
    })
  }, [stats, fixture])

  const homeName = fixture.home?.short_name || fixture.home?.name || 'Home'
  const awayName = fixture.away?.short_name || fixture.away?.name || 'Away'

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Swords size={18} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-950">Team Radar</h2>
          <p className="text-sm text-slate-500">{live ? 'Live' : 'Full match'} comparison — normalized vs match elite</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
          <Radar name={homeName} dataKey={homeName} stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} strokeWidth={2} />
          <Radar name={awayName} dataKey={awayName} stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
        </RadarChart>
      </ResponsiveContainer>
    </section>
  )
}

// ── Player minutes ────────────────────────────────────────────────────────────
function PlayerMinutes({ lineups, incidents, fixture, currentMinute, live }) {
  const totalMins = live ? (currentMinute ?? 90) : 90

  // Build substitution map: player_out → minute off, player_in → minute on
  const subEvents = incidents.filter((i) => i.type === 'substitution')

  function getMinutes(player, isHome) {
    const name = player.short_name || player.name || ''
    const subOut = subEvents.find((s) => s.is_home === isHome && normalize(s.player_out).includes(normalize(name)))
    const subIn = subEvents.find((s) => s.is_home === isHome && normalize(s.player_in).includes(normalize(name)))
    const start = subIn ? (subIn.minute ?? 0) : 0
    const end = subOut ? (subOut.minute ?? totalMins) : totalMins
    return { start, end, mins: Math.max(0, end - start) }
  }

  function TeamMinutes({ team, lineup, isHome }) {
    const starters = lineup?.starters ?? []
    const bench = (lineup?.bench ?? []).filter((p) => {
      const name = normalize(p.short_name || p.name || '')
      return subEvents.some((s) => s.is_home === isHome && normalize(s.player_in).includes(name))
    })
    const players = [...starters, ...bench]

    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <CountryFlag code={team?.flag_code} nationality={team?.name} size="sm" />
          <p className="text-sm font-black text-slate-950">{team?.name}</p>
        </div>
        <div className="space-y-1.5">
          {players.map((player) => {
            const { start, end, mins } = getMinutes(player, isHome)
            const startPct = (start / 90) * 100
            const widthPct = Math.max(2, ((end - start) / 90) * 100)
            const isSub = start > 0
            return (
              <div key={player.source_player_id || player.name} className="grid grid-cols-[120px_1fr_36px] items-center gap-2">
                <p className={`truncate text-xs font-semibold ${isSub ? 'text-slate-400' : 'text-slate-700'}`}>
                  {isSub && <span className="mr-1 text-emerald-500">↑</span>}
                  {player.short_name || player.name}
                </p>
                <div className="relative h-3 rounded-full bg-slate-100">
                  <div
                    className={`absolute h-full rounded-full ${isSub ? 'bg-emerald-400' : 'bg-sky-500'}`}
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  />
                </div>
                <p className="text-right text-[10px] font-bold tabular-nums text-slate-400">{mins}'</p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Users size={18} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-950">Minutes Played</h2>
          <p className="text-sm text-slate-500">Starters and substitutes · {live ? `${currentMinute ?? '?'} min played` : 'Full time'}</p>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <TeamMinutes team={fixture.home} lineup={lineups.home} isHome={true} />
        <TeamMinutes team={fixture.away} lineup={lineups.away} isHome={false} />
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-5 rounded-full bg-sky-500" /><span className="text-[10px] font-semibold text-slate-500">Starter</span></div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-5 rounded-full bg-emerald-400" /><span className="text-[10px] font-semibold text-slate-500">Substitute</span></div>
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
  const totalSeconds = Math.max(0, Math.floor((timestamp * 1000 - nowMs) / 1000))
  if (totalSeconds <= 0) return { main: 'Kickoff soon', sub: '' }

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
