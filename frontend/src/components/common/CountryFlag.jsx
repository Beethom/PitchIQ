/**
 * Renders a country flag from the local media cache using the ISO 3166-1 alpha-2 code
 * (or subdivision code like "gb-eng" for England).
 * Falls back to a neutral globe icon on error.
 */
export default function CountryFlag({ code, nationality, size = 'sm' }) {
  const sizes = {
    xs: 'w-4 h-3',
    sm: 'w-6 h-4',
    md: 'w-8 h-6',
    lg: 'w-10 h-7',
  }

  if (!code) {
    return (
      <span className={`${sizes[size]} rounded-sm bg-slate-200 inline-block`} title={nationality} />
    )
  }

  return (
    <img
      src={`/api/media/flag/${code}.png`}
      alt={nationality ?? code}
      title={nationality}
      loading="lazy"
      decoding="async"
      className={`${sizes[size]} object-cover rounded-sm shadow-sm inline-block`}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}
