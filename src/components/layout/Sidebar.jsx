import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  Heart, LayoutDashboard, Users, ClipboardList,
  Map, Calendar, Receipt, LogOut, Settings, Menu, X, Bell
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板', end: true },
  { to: '/patients', icon: Users, label: '個案管理' },
  { to: '/visits', icon: ClipboardList, label: '訪視紀錄' },
  { to: '/map', icon: Map, label: '訪視地圖' },
  { to: '/schedule', icon: Calendar, label: '訪視排程' },
  { to: '/receipts', icon: Receipt, label: '收據管理' },
]

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <Heart size={20} className="text-white" fill="white" />
        </div>
        <div className="min-w-0">
          <div className="text-white font-bold text-sm leading-tight">居護所個案管理</div>
          <div className="text-primary-300 text-xs">Home Nursing System</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-primary-200 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-white' : 'text-primary-300 group-hover:text-white'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-1">
        <NavLink
          to="/settings"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive ? 'bg-white/15 text-white' : 'text-primary-200 hover:bg-white/8 hover:text-white'
            }`
          }
        >
          <Settings size={18} />
          系統設定
        </NavLink>

        {/* Profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/8 mt-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
            {profile?.full_name?.[0] || profile?.email?.[0]?.toUpperCase() || 'N'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">{profile?.full_name || '護理師'}</div>
            <div className="text-primary-300 text-xs truncate">{profile?.email || ''}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex-shrink-0 text-primary-300 hover:text-white transition-colors"
            title="登出"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[var(--sidebar-width)] bg-gradient-to-b from-primary-900 to-primary-800 fixed top-0 left-0 h-full z-30 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full bg-gradient-to-b from-primary-900 to-primary-800 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-primary-300 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}

export function TopBar({ setMobileOpen }) {
  return (
    <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
      <button
        onClick={() => setMobileOpen(true)}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
      >
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <Heart size={20} className="text-primary-600" fill="currentColor" />
        <span className="font-bold text-gray-900 text-sm">居護所個案管理</span>
      </div>
      <div className="ml-auto">
        <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
