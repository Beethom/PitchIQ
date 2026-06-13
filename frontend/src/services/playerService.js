import api from './api'

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_VERSION = 'v15'
const memoryCache = new Map()

function cacheKey(name, params) {
  return `${CACHE_VERSION}:${name}:${JSON.stringify(params ?? {})}`
}

function readCache(key, ttlMs = CACHE_TTL_MS) {
  const cached = memoryCache.get(key)
  if (cached && Date.now() - cached.createdAt < ttlMs) return cached.data

  try {
    const raw = sessionStorage.getItem(`pitchiq:${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.createdAt >= ttlMs) return null
    memoryCache.set(key, parsed)
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(key, data) {
  const payload = { createdAt: Date.now(), data }
  memoryCache.set(key, payload)
  try {
    sessionStorage.setItem(`pitchiq:${key}`, JSON.stringify(payload))
  } catch {
    // Browsers can evict or reject storage; memory cache still helps this tab.
  }
}

function clearCachePrefix(prefix) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }

  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(`pitchiq:${prefix}`)) sessionStorage.removeItem(key)
    }
  } catch {
    // Ignore storage access issues; fresh network requests will still update memory cache.
  }
}

async function cachedGet(name, url, params, options = {}) {
  const key = cacheKey(name, params)
  const cached = options.force ? null : readCache(key, options.ttlMs)
  if (cached) return cached
  const { data } = await api.get(url, { params })
  writeCache(key, data)
  return data
}

export const playerService = {
  async getAll(filters = {}) {
    return cachedGet('players', '/players/', filters)
  },

  async getById(id) {
    const { data } = await api.get(`/players/${id}`)
    return data
  },

  async syncForm(id) {
    const { data } = await api.post(`/players/${id}/sync-form`)
    clearCachePrefix(`${CACHE_VERSION}:player:`)
    clearCachePrefix(`${CACHE_VERSION}:players:`)
    return data
  },

  async syncDefensive(id, maxMatches = 10) {
    const { data } = await api.post(`/players/${id}/sync-defensive`, null, {
      params: { max_matches: maxMatches },
      timeout: 20000,
    })
    clearCachePrefix(`${CACHE_VERSION}:player:`)
    clearCachePrefix(`${CACHE_VERSION}:players:`)
    return data
  },

  async search(query, options = {}) {
    const { data } = await api.get('/players/search', {
      params: { q: query, limit: 20 },
      signal: options.signal,
      timeout: 20000,
    })
    return data
  },

  async getWorldCupMatches(limit = 12) {
    return cachedGet('worldCupMatches', '/players/world-cup/matches', { limit }, {
      ttlMs: 5 * 60 * 1000,
    })
  },

  async getWorldCupFixtures(limit = 24, options = {}) {
    return cachedGet('worldCupFixtures', '/players/world-cup/fixtures', { limit }, {
      ttlMs: 60 * 1000,
      force: options.force,
    })
  },

  async getWorldCupMatchDetail(fixtureId, options = {}) {
    return cachedGet('worldCupMatchDetail', `/players/world-cup/matches/${fixtureId}`, { fixtureId }, {
      ttlMs: options.ttlMs ?? 5 * 60 * 1000,
      force: options.force,
    })
  },
}
