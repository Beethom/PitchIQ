import { useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { usePlayers } from '../../hooks/usePlayers'
import { formatStat } from '../../utils/formatStat'
import { toPer90 } from '../../utils/per90'
import { benchmarkRole } from '../../utils/positionRoles'

const TOP_7_LEAGUES = new Set([
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1',
  'Liga Profesional de Fútbol',
  'Brasileirão Betano',
])

const BENCHMARK_METRICS = [
  { key: 'progressivePasses', label: 'Progressive Passes' },
  { key: 'chancesCreated', label: 'Chances Created' },
  { key: 'goalContributions', label: 'Goal Contributions' },
  { key: 'passAccuracy', label: 'Pass Accuracy' },
  { key: 'dribbles', label: 'Dribbles' },
  { key: 'defensiveWorkrate', label: 'Defensive Work Rate' },
]

const POOLS = [
  { value: 'top7', label: 'Top 7 Leagues' },
  { value: 'all', label: 'All Competitions' },
]

function metricValue(player, metricKey) {
  return player?.stats?.[metricKey] ?? 0
}

function metricPer90Value(player, metricKey) {
  if (['passAccuracy', 'dribbleSuccess', 'shotConversion', 'defensiveWorkrate'].includes(metricKey)) {
    return metricValue(player, metricKey)
  }
  return toPer90(metricValue(player, metricKey), player?.stats?.minutesPlayed) ?? 0
}

function filterByPool(players, pool) {
  if (pool === 'top7') {
    return players.filter((player) => TOP_7_LEAGUES.has(player.primary_league || player.league))
  }
  return players
}

function filterByPosition(players, player, scope) {
  if (!player) return []
  if (scope === 'family') {
    const role = benchmarkRole(player.position)
    return players.filter((candidate) => benchmarkRole(candidate.position) === role)
  }
  return players.filter((candidate) => candidate.position === player.position)
}

function rankPlayers(players, metricKey, per90) {
  const getValue = per90 ? metricPer90Value : metricValue
  return [...players].sort((a, b) => getValue(b, metricKey) - getValue(a, metricKey))
}

function PlayerBenchmarkCard({
  title,
  player,
  players,
  metricKey,
  pool,
  positionScope,
  minApps,
  per90,
}) {
  const leaderboard = useMemo(() => {
    if (!player) return []
    const pooled = filterByPool(players, pool)
    const byPosition = filterByPosition(pooled, player, positionScope)
    const eligible = byPosition.filter((candidate) => (candidate.stats?.appearances ?? 0) >= minApps)
    return rankPlayers(eligible, metricKey, per90)
  }, [player, players, pool, positionScope, minApps, metricKey, per90])

  const currentIndex = leaderboard.findIndex((candidate) => candidate.id === player?.id)
  const rank = currentIndex >= 0 ? currentIndex + 1 : null
  const topFive = leaderboard.slice(0, 5)
  const value = player ? (per90 ? metricPer90Value(player, metricKey) : metricValue(player, metricKey)) : null

  if (!player) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{player.name}</p>
          <p className="text-sm text-slate-500">{player.position} · {player.club}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rank</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{rank ? `#${rank}` : '—'}</p>
          <p className="text-xs text-slate-500">
            {value == null ? 'No value' : `${formatStat(metricKey, value)}${per90 && !['passAccuracy', 'dribbleSuccess', 'shotConversion', 'defensiveWorkrate'].includes(metricKey) ? ' /90' : ''}`}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Top 5</p>
        <div className="mt-3 space-y-2">
          {topFive.map((candidate, index) => (
            <div key={candidate.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {index + 1}. {candidate.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {candidate.position} · {candidate.club}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-slate-700">
                {formatStat(metricKey, per90 ? metricPer90Value(candidate, metricKey) : metricValue(candidate, metricKey))}
              </p>
            </div>
          ))}
          {topFive.length === 0 && (
            <p className="text-sm text-slate-500">No peers match this benchmark scope yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PeerBenchmark({ playerA, playerB }) {
  const benchmarkSeason = playerA?.season || playerB?.season || ''
  const { players, loading, error } = usePlayers(benchmarkSeason ? { season: benchmarkSeason } : {})
  const [metricKey, setMetricKey] = useState('progressivePasses')
  const [pool, setPool] = useState('top7')
  const [positionScope, setPositionScope] = useState('exact')
  const [minApps, setMinApps] = useState(5)
  const [per90, setPer90] = useState(false)

  if (!playerA && !playerB) return null

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Trophy size={15} className="text-amber-500" />
            Position Benchmark
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Rank selected players against same-position peers and build a top list for the chosen metric.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <label className="text-sm text-slate-600">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Metric</span>
          <select
            value={metricKey}
            onChange={(event) => setMetricKey(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {BENCHMARK_METRICS.map((metric) => (
              <option key={metric.key} value={metric.key}>{metric.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-600">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pool</span>
          <select
            value={pool}
            onChange={(event) => setPool(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {POOLS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-600">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Position Scope</span>
          <select
            value={positionScope}
            onChange={(event) => setPositionScope(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="exact">Exact Position</option>
            <option value="family">Position Line</option>
          </select>
        </label>

        <label className="text-sm text-slate-600">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Min Apps</span>
          <input
            type="number"
            min="1"
            value={minApps}
            onChange={(event) => setMinApps(Number(event.target.value) || 1)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          />
        </label>

        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 md:self-end">
          <input
            type="checkbox"
            checked={per90}
            onChange={(event) => setPer90(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Use per 90
        </label>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading peer pool…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PlayerBenchmarkCard
            title="Player A Benchmark"
            player={playerA}
            players={players}
            metricKey={metricKey}
            pool={pool}
            positionScope={positionScope}
            minApps={minApps}
            per90={per90}
          />
          <PlayerBenchmarkCard
            title="Player B Benchmark"
            player={playerB}
            players={players}
            metricKey={metricKey}
            pool={pool}
            positionScope={positionScope}
            minApps={minApps}
            per90={per90}
          />
        </div>
      )}
    </div>
  )
}
