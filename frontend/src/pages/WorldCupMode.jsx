import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, RefreshCw,
  CalendarDays, ListOrdered, ShieldCheck, Swords, Trophy,
} from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import EmptyState from '../components/common/EmptyState'
import CountryFlag from '../components/common/CountryFlag'
import PlayerAvatar from '../components/player/PlayerAvatar'
import PlayerSearch from '../components/player/PlayerSearch'
import { usePlayers } from '../hooks/usePlayers'
import { adminService } from '../services/adminService'
import { playerService } from '../services/playerService'

const OFFICIAL_FILTERS = {
  league: 'FIFA World Cup',
  season: '2026',
  min_starts: 0,
  sort: 'goals',
  limit: 2000,
}

const POS_GROUPS = {
  ALL: null,
  GK:  ['GK'],
  DEF: ['CB', 'LB', 'RB'],
  MID: ['CDM', 'CM', 'CAM'],
  ATT: ['LW', 'RW', 'ST'],
}

const GK_MIN_MINUTES = 60
const GK_MIN_SHOTS_FACED = 2

const p90 = (val, mins) => mins > 0 ? Math.round((val / mins) * 90 * 10) / 10 : 0

const LEADERBOARD_CATEGORIES = [
  {
    key: 'output',
    label: 'Output',
    tabs: [
      { key: 'goals',    label: 'Goals',            fn: (p) => p.stats?.goals ?? 0,                                      fmt: (v) => `${v}` },
      { key: 'assists',  label: 'Assists',          fn: (p) => p.stats?.assists ?? 0,                                    fmt: (v) => `${v}` },
      { key: 'ga',       label: 'Goals + Assists',  fn: (p) => (p.stats?.goals ?? 0) + (p.stats?.assists ?? 0),           fmt: (v) => `${v}` },
      { key: 'rating',   label: 'Rating',           fn: (p) => p.stats?.rating ?? 0,                                     fmt: (v) => Number(v).toFixed(2) },
      { key: 'minutes',  label: 'Minutes Played',   fn: (p) => p.stats?.minutesPlayed ?? 0,                              fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'attack',
    label: 'Shooting + Creation',
    tabs: [
      { key: 'shots',            label: 'Shots',               fn: (p) => p.stats?.shots ?? 0,                       fmt: (v) => `${v}` },
      { key: 'shotsOnTarget',    label: 'Shots on Goal',       fn: (p) => p.stats?.shotsOnTarget ?? 0,               fmt: (v) => `${v}` },
      { key: 'xG',               label: 'Expected Goals',      fn: (p) => p.stats?.xG ?? 0,                          fmt: (v) => Number(v).toFixed(2) },
      { key: 'keyPasses',        label: 'Key Passes',          fn: (p) => p.stats?.keyPasses ?? 0,                   fmt: (v) => `${v}` },
      { key: 'chancesCreated',   label: 'Chances Created',     fn: (p) => p.stats?.chancesCreated ?? 0,              fmt: (v) => `${v}` },
      { key: 'bigChancesCreated',label: 'Big Chances Created', fn: (p) => p.stats?.bigChancesCreated ?? 0,           fmt: (v) => `${v}` },
      { key: 'xA',               label: 'Expected Assists',    fn: (p) => p.stats?.xA ?? 0,                          fmt: (v) => Number(v).toFixed(2) },
      { key: 'bigChancesMissed', label: 'Big Chances Missed',  fn: (p) => p.stats?.bigChancesMissed ?? 0,            fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'passing',
    label: 'Passing + Ball Use',
    tabs: [
      { key: 'totalPasses',      label: 'Passes Attempted',    fn: (p) => p.stats?.totalPasses ?? 0,                 fmt: (v) => `${v}` },
      { key: 'accuratePasses',   label: 'Successful Passes',   fn: (p) => p.stats?._accuratePasses ?? 0,             fmt: (v) => `${v}` },
      { key: 'passAccuracy',     label: 'Pass Accuracy',       fn: (p) => p.stats?.passAccuracy ?? 0,                fmt: (v) => `${Number(v).toFixed(1)}%` },
      { key: 'touches',          label: 'Touches',             fn: (p) => p.stats?.touches ?? 0,                     fmt: (v) => `${v}` },
      { key: 'possessionLost',   label: 'Possession Lost',     fn: (p) => p.stats?.possessionLost ?? 0,              fmt: (v) => `${v}` },
      { key: 'finalThirdPasses', label: 'Final Third Passes',  fn: (p) => p.stats?.finalThirdPasses ?? 0,            fmt: (v) => `${v}` },
      { key: 'throughPasses',    label: 'Through Passes',      fn: (p) => p.stats?.throughPasses ?? 0,               fmt: (v) => `${v}` },
      { key: 'crosses',          label: 'Crosses',             fn: (p) => p.stats?.crosses ?? 0,                     fmt: (v) => `${v}` },
      { key: 'accurateCrosses',  label: 'Accurate Crosses',    fn: (p) => p.stats?.accurateCrosses ?? 0,             fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'dribbling',
    label: 'Dribbling',
    tabs: [
      { key: 'dribbles',         label: 'Dribbles Completed',  fn: (p) => p.stats?.dribbles ?? 0,                   fmt: (v) => `${v}` },
      { key: 'totalDribbles',    label: 'Dribbles Attempted',  fn: (p) => p.stats?._totalDribbles ?? 0,             fmt: (v) => `${v}` },
      { key: 'dribbleSuccess',   label: 'Dribble Success',     fn: (p) => p.stats?.dribbleSuccess ?? 0,             fmt: (v) => `${Number(v).toFixed(1)}%` },
      { key: 'dispossessed',     label: 'Dispossessed',        fn: (p) => p.stats?.dispossessed ?? 0,               fmt: (v) => `${v}` },
      { key: 'miscontrols',      label: 'Miscontrols',         fn: (p) => p.stats?.miscontrols ?? 0,                fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'defense',
    label: 'Defense',
    tabs: [
      { key: 'tackles',          label: 'Tackles',             fn: (p) => p.stats?.tackles ?? 0,                    fmt: (v) => `${v}` },
      { key: 'successfulTackles',label: 'Successful Tackles',  fn: (p) => p.stats?.successfulTackles ?? 0,          fmt: (v) => `${v}` },
      { key: 'interceptions',    label: 'Interceptions',       fn: (p) => p.stats?.interceptions ?? 0,              fmt: (v) => `${v}` },
      { key: 'recoveries',       label: 'Recoveries',          excludeGk: true, fn: (p) => p.stats?.recoveries ?? 0, fmt: (v) => `${v}` },
      { key: 'clearances',       label: 'Clearances',          fn: (p) => p.stats?.clearances ?? 0,                 fmt: (v) => `${v}` },
      { key: 'aerialDuelsWon',   label: 'Aerial Duels Won',    fn: (p) => p.stats?.aerialDuelsWon ?? 0,             fmt: (v) => `${v}` },
      { key: 'fouls',            label: 'Fouls',               fn: (p) => p.stats?.fouls ?? 0,                      fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'goalkeeping',
    label: 'Goalkeeping',
    tabs: [
      { key: 'saves',         label: 'Total Saves',       fn: (p) => p.stats?.saves ?? 0,                                                                         fmt: (v) => `${v}` },
      { key: 'savesP90',      label: 'Saves per 90',      minMins: GK_MIN_MINUTES, fn: (p) => p90(p.stats?.saves ?? 0, p.stats?.minutesPlayed ?? 0),              fmt: (v) => Number(v).toFixed(2) },
      { key: 'savePct',       label: 'Save Percentage',   minMins: GK_MIN_MINUTES, minShotsFaced: GK_MIN_SHOTS_FACED, fn: savePercentage,                         fmt: (v) => `${Number(v).toFixed(1)}%` },
      { key: 'cleanSheets',   label: 'Clean Sheets',      fn: (p) => p.stats?.cleanSheets ?? 0,                                                                    fmt: (v) => `${v}` },
      { key: 'goalsConceded', label: 'Goals Conceded',    lowerIsBetter: true, fn: (p) => p.stats?.goalsConceded ?? 0,                                             fmt: (v) => `${v}` },
      { key: 'shotsFaced',    label: 'Total Shots Faced', fn: (p) => p.stats?.totalShotsFaced ?? 0,                                                                fmt: (v) => `${v}` },
      { key: 'clearances',    label: 'Clearances',        fn: (p) => p.stats?.clearances ?? 0,                                                                     fmt: (v) => `${v}` },
      { key: 'recoveries',    label: 'Recoveries',        fn: (p) => p.stats?.recoveries ?? 0,                                                                     fmt: (v) => `${v}` },
    ],
  },
]

export default function WorldCupMode() {
  const navigate = useNavigate()
  const [posFilter, setPosFilter]   = useState('ALL')
  const [maxAge, setMaxAge]         = useState(99)
  const [lbCategory, setLbCategory] = useState('output')
  const [lbTab, setLbTab]           = useState('goals')
  const [hasLiveMatch, setHasLiveMatch] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const { players, loading, error, updatedAt, refetch } = usePlayers(OFFICIAL_FILTERS)
  const lastUpdated = updatedAt

  const posFilteredPlayers = useMemo(() => {
    const positions = POS_GROUPS[posFilter]
    return players
      .filter((p) => !positions || positions.includes(p.position))
      .filter((p) => maxAge >= 40 || (p.age ?? 99) <= maxAge)
  }, [players, posFilter, maxAge])

  const data = useMemo(() => buildWorldCupData(players), [players])
  const goalkeepers = useMemo(() => {
    return players
      .filter((p) => p.position === 'GK')
      .filter((p) => maxAge >= 40 || (p.age ?? 99) <= maxAge)
  }, [players, maxAge])
  const visibleCategories = LEADERBOARD_CATEGORIES
  const activeCategory = useMemo(
    () => visibleCategories.find((c) => c.key === lbCategory) ?? visibleCategories[0],
    [visibleCategories, lbCategory],
  )
  const leaderboardTabs = activeCategory?.tabs ?? []
  useEffect(() => {
    if (!leaderboardTabs.some((tab) => tab.key === lbTab)) setLbTab(leaderboardTabs[0]?.key ?? 'goals')
  }, [leaderboardTabs, lbTab])
  const lbSourcePlayers = activeCategory?.key === 'goalkeeping' ? goalkeepers : posFilteredPlayers
  const lbPlayers = useMemo(() => rankByTab(lbSourcePlayers, lbTab, leaderboardTabs), [lbSourcePlayers, lbTab, leaderboardTabs])
  const inForm    = useMemo(() => rankInForm(posFilteredPlayers), [posFilteredPlayers])
  const goalkeeperLeaders = useMemo(() => rankGoalkeepers(goalkeepers), [goalkeepers])

  // Track whether any World Cup match is currently live, so we can poll
  // aggressively during games and back off when nothing is happening.
  useEffect(() => {
    let cancelled = false
    const checkLive = async () => {
      try {
        const matches = await playerService.getWorldCupMatches(20)
        if (cancelled) return
        const live = (matches ?? []).some((m) =>
          ['inprogress', 'live'].includes(String(m.status_type || '').toLowerCase()),
        )
        setHasLiveMatch(live)
      } catch {
        /* ignore — fall back to slow polling */
      }
    }
    checkLive()
    const timer = setInterval(checkLive, 60000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // Auto-refresh the leaderboards. Quiet refetches update data in place
  // (no loader flash), the cadence ramps up while a match is live, and we
  // pause while the tab is hidden — refreshing immediately when it returns.
  useEffect(() => {
    const intervalMs = hasLiveMatch ? 20000 : 90000
    let timer = null

    const start = () => {
      if (timer) return
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') refetch({ force: true, quiet: true })
      }, intervalMs)
    }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch({ force: true, quiet: true })
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [refetch, hasLiveMatch])

  async function syncWorldCupStats() {
    try {
      setSyncing(true)
      setSyncMessage('')
      const result = await adminService.startIncrementalSync({
        competitions: ['FIFA World Cup'],
        dry_run: false,
      })
      setSyncMessage(result.message || 'Updating World Cup stats...')

      for (let attempt = 0; attempt < 24; attempt += 1) {
        await delay(5000)
        const status = await adminService.getSyncStatus()
        if (status.status === 'running') {
          setSyncMessage('Updating World Cup stats...')
          continue
        }
        setSyncMessage(`Stats updated. Players changed: ${status.players ?? 0}.`)
        await refetch({ force: true })
        return
      }

      setSyncMessage('Still updating. The leaderboard will refresh automatically.')
    } catch (err) {
      setSyncMessage(err.message || 'Could not start World Cup sync.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex-1 min-w-0 bg-slate-50">
      {/* Hero header */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                <Trophy size={13} />
                World Cup 2026
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Official World Cup stats
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Only FIFA World Cup rows — no qualifiers, no club context.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/world-cup/matches"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <CalendarDays size={15} />
                Match Center
              </Link>
              <Link
                to="/scouting-board?league=FIFA%20World%20Cup&season=2026&min_starts=0&sort=goals"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Full Board <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                onClick={syncWorldCupStats}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                Update Stats
              </button>
            </div>
          </div>
          {syncMessage && (
            <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {syncMessage}
            </p>
          )}
          <div className="mt-5 max-w-2xl">
            <PlayerSearch
              onSelect={(player) => player?.id && navigate(`/player/${player.id}`)}
              placeholder="Search official World Cup players…"
            />
          </div>
        </div>
      </section>

      <PageContainer>
        <div className="space-y-6">
          <WorldCupCategoryNav active="leaderboards" />

          {/* Status strip */}
          <StatusStrip
            rows={players.length}
            summary={data.summary}
            lastUpdated={lastUpdated}
          />

          {loading && <Loader />}
          {error && <ErrorMessage message={error} onRetry={refetch} />}

          {!loading && !error && players.length === 0 && (
            <EmptyState
              title="No official World Cup stats yet"
              message="Admins can refresh World Cup player rows from Data Control after the provider publishes match stats."
            />
          )}

          {!loading && !error && players.length > 0 && (
            <>
              {/* Position filter */}
              <div className="flex flex-wrap items-center gap-3">
                <PosFilterTabs value={posFilter} onChange={setPosFilter} />
                <button
                  type="button"
                  onClick={() => setMaxAge((prev) => (prev === 23 ? 99 : 23))}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors border ${
                    maxAge === 23
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                  }`}
                >
                  U23
                </button>
                {(posFilter !== 'ALL' || maxAge < 40) && (
                  <span className="text-xs text-slate-500">
                    {posFilteredPlayers.length} players
                  </span>
                )}
              </div>

              {/* Most in-form — hero panel */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Most In-Form</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      All-around tournament impact — output, creation, dribbling, rating, ball security.
                    </p>
                  </div>
                  <Swords size={20} className="text-slate-300 shrink-0" />
                </div>
                <InFormList players={inForm} />
              </section>

              {goalkeepers.length > 0 && (
                <GoalkeepingSection goalkeepers={goalkeeperLeaders} />
              )}

              {/* Tabbed leaderboard */}
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 pt-5 pb-0">
                  <h2 className="text-xl font-black text-slate-950 mb-4">Tournament Leaders</h2>
                  {/* Category row */}
                  <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                    {visibleCategories.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => { setLbCategory(cat.key); setLbTab(cat.tabs[0]?.key) }}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                          activeCategory?.key === cat.key
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {/* Stat tab row */}
                  <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
                    {leaderboardTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setLbTab(tab.key)}
                        className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-bold transition-colors border-b-2 whitespace-nowrap ${
                          lbTab === tab.key
                            ? 'border-slate-950 text-slate-950'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <LeaderboardList players={lbPlayers} tabKey={lbTab} tabs={leaderboardTabs} />
                </div>
              </section>

            </>
          )}
        </div>
      </PageContainer>
    </div>
  )
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/* ─────────────────────────────────────────── components ── */

function WorldCupCategoryNav({ active }) {
  const categories = [
    {
      key: 'leaderboards',
      to: '/world-cup',
      label: 'Player Leaderboards',
      description: 'Individual output, all-around form, positions, and tournament leaders.',
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

function PosFilterTabs({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {Object.keys(POS_GROUPS).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
            value === key ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {key}
        </button>
      ))}
    </div>
  )
}

function StatusStrip({ rows, summary, lastUpdated }) {
  const updatedLabel = lastUpdated
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(lastUpdated)
    : 'not refreshed yet'

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatusTile label="Player Rows" value={rows} sub="synced" />
      <StatusTile label="Goal Contributions" value={summary.goalContributions} sub="goals + assists" />
      <StatusTile label="Goals" value={summary.goals} sub="scored" />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Avg Rating</p>
        <p className="mt-2 text-3xl font-black text-slate-950">
          {summary.avgRating ? summary.avgRating.toFixed(2) : '—'}
        </p>
        <p className="mt-1 text-xs text-slate-400">updated {updatedLabel}</p>
      </div>
    </section>
  )
}

function StatusTile({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

const SCORE_BARS = [
  { key: 'finishing',       label: 'Fin',  color: 'bg-red-500' },
  { key: 'creation',        label: 'Cre',  color: 'bg-sky-500' },
  { key: 'ballProgression', label: 'Prog', color: 'bg-violet-500' },
  { key: 'defending',       label: 'Def',  color: 'bg-emerald-500' },
]

function ScoreBars({ scores = {} }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {SCORE_BARS.map(({ key, label, color }) => {
        const val = scores[key] ?? 0
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
              <span className="text-[9px] font-black text-slate-600">{val}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-slate-100">
              <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(100, val)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InFormList({ players }) {
  if (!players.length) return <p className="text-sm text-slate-500">No rows yet.</p>

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {players.slice(0, 8).map((player, index) => {
        const stats = player.stats ?? {}
        return (
          <Link
            key={player.id}
            to={`/player/${player.id}`}
            className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-sky-200 hover:bg-sky-50 transition-colors"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
              {index + 1}
            </div>
            <PlayerAvatar player={player} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
                <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
              </div>
              <p className="truncate text-xs text-slate-500">
                {player.club} · {player.position} · {stats.minutesPlayed ?? 0}′
              </p>
              <ScoreBars scores={player.scores} />
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-slate-950">{Math.round(player.inFormScore)}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Score</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function GoalkeepingSection({ goalkeepers }) {
  if (!goalkeepers.length) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Goalkeeping Leaders</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shot stopping, command of the box, and keeper form across official World Cup rows.
          </p>
        </div>
        <ShieldCheck size={20} className="shrink-0 text-slate-300" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {goalkeepers.slice(0, 3).map((player, index) => {
          const stats = player.stats ?? {}
          const faced = stats.totalShotsFaced ?? 0
          const saves = stats.saves ?? 0
          return (
            <Link
              key={player.id}
              to={`/player/${player.id}`}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-sky-200 hover:bg-sky-50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
                  {index + 1}
                </div>
                <PlayerAvatar player={player} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
                    <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {player.club} · {stats.minutesPlayed ?? 0}′
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-950">{Math.round(player.gkImpactScore)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Impact</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Saves" value={saves} />
                <MiniStat label="Save %" value={faced ? `${savePercentage(player).toFixed(1)}%` : '-'} />
                <MiniStat label="Clean Sheets" value={stats.cleanSheets ?? 0} />
                <MiniStat label="Conceded" value={stats.goalsConceded ?? 0} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-base font-black text-slate-950">{value}</p>
    </div>
  )
}

function LeaderboardList({ players, tabKey, tabs = [] }) {
  const tab = tabs.find((t) => t.key === tabKey)
  if (!tab) return <p className="text-sm text-slate-500">No rows yet.</p>
  if (!players.length) return <p className="text-sm text-slate-500">No rows yet.</p>

  const max = tab.fn(players[0])

  return (
    <div className="space-y-2">
      {players.map((player, index) => {
        const val = tab.fn(player)
        const pct = max > 0 ? (val / max) * 100 : 0
        return (
          <Link
            key={player.id}
            to={`/player/${player.id}`}
            className="group flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-sky-200 hover:bg-sky-50 transition-colors"
          >
            <span className="w-5 text-center text-xs font-black text-slate-400">{index + 1}</span>
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
                <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{player.club} · {player.position}</span>
              </div>
            </div>
            <span className="text-base font-black text-slate-950 shrink-0">
              {tab.fmt(val)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────── data utils ── */

function buildWorldCupData(players) {
  let totalGoals = 0, totalAssists = 0, ratingSum = 0, ratingCount = 0

  players.forEach((player) => {
    totalGoals += player.stats?.goals ?? 0
    totalAssists += player.stats?.assists ?? 0
    if (player.stats?.rating) { ratingSum += player.stats.rating; ratingCount++ }
  })

  return {
    summary: {
      goals: totalGoals,
      goalContributions: totalGoals + totalAssists,
      avgRating: ratingCount ? ratingSum / ratingCount : null,
    },
  }
}

function inFormScore(player) {
  const stats = player.stats ?? {}
  const minutes = stats.minutesPlayed ?? 0
  const minuteWeight = Math.min(1, minutes / 75)
  const dribbleValue = (stats.dribbles ?? 0) * ((stats.dribbleSuccess ?? 0) / 100) * 1.2
  const passingValue = (stats._accuratePasses ?? 0) * ((stats.passAccuracy ?? 0) / 100) * 0.08

  return (
    (stats.rating ?? 0) * 8.5 * minuteWeight
    + (stats.goals ?? 0) * 16
    + (stats.assists ?? 0) * 12
    + passingValue
    + (stats.keyPasses ?? 0) * 2.2
    + (stats.shotsOnTarget ?? 0) * 1.8
    + dribbleValue
    + (stats.recoveries ?? 0) * 0.65
    + (stats.tackles ?? 0) * 0.55
    + (stats.interceptions ?? 0) * 0.65
    - (stats.possessionLost ?? 0) * 0.35
  )
}

function savePercentage(player) {
  const stats = player.stats ?? {}
  const faced = stats.totalShotsFaced ?? 0
  return faced > 0 ? ((stats.saves ?? 0) / faced) * 100 : 0
}

function goalkeeperImpactScore(player) {
  const stats = player.stats ?? {}
  const minutes = stats.minutesPlayed ?? 0
  const minuteWeight = Math.min(1, minutes / 90)
  const savePct = savePercentage(player)

  return (
    (stats.rating ?? 0) * 8 * minuteWeight
    + (stats.saves ?? 0) * 5
    + (stats.cleanSheets ?? 0) * 8
    + savePct * 0.45
    + (stats.highClaims ?? 0) * 2
    + (stats.punches ?? 0) * 1.2
    + (stats.runOuts ?? 0) * 1.2
    - (stats.goalsConceded ?? 0) * 4
  )
}

function rankInForm(players) {
  return [...players]
    .filter((p) => (p.stats?.minutesPlayed ?? 0) >= 20)
    .map((p) => ({ ...p, inFormScore: inFormScore(p) }))
    .sort((a, b) => b.inFormScore - a.inFormScore)
    .slice(0, 8)
}

function rankGoalkeepers(players) {
  return [...players]
    .filter((p) => (p.stats?.minutesPlayed ?? 0) >= 20)
    .map((p) => ({ ...p, gkImpactScore: goalkeeperImpactScore(p) }))
    .sort((a, b) => b.gkImpactScore - a.gkImpactScore)
    .slice(0, 6)
}

function rankByTab(players, tabKey, tabs = []) {
  const tab = tabs.find((t) => t.key === tabKey)
  if (!tab) return []
  const minMins = tab.minMins ?? 0
  return [...players]
    .filter((p) => !tab.keeperOnly || p.position === 'GK')
    .filter((p) => !tab.excludeGk || p.position !== 'GK')
    .filter((p) => (p.stats?.minutesPlayed ?? 0) >= minMins)
    .filter((p) => tab.lowerIsBetter || tab.fn(p) > 0)
    .sort((a, b) => {
      const direction = tab.lowerIsBetter ? 1 : -1
      return (tab.fn(a) - tab.fn(b)) * direction
    })
    .slice(0, 10)
}
