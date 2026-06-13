import { useState } from 'react'
import { formatStat } from '../../utils/formatStat'
import { STAT_GROUPS } from '../../utils/constants'

const TOP_STATS_BY_POSITION = {
  GK:  ['saves', 'totalShotsFaced', 'goalsConceded', 'passAccuracy', 'highClaims', 'yellowCards'],
  CB:  ['recoveries', 'interceptions', 'clearances', 'aerialDuelsWon', 'passAccuracy', 'yellowCards'],
  LB:  ['recoveries', 'interceptions', 'clearances', 'crosses', 'passAccuracy', 'yellowCards'],
  RB:  ['recoveries', 'interceptions', 'clearances', 'crosses', 'passAccuracy', 'yellowCards'],
  CDM: ['tackles', 'interceptions', 'recoveries', 'passAccuracy', 'chancesCreated', 'yellowCards'],
  CM:  ['goals', 'assists', 'chancesCreated', 'passAccuracy', 'progressivePasses', 'yellowCards'],
  CAM: ['goals', 'assists', 'chancesCreated', 'xG', 'xA', 'dribbles'],
  LW:  ['goals', 'assists', 'chancesCreated', 'dribbles', 'shotConversion', 'xG'],
  RW:  ['goals', 'assists', 'chancesCreated', 'dribbles', 'shotConversion', 'xG'],
  ST:  ['goals', 'assists', 'shots', 'shotsOnTarget', 'shotConversion', 'xG'],
}

const TABS = ['Top Stats', 'Attack', 'Defense', 'Goalkeeping', 'Discipline']

const TAB_GROUPS = {
  Attack:      'Attack',
  Defense:     'Defence',
  Goalkeeping: 'Goalkeeping',
  Discipline:  'Discipline',
}

export default function PlayerStatGrid({ stats, position }) {
  const [activeTab, setActiveTab] = useState('Top Stats')

  const topKeys = TOP_STATS_BY_POSITION[position] ?? TOP_STATS_BY_POSITION.CM
  const allStats = STAT_GROUPS.flatMap((g) => g.stats)

  let displayStats = []

  if (activeTab === 'Top Stats') {
    displayStats = topKeys
      .map((key) => allStats.find((s) => s.key === key))
      .filter(Boolean)
  } else {
    const groupLabel = TAB_GROUPS[activeTab]
    const group = STAT_GROUPS.find((g) => g.label === groupLabel)
    displayStats = group?.stats ?? []
  }

  const visibleTabs = position === 'GK'
    ? TABS
    : TABS.filter((t) => t !== 'Goalkeeping')

  return (
    <div>
      {/* Tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === tab
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {displayStats.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
          >
            <p className="stat-value">{formatStat(key, stats[key])}</p>
            <p className="stat-label mt-0.5">{label}</p>
          </div>
        ))}
        {displayStats.length === 0 && (
          <p className="col-span-4 py-6 text-center text-sm text-slate-400">No stats available</p>
        )}
      </div>
    </div>
  )
}
