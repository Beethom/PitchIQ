import { GitCompare, Search, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import PlayerAvatar from './PlayerAvatar'
import ShortlistButton from './ShortlistButton'
import ClubLogo from '../common/ClubLogo'
import CountryFlag from '../common/CountryFlag'
import { summarizeRoleStrengths } from '../../utils/playerMetrics'
import { formatStat } from '../../utils/formatStat'

export default function PlayerCard({ player, selected, onClick, onSimilar }) {
  const strengths = summarizeRoleStrengths(player)
  const standout = getStandoutStat(player)

  const inner = (
    <div
      className={`card overflow-hidden p-0 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:border-sky-200' : 'hover:shadow-xl'
      } ${selected ? 'border-sky-300 bg-sky-50/70 shadow-sky-100' : ''}`}
      onClick={onClick}
    >
      <div className="w-full">
        <div className="relative overflow-hidden rounded-t-lg bg-[linear-gradient(135deg,_#f8fbff_0%,_#eef6fb_52%,_#fff7ed_100%)] px-4 py-4">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
          <div className="relative flex items-start gap-4">
            <PlayerAvatar player={player} size="lg" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-950 truncate">{player.name}</p>
                <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <ClubLogo url={player.club_logo_url} club={player.club} size="xs" />
                <p className="text-xs text-slate-600 truncate">{player.club} · {player.position} · Age {player.age}</p>
              </div>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {player.league} · {player.season}
              </p>
              <div className="mt-3 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-white shadow-sm">
                <div>
                  <p className="text-lg font-black leading-none">{standout.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">{standout.label}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {strengths.map(({ key, score }) => (
                  <span
                    key={key}
                  className="inline-flex items-center rounded-lg border border-white/70 bg-white/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700 backdrop-blur"
                  >
                    {traitLabel(key)} {score}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-4 gap-3">
            <Stat label={player.stats.starts == null ? 'Apps' : 'Starts'} value={player.stats.starts ?? player.stats.appearances} />
            <Stat label="Minutes" value={formatMinutes(player.stats.minutesPlayed)} />
            <Stat label="Goals" value={player.stats.goals} />
            <Stat label="Assists" value={player.stats.assists} />
          </div>

          <div className="mt-4 space-y-2.5">
            <MetricLine label="Shot Conversion" value={player.stats.shotConversion ?? 0} display={formatStat('shotConversion', player.stats.shotConversion)} />
            <MetricLine label="Pass Accuracy" value={player.stats.passAccuracy ?? 0} display={formatStat('passAccuracy', player.stats.passAccuracy)} />
            <MetricLine label="Dribble Success" value={player.stats.dribbleSuccess ?? 0} display={formatStat('dribbleSuccess', player.stats.dribbleSuccess)} />
          </div>

          {!onClick && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <ActionLink to={`/player/${player.id}`} icon={UserRound} label="View" />
              <ActionLink to="/compare" icon={GitCompare} label="Compare" />
              {onSimilar ? (
                <ActionButton onClick={() => onSimilar(player)} icon={Search} label="Similar" />
              ) : (
                <ActionLink to={`/similar/${player.id}`} icon={Search} label="Similar" />
              )}
              <ShortlistButton player={player} compact />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (onClick) return inner

  return inner
}

function traitLabel(key) {
  return {
    finishing: 'Finisher',
    creation: 'Creator',
    ballProgression: 'Ball Carrier',
    defending: 'High Press',
  }[key] ?? key
}

function getStandoutStat(player) {
  const stats = player.stats ?? {}
  const candidates = [
    { label: 'G+A', value: stats.goalContributions ?? 0, rank: stats.goalContributions ?? 0 },
    { label: 'Chances', value: stats.chancesCreated ?? 0, rank: stats.chancesCreated ?? 0 },
    { label: 'Rating', value: (stats.rating ?? 0).toFixed(1), rank: (stats.rating ?? 0) * 12 },
    { label: 'Def Work', value: stats.defensiveWorkrate ?? 0, rank: stats.defensiveWorkrate ?? 0 },
  ]
  return candidates.sort((a, b) => b.rank - a.rank)[0]
}

function formatMinutes(value = 0) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
}

function ActionLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
    >
      <Icon size={13} />
      {label}
    </Link>
  )
}

function ActionButton({ onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2.5 text-center">
      <p className="text-base font-black text-slate-950">{value}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function MetricLine({ label, value, display }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-slate-600 normal-case tracking-normal">{display}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400"
          style={{ width: `${Math.max(8, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  )
}
