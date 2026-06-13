import { SearchX } from 'lucide-react'

export default function EmptyState({ title = 'Nothing here', message, icon: Icon = SearchX }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Icon size={22} className="text-slate-400" />
      </div>
      <p className="font-medium text-slate-700">{title}</p>
      {message && <p className="text-sm text-slate-500 max-w-xs">{message}</p>}
    </div>
  )
}
