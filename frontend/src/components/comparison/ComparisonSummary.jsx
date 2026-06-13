import { buildInsight } from '../../utils/buildInsight'
import { Sparkles } from 'lucide-react'
import ClubLogo from '../common/ClubLogo'
import CountryFlag from '../common/CountryFlag'

export default function ComparisonSummary({ playerA, playerB }) {
  const { narrative, summaryA, summaryB } = buildInsight(playerA, playerB)

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Sparkles size={15} className="text-indigo-500" />
        Auto Insight
      </h3>

      <p className="text-sm text-slate-600 leading-relaxed">{narrative}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InsightRow
          player={playerA}
          summary={summaryA}
          color="text-indigo-700"
          bg="bg-indigo-50 border-indigo-200"
        />
        <InsightRow
          player={playerB}
          summary={summaryB}
          color="text-sky-700"
          bg="bg-sky-50 border-sky-200"
        />
      </div>
    </div>
  )
}

function InsightRow({ player, summary, color, bg }) {
  if (!summary) return null
  return (
    <div className={`border rounded-xl px-4 py-3 ${bg}`}>
      {/* Player identity */}
      <div className="flex items-center gap-2 mb-1.5">
        <ClubLogo url={player.club_logo_url} club={player.club} size="xs" />
        <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
        <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{player.name}</p>
      </div>
      <p className="text-sm text-slate-600">{summary}</p>
    </div>
  )
}
