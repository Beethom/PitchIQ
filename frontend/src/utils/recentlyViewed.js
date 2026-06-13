const STORAGE_KEY = 'pitchiq:recently-viewed:v1'
const MAX_RECENT = 8

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeRecent(players) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players))
  window.dispatchEvent(new CustomEvent('pitchiq:recently-viewed-updated'))
}

export function getRecentlyViewed() {
  return readRecent()
}

export function trackRecentlyViewed(player) {
  if (!player?.id) return
  const item = {
    id: player.id,
    name: player.name,
    club: player.club,
    league: player.league,
    season: player.season,
    position: player.position,
    age: player.age,
    nationality: player.nationality,
    flag_code: player.flag_code,
    primary_league: player.primary_league,
    stats: player.stats,
    scores: player.scores,
    viewedAt: new Date().toISOString(),
  }
  const existing = readRecent()
  writeRecent([item, ...existing.filter((saved) => saved.id !== player.id)].slice(0, MAX_RECENT))
}
