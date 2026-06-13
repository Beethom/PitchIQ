import { motion } from 'framer-motion'
import { GitCompare, Info, Users } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerSelector from '../components/player/PlayerSelector'
import PlayerAvatar from '../components/player/PlayerAvatar'
import ComparisonTable from '../components/comparison/ComparisonTable'
import ComparisonSummary from '../components/comparison/ComparisonSummary'
import PeerBenchmark from '../components/comparison/PeerBenchmark'
import Per90Toggle from '../components/comparison/Per90Toggle'
import RadarComparisonChart from '../components/charts/RadarComparisonChart'
import Per90BarChart from '../components/charts/Per90BarChart'
import ChartCard from '../components/charts/ChartCard'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import { useComparison } from '../hooks/useComparison'
import { formatStat } from '../utils/formatStat'
import { toPer90 } from '../utils/per90'

export default function ComparePlayers() {
  const {
    playerA, playerB,
    scopeA, scopeB,
    scopeOptionsA, scopeOptionsB,
    per90, loading, error,
    selectPlayerA, selectPlayerB,
    clearPlayerA, clearPlayerB,
    setScopeA, setScopeB,
    togglePer90,
  } = useComparison()

  const ready = playerA && playerB

  return (
    <div className="flex-1 min-w-0">
      {/* Gradient header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 text-white px-4 sm:px-6 lg:px-8 py-8"
      >
        <div className="max-w-7xl mx-auto">
          <span className="inline-block text-xs font-semibold bg-white/20 border border-white/20 px-3 py-1 rounded-full mb-3">
            Player Comparison
          </span>
          <h1 className="text-3xl md:text-4xl font-bold">Compare Players</h1>
          <p className="mt-2 text-sky-100/90 text-sm">
            Select two players to compare stats, charts, and auto-generated insights.
          </p>
        </div>
      </motion.div>

      <PageContainer>
        {/* Player selectors */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 -mt-6"
        >
          <PlayerSelector
            label="Player A"
            player={playerA}
            onSelect={selectPlayerA}
            onClear={clearPlayerA}
            scopeOptions={scopeOptionsA}
            selectedScope={scopeA}
            onScopeChange={setScopeA}
          />
          <PlayerSelector
            label="Player B"
            player={playerB}
            onSelect={selectPlayerB}
            onClear={clearPlayerB}
            scopeOptions={scopeOptionsB}
            selectedScope={scopeB}
            onScopeChange={setScopeB}
          />
        </motion.div>

        {loading && <Loader text="Loading comparison…" />}
        {error   && <ErrorMessage message={error} />}

        {!loading && !ready && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Users size={28} className="text-indigo-400" />
            </div>
            <p className="text-slate-700 font-medium">Select two players to start comparing</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Use the search boxes above to find any player in the database.
            </p>
          </div>
        )}

        {!loading && ready && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="space-y-6"
          >
            {/* Per-90 toggle */}
            <div className="flex justify-end">
              <Per90Toggle enabled={per90} onToggle={togglePer90} />
            </div>

            <HeadToHeadGraphic playerA={playerA} playerB={playerB} />

            {/* Insight summary */}
            <ComparisonSummary playerA={playerA} playerB={playerB} />

            <PeerBenchmark playerA={playerA} playerB={playerB} />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Radar Comparison" subtitle="Normalised per-90 across key attributes (0 – 100)">
                <RadarComparisonChart playerA={playerA} playerB={playerB} />
              </ChartCard>
              <ChartCard title="Per 90 Stats" subtitle="Key output per 90 minutes">
                <Per90BarChart playerA={playerA} playerB={playerB} />
              </ChartCard>
            </div>

            {/* Stat table */}
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-3">Detailed Stats</h2>
              <ComparisonTable playerA={playerA} playerB={playerB} per90={per90} />
            </div>

            <ComparisonGuide />
          </motion.div>
        )}
      </PageContainer>
    </div>
  )
}

