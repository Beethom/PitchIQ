import { TrendingUp } from 'lucide-react'

export default function StatLeaderBadge({ playerName }) {
  if (!playerName) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
      <TrendingUp size={10} />
      {playerName}
    </span>
  )
}
