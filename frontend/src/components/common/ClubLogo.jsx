import { useState } from 'react'
import { directSofaScoreImageUrl, localMediaUrl } from '../../utils/mediaUrl'

/**
 * Renders a club crest from the local media cache.
 * Falls back to a styled text badge showing the club's initials on error.
 */
function getInitials(clubName) {
  return clubName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

export default function ClubLogo({ url, club, size = 'sm', sourceTeamId = null }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [useDirectImage, setUseDirectImage] = useState(false)
  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-sm',
    xl: 'w-20 h-20 text-base',
  }

  const fallback = (
    <div
      className={`${sizes[size]} rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-500`}
      title={club}
    >
      {getInitials(club ?? '')}
    </div>
  )

  const sourceLogoUrl = url || (sourceTeamId ? `/api/media/team/${sourceTeamId}/image` : '')
  const localLogoUrl = localMediaUrl(sourceLogoUrl)
  const directLogoUrl = directSofaScoreImageUrl(sourceLogoUrl)
  const logoUrl = useDirectImage && directLogoUrl ? directLogoUrl : localLogoUrl

  if (!logoUrl || imgFailed) return fallback

  return (
    <img
      src={logoUrl}
      alt={club}
      title={club}
      loading="lazy"
      decoding="async"
      className={`${sizes[size]} object-contain`}
      onError={() => {
        if (!useDirectImage && directLogoUrl) {
          setUseDirectImage(true)
          return
        }
        setImgFailed(true)
      }}
    />
  )
}