const COMPARISON_ROWS = [
  { key: 'appearances', label: 'Games' },
  { key: 'minutesPlayed', label: 'Minutes' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'goalContributions', label: 'Goal Contributions' },
  { key: 'goalsP90', label: 'Goals per90', rate: true },
  { key: 'assistsP90', label: 'Assists per90', rate: true },
  { key: 'shotConversion', label: 'Shot Conversion %' },
  { key: 'chancesCreated', label: 'Chances Created' },
  { key: 'finalThirdPasses', label: 'Final-third Passes' },
  { key: 'throughPasses', label: 'Through Passes' },
  { key: 'crosses', label: 'Crosses' },
  { key: 'accurateCrosses', label: 'Accurate Crosses' },
  { key: 'dribbles', label: 'Successful Dribbles' },
  { key: 'touches', label: 'Touches' },
  { key: 'touchesPerMatch', label: 'Touches per Match', rate: true },
  { key: 'passAccuracy', label: 'Pass Accuracy %' },
  { key: 'defensiveWorkrate', label: 'Defensive Work Rate' },
  { key: 'tacklesP90', label: 'Tackles per90', rate: true },
  { key: 'interceptionsP90', label: 'Interceptions per90', rate: true },
  { key: 'aerialP90', label: 'Aerial Wins per90', rate: true },
  { key: 'recoveriesP90', label: 'Recoveries per90', rate: true },
  { key: 'possessionLostP90', label: 'Possession Lost per90', lowerBetter: true, rate: true },
  { key: 'possessionLostPerMatch', label: 'Possession Lost per Match', lowerBetter: true, rate: true },
  { key: 'possessionLost', label: 'Possession Lost', lowerBetter: true },
]

function compareValue(player, key) {
  const stats = player.stats ?? {}
  if (key === 'goalsP90') return toPer90(stats.goals ?? 0, stats.minutesPlayed) ?? 0
  if (key === 'assistsP90') return toPer90(stats.assists ?? 0, stats.minutesPlayed) ?? 0
  if (key === 'tacklesP90') return toPer90(stats.tackles ?? 0, stats.minutesPlayed) ?? 0
  if (key === 'interceptionsP90') return toPer90(stats.interceptions ?? 0, stats.minutesPlayed) ?? 0
  if (key === 'aerialP90') return toPer90(stats.aerialDuelsWon ?? 0, stats.minutesPlayed) ?? 0
  if (key === 'recoveriesP90') return toPer90(stats.recoveries ?? 0, stats.minutesPlayed) ?? 0
  if (key === 'possessionLostP90') return toPer90(stats.possessionLost ?? 0, stats.minutesPlayed) ?? 0
  return stats[key] ?? 0
}

function compareFormat(key, value) {
  if (key.endsWith('P90')) return value.toFixed(2)
  if (key === 'minutesPlayed') return Math.round(value).toLocaleString()
  return formatStat(key, value)
}

function shortName(name = '') {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function HeadToHeadGraphic({ playerA, playerB }) {
  const rows = COMPARISON_ROWS.map((row) => {
    const valueA = compareValue(playerA, row.key)
    const valueB = compareValue(playerB, row.key)
    const winner = valueA === valueB
      ? null
      : row.lowerBetter
        ? (valueA < valueB ? 'A' : 'B')
        : (valueA > valueB ? 'A' : 'B')
    const max = Math.max(Math.abs(valueA), Math.abs(valueB), row.key.includes('Accuracy') || row.key.includes('Conversion') ? 100 : 1)

    return {
      ...row,
      valueA,
      valueB,
      winner,
      widthA: Math.max(8, Math.min(100, (Math.abs(valueA) / max) * 100)),
      widthB: Math.max(8, Math.min(100, (Math.abs(valueB) / max) * 100)),
    }
  })

  const winsA = rows.filter((row) => row.winner === 'A').length
  const winsB = rows.filter((row) => row.winner === 'B').length

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr]">
        <PlayerCompareHeader player={playerA} side="A" wins={winsA} />

        <div className="hidden items-center justify-center border-x border-white/10 px-8 lg:flex">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/5">
            <GitCompare size={28} />
          </div>
        </div>

        <PlayerCompareHeader player={playerB} side="B" wins={winsB} />
      </div>

      <div className="border-t border-white/10">
        {rows.map((row) => (
          <HeadToHeadRow key={row.key} row={row} />
        ))}
      </div>
    </section>
  )
}

