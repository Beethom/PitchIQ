import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import { buildRadarData } from '../../utils/buildRadarData'

const COLOR_A = '#6366f1' // indigo-500
const COLOR_B = '#0ea5e9' // sky-500

export default function RadarComparisonChart({ playerA, playerB }) {
  const data = buildRadarData(playerA, playerB)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="stat" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} tickCount={4} />
        <Radar
          name={playerA.name} dataKey={playerA.name}
          stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.15} strokeWidth={2}
          dot={{ fill: COLOR_A, r: 3 }}
        />
        <Radar
          name={playerB.name} dataKey={playerB.name}
          stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.15} strokeWidth={2}
          dot={{ fill: COLOR_B, r: 3 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#0f172a', fontWeight: 600 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
