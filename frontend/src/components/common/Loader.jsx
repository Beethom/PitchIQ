export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
      <p className="text-sm font-medium text-slate-500">{text}</p>
    </div>
  )
}
