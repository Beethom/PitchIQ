import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, GitCompare, LayoutGrid, Search, SlidersHorizontal, Table2, UserRound } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerCard from '../components/player/PlayerCard'
import PlayerAvatar from '../components/player/PlayerAvatar'
import ShortlistButton from '../components/player/ShortlistButton'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import EmptyState from '../components/common/EmptyState'
import SectionTitle from '../components/common/SectionTitle'
import { usePlayers } from '../hooks/usePlayers'
import { SEASONS } from '../utils/constants'
import { summarizeRoleStrengths } from '../utils/playerMetrics'

const COMPETITION_GROUPS = [
  { id: 'leagues', label: 'Leagues', season: '25/26' },
  { id: 'europe', label: 'Europe', season: '25/26' },
  { id: 'mls', label: 'MLS', season: '2026' },
  { id: 'world_cup_2026', label: 'World Cup 2026', season: '2026' },
  { id: 'national', label: 'National', season: '2026' },
]

const POSITION_GROUPS = [
  { id: '', label: 'All', positions: [] },
  { id: 'gk', label: 'GK', positions: ['GK'] },
  { id: 'defenders', label: 'Defenders', positions: ['CB', 'LB', 'RB'] },
  { id: 'midfielders', label: 'Midfielders', positions: ['CDM', 'CM', 'CAM'] },
  { id: 'attackers', label: 'Attackers', positions: ['LW', 'RW', 'ST'] },
]

const SORT_OPTIONS = [
  { id: 'rating', label: 'Rating', value: (player) => player.stats.rating ?? 0 },
  { id: 'goals', label: 'Goals', value: (player) => player.stats.goals ?? 0 },
  { id: 'assists', label: 'Assists', value: (player) => player.stats.assists ?? 0 },
  { id: 'xg', label: 'xG', value: (player) => player.stats.xG ?? 0 },
  { id: 'xa', label: 'xA', value: (player) => player.stats.xA ?? 0 },
  { id: 'chances', label: 'Chances', value: (player) => player.stats.chancesCreated ?? 0 },
  { id: 'defending', label: 'Work Rate', value: (player) => player.stats.defensiveWorkrate ?? 0 },
  { id: 'def_contribution', label: 'Def. Contribution', value: (player) => player.stats.defensiveContribution ?? 0 },
  { id: 'def_intensity',    label: 'Def. Intensity',    value: (player) => player.stats.defensiveIntensity ?? 0 },
  { id: 'saves',            label: 'Saves',             value: (player) => player.stats.saves ?? 0 },
]

const INITIAL_LIMIT = 72
const LIMIT_STEP = 72
const MAX_LIMIT = 288

