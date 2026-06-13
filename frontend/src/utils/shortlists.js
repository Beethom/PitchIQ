export const SHORTLISTS = [
  'Watchlist',
  'Compare Later',
  'Transfer Targets',
  'MLS',
  'Wonderkids',
]

const STORAGE_KEY = 'pitchiq:shortlists:v1'

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return Object.fromEntries(SHORTLISTS.map((list) => [list, parsed[list] || []]))
  } catch {
    return Object.fromEntries(SHORTLISTS.map((list) => [list, []]))
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent('pitchiq:shortlists-updated'))
}

export function getShortlists() {
  return readStore()
}

export function savePlayerToShortlist(list, player) {
  const store = readStore()
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
  }
  const existing = store[list] || []
  store[list] = [item, ...existing.filter((saved) => saved.id !== player.id)].slice(0, 100)
  writeStore(store)
}

export function removePlayerFromShortlist(list, playerId) {
  const store = readStore()
  store[list] = (store[list] || []).filter((saved) => saved.id !== playerId)
  writeStore(store)
}

export function clearShortlist(list) {
  const store = readStore()
  store[list] = []
  writeStore(store)
}
