import { SEASONS } from '../../utils/constants'

export default function SeasonFilter({ value, onChange }) {
  return (
    <select className="select text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All Seasons</option>
      {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
