export default function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
      <div>
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
