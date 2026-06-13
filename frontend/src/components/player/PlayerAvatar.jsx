import { useState } from 'react'
import { POSITION_COLORS } from '../../utils/constants'
import { directSofaScoreImageUrl, localMediaUrl } from '../../utils/mediaUrl'

function getInitials(name) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function nameToHue(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

const sizeMap = {
  sm: { outer: 'w-8 h-8',   text: 'text-xs',  badge: 'text-[9px] px-1',   ring: 'ring-1' },
  md: { outer: 'w-12 h-12', text: 'text-sm',  badge: 'text-[10px] px-1.5', ring: 'ring-1' },
  lg: { outer: 'w-16 h-16', text: 'text-lg',  badge: 'text-[10px] px-1.5', ring: 'ring-1' },
  xl: { outer: 'w-20 h-20', text: 'text-xl',  badge: 'text-[11px] px-2',   ring: 'ring-1' },
}

export default function PlayerAvatar({ player, size = 'md' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const [useDirectImage, setUseDirectImage] = useState(false)
  const s   = sizeMap[size]
  const hue = nameToHue(player.name)
  const sourcePhotoUrl = player.photo_url || (player.source_player_id ? `/api/media/player/${player.source_player_id}/image` : '')
  const localPhotoUrl = localMediaUrl(sourcePhotoUrl)
  const directPhotoUrl = directSofaScoreImageUrl(sourcePhotoUrl)
  const photoUrl = useDirectImage && directPhotoUrl ? directPhotoUrl : localPhotoUrl

  const positionBadge = (
    <span
      className={`absolute -bottom-1 -right-1 badge shadow-sm ${s.badge} ${
        POSITION_COLORS[player.position] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {player.position}
    </span>
  )

  // Real photo
  if (photoUrl && !imgFailed) {
    return (
      <div className="relative inline-flex shrink-0">
        <div
          className={`${s.outer} overflow-hidden rounded-lg ${s.ring} bg-slate-100 shadow-sm ring-white`}
        >
          <img
            src={photoUrl}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-top"
            onError={() => {
              if (!useDirectImage && directPhotoUrl) {
                setUseDirectImage(true)
                return
              }
              setImgFailed(true)
            }}
          />
        </div>
        {positionBadge}
      </div>
    )
  }

  // Fallback — gradient initials
  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${s.outer} ${s.text} flex items-center justify-center rounded-lg font-black text-white shadow-sm`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue},65%,45%), hsl(${(hue + 40) % 360},65%,35%))`,
        }}
      >
        {getInitials(player.name)}
      </div>
      {positionBadge}
    </div>
  )
}