export default function ScoutingBoard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [competitionGroup, setCompetitionGroup] = useState(searchParams.get('group') || 'leagues')
  const [league, setLeague] = useState(searchParams.get('league') || '')
  const [season, setSeason] = useState(searchParams.get('season') || '25/26')
  const [positionGroup, setPositionGroup] = useState(searchParams.get('position_group') || '')
  const [minStarts, setMinStarts] = useState(Number(searchParams.get('min_starts') || 25))
  const [minMinutes, setMinMinutes] = useState(Number(searchParams.get('min_minutes') || 0))
  const [maxAge, setMaxAge] = useState(Number(searchParams.get('max_age') || 40))
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'rating')
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_LIMIT)
  const [viewMode, setViewMode] = useState('cards')

  useEffect(() => {
    setCompetitionGroup(searchParams.get('group') || 'leagues')
    setLeague(searchParams.get('league') || '')
    setSeason(searchParams.get('season') || '25/26')
    setPositionGroup(searchParams.get('position_group') || '')
    setMinStarts(Number(searchParams.get('min_starts') || 25))
    setMinMinutes(Number(searchParams.get('min_minutes') || 0))
    setMaxAge(Number(searchParams.get('max_age') || 40))
    setSortBy(searchParams.get('sort') || 'rating')
  }, [searchParams])

  useEffect(() => {
    setVisibleLimit(INITIAL_LIMIT)
  }, [competitionGroup, league, season, positionGroup, minStarts, minMinutes, maxAge, sortBy])

  const filters = {
    season,
    min_starts: minStarts,
    min_minutes: minMinutes,
    sort: sortBy,
    limit: visibleLimit,
  }
  if (league) filters.league = league
  else filters.group = competitionGroup
  if (positionGroup) filters.position_group = positionGroup
  if (maxAge < 40) filters.max_age = maxAge

  const { players, loading, error, refetch } = usePlayers(filters)
  const selectedSort = SORT_OPTIONS.find((option) => option.id === sortBy) ?? SORT_OPTIONS[0]
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => selectedSort.value(b) - selectedSort.value(a)),
    [players, selectedSort],
  )
  const canLoadMore = !loading && !error && players.length >= visibleLimit && visibleLimit < MAX_LIMIT

  const setCompetitionGroupFilter = (group) => {
    const config = COMPETITION_GROUPS.find((item) => item.id === group)
    setLeague('')
    setCompetitionGroup(group)
    setSeason(config?.season ?? '')
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#eef6fb_100%)] px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950">
            <ArrowLeft size={15} /> Back to Dashboard
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Player Pool</p>
              <h1 className="mt-2 text-3xl font-black">Scouting Board</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Ranked player cards for deeper browsing. Dashboard stays light; this page handles the full board.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
              <SlidersHorizontal size={15} className="text-sky-600" />
              Minimum {minStarts} starts
            </div>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="space-y-6">
          <div className="surface p-4">
            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-4">
              <div className="space-y-4">
                <FilterTabs label="Competition" value={competitionGroup} options={COMPETITION_GROUPS} onChange={setCompetitionGroupFilter} />
                <FilterTabs label="Position" value={positionGroup} options={POSITION_GROUPS} onChange={setPositionGroup} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <RangeControl label="Age max" min={16} max={40} value={maxAge} onChange={setMaxAge} suffix={maxAge >= 40 ? '+' : ''} />
                  <RangeControl label="Min minutes" min={0} max={3000} step={100} value={minMinutes} onChange={setMinMinutes} />
                  <label className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Sort by</span>
                    <select
                      className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <RangeControl label="Min starts" min={1} max={40} value={minStarts} onChange={setMinStarts} />
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSeason(value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        season === value
                          ? 'bg-slate-950 text-white'
                          : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Current lane:</span>{' '}
                  {league || COMPETITION_GROUPS.find((group) => group.id === competitionGroup)?.label} · {season || 'all seasons'} · Loaded {players.length} ranked profiles
                </div>
              </div>
            </div>
          </div>

          {loading && <Loader />}
          {error && <ErrorMessage message={error} onRetry={refetch} />}
          {!loading && !error && sortedPlayers.length === 0 && (
            <EmptyState title="No players match" message="Try lowering minimum starts or broadening the filters." />
          )}

          {!loading && !error && sortedPlayers.length > 0 && (
            <div>
              <SectionTitle
                title="Scouting Board"
                subtitle={`${sortedPlayers.length} ranked profile${sortedPlayers.length !== 1 ? 's' : ''} loaded`}
              />

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                  <ViewModeButton active={viewMode === 'cards'} icon={LayoutGrid} label="Cards" onClick={() => setViewMode('cards')} />
                  <ViewModeButton active={viewMode === 'table'} icon={Table2} label="Table" onClick={() => setViewMode('table')} />
                </div>
                <p className="text-xs text-slate-500">
                  Table mode is for quick scanning; cards are for browsing.
                </p>
              </div>

              {viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {sortedPlayers.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      onSimilar={(candidate) => navigate(`/similar/${candidate.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <ScoutingTable players={sortedPlayers} />
              )}

              {canLoadMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((current) => Math.min(current + LIMIT_STEP, MAX_LIMIT))}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
                  >
                    Load more ranked players
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  )
}

function ViewModeButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
        active
          ? 'bg-slate-950 text-white'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

function ScoutingTable({ players }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_22px_70px_-50px_rgba(15,23,42,0.55)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <Th>Player</Th>
              <Th>Club</Th>
              <Th>Pos</Th>
              <Th>Age</Th>
              <Th>Starts</Th>
              <Th>Minutes</Th>
              <Th>G+A</Th>
              <Th>Rating</Th>
              <Th>Traits</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {players.map((player) => {
              const strengths = summarizeRoleStrengths(player)
              return (
                <tr key={player.id} className="transition hover:bg-sky-50/45">
                  <td className="px-4 py-3">
                    <Link to={`/player/${player.id}`} className="group flex items-center gap-3">
                      <PlayerAvatar player={player} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950 group-hover:text-sky-700">{player.name}</p>
                        <p className="truncate text-xs text-slate-500">{player.league} · {player.season}</p>
                      </div>
                    </Link>
                  </td>
                  <Td>{player.club}</Td>
                  <Td><Badge>{player.position}</Badge></Td>
                  <Td>{player.age || '—'}</Td>
                  <Td>{player.stats?.starts ?? player.stats?.appearances ?? 0}</Td>
                  <Td>{formatMinutes(player.stats?.minutesPlayed ?? 0)}</Td>
                  <Td>{player.stats?.goalContributions ?? ((player.stats?.goals ?? 0) + (player.stats?.assists ?? 0))}</Td>
                  <Td>{player.stats?.rating ? Number(player.stats.rating).toFixed(1) : '—'}</Td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[210px] flex-wrap gap-1.5">
                      {strengths.map(({ key, score }) => (
                        <span key={key} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                          {traitLabel(key)} {score}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <IconAction to={`/player/${player.id}`} icon={UserRound} label="View profile" />
                      <IconAction to="/compare" icon={GitCompare} label="Compare" />
                      <IconAction to={`/similar/${player.id}`} icon={Search} label="Similar players" />
                      <ShortlistButton player={player} compact />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 font-bold">{children}</th>
}

function Td({ children }) {
  return <td className="max-w-[180px] truncate px-4 py-3 text-sm font-medium text-slate-600">{children}</td>
}

function Badge({ children }) {
  return <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{children}</span>
}

function IconAction({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
    >
      <Icon size={15} />
    </Link>
  )
}

function traitLabel(key) {
  return {
    finishing: 'Finisher',
    creation: 'Creator',
    ballProgression: 'Carrier',
    defending: 'Press',
  }[key] ?? key
}

function formatMinutes(value = 0) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
}

function FilterTabs({ label, value, options, onChange }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              value === option.id
                ? 'bg-slate-950 text-white shadow-lg shadow-slate-200'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RangeControl({ label, min, max, step = 1, value, onChange, suffix = '' }) {
  return (
    <label className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
        <span className="text-xs font-black text-slate-900">{value}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-slate-950"
      />
    </label>
  )
}
