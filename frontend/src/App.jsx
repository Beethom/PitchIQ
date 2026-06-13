import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import Footer from './components/layout/Footer'
import Loader from './components/common/Loader'
import { LanguageProvider } from './i18n/LanguageProvider'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const WorldCupMode = lazy(() => import('./pages/WorldCupMode'))
const WorldCupMatches = lazy(() => import('./pages/WorldCupMatches'))
const WorldCupMatchDetail = lazy(() => import('./pages/WorldCupMatchDetail'))
const ScoutingBoard = lazy(() => import('./pages/ScoutingBoard'))
const ComparePlayers = lazy(() => import('./pages/ComparePlayers'))
const PlayerDetails = lazy(() => import('./pages/PlayerDetails'))
const DataControl = lazy(() => import('./pages/DataControl'))
const SimilarPlayers = lazy(() => import('./pages/SimilarPlayers'))
const Shortlists = lazy(() => import('./pages/Shortlists'))
const StaticPage = lazy(() => import('./pages/StaticPages'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="flex flex-1">
            <Sidebar />
            <Suspense fallback={<Loader text="Loading page..." />}>
              <Routes>
                <Route path="/"           element={<Dashboard />} />
                <Route path="/world-cup"  element={<WorldCupMode />} />
                <Route path="/world-cup/matches" element={<WorldCupMatches />} />
                <Route path="/world-cup/matches/:fixtureId" element={<WorldCupMatchDetail />} />
                <Route path="/scouting-board" element={<ScoutingBoard />} />
                <Route path="/compare"    element={<ComparePlayers />} />
                <Route path="/similar/:id" element={<SimilarPlayers />} />
                <Route path="/shortlists" element={<Shortlists />} />
                <Route path="/admin-pitchiq" element={<DataControl />} />
                <Route path="/player/:id" element={<PlayerDetails />} />
                <Route path="/about" element={<StaticPage page="about" />} />
                <Route path="/how-it-works" element={<StaticPage page="how" />} />
                <Route path="/faq" element={<StaticPage page="faq" />} />
                <Route path="/request-demo" element={<StaticPage page="requestDemo" />} />
                <Route path="/coverage" element={<StaticPage page="coverage" />} />
                <Route path="/methodology" element={<StaticPage page="methodology" />} />
                <Route path="/updates" element={<StaticPage page="updates" />} />
                <Route path="/contact" element={<StaticPage page="contact" />} />
                <Route path="/privacy" element={<StaticPage page="privacy" />} />
                <Route path="/terms" element={<StaticPage page="terms" />} />
                <Route path="*"           element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </LanguageProvider>
  )
}
