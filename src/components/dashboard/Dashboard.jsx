import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  Users, ClipboardList, Calendar, TrendingUp,
  Heart, AlertTriangle, MapPin, Phone, ChevronRight,
  Activity, Clock, Map, Receipt, UserCheck
} from 'lucide-react'
import { format, isToday } from 'date-fns'
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
  const isAdmin = profile?.role === 'admin'

  const [nurses, setNurses] = useState([])
  const [selectedNurseId, setSelectedNurseId] = useState('all') // 'all' or nurse profile id
  const [stats, setStats] = useState({ total: 0, active: 0, todayVisits: 0, hospitalized: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [todaySchedule, setTodaySchedule] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch nurses list (admin only)
  useEffect(() => {
    if (isAdmin) {
      fetchNurses()
    }
  }, [isAdmin])

  useEffect(() => {
    fetchDashboardData()
  }, [selectedNurseId, profile])

  async function fetchNurses() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'nurse')
      .order('full_name')
    setNurses(data || [])
  }

  async function fetchDashboardData() {
    if (!profile) return
    setLoading(true)
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Admin viewing specific nurse: apply explicit filters
    // Admin viewing all / non-admin: rely on RLS for isolation
    const adminNurseFilter = isAdmin && selectedNurseId !== 'all' ? selectedNurseId : null

    // patients → created_by; visit_records → nurse_id; visit_schedules → nurse_id
    let patientsQuery = supabase.from('patients').select('id, status, name, case_number, phone, address, created_by')
    if (adminNurseFilter) patientsQuery = patientsQuery.eq('created_by', adminNurseFilter)

    let visitsQuery = supabase.from('visit_records')
      .select('*, patients(name, case_number)')
      .order('visit_date', { ascending: false })
      .limit(5)
    if (adminNurseFilter) visitsQuery = visitsQuery.eq('nurse_id', adminNurseFilter)

    let scheduleQuery = supabase.from('visit_schedules')
      .select('*, patients(name, case_number, phone, address)')
      .eq('scheduled_date', todayStr)
      .order('scheduled_time')
    if (adminNurseFilter) scheduleQuery = scheduleQuery.eq('nurse_id', adminNurseFilter)

    const [patientsRes, visitsRes, scheduleRes] = await Promise.all([
      patientsQuery,
      visitsQuery,
      scheduleQuery,
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

  const selectedNurseName = selectedNurseId === 'all'
    ? '全部護理師'
    : nurses.find(n => n.id === selectedNurseId)?.full_name || ''

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

      {/* Nurse Selector (Admin only) */}
      {isAdmin && (
        <div className="card py-3">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={16} className="text-primary-600" />
            <span className="text-sm font-semibold text-gray-700">切換護理師視角</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedNurseId('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                selectedNurseId === 'all'
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              全部
            </button>
            {nurses.map(nurse => (
              <button
                key={nurse.id}
                onClick={() => setSelectedNurseId(nurse.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedNurseId === nurse.id
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {nurse.full_name}
              </button>
            ))}
          </div>
          {selectedNurseId !== 'all' && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <UserCheck size={11} />
              目前查看：{selectedNurseName} 的個案與排程
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label={isAdmin && selectedNurseId !== 'all' ? `${selectedNurseName}個案數` : '總個案數'}
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

          {/* Per-nurse summary cards (admin 全部 view) */}
          {isAdmin && selectedNurseId === 'all' && nurses.length > 0 && (
            <NurseSummaryCards nurses={nurses} />
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Schedule */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar size={18} className="text-primary-600" />
                  今日訪視排程
                  {isAdmin && selectedNurseId !== 'all' && (
                    <span className="text-xs font-normal text-gray-400">（{selectedNurseName}）</span>
                  )}
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
                    <div key={schedule.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-primary-50 transition-colors cursor-pointer group"
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
                  {isAdmin && selectedNurseId !== 'all' && (
                    <span className="text-xs font-normal text-gray-400">（{selectedNurseName}）</span>
                  )}
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
        </>
      )}
    </div>
  )
}

// Sub-component: per-nurse summary cards for admin "全部" view
function NurseSummaryCards({ nurses }) {
  const [nurseStats, setNurseStats] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    fetchAllNurseStats()
  }, [nurses])

  async function fetchAllNurseStats() {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const results = {}
    await Promise.all(
      nurses.map(async (nurse) => {
        const [pRes, sRes] = await Promise.all([
          supabase.from('patients').select('id, status').eq('created_by', nurse.id),
          supabase.from('visit_schedules').select('id, status').eq('nurse_id', nurse.id).eq('scheduled_date', todayStr),
        ])
        const patients = pRes.data || []
        const schedules = sRes.data || []
        results[nurse.id] = {
          total: patients.length,
          active: patients.filter(p => p.status === 'active').length,
          todaySchedule: schedules.length,
          todayDone: schedules.filter(s => s.status === 'completed').length,
        }
      })
    )
    setNurseStats(results)
  }

  const colorMap = [
    { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
    { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    { bg: 'bg-pink-50', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  ]

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <UserCheck size={18} className="text-primary-600" />
        各護理師概況
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {nurses.map((nurse, idx) => {
          const c = colorMap[idx % colorMap.length]
          const s = nurseStats[nurse.id]
          return (
            <div key={nurse.id} className={`rounded-xl border ${c.border} ${c.bg} p-4 transition-all hover:shadow-md`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full ${c.dot} flex items-center justify-center text-white font-bold text-sm`}>
                  {nurse.full_name?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{nurse.full_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.badge}`}>護理師</span>
                </div>
              </div>
              {!s ? (
                <div className="text-center py-2"><Spinner size="sm" /></div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{s.total}</p>
                    <p className="text-xs text-gray-500">總個案</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-medical-600">{s.active}</p>
                    <p className="text-xs text-gray-500">活躍</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center col-span-2">
                    <p className="text-sm font-semibold text-gray-800">
                      今日排程：
                      <span className="text-primary-600">{s.todayDone}</span>
                      <span className="text-gray-400"> / {s.todaySchedule}</span>
                      <span className="text-xs text-gray-400 ml-1">完成</span>
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => navigate(`/patients?nurse=${nurse.id}`)}
                className="w-full mt-3 text-xs text-center text-gray-500 hover:text-primary-600 flex items-center justify-center gap-1 transition-colors"
              >
                查看個案 <ChevronRight size={11} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
