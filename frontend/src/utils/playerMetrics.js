import { toPer90 } from './per90'
import { benchmarkRole } from './positionRoles'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function percent(part, total) {
  if (!total) return null
  return (part / total) * 100
}

function estimateAttemptedDribbles(stats) {
  const successful = stats.dribbles ?? 0
  const recordedAttempts = stats.dribblesAttempted ?? stats.totalDribbles ?? stats._totalDribbles
  if (recordedAttempts != null && recordedAttempts > 0) {
    return Math.max(recordedAttempts, successful)
  }
  if (stats.dribbleSuccess && stats.dribbles != null) {
    const attempts = stats.dribbles / (stats.dribbleSuccess / 100)
    return Number.isFinite(attempts) ? Math.max(Math.round(attempts), successful) : successful
  }
  return successful
}

function estimatePossessionLost(stats, attemptedDribbles) {
  if (stats.possessionLost != null) return stats.possessionLost
  const failedDribbles = Math.max(0, attemptedDribbles - (stats.dribbles ?? 0))
  return (stats.dispossessed ?? 0) + (stats.miscontrols ?? 0) + failedDribbles
}

function aggregateCompetitionStats(player) {
  const competitions = player?.competitions ?? []
  if (competitions.length < 2) return player?.stats ?? {}

  const sumKeys = [
    'appearances',
    'starts',
    'minutesPlayed',
    'goals',
    'assists',
    'shots',
    'shotsOnTarget',
    'keyPasses',
    'totalPasses',
    'touches',
    'accurateCrosses',
    'crosses',
    'finalThirdPasses',
    'throughPasses',
    'dribbles',
    'possessionLost',
    'dispossessed',
    'miscontrols',
    'recoveries',
    'tackles',
    'successfulTackles',
    'fouls',
    'interceptions',
    'aerialDuelsWon',
    'yellowCards',
    'redCards',
    '_accuratePasses',
    'xG',
    'xA',
    // Attacking / creation
    'bigChancesCreated',
    'bigChancesMissed',
    'missedChances',
    // Defensive / outfield
    'clearances',
    // Goalkeeper
    'saves',
    'goalsConceded',
    'totalShotsFaced',
    'punches',
    'runOuts',
    'highClaims',
  ]

  const totals = { ...(player.stats ?? {}) }
  sumKeys.forEach((key) => {
    totals[key] = competitions.reduce((sum, competition) => (
      sum + ((competition.stats ?? {})[key] ?? 0)
    ), 0)
  })

  totals._totalDribbles = competitions.reduce((sum, competition) => (
    sum + estimateAttemptedDribbles(competition.stats ?? {})
  ), 0)

  if (totals.totalPasses) {
    totals.passAccuracy = round1(((totals._accuratePasses ?? 0) / totals.totalPasses) * 100)
  }
  if (totals._totalDribbles) {
    totals.dribbleSuccess = round1(((totals.dribbles ?? 0) / totals._totalDribbles) * 100)
  }
  if (totals.crosses) {
    totals.crossAccuracy = round1(((totals.accurateCrosses ?? 0) / totals.crosses) * 100)
  }

  totals.xG = round2(totals.xG ?? 0)
  totals.xA = round2(totals.xA ?? 0)
  totals.goalContributions = (totals.goals ?? 0) + (totals.assists ?? 0)

  // avgTeamPossession: weighted average across competitions by minutesPlayed
  const possComps = competitions.filter((c) => (c.stats ?? {}).avgTeamPossession != null)
  if (possComps.length) {
    const totalMins = possComps.reduce((s, c) => s + ((c.stats ?? {}).minutesPlayed ?? 0), 0)
    totals.avgTeamPossession = totalMins
      ? round1(possComps.reduce((s, c) => s + ((c.stats ?? {}).avgTeamPossession ?? 0) * ((c.stats ?? {}).minutesPlayed ?? 0), 0) / totalMins)
      : null
  }

  return totals
}

