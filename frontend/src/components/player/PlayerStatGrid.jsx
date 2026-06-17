import { formatStat } from '../../utils/formatStat'
import { STAT_GROUPS } from '../../utils/constants'

const ALWAYS_VISIBLE_STATS = new Set([
  'throughPasses',
  'chancesCreated',
  'bigChancesCreated',
  'missedChances',
  'bigChancesMissed',
])

export default function PlayerStatGrid({ stats, position }) {
  const visibleGroups = STAT_GROUPS
    .map((group) => {
      const groupStats = group.stats.filter(({ key }) => {
        if (ALWAYS_VISIBLE_STATS.has(key)) return true
        if (position !== 'GK' && group.label === 'Goalkeeping') {
          return stats[key] != null && Number(stats[key]) !== 0
        }
        return stats[key] != null
      })
      return groupStats.length ? { ...group, stats: groupStats } : null
    })
    .filter(Boolean)

  return (
    <div className="space-y-8">
      {visibleGroups.map((group) => (
        <section key={group.label}>
          <h3 className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">{displayGroupLabel(group.label)}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {group.stats.map(({ key, label }) => {
              const source = statSource(key, stats, position)
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-3xl font-black tracking-tight text-slate-950">{formatStat(key, stats[key])}</p>
                    <SourceBadge source={source} />
                  </div>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {!visibleGroups.length && (
        <p className="rounded-xl border border-slate-200 bg-white py-6 text-center text-sm text-slate-400 shadow-sm">No stats available</p>
      )}
    </div>
  )
}

function statSource(key, stats, position) {
  if (stats[key] == null) return 'unavailable'
  if ([
    'goalContributions',
    'shotConversion',
    'passAccuracy',
    'crossAccuracy',
    'dribbleSuccess',
    'touchesPerMatch',
    'possessionLostPerMatch',
    'defensiveWorkrate',
    'defensiveContribution',
    'defensiveIntensity',
  ].includes(key)) return 'calculated'
  if (key === 'bigChancesCreated' && (stats.bigChancesCreated ?? 0) > 0 && (stats.xA ?? 0) > 0) return 'exact'
  if (key === 'bigChancesCreated') return 'estimated'
  if (key === 'throughPasses') return (stats.throughPasses ?? 0) > 0 ? 'exact' : 'unavailable'
  if (['missedChances', 'bigChancesMissed'].includes(key)) return (stats[key] ?? 0) > 0 ? 'exact' : 'unavailable'
  if (position === 'GK' && ['savePercentage', 'saves', 'totalShotsFaced', 'goalsConceded', 'cleanSheets'].includes(key)) {
    return key === 'savePercentage' ? 'calculated' : 'exact'
  }
  return 'exact'
}

function SourceBadge({ source }) {
  const map = {
    exact: ['Exact', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
    calculated: ['Calculated', 'bg-sky-50 text-sky-700 ring-sky-200'],
    estimated: ['Estimated', 'bg-amber-50 text-amber-700 ring-amber-200'],
    unavailable: ['Unavailable', 'bg-slate-100 text-slate-500 ring-slate-200'],
  }
  const [label, className] = map[source] ?? map.exact
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ring-1 ${className}`}>
      {label}
    </span>
  )
}

function displayGroupLabel(label) {
  if (label === 'Passing & Creation') return 'Passing'
  if (label === 'Dribbling & Possession') return 'Possession'
  return label
}
