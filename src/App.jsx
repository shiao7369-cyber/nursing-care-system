import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/ui/Toast'
import Spinner from './components/ui/Spinner'
import Sidebar, { TopBar } from './components/layout/Sidebar'

// 懶加載所有頁面元件（只有訪問該路由時才下載對應 JS）
const Login        = lazy(() => import('./components/auth/Login'))
const Dashboard    = lazy(() => import('./components/dashboard/Dashboard'))
const PatientList  = lazy(() => import('./components/patients/PatientList'))
const PatientDetail= lazy(() => import('./components/patients/PatientDetail'))
const VisitList    = lazy(() => import('./components/visits/VisitList'))
const MapView      = lazy(() => import('./components/map/MapView'))
const Schedule     = lazy(() => import('./components/map/Schedule'))
const Receipts     = lazy(() => import('./components/map/Receipts'))
const SettingsPage = lazy(() => import('./components/map/Settings'))

// 通用 loading 畫面
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-400 text-sm">載入中...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <TopBar setMobileOpen={setMobileOpen} />

      <main className="lg:ml-[var(--sidebar-width)] min-h-screen">
        <div className="p-6 max-w-7xl">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/patients"   element={<PatientList />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/visits"     element={<VisitList />} />
              <Route path="/map"        element={<MapView />} />
              <Route path="/schedule"   element={<Schedule />} />
              <Route path="/receipts"   element={<Receipts />} />
              <Route path="/settings"   element={<SettingsPage />} />
              <Route path="*"           element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}

function AuthLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary-900" />}>
      <Login />
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<AuthLayout />} />
            <Route path="/*"     element={<ProtectedLayout />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
