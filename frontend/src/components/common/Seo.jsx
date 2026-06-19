import { useEffect } from 'react'

const SITE = 'PitchVision'
const ORIGIN = 'https://www.pitchvision.app'

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Per-page SEO: sets <title>, description, canonical, OG/Twitter, and optional
 * JSON-LD structured data. Cleans up the JSON-LD on unmount.
 */
export default function Seo({ title, description, path, image, jsonLd }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} — Football Player Analytics & World Cup Stats`
    document.title = fullTitle

    const url = path ? `${ORIGIN}${path}` : ORIGIN
    const img = image || `${ORIGIN}/og-image.jpg`

    if (description) upsertMeta('name', 'description', description)
    upsertCanonical(url)
    upsertMeta('property', 'og:title', fullTitle)
    if (description) upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', img)
    upsertMeta('name', 'twitter:title', fullTitle)
    if (description) upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', img)

    let script = null
    if (jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-seo', 'jsonld')
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => {
      if (script) script.remove()
    }
  }, [title, description, path, image, jsonLd])

  return null
}
