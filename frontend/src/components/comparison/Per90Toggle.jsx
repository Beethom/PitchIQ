export default function Per90Toggle({ enabled, onToggle }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium ${!enabled ? 'text-slate-900' : 'text-slate-400'}`}>
        Total
      </span>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-sm ${
          enabled ? 'bg-gradient-to-r from-sky-500 to-indigo-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm font-medium ${enabled ? 'text-slate-900' : 'text-slate-400'}`}>
        Per 90
      </span>
    </div>
  )
}
