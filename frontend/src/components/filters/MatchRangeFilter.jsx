export default function MatchRangeFilter({ min = 1, max = 38, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 whitespace-nowrap">Min apps</span>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-indigo-500 cursor-pointer"
      />
      <span className="text-xs font-semibold text-slate-700 w-5 text-right">{value}</span>
    </div>
  )
}
