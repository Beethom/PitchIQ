import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Flame, GitCompare, Info, Share2, Trophy, Users } from 'lucide-react'
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

            <DebateMode playerA={playerA} playerB={playerB} />

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

function debateScore(player) {
  const stats = player.stats ?? {}
  return {
    output: (toPer90(stats.goalContributions ?? 0, stats.minutesPlayed) ?? 0) * 34,
    creation: (toPer90(stats.chancesCreated ?? stats.keyPasses ?? 0, stats.minutesPlayed) ?? 0) * 22 + (stats.bigChancesCreated ?? 0) * 1.2,
    control: (stats.passAccuracy ?? 0) * 0.18 + (toPer90(stats.touches ?? 0, stats.minutesPlayed) ?? 0) * 0.24,
    defense: (toPer90((stats.tackles ?? 0) + (stats.interceptions ?? 0) + (stats.recoveries ?? 0), stats.minutesPlayed) ?? 0) * 8,
    form: (stats.rating ?? 0) * 7,
  }
}

function debateRows(playerA, playerB) {
  const scoreA = debateScore(playerA)
  const scoreB = debateScore(playerB)
  return [
    { label: 'Output', key: 'output', body: 'goals, assists, and end product per 90' },
    { label: 'Creation', key: 'creation', body: 'chances, big chances, and key-pass volume' },
    { label: 'Control', key: 'control', body: 'touch volume and pass security' },
    { label: 'Defensive edge', key: 'defense', body: 'tackles, interceptions, recoveries per 90' },
    { label: 'Form', key: 'form', body: 'rating and recent impact signal' },
  ].map((row) => ({
    ...row,
    valueA: scoreA[row.key],
    valueB: scoreB[row.key],
    winner: scoreA[row.key] === scoreB[row.key] ? null : scoreA[row.key] > scoreB[row.key] ? 'A' : 'B',
  }))
}

function DebateMode({ playerA, playerB }) {
  const [copied, setCopied] = useState(false)
  const rows = debateRows(playerA, playerB)
  const winsA = rows.filter((row) => row.winner === 'A').length
  const winsB = rows.filter((row) => row.winner === 'B').length
  const winner = winsA === winsB ? null : winsA > winsB ? playerA : playerB
  const loser = winner?.id === playerA.id ? playerB : playerA
  const debateText = debateSummaryText(playerA, playerB, rows, winner)

  async function copyDebate() {
    try {
      await navigator.clipboard.writeText(debateText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  function downloadDebateCard() {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 675
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(32, 32, 1136, 611)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 54px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('PitchIQ Debate Mode', 72, 115)
    ctx.font = '900 70px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(shortName(playerA.name), 72, 245)
    ctx.fillText(shortName(playerB.name), 760, 245)
    ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = '#38bdf8'
    ctx.fillText(`${winsA} category wins`, 72, 300)
    ctx.fillStyle = '#34d399'
    ctx.fillText(`${winsB} category wins`, 760, 300)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 44px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(winner ? `${shortName(winner.name)} has the edge` : 'Debate is too close to call', 72, 405)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '500 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    wrapCanvasText(ctx, debateText, 72, 465, 1040, 34)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `${playerA.name}-vs-${playerB.name}-debate.png`.replace(/[^a-z0-9.-]+/gi, '-')
    link.click()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/10 p-3 text-amber-300">
            <Flame size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">Debate Mode</p>
            <h2 className="mt-1 text-2xl font-black">
              {winner ? `${winner.name} has the edge` : 'Too close to call'}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Built for fan arguments: output, creation, control, role fit, and form.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyDebate} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
            <Share2 size={15} /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={downloadDebateCard} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
            <Download size={15} /> Card
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr_1fr]">
        <DebatePlayer player={playerA} wins={winsA} tone="sky" />
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-slate-950">{row.label}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                  row.winner === 'A' ? 'bg-sky-100 text-sky-700' : row.winner === 'B' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {row.winner === 'A' ? shortName(playerA.name) : row.winner === 'B' ? shortName(playerB.name) : 'Even'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{row.body}</p>
            </div>
          ))}
        </div>
        <DebatePlayer player={playerB} wins={winsB} tone="emerald" />
      </div>

      <div className="border-t border-slate-100 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <Trophy size={18} className="mt-0.5 text-amber-500" />
          <p className="text-sm leading-6 text-slate-700">
            {winner
              ? `${winner.name} wins this argument ${Math.max(winsA, winsB)}-${Math.min(winsA, winsB)} on category edge. ${loser.name} can still win the debate if the context values their strongest category more.`
              : `${playerA.name} and ${playerB.name} split the argument. Use role fit and minutes context as the tiebreaker.`}
          </p>
        </div>
      </div>
    </section>
  )
}

function DebatePlayer({ player, wins, tone }) {
  const stats = player.stats ?? {}
  const toneClass = tone === 'sky' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar player={player} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-950">{player.name}</p>
          <p className="truncate text-xs font-semibold text-slate-500">{player.club} · {player.position}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <DebateMini label="Wins" value={wins} toneClass={toneClass} />
        <DebateMini label="Rating" value={stats.rating != null ? Number(stats.rating).toFixed(1) : '—'} toneClass={toneClass} />
        <DebateMini label="G+A" value={stats.goalContributions ?? 0} toneClass={toneClass} />
        <DebateMini label="Chances" value={stats.chancesCreated ?? stats.keyPasses ?? 0} toneClass={toneClass} />
      </div>
    </div>
  )
}

function DebateMini({ label, value, toneClass }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${toneClass}`}>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
    </div>
  )
}

function debateSummaryText(playerA, playerB, rows, winner) {
  const rowText = rows.map((row) => `${row.label}: ${row.winner === 'A' ? playerA.name : row.winner === 'B' ? playerB.name : 'Even'}`).join(' | ')
  return `PitchIQ debate: ${playerA.name} vs ${playerB.name}. Verdict: ${winner ? `${winner.name} has the edge` : 'too close to call'}. ${rowText}.`
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = testLine
    }
  }
  if (line) ctx.fillText(line, x, y)
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
