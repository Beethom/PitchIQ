import { formatStat } from '../../utils/formatStat'
import { buildPer90Stats } from '../../utils/per90'
import { STAT_GROUPS } from '../../utils/constants'
import ClubLogo from '../common/ClubLogo'
import CountryFlag from '../common/CountryFlag'

const LOWER_BETTER = new Set(['yellowCards', 'redCards'])

export default function ComparisonTable({ playerA, playerB, per90 }) {
  const statsA = per90 ? buildPer90Stats(playerA.stats) : playerA.stats
  const statsB = per90 ? buildPer90Stats(playerB.stats) : playerB.stats

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-3 bg-gradient-to-r from-sky-50 to-violet-50 border-b border-slate-200 px-4 py-4">
        {/* Player A */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <ClubLogo url={playerA.club_logo_url} club={playerA.club} size="sm" />
            <CountryFlag code={playerA.flag_code} nationality={playerA.nationality} size="xs" />
          </div>
          <p className="text-sm font-semibold text-indigo-600 truncate max-w-full">{playerA.name}</p>
        </div>

        {/* Centre label */}
        <div className="flex items-center justify-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stat</p>
        </div>

        {/* Player B */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <ClubLogo url={playerB.club_logo_url} club={playerB.club} size="sm" />
            <CountryFlag code={playerB.flag_code} nationality={playerB.nationality} size="xs" />
          </div>
          <p className="text-sm font-semibold text-sky-600 truncate max-w-full">{playerB.name}</p>
        </div>
      </div>

      {/* Rows */}
      {STAT_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-4 py-2 bg-slate-50 border-y border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {group.label}
            </p>
          </div>
          {group.stats.map(({ key, label }) => {
            const valA = statsA[key] ?? 0
            const valB = statsB[key] ?? 0
            const cmp  = LOWER_BETTER.has(key)
              ? (valA === valB ? null : valA < valB ? 'A' : 'B')
              : (valA === valB ? null : valA > valB ? 'A' : 'B')

            return (
              <div
                key={key}
                className="grid grid-cols-3 items-center px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
              >
                <div className="text-center">
                  <span className={`text-base font-bold ${cmp === 'A' ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {formatStat(key, valA)}
                  </span>
                  {cmp === 'A' && <div className="w-1 h-1 rounded-full bg-indigo-400 mx-auto mt-1" />}
                </div>
                <div className="text-center text-xs text-slate-400 px-2">{label}</div>
                <div className="text-center">
                  <span className={`text-base font-bold ${cmp === 'B' ? 'text-sky-600' : 'text-slate-700'}`}>
                    {formatStat(key, valB)}
                  </span>
                  {cmp === 'B' && <div className="w-1 h-1 rounded-full bg-sky-400 mx-auto mt-1" />}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