function estimateProgressivePasses(stats, position) {
  if (stats.progressivePasses != null) return stats.progressivePasses

  const attempts = stats.totalPasses ?? 0
  const keyPasses = stats.keyPasses ?? 0
  const accuracy = stats.passAccuracy ?? 0
  const baseRate = position === 'CB' || position === 'LB' || position === 'RB'
    ? 0.06
    : position === 'CDM' || position === 'CM' || position === 'CAM'
      ? 0.08
      : 0.04

  if (!attempts) return null
  return Math.round((attempts * baseRate) + (keyPasses * 1.4) + (accuracy >= 85 ? 3 : 0))
}

function estimateBackPasses(stats, position) {
  if (stats.backPasses != null) return stats.backPasses

  const attempts = stats.totalPasses ?? 0
  if (!attempts) return null

  const ratio = position === 'CB' || position === 'LB' || position === 'RB'
    ? 0.22
    : position === 'CDM' || position === 'CM'
      ? 0.16
      : 0.09

  return Math.round(attempts * ratio)
}

function estimateBigChancesCreated(stats, chancesCreated) {
  const exact = stats.bigChancesCreated ?? 0
  const estimate = stats.xA != null
    ? Math.max(0, Math.round(stats.xA * 0.75))
    : Math.round(chancesCreated * 0.2)
  return Math.max(exact, estimate)
}

// Position-specific elite ceilings (per90) — derived from real PL/top-league data
const DEFENSIVE_CEILINGS = {
  CB:  { tackles: 2.5, interceptions: 2.0, aerials: 5.5, recoveries: 8.0, clearances: 9.0, fouls: 1.8 },
  LB:  { tackles: 2.8, interceptions: 2.2, aerials: 3.0, recoveries: 7.0, clearances: 5.0, fouls: 1.8 },
  RB:  { tackles: 2.8, interceptions: 2.2, aerials: 3.0, recoveries: 7.0, clearances: 5.0, fouls: 1.8 },
  CDM: { tackles: 4.0, interceptions: 3.0, aerials: 3.5, recoveries: 8.0, clearances: 3.0, fouls: 2.0 },
  CM:  { tackles: 3.0, interceptions: 2.5, aerials: 2.5, recoveries: 7.0, clearances: 2.0, fouls: 1.8 },
  CAM: { tackles: 2.0, interceptions: 1.8, aerials: 1.5, recoveries: 5.0, clearances: 1.0, fouls: 1.5 },
  LW:  { tackles: 2.0, interceptions: 1.5, aerials: 1.5, recoveries: 5.0, clearances: 1.0, fouls: 1.5 },
  RW:  { tackles: 2.0, interceptions: 1.5, aerials: 1.5, recoveries: 5.0, clearances: 1.0, fouls: 1.5 },
  ST:  { tackles: 1.5, interceptions: 1.2, aerials: 3.5, recoveries: 4.0, clearances: 0.5, fouls: 2.0 },
  GK:  { tackles: 0.3, interceptions: 0.8, aerials: 2.0, recoveries: 2.0, clearances: 1.0, fouls: 0.3 },
}

function buildDefensiveWorkrate(stats, position) {
  const mins = stats.minutesPlayed ?? 0
  if (mins <= 0) return 0

  const p90 = (v) => ((v ?? 0) / mins) * 90
  const ceil = DEFENSIVE_CEILINGS[position] ?? DEFENSIVE_CEILINGS.CM
  const norm = (v, c) => Math.min(v / c, 1)

  // Weighted components — clearances and recoveries only count if we have them
  // (they come from lineup sync; fallback gracefully to 0 if missing)
  const hasClearances = (stats.clearances ?? 0) > 0
  const hasRecoveries = (stats.recoveries ?? 0) > 0

  const tackleW       = 22
  const interceptW    = 22
  const aerialW       = 18
  const recoveryW     = hasRecoveries ? 18 : 0
  const clearanceW    = hasClearances ? 15 : 0
  const foulPenaltyW  = 5
  const total = tackleW + interceptW + aerialW + recoveryW + clearanceW + foulPenaltyW

  const score = (
    norm(p90(stats.tackles),       ceil.tackles)       * tackleW +
    norm(p90(stats.interceptions), ceil.interceptions)  * interceptW +
    norm(p90(stats.aerialDuelsWon),ceil.aerials)        * aerialW +
    norm(p90(stats.recoveries),    ceil.recoveries)     * recoveryW +
    norm(p90(stats.clearances),    ceil.clearances)     * clearanceW +
    (1 - norm(p90(stats.fouls),    ceil.fouls))         * foulPenaltyW
  ) / total * 100

  return clamp(Math.round(score), 0, 100)
}

