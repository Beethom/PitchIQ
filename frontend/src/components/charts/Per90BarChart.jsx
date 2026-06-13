import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { BAR_STATS } from '../../utils/constants'
import { toPer90 } from '../../utils/per90'

const COLOR_A = '#6366f1'
const COLOR_B = '#0ea5e9'

export default function Per90BarChart({ playerA, playerB }) {
  const per90Value = (player, key) => {
    const value = toPer90(player.stats[key] ?? 0, player.stats.minutesPlayed)
    return value == null ? 0 : Number(value.toFixed(2))
  }

  const data = BAR_STATS.map(({ key, label }) => ({
    stat: label,
    [playerA.name]: per90Value(playerA, key),
    [playerB.name]: per90Value(playerB, key),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="stat" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis                tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#0f172a', fontWeight: 600 }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 8 }} />
        <Bar dataKey={playerA.name} fill={COLOR_A} radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey={playerB.name} fill={COLOR_B} radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
