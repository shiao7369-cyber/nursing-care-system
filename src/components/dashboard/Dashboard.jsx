import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  Users, ClipboardList, Calendar, TrendingUp,
  Heart, AlertTriangle, MapPin, Phone, ChevronRight,
  Activity, Clock, Map, Receipt
} from 'lucide-react'
import { format, startOfDay, endOfDay, isToday } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Spinner from '../ui/Spinner'

function StatCard({ icon: Icon, label, value, color, trend, onClick }) {
  return (
    <div
      className={`card cursor-pointer hover:shadow-md transition-all duration-200 group ${onClick ? 'hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {trend !== undefined && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <TrendingUp size={12} />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color === 'text-primary-600' ? 'bg-primary-50' :
          color === 'text-medical-600' ? 'bg-medical-50' :
          color === 'text-yellow-600' ? 'bg-yellow-50' : 'bg-red-50'}`}>
          <Icon size={22} className={color} />
        </div>
      </div>
      {onClick && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center text-xs text-gray-400 group-hover:text-primary-500 transition-colors">
          查看詳情 <ChevronRight size={12} className="ml-1" />
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, active: 0, todayVisits: 0, hospitalized: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [todaySchedule, setTodaySchedule] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    const [patientsRes, visitsRes, scheduleRes] = await Promise.all([
      supabase.from('patients').select('id, status, name, case_number, phone, address'),
      supabase.from('visit_records')
        .select('*, patients(name, case_number)')
        .order('visit_date', { ascending: false })
        .limit(5),
      supabase.from('visit_schedules')
        .select('*, patients(name, case_number, phone, address)')
        .eq('scheduled_date', todayStr)
        .order('scheduled_time')
    ])

    const patients = patientsRes.data || []
    setStats({
      total: patients.length,
      active: patients.filter(p => p.status === 'active').length,
      hospitalized: patients.filter(p => p.status === 'hospitalized').length,
      todayVisits: (visitsRes.data || []).filter(v => v.visit_date === todayStr).length,
    })
    setRecentVisits(visitsRes.data || [])
    setTodaySchedule(scheduleRes.data || [])
    setLoading(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return '早安'
    if (h < 18) return '午安'
    return '晚安'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}，{profile?.full_name || '護理師'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhTW })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl border border-primary-100">
          <Activity size={16} className="text-primary-600" />
          <span className="text-sm font-medium text-primary-700">系統運作正常</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="總個案數"
          value={stats.total}
          color="text-primary-600"
          trend="所有在案個案"
          onClick={() => navigate('/patients')}
        />
        <StatCard
          icon={Heart}
          label="活躍個案"
          value={stats.active}
          color="text-medical-600"
          trend="目前服務中"
          onClick={() => navigate('/patients?status=active')}
        />
        <StatCard
          icon={ClipboardList}
          label="今日訪視"
          value={stats.todayVisits}
          color="text-yellow-600"
          trend="今日已完成"
          onClick={() => navigate('/visits')}
        />
        <StatCard
          icon={AlertTriangle}
          label="住院個案"
          value={stats.hospitalized}
          color="text-red-600"
          trend="目前住院中"
          onClick={() => navigate('/patients?status=hospitalized')}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={18} className="text-primary-600" />
              今日訪視排程
            </h2>
            <button
              onClick={() => navigate('/schedule')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              查看全部 <ChevronRight size={12} />
            </button>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">今日尚無排程</p>
              <button
                onClick={() => navigate('/schedule')}
                className="mt-3 text-sm text-primary-600 hover:underline"
              >
                新增訪視排程
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySchedule.map((schedule, idx) => (
                <div key={schedule.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-primary-50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/patients/${schedule.patient_id}`)}>
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-sm font-bold text-primary-700">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{schedule.patients?.name}</div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      {schedule.patients?.address}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {schedule.scheduled_time && (
                      <div className="text-xs font-medium text-primary-700 flex items-center gap-1">
                        <Clock size={10} />
                        {schedule.scheduled_time.slice(0, 5)}
                      </div>
                    )}
                    <span className={`badge text-xs mt-1 ${
                      schedule.status === 'completed' ? 'badge-active' :
                      schedule.status === 'cancelled' ? 'badge-inactive' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {schedule.status === 'completed' ? '已完成' :
                       schedule.status === 'cancelled' ? '已取消' : '待訪視'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Visits */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList size={18} className="text-medical-600" />
              最近訪視紀錄
            </h2>
            <button
              onClick={() => navigate('/visits')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              查看全部 <ChevronRight size={12} />
            </button>
          </div>

          {recentVisits.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">尚無訪視紀錄</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentVisits.map(visit => (
                <div
                  key={visit.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-medical-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/patients/${visit.patient_id}`)}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-medical-100 rounded-full flex items-center justify-center">
                    <Heart size={14} className="text-medical-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 text-sm">{visit.patients?.name}</span>
                      <span className="text-xs text-gray-400">
                        {isToday(new Date(visit.visit_date)) ? '今天' : format(new Date(visit.visit_date), 'MM/dd')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{visit.visit_notes || '無備註'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {visit.blood_pressure_systolic && (
                        <span className="text-xs text-gray-400">
                          BP: {visit.blood_pressure_systolic}/{visit.blood_pressure_diastolic}
                        </span>
                      )}
                      {visit.temperature && (
                        <span className="text-xs text-gray-400">體溫: {visit.temperature}°C</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">快速操作</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: '新增個案', color: 'text-primary-600 bg-primary-50', action: () => navigate('/patients?new=1') },
            { icon: ClipboardList, label: '新增訪視', color: 'text-medical-600 bg-medical-50', action: () => navigate('/visits?new=1') },
            { icon: Map, label: '規劃路線', color: 'text-yellow-600 bg-yellow-50', action: () => navigate('/map') },
            { icon: Receipt, label: '開立收據', color: 'text-purple-600 bg-purple-50', action: () => navigate('/receipts?new=1') },
          ].map(({ icon: Icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all group"
            >
              <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform`}>
                <Icon size={20} className={color.split(' ')[0]} />
              </div>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