// Defensive Contribution — weighted seasonal volume, 0-100 scale
// Elite ceiling ~1200 pts for a CB playing a full season
const CONTRIBUTION_ELITE_CEILING = 1200

function buildDefensiveContribution(stats) {
  const successfulTackles = stats.successfulTackles ?? Math.round((stats.tackles ?? 0) * 0.65)
  const raw = (
    successfulTackles          * 4   +
    (stats.interceptions ?? 0) * 4   +
    (stats.clearances    ?? 0) * 3   +
    (stats.aerialDuelsWon?? 0) * 2   +
    (stats.recoveries    ?? 0) * 1.5 -
    (stats.fouls         ?? 0) * 1
  )
  return clamp(Math.round((Math.max(0, raw) / CONTRIBUTION_ELITE_CEILING) * 100), 0, 100)
}

const ROLE_SCORE_KEYS = ['finishing', 'creation', 'ballProgression', 'defending']

function positionFamily(position) {
  if (position === 'GK') return 'GK'
  if (['CB', 'LB', 'RB'].includes(position)) return 'Defenders'
  if (['CDM', 'CM', 'CAM'].includes(position)) return 'Midfielders'
  return 'Attackers'
}

function roleScoreValue(player, key) {
  return player?.rawScores?.[key] ?? player?.scores?.[key] ?? 0
}

function modelDisplayScore(rawScore) {
  const value = Math.max(0, Math.round(rawScore ?? 0))
  if (value <= 90) return value
  return clamp(Math.round(90 + (value - 90) * 0.16), 0, 99)
}

function modelDisplayScores(rawScores) {
  return Object.fromEntries(
    ROLE_SCORE_KEYS.map((key) => [key, modelDisplayScore(rawScores?.[key] ?? 0)]),
  )
}

function percentileForValue(value, values) {
  const clean = values.filter((item) => Number.isFinite(item))
  if (!Number.isFinite(value) || clean.length < 8) return null

  const max = Math.max(...clean)
  const maxCount = clean.filter((item) => item === max).length
  if (value === max && maxCount === 1) return 100

  const below = clean.filter((item) => item < value).length
  const equal = clean.filter((item) => item === value).length
  const percentile = Math.round(((below + equal / 2) / clean.length) * 100)
  return clamp(percentile, 1, 99)
}

