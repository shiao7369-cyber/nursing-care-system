import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePatients, useVisitRecords } from '../../hooks/usePatients'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import Modal from '../ui/Modal'
import PatientForm from './PatientForm'
import VisitForm from '../visits/VisitForm'
import { PageLoader } from '../ui/Spinner'
import {
  ArrowLeft, Edit, Phone, MapPin, Heart, ClipboardList,
  Plus, Calendar, Activity, Pill, Hospital, ChevronDown, ChevronUp,
  User, AlertCircle, Stethoscope, LocateFixed, Navigation
} from 'lucide-react'
import { format, differenceInYears } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// 可拖拉的地圖 Marker 元件
function DraggableMarker({ position, onMove }) {
  const markerRef = useRef(null)
  const map = useMap()
  useEffect(() => { if (position) map.setView(position, map.getZoom()) }, [])
  return (
    <Marker
      position={position}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const m = markerRef.current
          if (m) { const p = m.getLatLng(); onMove([p.lat, p.lng]) }
        }
      }}
    />
  )
}

// 點擊地圖移動 Marker
function ClickToMove({ onMove }) {
  useMapEvents({ click: e => onMove([e.latlng.lat, e.latlng.lng]) })
  return null
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getPatient, updatePatient } = usePatients()
  const { visits, loading: visitsLoading, createVisit } = useVisitRecords(id)
  const toast = useToast()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [resources, setResources] = useState([])
  const [hospitalizations, setHospitalizations] = useState([])
  const [activeTab, setActiveTab] = useState('visits')
  const [showMapModal, setShowMapModal] = useState(false)
  const [pinPos, setPinPos] = useState(null)
  const [savingPin, setSavingPin] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const { data } = await getPatient(id)
    if (data) {
      setPatient(data)
      setResources(data.medical_resources || [])
      setHospitalizations(data.hospitalizations || [])
    }
    setLoading(false)
  }

  const openMapModal = () => {
    setPinPos(
      patient.address_lat && patient.address_lng
        ? [patient.address_lat, patient.address_lng]
        : [24.99, 121.31]
    )
    setShowMapModal(true)
  }

  const handleReGeocode = async () => {
    if (!patient.address) { toast.error('沒有地址可以定位'); return }
    const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(patient.address)}.json?country=TW&language=zh&limit=1&bbox=121.0,24.65,121.45,25.15&proximity=121.31,24.99&access_token=${TOKEN}`
      )
      const d = await res.json()
      if (d?.features?.length > 0) {
        const [lng, lat] = d.features[0].center
        setPinPos([lat, lng])
        toast.success('已重新定位，確認後請按儲存')
      } else {
        toast.error('找不到地址，請手動拖動 Pin')
      }
    } catch { toast.error('定位失敗') }
  }

  const handleSavePin = async () => {
    if (!pinPos) return
    setSavingPin(true)
    const { error } = await supabase.from('patients')
      .update({ address_lat: pinPos[0], address_lng: pinPos[1] })
      .eq('id', id)
    setSavingPin(false)
    if (error) { toast.error('儲存失敗'); return }
    setPatient(p => ({ ...p, address_lat: pinPos[0], address_lng: pinPos[1] }))
    setShowMapModal(false)
    toast.success('地址座標已更新')
  }

  if (loading) return <PageLoader />
  if (!patient) return (
    <div className="text-center py-20">
      <p className="text-gray-400">找不到此個案</p>
      <button onClick={() => navigate('/patients')} className="btn-secondary mt-4 mx-auto">返回列表</button>
    </div>
  )

  const statusBadge = {
    active: 'badge-active',
    hospitalized: 'badge-hospitalized',
    inactive: 'badge-inactive',
    discharged: 'badge-discharged',
  }
  const statusLabel = { active: '活躍', hospitalized: '住院中', inactive: '暫停', discharged: '已結案' }

  return (
    <div className="space-y-5 fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/patients')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            <span className={`badge ${statusBadge[patient.status] || 'badge-inactive'}`}>
              {statusLabel[patient.status] || patient.status}
            </span>
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{patient.case_number}</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {patient.gender} · {patient.age}歲
            {patient.birth_date && ` · 生日：${format(new Date(patient.birth_date), 'yyyy年MM月dd日')}`}
          </p>
        </div>
        <button onClick={() => setShowEdit(true)} className="btn-secondary flex-shrink-0">
          <Edit size={16} /> 編輯
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Basic Info */}
        <div className="card md:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User size={16} className="text-primary-600" /> 基本資料
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: '轉介單位', value: patient.referral_unit },
              { label: '身份別', value: patient.admission_type },
              { label: '教育程度', value: patient.education },
              { label: '婚姻狀況', value: patient.marital_status },
              { label: '宗教信仰', value: patient.religion || '無' },
              { label: '使用語言', value: patient.language?.join('・') },
              { label: '血型', value: patient.blood_type || '不明' },
              { label: '過敏史', value: patient.allergy || '無' },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <span className="text-gray-400">{label}：</span>
                <span className="text-gray-700 font-medium">{value}</span>
              </div>
            ) : null)}

            {patient.address && (
              <div className="col-span-2 flex items-start gap-1">
                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-400">居住地址：</span>
                  <button
                    onClick={() => navigate(`/map?focus=${id}`)}
                    className="text-primary-600 hover:underline font-medium text-left"
                  >
                    {patient.address}
                  </button>
                  <button
                    onClick={openMapModal}
                    className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                  >
                    <LocateFixed size={11} />
                    {patient.address_lat ? '調整座標' : '設定座標'}
                  </button>
                </div>
              </div>
            )}

            {patient.phone && (
              <div className="flex items-center gap-1">
                <Phone size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-400">電話：</span>
                <a href={`tel:${patient.phone}`} className="text-primary-600 hover:underline font-medium">{patient.phone}</a>
              </div>
            )}
          </div>

          {patient.past_diseases?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-2">過去病史</p>
              <div className="flex flex-wrap gap-1.5">
                {patient.past_diseases.map(d => (
                  <span key={d} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs border border-red-100">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emergency & Vitals */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <AlertCircle size={16} className="text-red-500" /> 緊急聯絡
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">聯絡人：</span>
                <span className="text-gray-700 font-medium">{patient.emergency_contact || '-'}</span>
              </div>
              {patient.emergency_phone && (
                <div className="flex items-center gap-1">
                  <Phone size={12} className="text-gray-400" />
                  <a href={`tel:${patient.emergency_phone}`} className="text-primary-600 hover:underline">
                    {patient.emergency_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <Activity size={16} className="text-medical-600" /> 身體狀況
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xs text-blue-500">身高</div>
                <div className="font-bold text-blue-700">{patient.height ? `${patient.height}cm` : '-'}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xs text-green-500">體重</div>
                <div className="font-bold text-green-700">{patient.weight ? `${patient.weight}kg` : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'visits', icon: ClipboardList, label: `訪視紀錄 (${visits.length})` },
            { key: 'resources', icon: Stethoscope, label: `使用醫療資源 (${resources.length})` },
            { key: 'hospitalization', icon: Hospital, label: `住院紀錄 (${hospitalizations.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Visits Tab */}
          {activeTab === 'visits' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={() => setShowVisitForm(true)} className="btn-primary">
                  <Plus size={16} /> 新增訪視
                </button>
              </div>
              {visits.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList size={40} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">尚無訪視紀錄</p>
                </div>
              ) : (
                visits.map(visit => (
                  <VisitCard key={visit.id} visit={visit} />
                ))
              )}
            </div>
          )}

          {/* Medical Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-3">
              <MedicalResourcesPanel patientId={id} resources={resources} onUpdate={fetchData} />
            </div>
          )}

          {/* Hospitalization Tab */}
          {activeTab === 'hospitalization' && (
            <HospitalizationPanel patientId={id} hospitalizations={hospitalizations} onUpdate={fetchData} />
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="編輯個案資料" size="lg">
        <PatientForm patient={patient} onSuccess={() => { setShowEdit(false); fetchData() }} onCancel={() => setShowEdit(false)} />
      </Modal>

      {/* Visit Form Modal */}
      <Modal isOpen={showVisitForm} onClose={() => setShowVisitForm(false)} title="新增訪視紀錄" size="lg">
        <VisitForm patientId={id} patientName={patient.name} onSuccess={() => { setShowVisitForm(false); }} onCancel={() => setShowVisitForm(false)} />
      </Modal>

      {/* 座標調整 Modal */}
      <Modal isOpen={showMapModal} onClose={() => setShowMapModal(false)} title={`調整地址座標 — ${patient.name}`} size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-gray-500 flex-1">{patient.address}</p>
            <button onClick={handleReGeocode}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 font-medium transition-colors">
              <Navigation size={12} /> 重新定位
            </button>
          </div>
          <p className="text-xs text-gray-400">可直接拖動地圖上的 Pin，或點擊地圖設定新位置</p>

          {pinPos && (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 380 }}>
              <MapContainer center={pinPos} zoom={16} className="w-full h-full" zoomControl={true}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' maxZoom={19} />
                <DraggableMarker position={pinPos} onMove={setPinPos} />
                <ClickToMove onMove={setPinPos} />
              </MapContainer>
            </div>
          )}

          {pinPos && (
            <div className="text-xs text-gray-400 text-center">
              座標：{pinPos[0].toFixed(6)}, {pinPos[1].toFixed(6)}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowMapModal(false)} className="btn-secondary flex-1">取消</button>
            <button onClick={handleSavePin} disabled={savingPin} className="btn-primary flex-1">
              {savingPin ? '儲存中...' : '✓ 儲存座標'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function VisitCard({ visit }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">
              {format(new Date(visit.visit_date), 'yyyy年MM月dd日')}
            </span>
            {visit.visit_start_time && (
              <span className="text-xs text-gray-400">
                {format(new Date(visit.visit_start_time), 'HH:mm')} - {visit.visit_end_time ? format(new Date(visit.visit_end_time), 'HH:mm') : '?'}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            護理師：{visit.nurse_name || '未記錄'} · {visit.visit_notes?.slice(0, 60) || '無備註'}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '血壓', value: visit.blood_pressure_systolic ? `${visit.blood_pressure_systolic}/${visit.blood_pressure_diastolic} mmHg` : null },
            { label: '心跳', value: visit.heart_rate ? `${visit.heart_rate} bpm` : null },
            { label: '體溫', value: visit.temperature ? `${visit.temperature}°C` : null },
            { label: 'SpO2', value: visit.spo2 ? `${visit.spo2}%` : null },
            { label: '血糖', value: visit.blood_sugar ? `${visit.blood_sugar} mg/dL` : null },
            { label: '下次訪視', value: visit.next_visit_date ? format(new Date(visit.next_visit_date), 'MM/dd') : null },
          ].filter(v => v.value).map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5">{value}</div>
            </div>
          ))}

          {visit.visit_notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-gray-400 mb-1">訪視紀錄</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{visit.visit_notes}</p>
            </div>
          )}

          {visit.wound_condition && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-gray-400 mb-1">傷口狀況</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{visit.wound_condition}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MedicalResourcesPanel({ patientId, resources, onUpdate }) {
  const [form, setForm] = useState({ resource_date: '', resource_type: '', provider: '', notes: '' })
  const [adding, setAdding] = useState(false)
  const toast = useToast()

  const handleAdd = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('medical_resources').insert([{ ...form, patient_id: patientId }])
    if (error) toast.error('新增失敗')
    else { toast.success('已新增醫療資源'); setAdding(false); setForm({ resource_date: '', resource_type: '', provider: '', notes: '' }); onUpdate() }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          <Plus size={16} /> 新增資源
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">日期</label>
              <input type="date" className="form-input" value={form.resource_date} onChange={e => setForm(p => ({...p, resource_date: e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">資源類型</label>
              <select className="form-select" value={form.resource_type} onChange={e => setForm(p => ({...p, resource_type: e.target.value}))} required>
                <option value="">請選擇</option>
                {['家庭醫師', '延緩失能', '健保', '長照2.0', '復健', '其他'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">提供單位/人員</label>
              <input className="form-input" value={form.provider} onChange={e => setForm(p => ({...p, provider: e.target.value}))} placeholder="診所/醫院名稱" />
            </div>
            <div>
              <label className="form-label">備註</label>
              <input className="form-input" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary flex-1">取消</button>
            <button type="submit" className="btn-primary flex-1">儲存</button>
          </div>
        </form>
      )}

      {resources.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">尚無醫療資源紀錄</div>
      ) : (
        <div className="space-y-2">
          {resources.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-sm">
              <span className="text-gray-400 flex-shrink-0">{r.resource_date}</span>
              <span className="font-medium text-gray-900 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{r.resource_type}</span>
              <span className="text-gray-600">{r.provider}</span>
              {r.notes && <span className="text-gray-400 truncate flex-1">{r.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HospitalizationPanel({ patientId, hospitalizations, onUpdate }) {
  const [form, setForm] = useState({ admission_date: '', discharge_date: '', hospital_name: '', ward: '', reason: '', notes: '' })
  const [adding, setAdding] = useState(false)
  const toast = useToast()

  const handleAdd = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('hospitalizations').insert([{ ...form, patient_id: patientId }])
    if (error) toast.error('新增失敗')
    else { toast.success('已新增住院紀錄'); setAdding(false); onUpdate() }
  }

  const calcDays = (admission, discharge) => {
    if (!admission || !discharge) return null
    const d = Math.round((new Date(discharge) - new Date(admission)) / (1000 * 60 * 60 * 24))
    return d
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          <Plus size={16} /> 新增住院紀錄
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-yellow-50 rounded-xl p-4 space-y-3 border border-yellow-100">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">入院日期</label><input type="date" className="form-input" value={form.admission_date} onChange={e => setForm(p => ({...p, admission_date: e.target.value}))} required /></div>
            <div><label className="form-label">出院日期</label><input type="date" className="form-input" value={form.discharge_date} onChange={e => setForm(p => ({...p, discharge_date: e.target.value}))} /></div>
            <div><label className="form-label">醫院名稱</label><input className="form-input" value={form.hospital_name} onChange={e => setForm(p => ({...p, hospital_name: e.target.value}))} /></div>
            <div><label className="form-label">病房</label><input className="form-input" value={form.ward} onChange={e => setForm(p => ({...p, ward: e.target.value}))} /></div>
            <div className="col-span-2"><label className="form-label">住院原因</label><input className="form-input" value={form.reason} onChange={e => setForm(p => ({...p, reason: e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary flex-1">取消</button>
            <button type="submit" className="btn-primary flex-1">儲存</button>
          </div>
        </form>
      )}

      {hospitalizations.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">尚無住院紀錄</div>
      ) : (
        <div className="space-y-2">
          {hospitalizations.map(h => {
            const days = calcDays(h.admission_date, h.discharge_date)
            return (
              <div key={h.id} className="p-3 rounded-xl bg-yellow-50 border border-yellow-100 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-gray-900">{h.hospital_name || '未知醫院'} {h.ward && `· ${h.ward}`}</div>
                  {days !== null && (
                    <span className="badge bg-yellow-100 text-yellow-800">{days} 天</span>
                  )}
                </div>
                <div className="text-gray-500 mt-1">
                  {h.admission_date} → {h.discharge_date || '未出院'}
                </div>
                {h.reason && <div className="text-gray-600 mt-1">原因：{h.reason}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
