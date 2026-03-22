import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import Modal from '../ui/Modal'
import { PageLoader } from '../ui/Spinner'
import {
  Calendar, Plus, ChevronLeft, ChevronRight,
  Clock, MapPin, Phone, CheckCircle, X, User
} from 'lucide-react'
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export default function Schedule() {
  const toast = useToast()
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('week')
  const [showForm, setShowForm] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ patient_id: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), scheduled_time: '', notes: '' })
  const [patientSearch, setPatientSearch] = useState('')
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [selectedPatientLabel, setSelectedPatientLabel] = useState('')
  const patientSearchRef = useRef(null)

  useEffect(() => { fetchData() }, [currentDate, viewMode])

  async function fetchData() {
    setLoading(true)
    const weekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const [schedRes, patRes] = await Promise.all([
      supabase.from('visit_schedules')
        .select('*, patients(id, name, case_number, phone, address)')
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd)
        .order('scheduled_time'),
      supabase.from('patients').select('id, name, case_number').eq('status', 'active').order('name')
    ])

    setSchedules(schedRes.data || [])
    setPatients(patRes.data || [])
    setLoading(false)
  }

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 })
  })

  const getDaySchedules = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return schedules.filter(s => s.scheduled_date === dayStr)
  }

  const handleAddSchedule = async (e) => {
    e.preventDefault()
    if (!newSchedule.patient_id) { toast.error('請從下拉選單選擇個案'); return }
    // 空字串改成 null，避免 DB 型別錯誤
    const payload = {
      ...newSchedule,
      scheduled_time: newSchedule.scheduled_time || null,
      notes: newSchedule.notes || null,
    }
    const { error } = await supabase.from('visit_schedules').insert([payload])
    if (error) { toast.error(`新增失敗：${error.message}`); return }
    else {
      toast.success('排程已新增')
      setShowForm(false)
      setNewSchedule({ patient_id: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), scheduled_time: '', notes: '' })
      setPatientSearch('')
      setSelectedPatientLabel('')
      fetchData()
    }
  }

  const handleComplete = async (id) => {
    await supabase.from('visit_schedules').update({ status: 'completed' }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: 'completed' } : s))
    toast.success('已標記為完成')
  }

  const handleCancel = async (id) => {
    await supabase.from('visit_schedules').update({ status: 'cancelled' }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s))
  }

  const todayTotal = getDaySchedules(new Date()).length
  const weekTotal = schedules.length
  const completedTotal = schedules.filter(s => s.status === 'completed').length

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={24} className="text-primary-600" />
            訪視排程
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            本週 {weekTotal} 次訪視 · 已完成 {completedTotal} 次
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> 新增排程
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '今日排程', value: todayTotal, color: 'text-primary-600 bg-primary-50' },
          { label: '本週總計', value: weekTotal, color: 'text-gray-700 bg-gray-50' },
          { label: '完成率', value: weekTotal ? `${Math.round(completedTotal/weekTotal*100)}%` : '-', color: 'text-medical-600 bg-medical-50' },
        ].map(s => (
          <div key={s.label} className={`card text-center py-3 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Week Navigation */}
      <div className="card py-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCurrentDate(d => subDays(d, 7))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm font-semibold text-gray-700">
            {format(weekDays[0], 'MM月dd日')} - {format(weekDays[6], 'MM月dd日')}
          </div>
          <button onClick={() => setCurrentDate(d => addDays(d, 7))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const daySchedules = getDaySchedules(day)
            const isCurrentDay = isToday(day)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setCurrentDate(day)}
                className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                  isSameDay(day, currentDate) ? 'bg-primary-600 text-white' :
                  isCurrentDay ? 'bg-primary-50 text-primary-700' :
                  'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className="text-xs">{format(day, 'E', { locale: zhTW })}</span>
                <span className={`text-lg font-bold my-0.5 ${isSameDay(day, currentDate) ? 'text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
                {daySchedules.length > 0 ? (
                  <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                    isSameDay(day, currentDate) ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'
                  }`}>
                    {daySchedules.length}
                  </div>
                ) : <div className="w-5 h-5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day Schedule */}
      {loading ? <PageLoader /> : (
        <div className="space-y-4">
          {weekDays.map(day => {
            const daySchedules = getDaySchedules(day)
            if (daySchedules.length === 0) return null

            return (
              <div key={day.toISOString()}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isToday(day) ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isToday(day) ? '今天 · ' : ''}{format(day, 'MM月dd日 EEEE', { locale: zhTW })}
                  </div>
                  <span className="text-xs text-gray-400">{daySchedules.length} 次</span>
                </div>

                <div className="card p-0 overflow-hidden divide-y divide-gray-50">
                  {daySchedules.map(s => (
                    <div key={s.id} className={`flex items-center gap-3 p-3 ${
                      s.status === 'completed' ? 'opacity-60' : ''
                    }`}>
                      <div className="flex-shrink-0 text-center w-14">
                        {s.scheduled_time ? (
                          <>
                            <div className="text-xs font-bold text-primary-700">{s.scheduled_time.slice(0, 5)}</div>
                            <div className="text-xs text-gray-400">時</div>
                          </>
                        ) : (
                          <Clock size={16} className="text-gray-300 mx-auto" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/patients/${s.patient_id}`)}>
                        <div className="font-semibold text-gray-900 text-sm">{s.patients?.name}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} />
                          {s.patients?.address || '未設定地址'}
                        </div>
                        {s.notes && <div className="text-xs text-gray-500 mt-0.5">{s.notes}</div>}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {s.patients?.phone && (
                          <a href={`tel:${s.patients.phone}`} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors">
                            <Phone size={14} />
                          </a>
                        )}
                        {s.status === 'scheduled' && (
                          <>
                            <button onClick={() => handleComplete(s.id)}
                              className="p-1.5 rounded-lg hover:bg-medical-50 text-medical-600 transition-colors"
                              title="標記完成">
                              <CheckCircle size={14} />
                            </button>
                            <button onClick={() => handleCancel(s.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="取消">
                              <X size={14} />
                            </button>
                          </>
                        )}
                        <span className={`badge ml-1 ${
                          s.status === 'completed' ? 'badge-active' :
                          s.status === 'cancelled' ? 'badge-inactive' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {s.status === 'completed' ? '完成' : s.status === 'cancelled' ? '取消' : '待訪'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {schedules.length === 0 && (
            <div className="card text-center py-16">
              <Calendar size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">本週尚無排程</p>
              <button onClick={() => setShowForm(true)} className="btn-primary mx-auto mt-4">
                <Plus size={16} /> 新增排程
              </button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="新增訪視排程" size="sm">
        <form onSubmit={handleAddSchedule} className="space-y-4">
          <div className="relative">
            <label className="form-label">個案 *</label>
            <input
              ref={patientSearchRef}
              type="text"
              className="form-input"
              placeholder="輸入姓名或病歷號，再從下拉選單點選..."
              value={selectedPatientLabel || patientSearch}
              onChange={e => {
                setPatientSearch(e.target.value)
                setSelectedPatientLabel('')
                setNewSchedule(p => ({ ...p, patient_id: '' }))
                setShowPatientDropdown(true)
              }}
              onFocus={() => {
                if (!newSchedule.patient_id) setShowPatientDropdown(true)
              }}
              onBlur={() => setTimeout(() => setShowPatientDropdown(false), 150)}
              required={!newSchedule.patient_id}
              autoComplete="off"
            />
            {/* 隱藏欄位確保 required 驗證 */}
            <input type="hidden" value={newSchedule.patient_id} required />
            {showPatientDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {patients
                  .filter(p => {
                    const q = patientSearch.toLowerCase()
                    return !q || p.name.includes(q) || (p.case_number || '').toLowerCase().includes(q)
                  })
                  .slice(0, 30)
                  .map(p => (
                    <div
                      key={p.id}
                      className="px-4 py-2.5 hover:bg-primary-50 cursor-pointer flex items-center gap-3 text-sm"
                      onMouseDown={() => {
                        setNewSchedule(prev => ({ ...prev, patient_id: p.id }))
                        setSelectedPatientLabel(`${p.name}（${p.case_number}）`)
                        setPatientSearch('')
                        setShowPatientDropdown(false)
                      }}
                    >
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="text-gray-400 text-xs">{p.case_number}</span>
                    </div>
                  ))}
                {patients.filter(p => {
                  const q = patientSearch.toLowerCase()
                  return !q || p.name.includes(q) || (p.case_number || '').toLowerCase().includes(q)
                }).length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">找不到符合的個案</div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">日期 *</label>
              <input type="date" className="form-input" value={newSchedule.scheduled_date} onChange={e => setNewSchedule(p => ({...p, scheduled_date: e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">時間</label>
              <input type="time" className="form-input" value={newSchedule.scheduled_time} onChange={e => setNewSchedule(p => ({...p, scheduled_time: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="form-label">備註</label>
            <input className="form-input" value={newSchedule.notes} onChange={e => setNewSchedule(p => ({...p, notes: e.target.value}))} placeholder="特殊注意事項..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">取消</button>
            <button type="submit" className="btn-primary flex-1">確認新增</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
