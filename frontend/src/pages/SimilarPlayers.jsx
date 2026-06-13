import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerCard from '../components/player/PlayerCard'
import ShortlistButton from '../components/player/ShortlistButton'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import { usePlayer, usePlayers } from '../hooks/usePlayers'
import { toPer90 } from '../utils/per90'

function playerGroup(player) {
  const league = player?.primary_league || player?.league || ''
  if (league === 'MLS') return 'mls'
  if (league.includes('UEFA')) return 'europe'
  if (league.includes('World Cup') || league.includes('Nations') || league.includes('Gold Cup') || league.includes('Copa América')) return 'national'
  return 'leagues'
}

function leagueLevel(player) {
  const league = player?.primary_league || player?.league || ''
  if (league.includes('Premier League') || league.includes('La Liga')) return 5
  if (league.includes('Bundesliga') || league.includes('Serie A') || league.includes('Ligue 1') || league.includes('Champions League')) return 4
  if (league.includes('Europa League') || league.includes('Conference League')) return 3
  if (league === 'MLS') return 2
  return 3
}

function positionFamily(position) {
  if (position === 'GK') return 'GK'
  if (['CB', 'LB', 'RB'].includes(position)) return 'Defenders'
  if (['CDM', 'CM', 'CAM'].includes(position)) return 'Midfielders'
  return 'Attackers'
}

function whyMatched(target, candidate) {
  const labels = []
  const targetFamily = positionFamily(target.position)
  const candidateFamily = positionFamily(candidate.position)
  const ageGap = Math.abs((target.age ?? 0) - (candidate.age ?? 0))
  const creatorGap = Math.abs(roleScore(target, 'creation') - roleScore(candidate, 'creation'))
  const progressionGap = Math.abs(roleScore(target, 'ballProgression') - roleScore(candidate, 'ballProgression'))

  if (target.position === candidate.position || targetFamily === candidateFamily) labels.push('Same role')
  if (ageGap <= 2) labels.push('Similar age')
  if (creatorGap <= 12 || progressionGap <= 12 || Math.abs(statPer90(target, 'keyPasses') - statPer90(candidate, 'keyPasses')) <= 0.35) {
    labels.push('Similar creator profile')
  }
  const isDefender = ['CB', 'LB', 'RB'].includes(target.position)
  const defGap = Math.abs(roleScore(target, 'defending') - roleScore(candidate, 'defending'))
  if ((isDefender || ['CDM', 'CM'].includes(target.position)) && defGap <= 15) {
    labels.push('Similar defensive profile')
  }
  if ((candidate.age ?? 99) < (target.age ?? 0) && (candidate.stats?.minutesPlayed ?? 0) >= 900) labels.push('Higher ceiling')
  if (leagueLevel(candidate) < leagueLevel(target)) labels.push('Cheaper league jump')

  if (!labels.length) labels.push('Comparable role profile')
  return labels.slice(0, 4)
}

function statPer90(player, key) {
  return toPer90(player.stats?.[key] ?? 0, player.stats?.minutesPlayed) ?? 0
}

function roleScore(player, key) {
  return player.rawScores?.[key] ?? player.scores?.[key] ?? 0
}

