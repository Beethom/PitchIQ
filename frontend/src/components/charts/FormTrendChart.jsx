import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

export default function FormTrendChart({ player, color = '#6366f1' }) {
  const form = player.form ?? []
  const estimated = form.some((f) => f.estimated)
  const data = [...form].reverse().map((f, index) => ({
    match: (f.match ?? `Match ${index + 1}`).replace('vs ', ''),
    rating: Number(f.rating ?? 0),
    goals: f.goals ?? 0,
    assists: f.assists ?? 0,
    date: f.date,
  }))

  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-700">No recent match log yet</p>
          <p className="mt-1 text-xs text-slate-400">Run recent fixture sync to populate last-five match ratings.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {estimated && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Season-average estimate shown until recent fixture logs are synced for this player.
        </p>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="match" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[5, 10]}   tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={7} stroke="#e2e8f0" strokeDasharray="4 2" />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: '#0f172a', fontWeight: 600 }}
            formatter={(value, name, item) => {
              if (name !== 'rating') return value
              const payload = item?.payload ?? {}
              return [`${Number(value).toFixed(1)} rating · ${payload.goals}G ${payload.assists}A`, 'Form']
            }}
          />
          <Line
            type="monotone" dataKey="rating" stroke={color} strokeWidth={2.5}
            dot={{ fill: color, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {[...form].slice(0, 5).map((item, index) => (
          <FormMatchCard key={`${item.match}-${item.date}-${index}`} item={item} index={index} />
        ))}
      </div>
    </div>
  )
}

function FormMatchCard({ item, index }) {
  const opponent = item.estimated
    ? 'Opponent unavailable'
    : (item.match ?? `Match ${index + 1}`).replace(/^vs\s+/i, '')

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <p className="truncate text-xs font-semibold text-slate-900" title={opponent}>
        {item.estimated ? opponent : `vs ${opponent}`}
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {item.date || 'Date TBD'}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-lg font-black tabular-nums text-indigo-600">
          {Number(item.rating ?? 0).toFixed(1)}
        </span>
        <span className="text-[11px] font-semibold text-slate-500">
          {item.goals ?? 0}G {item.assists ?? 0}A
        </span>
      </div>
    </div>
  )
}
