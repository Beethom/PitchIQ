import { useState } from 'react'
import { BookmarkPlus, Check } from 'lucide-react'
import { SHORTLISTS, savePlayerToShortlist } from '../../utils/shortlists'

export default function ShortlistButton({ player, compact = false }) {
  const [open, setOpen] = useState(false)
  const [savedTo, setSavedTo] = useState('')

  function save(list) {
    savePlayerToShortlist(list, player)
    setSavedTo(list)
    setOpen(false)
    window.setTimeout(() => setSavedTo(''), 1800)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 ${
          compact ? 'w-full' : ''
        }`}
      >
        {savedTo ? <Check size={13} /> : <BookmarkPlus size={13} />}
        {savedTo || 'Save'}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {SHORTLISTS.map((list) => (
            <button
              key={list}
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                save(list)
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            >
              {list}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