function PlayerCompareHeader({ player, side, wins }) {
  const align = side === 'A' ? 'lg:text-left' : 'lg:text-right'
  const justify = side === 'A' ? 'lg:justify-start' : 'lg:justify-end'

  return (
    <div className={`relative flex flex-col gap-4 p-6 sm:p-8 ${side === 'B' ? 'lg:items-end' : ''}`}>
      <div className={`flex items-center gap-4 ${side === 'B' ? 'lg:flex-row-reverse' : ''} ${justify}`}>
        <div className="rounded-3xl bg-white/10 p-1 ring-1 ring-white/10">
          <PlayerAvatar player={player} size="xl" />
        </div>
        <div className={`min-w-0 ${align}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            {player.position} · {player.age ? `Age ${player.age}` : player.nationality}
          </p>
          <h2 className="mt-1 truncate text-3xl font-black uppercase tracking-normal text-white sm:text-4xl">
            {shortName(player.name)}
          </h2>
          <p className="mt-1 truncate text-sm text-white/60">{player.name}</p>
          <p className="mt-3 text-sm font-medium text-white/70">
            {player.season} {player.league}
          </p>
          <p className="mt-1 truncate text-xs text-white/45">{player.club}</p>
        </div>
      </div>

      <div className={`flex items-center gap-3 ${justify}`}>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
          {wins} category wins
        </span>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
          {player.stats?.minutesPlayed?.toLocaleString?.() ?? 0} min
        </span>
      </div>
    </div>
  )
}

function HeadToHeadRow({ row }) {
  const colorA = row.winner === 'A' ? 'bg-emerald-500' : 'bg-red-500'
  const colorB = row.winner === 'B' ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 sm:grid-cols-[88px_1fr_180px_1fr_88px] sm:items-center sm:gap-5">
      <div className="text-right text-lg font-bold tabular-nums text-white sm:text-xl">
        {compareFormat(row.key, row.valueA)}
      </div>

      <div className="flex items-center">
        <div className="h-3 w-full rounded-full bg-white/5">
          <div
            className={`ml-auto h-full rounded-full ${colorA}`}
            style={{ width: `${row.widthA}%` }}
          />
        </div>
      </div>

      <div className="col-span-2 text-center text-xs font-semibold text-white/80 sm:col-span-1 sm:text-sm">
        {row.label}
      </div>

      <div className="flex items-center">
        <div className="h-3 w-full rounded-full bg-white/5">
          <div
            className={`h-full rounded-full ${colorB}`}
            style={{ width: `${row.widthB}%` }}
          />
        </div>
      </div>

      <div className="text-left text-lg font-bold tabular-nums text-white sm:text-xl">
        {compareFormat(row.key, row.valueB)}
      </div>
    </div>
  )
}

function ComparisonGuide() {
  const guideItems = [
    {
      title: 'Green and red bars',
      body: 'Green marks the player leading that row. Red marks the lower side. For possession lost rows, lower is treated as better.',
    },
    {
      title: 'Per90 rows',
      body: 'Per90 converts counting stats to a 90-minute rate, which makes players with different minutes easier to compare.',
    },
    {
      title: 'Defensive Work Rate',
      body: 'Custom 0-100 estimate using tackles, interceptions, aerial wins, recoveries, and possession lost per90, with a small position adjustment.',
    },
    {
      title: 'Position adjustment',
      body: 'Defenders get a 1.10 boost, CDM/CM get 1.05, and attacking roles get 0.90 because defensive activity means different things by role.',
    },
  ]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
          <Info size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Comparison Guide</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quick notes for reading the head-to-head graphic and custom scores.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {guideItems.map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
          Defensive Work Rate Formula
        </p>
        <p className="mt-2 text-sm leading-6 text-indigo-900">
          (tackles per90 x 18) + (interceptions per90 x 22) + (aerial wins per90 x 9) + (recoveries per90 x 12) - (possession lost per90 x 2), then multiplied by the position adjustment and capped from 0 to 100.
        </p>
      </div>
    </section>
  )
}