function buildRoleScores(stats, position) {
  if (position === 'GK') {
    const savesPct = stats.totalShotsFaced > 0
      ? (stats.saves ?? 0) / stats.totalShotsFaced * 100
      : null
    const concededP90 = toPer90(stats.goalsConceded ?? 0, stats.minutesPlayed) ?? 0
    const savesP90 = toPer90(stats.saves ?? 0, stats.minutesPlayed) ?? 0

    // Finishing → Save % (elite = 75%, raw 0-100)
    const finishing = savesPct != null ? clamp(Math.round((savesPct / 75) * 100), 0, 100) : 0

    // Creation → Distribution (pass accuracy, progressive passes)
    const creation = Math.max(0, Math.round(
      (stats.passAccuracy ?? 0) * 0.8 +
      (stats.progressivePasses ?? 0) * 0.3
    ))

    // Ball Progression → Shot stopping volume (saves per90, elite = 5)
    const ballProgression = clamp(Math.round((savesP90 / 5) * 100), 0, 100)

    // Defending → conceded rate (lower is better, 0 conceded p90 = 100)
    const defending = clamp(Math.round(Math.max(0, 1 - concededP90 / 2.5) * 100), 0, 100)

    return { finishing, creation, ballProgression, defending }
  }

  const goalsP90 = toPer90(stats.goals ?? 0, stats.minutesPlayed) ?? 0
  const assistsP90 = toPer90(stats.assists ?? 0, stats.minutesPlayed) ?? 0
  const chancesP90 = toPer90(stats.chancesCreated ?? 0, stats.minutesPlayed) ?? 0
  const dribblesP90 = toPer90(stats.dribbles ?? 0, stats.minutesPlayed) ?? 0
  const progressivePassesP90 = toPer90(stats.progressivePasses ?? 0, stats.minutesPlayed) ?? 0
  const possessionLostP90 = toPer90(stats.possessionLost ?? 0, stats.minutesPlayed) ?? 0
  const shotsOnTargetPct = percent(stats.shotsOnTarget ?? 0, stats.shots ?? 0) ?? 0

  const finishing = Math.max(0, Math.round(
    goalsP90 * 45 +
    (stats.shotConversion ?? 0) * 0.45 +
    shotsOnTargetPct * 0.2
  ))

  const creation = Math.max(0, Math.round(
    chancesP90 * 26 +
    (stats.bigChancesCreated ?? 0) * 6 +
    assistsP90 * 22 +
    (stats.passAccuracy ?? 0) * 0.15
  ))

  const ballProgression = Math.max(0, Math.round(
    progressivePassesP90 * 9 +
    dribblesP90 * 18 +
    (stats.passAccuracy ?? 0) * 0.18 -
    possessionLostP90 * 2.5
  ))

  // Defending = blend of work rate (how active per game) + contribution (volume this season)
  const workrate     = buildDefensiveWorkrate(stats, position)
  const contribution = buildDefensiveContribution(stats)
  const isAttacker = ['LW', 'RW', 'ST'].includes(position)
  const defending = isAttacker
    ? workrate  // for attackers: purely rate-based, no volume penalty
    : Math.round(workrate * 0.6 + contribution * 0.4)

  return {
    finishing,
    creation,
    ballProgression,
    defending,
  }
}

function buildDefensiveIntensity(stats) {
  const minutes = stats.minutesPlayed ?? 0
  if (minutes <= 0) return null
  const possession = stats.avgTeamPossession
  const outOfPossessionMins = possession != null
    ? minutes * (1 - possession / 100)
    : minutes  // fallback: treat all minutes as out-of-possession
  if (outOfPossessionMins <= 0) return null
  const actions = (stats.tackles ?? 0) + (stats.interceptions ?? 0) + (stats.fouls ?? 0)
  return round2((actions / outOfPossessionMins) * 90)
}

