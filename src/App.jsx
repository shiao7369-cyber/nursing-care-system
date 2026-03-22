import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/ui/Toast'

import Login from './components/auth/Login'
import Sidebar, { TopBar } from './components/layout/Sidebar'
import Dashboard from './components/dashboard/Dashboard'
import PatientList from './components/patients/PatientList'
import PatientDetail from './components/patients/PatientDetail'
import VisitList from './components/visits/VisitList'
import MapView from './components/map/MapView'
import Schedule from './components/map/Schedule'
import Receipts from './components/map/Receipts'
import SettingsPage from './components/map/Settings'
import Spinner from './components/ui/Spinner'

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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<PatientList />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/visits" element={<VisitList />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<AuthLayout />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