function similarityScore(target, candidate) {
  const samePosition = target.position === candidate.position ? 22 : 0
  const sameFamily = positionFamily(target.position) === positionFamily(candidate.position) ? 14 : 0
  const ageScore = Math.max(0, 14 - Math.abs((target.age ?? 0) - (candidate.age ?? 0)) * 2)
  const minutesScore = Math.min(12, ((candidate.stats?.minutesPlayed ?? 0) / Math.max(target.stats?.minutesPlayed ?? 900, 900)) * 12)

  const outputDistance =
    Math.abs(statPer90(target, 'goals') - statPer90(candidate, 'goals')) * 10
    + Math.abs(statPer90(target, 'assists') - statPer90(candidate, 'assists')) * 10
    + Math.abs(statPer90(target, 'keyPasses') - statPer90(candidate, 'keyPasses')) * 2
    + Math.abs(statPer90(target, 'dribbles') - statPer90(candidate, 'dribbles')) * 2

  const isDefender = ['CB', 'LB', 'RB'].includes(target.position)
  const isMid = ['CDM', 'CM'].includes(target.position)
  const defDistance = (isDefender || isMid)
    ? Math.abs(roleScore(target, 'defending') - roleScore(candidate, 'defending')) * 1.5
    : 0

  const roleDistance =
    Math.abs(roleScore(target, 'finishing') - roleScore(candidate, 'finishing'))
    + Math.abs(roleScore(target, 'creation') - roleScore(candidate, 'creation'))
    + Math.abs(roleScore(target, 'ballProgression') - roleScore(candidate, 'ballProgression'))
    + Math.abs(roleScore(target, 'defending') - roleScore(candidate, 'defending'))
    + defDistance

  const outputScore = Math.max(0, 24 - outputDistance)
  const roleScore = Math.max(0, 24 - roleDistance / 8)

  return Math.round(Math.min(100, samePosition + sameFamily + ageScore + minutesScore + outputScore + roleScore))
}

export default function SimilarPlayers() {
  const { id } = useParams()
  const { player, loading: targetLoading, error: targetError } = usePlayer(id)
  const [ageBand, setAgeBand] = useState(4)
  const [minMinutes, setMinMinutes] = useState(450)

  const filters = player ? { group: playerGroup(player), season: player.season, limit: 2000 } : { limit: 1 }
  const { players, loading, error } = usePlayers(filters)

  const similar = useMemo(() => {
    if (!player) return []
    return players
      .filter((candidate) =>
        candidate.id !== player.id
        && positionFamily(candidate.position) === positionFamily(player.position)
        && Math.abs((candidate.age ?? 0) - (player.age ?? 0)) <= ageBand
        && (candidate.stats?.minutesPlayed ?? 0) >= minMinutes,
      )
      .map((candidate) => ({
        player: candidate,
        score: similarityScore(player, candidate),
        reasons: whyMatched(player, candidate),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
  }, [players, player, ageBand, minMinutes])

  if (targetLoading) return <PageContainer><Loader /></PageContainer>
  if (targetError) return <PageContainer><ErrorMessage message={targetError} /></PageContainer>
  if (!player) return null

  return (
    <div className="flex-1 min-w-0">
      <div className="bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft size={15} /> Back to Dashboard
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Similar Players</p>
              <h1 className="mt-2 text-3xl font-black">{player.name}</h1>
              <p className="mt-2 text-sm text-white/60">
                {player.position} · {player.club} · Age {player.age} · {player.season}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShortlistButton player={player} />
              <Link to={`/player/${player.id}`} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">
                View Profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                  <Search size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">Similarity Model</h2>
                  <p className="text-sm text-slate-500">Role, age, minutes, output per90, and profile scores.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Age band
                  <input type="range" min="1" max="10" value={ageBand} onChange={(event) => setAgeBand(Number(event.target.value))} className="mt-2 block w-full" />
                  <span className="mt-1 block normal-case tracking-normal text-slate-600">+/- {ageBand} years</span>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Minimum minutes
                  <input type="range" min="0" max="1800" step="150" value={minMinutes} onChange={(event) => setMinMinutes(Number(event.target.value))} className="mt-2 block w-full" />
                  <span className="mt-1 block normal-case tracking-normal text-slate-600">{minMinutes} min</span>
                </label>
              </div>
            </div>
          </div>

          {loading && <Loader text="Finding similar players..." />}
          {error && <ErrorMessage message={error} />}

          {!loading && !error && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {similar.map(({ player: candidate, score, reasons }) => (
                <div key={candidate.id}>
                  <div className="mb-2 flex min-h-7 flex-wrap items-center gap-1.5">
                    {reasons.map((reason) => (
                      <span key={reason} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <div className="absolute right-3 top-3 z-10 rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white shadow-lg">
                      {score}% match
                    </div>
                    <PlayerCard player={candidate} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
