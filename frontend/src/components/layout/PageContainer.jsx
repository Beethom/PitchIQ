export default function PageContainer({ children, title, subtitle }) {
  return (
    <main className="flex-1 min-w-0 px-4 py-7 sm:px-6 lg:px-8 lg:py-8">
      <div className="max-w-7xl mx-auto">
        {(title || subtitle) && (
          <div className="mb-6 border-b border-slate-200 pb-5">
            {title && <h1 className="text-2xl font-black tracking-tight text-slate-950">{title}</h1>}
            {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
