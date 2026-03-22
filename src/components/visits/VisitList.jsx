import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'
import VisitForm from './VisitForm'
import { PageLoader } from '../ui/Spinner'
import {
  ClipboardList, Search, Plus, Filter, Calendar,
  Heart, ChevronRight, Activity
} from 'lucide-react'
import { format, isToday, isYesterday, startOfWeek, endOfWeek } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export default function VisitList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [visits, setVisits] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [selectedPatientId, setSelectedPatientId] = useState('')

  useEffect(() => {
    fetchData()
  }, [dateFilter])

  async function fetchData() {
    setLoading(true)
    const [patientsRes, visitsRes] = await Promise.all([
      supabase.from('patients').select('id, name, case_number').order('name'),
      buildVisitQuery()
    ])
    setPatients(patientsRes.data || [])
    setVisits(visitsRes.data || [])
    setLoading(false)
  }

  async function buildVisitQuery() {
    let query = supabase
      .from('visit_records')
      .select('*, patients(name, case_number, phone)')
      .order('visit_date', { ascending: false })
      .order('visit_start_time', { ascending: false })

    if (dateFilter) {
      const today = new Date()
      if (dateFilter === 'today') {
        const d = format(today, 'yyyy-MM-dd')
        query = query.eq('visit_date', d)
      } else if (dateFilter === 'week') {
        const start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        const end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        query = query.gte('visit_date', start).lte('visit_date', end)
      }
    }

    return query
  }

  const filtered = visits.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return v.patients?.name?.toLowerCase().includes(s) ||
           v.nurse_name?.toLowerCase().includes(s) ||
           v.visit_notes?.toLowerCase().includes(s)
  })

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr)
    if (isToday(d)) return '今天'
    if (isYesterday(d)) return '昨天'
    return format(d, 'MM月dd日 EEEE', { locale: zhTW })
  }

  // Group by date
  const grouped = filtered.reduce((acc, v) => {
    const label = formatDateLabel(v.visit_date)
    if (!acc[label]) acc[label] = []
    acc[label].push(v)
    return acc
  }, {})

  const statusColor = {
    completed: 'bg-medical-100 text-medical-700',
    scheduled: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-gray-100 text-gray-600',
    no_answer: 'bg-red-100 text-red-700',
  }
  const statusLabel = { completed: '已完成', scheduled: '已排程', cancelled: '已取消', no_answer: '未應答' }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={24} className="text-medical-600" />
            訪視紀錄
          </h1>
          <p className="text-gray-500 text-sm mt-1">共 {visits.length} 筆紀錄</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> 新增訪視
        </button>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="form-input pl-9" placeholder="搜尋個案、護理師、紀錄內容..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Filter size={16} className="text-gray-400 self-center flex-shrink-0" />
            {[['', '全部'], ['today', '今天'], ['week', '本週']].map(([val, label]) => (
              <button key={val}
                onClick={() => setDateFilter(val)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === val ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <>
          {Object.keys(grouped).length === 0 ? (
            <div className="card text-center py-16">
              <ClipboardList size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">沒有符合條件的訪視紀錄</p>
              <button onClick={() => setShowForm(true)} className="btn-primary mx-auto mt-4">
                <Plus size={16} /> 新增訪視紀錄
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([dateLabel, dayVisits]) => (
                <div key={dateLabel}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                      <Calendar size={12} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600">{dateLabel}</span>
                    </div>
                    <span className="text-xs text-gray-400">{dayVisits.length} 次訪視</span>
                  </div>

                  <div className="card p-0 overflow-hidden divide-y divide-gray-50">
                    {dayVisits.map(visit => (
                      <div
                        key={visit.id}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/patients/${visit.patient_id}`)}
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-medical-100 flex items-center justify-center text-medical-700 font-bold">
                          {visit.patients?.name?.[0] || '?'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{visit.patients?.name}</span>
                            <span className="text-xs font-mono text-gray-400">{visit.patients?.case_number}</span>
                            <span className={`badge text-xs ${statusColor[visit.status] || 'badge-inactive'}`}>
                              {statusLabel[visit.status] || visit.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            {visit.visit_start_time && (
                              <span>{format(new Date(visit.visit_start_time), 'HH:mm')}</span>
                            )}
                            {visit.nurse_name && <span>護理師：{visit.nurse_name}</span>}
                            {visit.blood_pressure_systolic && (
                              <span className="flex items-center gap-0.5">
                                <Activity size={10} />
                                {visit.blood_pressure_systolic}/{visit.blood_pressure_diastolic}
                              </span>
                            )}
                            {visit.temperature && <span>🌡 {visit.temperature}°C</span>}
                          </div>
                          {visit.visit_notes && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{visit.visit_notes}</p>
                          )}
                        </div>

                        <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 transition-colors flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="新增訪視紀錄" size="lg">
        <div className="mb-4">
          <label className="form-label">選擇個案</label>
          <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
            <option value="">請選擇個案...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.case_number})</option>
            ))}
          </select>
        </div>
        {selectedPatientId && (
          <VisitForm
            patientId={selectedPatientId}
            patientName={patients.find(p => p.id === selectedPatientId)?.name}
            onSuccess={() => { setShowForm(false); setSelectedPatientId(''); fetchData() }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </Modal>
    </div>
  )
}
