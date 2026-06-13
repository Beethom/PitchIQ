import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <p className="text-8xl font-extrabold bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Page not found</h1>
        <p className="text-slate-500 mt-2 text-sm">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
      <Link to="/" className="btn-primary flex items-center gap-2">
        <Home size={16} /> Go to Dashboard
      </Link>
    </div>
  )
}
