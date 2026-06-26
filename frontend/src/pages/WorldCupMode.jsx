import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, RefreshCw,
  CalendarDays, ListOrdered, ShieldCheck, Share2, Swords, Trophy,
} from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import Loader from '../components/common/Loader'
import Seo from '../components/common/Seo'
import ErrorMessage from '../components/common/ErrorMessage'
import EmptyState from '../components/common/EmptyState'
import CountryFlag from '../components/common/CountryFlag'
import PlayerAvatar from '../components/player/PlayerAvatar'
import PlayerSearch from '../components/player/PlayerSearch'
import { usePlayers } from '../hooks/usePlayers'
import { adminService } from '../services/adminService'
import { playerService } from '../services/playerService'
import { saveLeaderboardImage, shareLeaderboardToX, postLeaderboardToX } from '../utils/shareLeaderboard'

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
  CB:  ['CB'],
  FB:  ['LB', 'RB'],
  MID: ['CDM', 'CM', 'CAM'],
  WNG: ['LW', 'RW'],
  ST:  ['ST'],
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
      { key: 'penaltyGoals', label: 'Penalty Goals', fn: (p) => p.stats?.penaltyGoals ?? 0,                              fmt: (v) => `${v}` },
      { key: 'rating',   label: 'Rating',           fn: (p) => p.stats?.rating ?? 0,                                     fmt: (v) => Number(v).toFixed(2) },
      { key: 'minutes',  label: 'Minutes Played',   fn: (p) => p.stats?.minutesPlayed ?? 0,                              fmt: (v) => `${v}` },
      { key: 'foulsSuffered', label: 'Fouls Suffered', fn: (p) => p.stats?.foulsSuffered ?? 0,                            fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'attack',
    label: 'Shooting + Creation',
    tabs: [
      { key: 'shots',            label: 'Shots',               fn: (p) => p.stats?.shots ?? 0,                       fmt: (v) => `${v}` },
      { key: 'shotsOnTarget',    label: 'Shots on Goal',       fn: (p) => p.stats?.shotsOnTarget ?? 0,               fmt: (v) => `${v}` },
      { key: 'xG',               label: 'Expected Goals',      fn: (p) => p.stats?.xG ?? 0,                          fmt: (v) => Number(v).toFixed(2) },
      { key: 'chancesCreated',   label: 'Chances Created',     fn: (p) => p.stats?.chancesCreated ?? 0,              fmt: (v) => `${v}` },
      { key: 'bigChancesCreated',label: 'Big Chances Created', fn: (p) => p.stats?.bigChancesCreated ?? 0,           fmt: (v) => `${v}` },
      { key: 'bigChancesMissed', label: 'Big Chances Missed',  fn: (p) => p.stats?.bigChancesMissed ?? 0,            fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'passing',
    label: 'Passing + Ball Use',
    tabs: [
      { key: 'totalPasses',      label: 'Passes Attempted',    fn: (p) => p.stats?.totalPasses ?? 0,                 fmt: (v) => `${v}` },
      { key: 'accuratePasses',   label: 'Successful Passes',   fn: (p) => p.stats?._accuratePasses ?? 0,             fmt: (v) => `${v}` },
      { key: 'accuratePassesP90', label: 'Passes Completed /90', minMins: 180, fn: (p) => p90(p.stats?._accuratePasses ?? 0, p.stats?.minutesPlayed ?? 0), fmt: (v) => Number(v).toFixed(1) },
      { key: 'passAccuracy',     label: 'Pass Accuracy',       minMins: 180, minPasses: 40, fn: (p) => p.stats?.passAccuracy ?? 0, fmt: (v) => `${Number(v).toFixed(1)}%` },
      { key: 'keyPasses',        label: 'Key Passes',          fn: (p) => p.stats?.keyPasses ?? 0,                   fmt: (v) => `${v}` },
      { key: 'xA',               label: 'Expected Assists',    fn: (p) => p.stats?.xA ?? 0,                          fmt: (v) => Number(v).toFixed(2) },
      { key: 'touches',          label: 'Touches',             fn: (p) => p.stats?.touches ?? 0,                     fmt: (v) => `${v}` },
      { key: 'oppHalfPasses',    label: 'Passes into Opp. Half', fn: (p) => p.stats?.oppHalfPasses ?? 0,             fmt: (v) => `${v}` },
      { key: 'crosses',          label: 'Crosses',             fn: (p) => p.stats?.crosses ?? 0,                     fmt: (v) => `${v}` },
      { key: 'accurateCrosses',  label: 'Accurate Crosses',    fn: (p) => p.stats?.accurateCrosses ?? 0,             fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'dribbling',
    label: 'Dribbling',
    tabs: [
      { key: 'dribbles',         label: 'Dribbles Completed',  fn: (p) => p.stats?.dribbles ?? 0,                   fmt: (v) => `${v}` },
      { key: 'dribblesP90',      label: 'Dribbles Completed /90', minMins: 100, fn: (p) => p90(p.stats?.dribbles ?? 0, p.stats?.minutesPlayed ?? 0), fmt: (v) => Number(v).toFixed(1) },
      { key: 'totalDribbles',    label: 'Dribbles Attempted',  fn: (p) => p.stats?._totalDribbles ?? 0,             fmt: (v) => `${v}` },
      { key: 'dribbleSuccess',   label: 'Dribble Success',     minMins: 100, minDribbles: 6, fn: (p) => p.stats?.dribbleSuccess ?? 0, fmt: (v) => `${Number(v).toFixed(1)}%` },
      { key: 'carries',          label: 'Ball Carries',        fn: (p) => p.stats?.carries ?? 0,                    fmt: (v) => `${v}` },
      { key: 'progressiveCarries', label: 'Progressive Carries', fn: (p) => p.stats?.progressiveCarries ?? 0,       fmt: (v) => `${v}` },
      { key: 'possessionLost',   label: 'Possession Lost',     fn: (p) => p.stats?.possessionLost ?? 0,             fmt: (v) => `${v}` },
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
      { key: 'recoveries',       label: 'Ball Recoveries',     excludeGk: true, fn: (p) => p.stats?.recoveries ?? 0, fmt: (v) => `${v}` },
      { key: 'clearances',       label: 'Clearances',          fn: (p) => p.stats?.clearances ?? 0,                 fmt: (v) => `${v}` },
      { key: 'blocks',           label: 'Blocked Shots',       fn: (p) => p.stats?.blocks ?? 0,                     fmt: (v) => `${v}` },
      { key: 'duelsWon',         label: 'Duels Won',           fn: (p) => p.stats?.duelsWon ?? 0,                   fmt: (v) => `${v}` },
      { key: 'aerialDuelsWon',   label: 'Aerial Duels Won',    fn: (p) => p.stats?.aerialDuelsWon ?? 0,             fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'discipline',
    label: 'Discipline',
    tabs: [
      { key: 'fouls',       label: 'Fouls Committed', fn: (p) => p.stats?.fouls ?? 0,       fmt: (v) => `${v}` },
      { key: 'yellowCards', label: 'Yellow Cards',    fn: (p) => p.stats?.yellowCards ?? 0, fmt: (v) => `${v}` },
      { key: 'redCards',    label: 'Red Cards',       fn: (p) => p.stats?.redCards ?? 0,    fmt: (v) => `${v}` },
    ],
  },
  {
    key: 'physical',
    label: 'Physical',
    tabs: [
      { key: 'distanceCovered',    label: 'Distance Covered',     minMins: 45, fn: (p) => p.stats?.distanceCovered ?? 0, fmt: (v) => `${Number(v).toFixed(1)} km` },
      { key: 'sprints',            label: 'Sprints',              fn: (p) => p.stats?.sprints ?? 0,            fmt: (v) => `${v}` },
      { key: 'topSpeed',           label: 'Top Speed',            fn: (p) => p.stats?.topSpeed ?? 0,           fmt: (v) => `${Number(v).toFixed(1)} km/h` },
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
      { key: 'leastConceded', label: 'Least Conceded',    lowerIsBetter: true, minMins: GK_MIN_MINUTES, fn: (p) => p.stats?.goalsConceded ?? 0,                    fmt: (v) => `${v}` },
      { key: 'mostConceded',  label: 'Most Conceded',     fn: (p) => p.stats?.goalsConceded ?? 0,                                                                  fmt: (v) => `${v}` },
      { key: 'shotsFaced',    label: 'Total Shots Faced', fn: (p) => p.stats?.totalShotsFaced ?? 0,                                                                fmt: (v) => `${v}` },
      { key: 'goalsPrevented',label: 'Goals Prevented',   minMins: GK_MIN_MINUTES, fn: (p) => p.stats?.goalsPrevented ?? 0,                                        fmt: (v) => Number(v).toFixed(2) },
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
  const [goalTotal, setGoalTotal] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const { players, loading, error, updatedAt, refetch } = usePlayers(OFFICIAL_FILTERS)
  const lastUpdated = updatedAt

  const posFilteredPlayers = useMemo(() => {
    const positions = POS_GROUPS[posFilter]
    return players
      .filter((p) => !positions || positions.includes(p.position))
      .filter((p) => maxAge >= 40 || (p.age || 99) <= maxAge)
  }, [players, posFilter, maxAge])

  const data = useMemo(() => buildWorldCupData(players, goalTotal), [players, goalTotal])
  const goalkeepers = useMemo(() => {
    return players
      .filter((p) => p.position === 'GK')
      .filter((p) => maxAge >= 40 || (p.age || 99) <= maxAge)
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
  const inForm    = useMemo(() => rankInForm(posFilteredPlayers, players), [posFilteredPlayers, players])
  const goalkeeperLeaders = useMemo(() => rankGoalkeepers(goalkeepers), [goalkeepers])

  // Track whether any World Cup match is currently live, so we can poll
  // aggressively during games and back off when nothing is happening.
  useEffect(() => {
    let cancelled = false
    const checkLive = async () => {
      try {
        const matches = await playerService.getWorldCupFixtures(80)
        if (cancelled) return
        const live = (matches ?? []).some((m) =>
          ['inprogress', 'live'].includes(String(m.status_type || '').toLowerCase()),
        )
        setHasLiveMatch(live)
        try {
          const gt = await playerService.getWorldCupGoalTotal({ force: true })
          if (!cancelled && gt && typeof gt.total === 'number') setGoalTotal(gt.total)
        } catch { /* keep last known total */ }
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
      <Seo
        title="World Cup 2026 Stats & Leaders"
        description="FIFA World Cup 2026 player stat leaders — goals, assists, xG, dribbles, duels, distance covered, top speed and more, updated live on PitchVision."
        path="/world-cup"
      />
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
                  <div className="flex items-center gap-2 shrink-0">
                    {inForm.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => shareLeaderboardToX('Form', IN_FORM_TAB, inForm)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          <Share2 size={15} />
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => postLeaderboardToX('Form', IN_FORM_TAB, inForm)}
                          title="Post to X"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                        >
                          <XLogo size={14} />
                          Post
                        </button>
                      </>
                    )}
                    <Swords size={20} className="text-slate-300" />
                  </div>
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
                  {lbPlayers.length > 0 && (() => {
                    const activeTab = leaderboardTabs.find((t) => t.key === lbTab)
                    if (!activeTab) return null
                    return (
                      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => postLeaderboardToX(activeCategory?.label ?? '', activeTab, lbPlayers)}
                          title="Post to X"
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                        >
                          <XLogo size={14} />
                          Post to X
                        </button>
                        <button
                          type="button"
                          onClick={() => shareLeaderboardToX(activeCategory?.label ?? '', activeTab, lbPlayers)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          <Share2 size={14} />
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={() => saveLeaderboardImage(activeCategory?.label ?? '', activeTab, lbPlayers)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Save image
                        </button>
                      </div>
                    )
                  })()}
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

// Official X (Twitter) logo glyph.
function XLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
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

const SCORE_BAR_COLORS = ['bg-red-500', 'bg-sky-500', 'bg-violet-500', 'bg-emerald-500']

// Position-aware percentile breakdown (each bar = top X% for the player's role).
function ScoreBars({ bars = [] }) {
  if (!bars.length) return null
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {bars.map(({ label, value }, i) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
            <span className="text-[9px] font-black text-slate-600">{value}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-100">
            <div className={`h-1 rounded-full ${SCORE_BAR_COLORS[i % SCORE_BAR_COLORS.length]}`} style={{ width: `${Math.min(100, value)}%` }} />
          </div>
        </div>
      ))}
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
              <ScoreBars bars={player.inFormBars} />
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

function buildWorldCupData(players, goalTotal = null) {
  let playerGoals = 0, totalAssists = 0, ratingSum = 0, ratingCount = 0

  players.forEach((player) => {
    playerGoals += player.stats?.goals ?? 0
    totalAssists += player.stats?.assists ?? 0
    if (player.stats?.rating) { ratingSum += player.stats.rating; ratingCount++ }
  })

  // Headline goal total comes from match scorelines (server-computed), which
  // include own goals — never credited to a player — and cover every finished
  // and live match. Fall back to the player-goal sum until it loads.
  const totalGoals = typeof goalTotal === 'number' ? goalTotal : playerGoals

  return {
    summary: {
      goals: totalGoals,
      goalContributions: totalGoals + totalAssists,
      avgRating: ratingCount ? ratingSum / ratingCount : null,
    },
  }
}

// Synthetic leaderboard tab so the In-Form panel can reuse the shared
// image/caption builder (it expects { key, label, fn, fmt }).
const IN_FORM_TAB = {
  key: 'inForm',
  label: 'Most In-Form',
  fn: (p) => Math.round(p.inFormScore ?? 0),
  fmt: (v) => `${v}`,
}

/* ════════════════════════════════════════════════════════════════════════
   IN-FORM ENGINE — position-aware performance model
   ────────────────────────────────────────────────────────────────────────
   Philosophy (the score answers ONE question):
     "Based only on this World Cup, how well has this player performed
      relative to what is expected of their position?"

   Design, in the spirit of Opta/StatsBomb positional models:

   1. PER-POSITION PROFILES. Every position group rewards a different set of
      actions (a CB's job ≠ a striker's). No universal formula.

   2. PERCENTILE SCORING. Each metric is converted to a percentile *within the
      player's own position cohort*. This is what makes scores comparable
      across positions — a keeper in the 90th percentile of keepers and a
      striker in the 90th percentile of strikers both read ~90. It also means
      "rare" actions (a CB scoring, a striker tackling) are rewarded naturally,
      because they land high in that cohort's distribution.

   3. RATES, NOT TOTALS. Counting stats are converted to per-90 so a player
      isn't rewarded for simply playing more matches. Efficiency (finishing vs
      xG, save %, dribble success, pass accuracy) is used directly.

   4. AVAILABILITY AS CONFIDENCE, NOT SCORE. Minutes never add to the score;
      they shrink an extreme percentile toward the median for small samples
      (Bayesian-style), so a 1-game cameo can't top a tournament's worth of
      sustained excellence — while a genuinely elite short run still ranks well.

   5. CONSISTENCY & RECENT FORM. Per-match ratings (the `form` array) reward
      steady performers over one-game spikes, and nudge for hot recent form.

   Everything is modular and fails safe — missing metrics default to 0 and
   derived metrics (finishing, progression, defensive actions…) are computed
   from whatever raw stats exist, so new metrics can be slotted in later.
   ════════════════════════════════════════════════════════════════════════ */

// Only players with a meaningful sample define the distributions and appear.
const IN_FORM_MIN_MINUTES = 90
// Minutes at which a player's percentile is ~half-trusted (shrinkage constant).
const IN_FORM_CONFIDENCE_K = 220

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const per90 = (value, minutes) => (minutes > 0 ? (value / minutes) * 90 : 0)

// Map detailed positions to the 8 scoring groups.
function getPositionGroup(position) {
  const p = String(position || '').toUpperCase()
  if (p === 'GK') return 'GK'
  if (p === 'CB') return 'CB'
  if (['LB', 'RB', 'LWB', 'RWB'].includes(p)) return 'FB'
  if (['CDM', 'DM'].includes(p)) return 'DM'
  if (['CM'].includes(p)) return 'CM'
  if (['CAM', 'AM'].includes(p)) return 'AM'
  if (['LW', 'RW', 'LM', 'RM'].includes(p)) return 'W'
  return 'ST'
}

// Metric library. Each returns a single comparable number from a stats blob.
// `negative: true` means lower is better (inverted when scored).
const IN_FORM_METRICS = {
  rating:        { get: (s) => s.rating ?? 0 },                                                   // match quality (rate)
  finishing:     { get: (s) => per90((s.goals ?? 0) - (s.xG ?? 0), s.minutesPlayed) },            // goals over expected
  goals:         { get: (s) => per90(s.goals ?? 0, s.minutesPlayed) },
  assists:       { get: (s) => per90(s.assists ?? 0, s.minutesPlayed) },
  shotsOnTarget: { get: (s) => per90(s.shotsOnTarget ?? 0, s.minutesPlayed) },
  chanceCreation:{ get: (s) => per90((s.keyPasses ?? 0) + (s.bigChancesCreated ?? 0) + (s.xA ?? 0), s.minutesPlayed) },
  bigChances:    { get: (s) => per90(s.bigChancesCreated ?? 0, s.minutesPlayed) },
  progPassing:   { get: (s) => per90((s.throughPasses ?? 0) + (s.finalThirdPasses ?? 0) + (s.oppHalfPasses ?? 0), s.minutesPlayed) }, // difficulty
  progCarries:   { get: (s) => per90(s.progressiveCarries ?? 0, s.minutesPlayed) },
  dribbling:     { get: (s) => per90((s.dribbles ?? 0) * ((s.dribbleSuccess ?? 0) / 100), s.minutesPlayed) },
  crosses:       { get: (s) => per90(s.accurateCrosses ?? 0, s.minutesPlayed) },
  passingControl:{ get: (s) => s.passAccuracy ?? 0 },                                             // rate
  defActions:    { get: (s) => per90((s.tackles ?? 0) + (s.interceptions ?? 0) + (s.clearances ?? 0) + (s.blocks ?? 0), s.minutesPlayed) },
  recoveries:    { get: (s) => per90(s.recoveries ?? 0, s.minutesPlayed) },
  aerials:       { get: (s) => per90(s.aerialDuelsWon ?? 0, s.minutesPlayed) },
  // Goalkeeper-specific
  savePct:       { get: (s) => ((s.totalShotsFaced ?? 0) > 0 ? (s.saves ?? 0) / s.totalShotsFaced * 100 : 0) },
  goalsPrevented:{ get: (s) => per90(s.goalsPrevented ?? 0, s.minutesPlayed) },
  cleanSheetRate:{ get: (s) => ((s.appearances ?? 0) > 0 ? (s.cleanSheets ?? 0) / s.appearances : 0) },
  command:       { get: (s) => per90((s.highClaims ?? 0) + (s.punches ?? 0) + (s.runOuts ?? 0), s.minutesPlayed) },
  // Penalties (lower is better)
  possLost:      { get: (s) => per90(s.possessionLost ?? 0, s.minutesPlayed), negative: true },
  bigChancesMissed: { get: (s) => per90(s.bigChancesMissed ?? 0, s.minutesPlayed), negative: true },
  goalsConceded: { get: (s) => per90(s.goalsConceded ?? 0, s.minutesPlayed), negative: true },
}

// Per-position metric weights. Weights are relative within a position only.
const IN_FORM_PROFILES = {
  GK: { rating: 1.5, savePct: 2.5, goalsPrevented: 3, cleanSheetRate: 2, command: 1, passingControl: 1, goalsConceded: 1.5, possLost: 0.5 },
  CB: { rating: 1.5, defActions: 2.5, recoveries: 1.5, aerials: 1.5, passingControl: 1, progPassing: 1, cleanSheetRate: 1.5, goals: 1, assists: 0.5, possLost: 0.5 },
  FB: { rating: 1.5, defActions: 1.5, recoveries: 1, progCarries: 1.5, crosses: 1.5, chanceCreation: 1.2, assists: 1.2, progPassing: 1, goals: 0.6, possLost: 0.5 },
  DM: { rating: 1.5, recoveries: 2, defActions: 2, progPassing: 1.8, passingControl: 1.2, assists: 1.2, goals: 1, dribbling: 0.6, possLost: 0.8 },
  CM: { rating: 1.5, progPassing: 1.5, chanceCreation: 1.5, assists: 1.6, goals: 1.6, recoveries: 1.2, defActions: 1, dribbling: 1, passingControl: 1, possLost: 0.6 },
  AM: { rating: 1.4, assists: 2, bigChances: 2, chanceCreation: 2, progPassing: 1.2, goals: 1.4, dribbling: 1.4, progCarries: 1.2, possLost: 0.5 },
  W:  { rating: 1.4, goals: 1.8, assists: 1.6, dribbling: 2, chanceCreation: 1.4, crosses: 1.2, progCarries: 1.4, shotsOnTarget: 1.2, finishing: 1.2, defActions: 0.5, possLost: 0.6 },
  ST: { rating: 1.4, goals: 2.5, finishing: 2, shotsOnTarget: 1.5, chanceCreation: 1, assists: 1.2, dribbling: 1, recoveries: 0.4, bigChancesMissed: 1, possLost: 0.4 },
}

// Per-position breakdown bars shown under each in-form player. Each entry is
// [label, metricKey]; values are the player's within-cohort percentile (0–100).
// Keepers get keeper dimensions — never a "finishing" bar.
const IN_FORM_BARS = {
  GK: [['Saves', 'savePct'], ['Prev', 'goalsPrevented'], ['Clean', 'cleanSheetRate'], ['Distr', 'passingControl']],
  CB: [['Def', 'defActions'], ['Aerial', 'aerials'], ['Pass', 'passingControl'], ['Prog', 'progPassing']],
  FB: [['Def', 'defActions'], ['Cross', 'crosses'], ['Carry', 'progCarries'], ['Creat', 'chanceCreation']],
  DM: [['Recov', 'recoveries'], ['Def', 'defActions'], ['Prog', 'progPassing'], ['Pass', 'passingControl']],
  CM: [['Prog', 'progPassing'], ['Creat', 'chanceCreation'], ['Def', 'defActions'], ['Drib', 'dribbling']],
  AM: [['Creat', 'chanceCreation'], ['Assist', 'assists'], ['Drib', 'dribbling'], ['Prog', 'progPassing']],
  W:  [['Goals', 'goals'], ['Drib', 'dribbling'], ['Creat', 'chanceCreation'], ['Carry', 'progCarries']],
  ST: [['Goals', 'goals'], ['Finish', 'finishing'], ['Shots', 'shotsOnTarget'], ['Creat', 'chanceCreation']],
}

// Build the position-aware breakdown bars for one player from its cohort fns.
function buildInFormBars(player, percentileFns) {
  const group = getPositionGroup(player.position)
  const defs = IN_FORM_BARS[group] ?? IN_FORM_BARS.CM
  const stats = player.stats ?? {}
  return defs.map(([label, key]) => {
    const metric = IN_FORM_METRICS[key]
    const fn = percentileFns[key]
    let pct = metric && fn ? fn(metric.get(stats)) : 0
    if (metric?.negative) pct = 1 - pct
    return { label, value: Math.round(pct * 100) }
  })
}

// Confidence from minutes — shrinks extreme percentiles toward the median for
// small samples. Never contributes to the score directly.
function calculateAvailability(stats) {
  const m = stats.minutesPlayed ?? 0
  return m / (m + IN_FORM_CONFIDENCE_K)
}

// Reward steady match ratings over one-game spikes (needs ≥3 matches).
function calculateConsistency(form) {
  const ratings = (form ?? []).map((f) => f?.rating).filter((r) => typeof r === 'number')
  if (ratings.length < 3) return 1
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const sd = Math.sqrt(ratings.reduce((a, r) => a + (r - mean) ** 2, 0) / ratings.length)
  const stability = clamp01(1 - sd / 1.5)        // 0 (volatile) … 1 (rock steady)
  return 0.94 + 0.12 * stability                  // ±6% nudge
}

// Team contribution — how much of the team's output runs through this player.
// Attackers: share of the team's goals they're directly involved in (G+A) and
// of its chance creation; defenders/mids: share of the team's defensive actions.
// This rewards being central to how the team scores or defends, not raw totals.
function calculateTeamContribution(player, teamTotals) {
  const s = player.stats ?? {}
  const g = getPositionGroup(player.position)
  if (g === 'GK') return 1                                   // GK judged on its own metrics
  const team = teamTotals[player.club] ?? { goals: 0, chances: 0, def: 0 }

  const involve = ((s.goals ?? 0) + (s.assists ?? 0)) / Math.max(1, team.goals)
  const create = ((s.keyPasses ?? 0) + (s.bigChancesCreated ?? 0)) / Math.max(1, team.chances)
  const defend = ((s.tackles ?? 0) + (s.interceptions ?? 0) + (s.clearances ?? 0) + (s.blocks ?? 0)) / Math.max(1, team.def)

  // Normalise each share to 0–1 against an "elite share" ceiling.
  const a = clamp01(involve / 0.5)    // involved in 50%+ of team goals = elite
  const c = clamp01(create / 0.35)    // 35%+ of team chances created = elite
  const d = clamp01(defend / 0.2)     // 20%+ of team defensive actions = elite

  // Position-weighted blend of the three contribution channels.
  let idx
  if (g === 'CB' || g === 'DM') idx = 0.65 * d + 0.20 * c + 0.15 * a
  else if (g === 'FB') idx = 0.45 * d + 0.30 * c + 0.25 * a
  else if (g === 'CM') idx = 0.40 * c + 0.30 * a + 0.30 * d
  else if (g === 'AM') idx = 0.55 * c + 0.35 * a + 0.10 * d
  else if (g === 'W') idx = 0.50 * a + 0.40 * c + 0.10 * d
  else idx = 0.70 * a + 0.30 * c      // ST

  return 1 + 0.15 * clamp01(idx)       // up to +15% for being central to the team
}

// Match influence — reward players who decide games. A direct goal contribution
// in a well-rated match is real impact on the result; doing it across multiple
// matches matters more than one big night.
// NOTE: the feed exposes per-match goals/assists/rating but not the scoreline or
// goal timing, so we can't yet detect literal game-winning goals — this proxies
// decisive involvement. The hook is here to upgrade once result data exists.
function calculateMatchInfluence(form) {
  const games = (form ?? []).filter((f) => typeof f?.rating === 'number')
  if (!games.length) return 1
  let influence = 0
  games.forEach((f) => {
    const contribution = (f.goals ?? 0) + 0.7 * (f.assists ?? 0)
    if (contribution > 0) {
      // Weight the contribution by how well the player played in that match.
      influence += Math.min(1.5, contribution) * (0.6 + 0.4 * clamp01((f.rating - 6) / 3))
    }
  })
  const perGame = influence / games.length          // decisive impact per appearance
  return 1 + 0.12 * clamp01(perGame)                  // up to +12% for a serial match-winner
}

// Reward hot recent form (most recent matches weighted most).
function calculateRecentForm(form) {
  const recent = (form ?? []).slice(0, 2).map((f) => f?.rating).filter((r) => typeof r === 'number')
  if (!recent.length) return 1
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  const norm = clamp01((avg - 6.0) / 3.0)         // 6.0 → 9.0 maps to 0 → 1
  return 0.95 + 0.13 * norm                        // up to +13% for red-hot form
}

// Weighted average of within-cohort percentiles for the player's position.
function calculateRawImpact(player, percentileFns) {
  const profile = IN_FORM_PROFILES[getPositionGroup(player.position)] ?? IN_FORM_PROFILES.CM
  const stats = player.stats ?? {}
  let weighted = 0
  let totalWeight = 0
  for (const [key, weight] of Object.entries(profile)) {
    const metric = IN_FORM_METRICS[key]
    if (!metric || !percentileFns[key]) continue
    let pct = percentileFns[key](metric.get(stats))
    if (metric.negative) pct = 1 - pct            // lower-is-better metrics
    weighted += weight * pct
    totalWeight += weight
  }
  return totalWeight > 0 ? weighted / totalWeight : 0   // 0…1
}

// Explicit, football-first bonuses layered ON TOP of the percentile core.
// These reward things the base model treats only relatively — genuinely rare
// events (a defender/keeper scoring), "complete" profiles, and hard actions.
// Each branch is capped so bonuses refine ordering without dominating it.
function calculateBonuses(player, fns) {
  const s = player.stats ?? {}
  const g = getPositionGroup(player.position)
  const m = s.minutesPlayed ?? 0
  const goals90 = per90(s.goals ?? 0, m)
  const assists90 = per90(s.assists ?? 0, m)
  const dribbles90 = per90((s.dribbles ?? 0) * ((s.dribbleSuccess ?? 0) / 100), m)
  const def90 = per90((s.tackles ?? 0) + (s.interceptions ?? 0) + (s.clearances ?? 0) + (s.blocks ?? 0), m)
  const prog90 = per90((s.throughPasses ?? 0) + (s.finalThirdPasses ?? 0) + (s.oppHalfPasses ?? 0) + (s.progressiveCarries ?? 0), m)
  const cc90 = per90((s.keyPasses ?? 0) + (s.bigChancesCreated ?? 0) + (s.xA ?? 0), m)
  const finishing = Math.max(0, (s.goals ?? 0) - (s.xG ?? 0))   // goals over expected (efficiency)
  const pct = (k, v) => (fns[k] ? fns[k](v) : 0)

  let bonus = 0

  // DIFFICULTY: reward difficult ball progression (outfield only).
  if (g !== 'GK') bonus += Math.min(3, prog90 * 0.1)

  // RARE EVENTS: attacking output from deep positions / keepers.
  if (g === 'GK') {
    bonus += Math.min(10, (s.goals ?? 0) * 6 + (s.assists ?? 0) * 3)
  } else if (g === 'CB' || g === 'FB') {
    bonus += Math.min(6, goals90 * 5 + assists90 * 2.5)
  }

  // MIDFIELDERS: finishing + dribbling on top of their creative/defensive base.
  if (g === 'DM' || g === 'CM' || g === 'AM') {
    bonus += Math.min(5, goals90 * 3 + dribbles90 * 1.2 + finishing * 1)
  }

  // WINGERS: defensive work + finishing efficiency (two-way + clinical).
  if (g === 'W') {
    bonus += Math.min(5, def90 * 0.9 + finishing * 2 + goals90 * 1.5)
  }

  // STRIKERS: "complete forward" — elite across scoring, creating AND dribbling
  // (min() means they must be strong in all three), plus finishing efficiency.
  if (g === 'ST') {
    const complete = Math.min(pct('goals', goals90), pct('chanceCreation', cc90), pct('dribbling', dribbles90))
    bonus += Math.min(8, complete * 6 + finishing * 1.5)
  }

  return Math.min(12, bonus)   // hard ceiling so bonuses never dominate the core
}

// Final 0–100 in-form score for one player (given its cohort percentile fns).
function calculateInFormScore(player, percentileFns, teamTotals) {
  const raw = calculateRawImpact(player, percentileFns)               // 0…1
  const confidence = calculateAvailability(player.stats ?? {})        // 0…1
  const adjusted = 0.5 + (raw - 0.5) * confidence                     // shrink to median
  const base = adjusted * 100
    * calculateConsistency(player.form)
    * calculateRecentForm(player.form)
    * calculateMatchInfluence(player.form)
    * calculateTeamContribution(player, teamTotals)
  // Bonuses are confidence-scaled too, so small samples can't farm them.
  const bonus = calculateBonuses(player, percentileFns) * confidence
  return Math.max(0, Math.min(100, base + bonus))
}

// Aggregate each team's totals so a player's share of output can be measured.
// Built from the FULL squad list, independent of any position/age filter.
function buildTeamTotals(players) {
  const totals = {}
  players.forEach((p) => {
    const s = p.stats ?? {}
    const t = (totals[p.club] ||= { goals: 0, chances: 0, def: 0 })
    t.goals += s.goals ?? 0
    t.chances += (s.keyPasses ?? 0) + (s.bigChancesCreated ?? 0)
    t.def += (s.tackles ?? 0) + (s.interceptions ?? 0) + (s.clearances ?? 0) + (s.blocks ?? 0)
  })
  return totals
}

// Score the whole pool: build per-position percentile functions, then score.
// `allPlayers` (full, unfiltered squad list) is used for team-contribution
// shares so they stay correct even when the view is filtered by position.
function scoreInFormPool(players, allPlayers = players) {
  const candidates = players.filter((p) => (p.stats?.minutesPlayed ?? 0) >= IN_FORM_MIN_MINUTES)
  if (!candidates.length) return []
  const teamTotals = buildTeamTotals(allPlayers)

  // Group candidates so each metric's percentile is computed within position.
  const byGroup = {}
  candidates.forEach((p) => {
    const g = getPositionGroup(p.position)
    ;(byGroup[g] ||= []).push(p)
  })

  // For each group, build a percentile lookup per metric in that group's profile.
  const groupPercentileFns = {}
  for (const [group, members] of Object.entries(byGroup)) {
    const profile = IN_FORM_PROFILES[group] ?? IN_FORM_PROFILES.CM
    const fns = {}
    for (const key of Object.keys(profile)) {
      const metric = IN_FORM_METRICS[key]
      if (!metric) continue
      const sorted = members.map((p) => metric.get(p.stats ?? {})).sort((a, b) => a - b)
      fns[key] = (value) => {
        if (!sorted.length) return 0.5
        let count = 0
        for (const x of sorted) { if (x <= value) count++ }
        return count / sorted.length
      }
    }
    groupPercentileFns[group] = fns
  }

  return candidates.map((p) => {
    const fns = groupPercentileFns[getPositionGroup(p.position)] ?? {}
    return {
      ...p,
      inFormScore: calculateInFormScore(p, fns, teamTotals),
      inFormBars: buildInFormBars(p, fns),
    }
  })
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

function rankInForm(players, allPlayers = players) {
  return scoreInFormPool(players, allPlayers)
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
    .filter((p) => !tab.minDribbles || (p.stats?._totalDribbles ?? 0) >= tab.minDribbles)
    .filter((p) => !tab.minPasses || (p.stats?._accuratePasses ?? 0) >= tab.minPasses)
    .filter((p) => tab.lowerIsBetter || tab.fn(p) > 0)
    .sort((a, b) => {
      const direction = tab.lowerIsBetter ? 1 : -1
      return (tab.fn(a) - tab.fn(b)) * direction
    })
    .slice(0, 10)
}
