const SOFASCORE_IMAGE_RE = /^https:\/\/img\.sofascore\.com\/api\/v1\/(player|team)\/(\d+)\/image/
const LOCAL_MEDIA_RE = /^\/api\/media\/(player|team)\/(\d+)\/image/
const MEDIA_CACHE_VERSION = 'v2'

function versionedLocalUrl(kind, id) {
  return `/api/media/${kind}/${id}/image?${MEDIA_CACHE_VERSION}`
}

export function localMediaUrl(url) {
  if (!url) return ''
  const match = String(url).match(SOFASCORE_IMAGE_RE)
  if (!match) {
    const localMatch = String(url).match(LOCAL_MEDIA_RE)
    if (!localMatch) return url
    const [, kind, id] = localMatch
    return versionedLocalUrl(kind, id)
  }
  const [, kind, id] = match
  return versionedLocalUrl(kind, id)
}

export function directSofaScoreImageUrl(url) {
  if (!url) return ''
  const raw = String(url)
  const directMatch = raw.match(SOFASCORE_IMAGE_RE)
  if (directMatch) return raw

  const localMatch = raw.match(LOCAL_MEDIA_RE)
  if (!localMatch) return ''

  const [, kind, id] = localMatch
  return `https://img.sofascore.com/api/v1/${kind}/${id}/image`
}
