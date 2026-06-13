import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-4 px-6 py-14">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <div className="text-center">
        <p className="font-bold text-slate-950">Something went wrong</p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      )}
    </div>
  )
}
