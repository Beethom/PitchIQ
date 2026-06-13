import { X } from 'lucide-react'
import PlayerSearch from './PlayerSearch'
import PlayerAvatar from './PlayerAvatar'
import ClubLogo from '../common/ClubLogo'
import CountryFlag from '../common/CountryFlag'

export default function PlayerSelector({
  label,
  player,
  onSelect,
  onClear,
  scopeOptions = [],
  selectedScope = 'all',
  onScopeChange,
}) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>

      {player ? (
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="xl" />

          <div className="flex-1 min-w-0">
            {/* Name + flag */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900 text-lg leading-tight">
                {player.name}
              </p>
              <CountryFlag code={player.flag_code} nationality={player.nationality} size="sm" />
            </div>

            {/* Position */}
            <p className="text-sm text-slate-500 mt-0.5">{player.position}</p>

            {/* Club + logo */}
            <div className="flex items-center gap-1.5 mt-1">
              <ClubLogo url={player.club_logo_url} club={player.club} size="sm" />
              <p className="text-xs text-slate-500 truncate">{player.club} · {player.league}</p>
            </div>

            {scopeOptions.length > 0 && onScopeChange && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Comparison Scope
                </label>
                <select
                  value={selectedScope}
                  onChange={(event) => onScopeChange(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={onClear}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <PlayerSearch
          onSelect={onSelect}
          placeholder={`Search for ${label.toLowerCase()}…`}
        />
      )}
    </div>
  )
}
