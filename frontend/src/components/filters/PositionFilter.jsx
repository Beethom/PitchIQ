import { POSITIONS } from '../../utils/constants'

export default function PositionFilter({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          !value
            ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
        }`}
        onClick={() => onChange('')}
      >
        All
      </button>
      {POSITIONS.map((pos) => (
        <button
          key={pos}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === pos
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
          }`}
          onClick={() => onChange(pos === value ? '' : pos)}
        >
          {pos}
        </button>
      ))}
    </div>
  )
}
