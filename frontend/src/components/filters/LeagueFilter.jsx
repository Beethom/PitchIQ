import { LEAGUES } from '../../utils/constants'

export default function LeagueFilter({ value, onChange }) {
  return (
    <select className="select text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All Competitions</option>
      {LEAGUES.map((l) => <option key={l} value={l}>{l}</option>)}
    </select>
  )
}