export function enrichStats(stats = {}, position = 'CM') {
  const goalContributions = (stats.goals ?? 0) + (stats.assists ?? 0)
  const dribblesAttempted = estimateAttemptedDribbles(stats)
  const chancesCreated = stats.chancesCreated ?? stats.keyPasses ?? 0
  const progressivePasses = estimateProgressivePasses(stats, position)
  const backPasses = estimateBackPasses(stats, position)
  const bigChancesCreated = estimateBigChancesCreated(stats, chancesCreated)
  const possessionLost = estimatePossessionLost(stats, dribblesAttempted)
  const shotConversion = percent(stats.goals ?? 0, stats.shots ?? 0)
  const crossAccuracy = stats.crossAccuracy ?? percent(stats.accurateCrosses ?? 0, stats.crosses ?? 0)
  const appearances = stats.appearances ?? 0
  const possessionLostPerMatch = appearances ? (stats.possessionLost ?? possessionLost) / appearances : null
  const touchesPerMatch = appearances ? (stats.touches ?? 0) / appearances : null
  const defensiveWorkrate = buildDefensiveWorkrate(
    { ...stats, possessionLost },
    position,
  )
  const defensiveContribution = buildDefensiveContribution({ ...stats, possessionLost })

  return {
    ...stats,
    goalContributions,
    chancesCreated,
    bigChancesCreated,
    throughPasses: (stats.throughPasses ?? 0) > 0 ? stats.throughPasses : null,
    dribblesAttempted,
    progressivePasses,
    backPasses,
    possessionLost,
    possessionLostPerMatch: possessionLostPerMatch == null ? null : round1(possessionLostPerMatch),
    touchesPerMatch: touchesPerMatch == null ? null : round1(touchesPerMatch),
    crossAccuracy: crossAccuracy == null ? null : round1(crossAccuracy),
    shotConversion: shotConversion == null ? null : round1(shotConversion),
    defensiveWorkrate,
    defensiveContribution,
    // Pass through new fields (already summed in aggregate; preserve whatever is in stats)
    bigChancesMissed:    (stats.bigChancesMissed ?? 0) > 0 ? stats.bigChancesMissed : null,
    missedChances:       (stats.missedChances ?? stats.bigChancesMissed ?? 0) > 0
      ? (stats.missedChances ?? stats.bigChancesMissed)
      : null,
    clearances:          stats.clearances           ?? null,
    saves:               stats.saves               ?? null,
    goalsConceded:       stats.goalsConceded        ?? null,
    totalShotsFaced:     stats.totalShotsFaced      ?? null,
    punches:             stats.punches              ?? null,
    runOuts:             stats.runOuts              ?? null,
    highClaims:          stats.highClaims           ?? null,
    avgTeamPossession:   stats.avgTeamPossession    ?? null,
    defensiveIntensity:  buildDefensiveIntensity(stats),
  }
}

export function enrichPlayer(player) {
  if (!player) return player
  const baseStats = player.selected_competition && player.selected_competition !== 'All Competitions'
    ? player.stats
    : aggregateCompetitionStats(player)
  const stats = enrichStats(baseStats, player.position)
  const rawScores = buildRoleScores(stats, player.position)

  return {
    ...player,
    stats,
    rawScores,
    scores: modelDisplayScores(rawScores),
    scoreBasis: 'model',
  }
}

export function enrichPlayers(players = []) {
  const enriched = players.map(enrichPlayer)
  return applyRoleScorePercentiles(enriched)
}

export function rolePercentilesForPlayer(player, peers = []) {
  if (!player?.rawScores) return player?.scores ?? {}
  const role = benchmarkRole(player.position)
  const peerPool = peers.filter((peer) => benchmarkRole(peer.position) === role && peer.rawScores)
  if (peerPool.length < 8) return player.scores ?? player.rawScores

  return Object.fromEntries(ROLE_SCORE_KEYS.map((key) => {
    const values = peerPool.map((peer) => roleScoreValue(peer, key))
    const percentile = percentileForValue(roleScoreValue(player, key), values)
    return [key, percentile ?? player.rawScores[key] ?? 0]
  }))
}

export function applyRoleScorePercentiles(players = []) {
  const groups = new Map()
  players.forEach((player) => {
    const role = benchmarkRole(player.position)
    groups.set(role, [...(groups.get(role) || []), player])
  })

  return players.map((player) => {
    const peers = groups.get(benchmarkRole(player.position)) || []
    const scores = rolePercentilesForPlayer(player, peers)
    return {
      ...player,
      scores,
      scoreBasis: peers.length >= 8 ? 'peer-percentile' : 'model',
    }
  })
}

export function formatScoreLabel(score) {
  if (score >= 85) return 'Elite'
  if (score >= 70) return 'Strong'
  if (score >= 55) return 'Good'
  if (score >= 40) return 'Average'
  return 'Raw'
}

export function summarizeRoleStrengths(player) {
  if (!player?.scores) return []

  return Object.entries(player.scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, score]) => ({
      key,
      score,
      label: formatScoreLabel(score),
    }))
}

export { buildRoleScores, buildDefensiveWorkrate, buildDefensiveContribution, round1, round2 }
