import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePatients } from '../../hooks/usePatients'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import PatientForm from './PatientForm'
import Modal from '../ui/Modal'
import { PageLoader } from '../ui/Spinner'
import {
  Users, Search, Plus, Phone, MapPin, Filter,
  ChevronRight, MoreVertical, Edit, Trash2, Eye, Upload, X, CheckCircle, AlertCircle
} from 'lucide-react'
import * as XLSX from 'xlsx'

const STATUS_OPTIONS = [
  { value: '', label: '全部個案' },
  { value: 'active', label: '活躍' },
  { value: 'hospitalized', label: '住院中' },
  { value: 'inactive', label: '暫停服務' },
  { value: 'discharged', label: '已結案' },
]

const DISEASE_LABELS = {
  '1.糖尿病': '糖尿病', '2.高血壓': '高血壓', '3.糖尿病': '糖尿病',
  '3.糖尿病 6.高血壓': '糖尿病・高血壓', '6.高血壓': '高血壓',
  '7.中風': '中風'
}

export default function PatientList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { patients, loading, fetchPatients, deletePatient, createPatient, geocodeAddress } = usePatients()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [nurseFilter, setNurseFilter] = useState(searchParams.get('nurse') || '')
  const [nurses, setNurses] = useState([])
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [editPatient, setEditPatient] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importData, setImportData] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const fileInputRef = useRef(null)

  // 管理員才抓護理師清單
  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('id, full_name').eq('role', 'nurse').order('full_name')
        .then(({ data }) => setNurses(data || []))
    }
  }, [isAdmin])

  const FIELD_MAP = {
    '案號': 'case_number', '病歷號': 'case_number', '個案編號': 'case_number',
    '姓名': 'name', '個案姓名': 'name', '病患姓名': 'name', '名字': 'name',
    '性別': 'gender', '出生日期': 'birth_date', '生日': 'birth_date',
    '年齡': 'age', '歲': 'age',
    '身分證號': 'id_number', '身分證': 'id_number', '證號': 'id_number',
    '電話': 'phone', '聯絡電話': 'phone', '手機': 'phone',
    '地址': 'address', '居住地址': 'address', '住址': 'address',
    '轉介單位': 'referral_unit', '身份別': 'admission_type', '身分別': 'admission_type',
    '婚姻狀態': 'marital_status', '婚姻': 'marital_status',
    '緊急聯絡人': 'emergency_contact', '緊急聯絡電話': 'emergency_phone',
    '身高': 'height', '體重': 'weight', '血型': 'blood_type',
    '過敏': 'allergy', '過敏史': 'allergy',
    '狀態': 'status', '備註': 'notes', '注意事項': 'notes'
  }

  // AI 偵測哪欄最可能是「姓名」
  const detectNameColumn = (rows) => {
    if (!rows.length) return null
    const headers = Object.keys(rows[0])
    const scores = {}
    for (const h of headers) {
      let score = 0
      const hc = h.trim()
      // 標頭關鍵字比對
      if (/^姓名$|個案姓名|病患姓名|^名字$/.test(hc)) score += 12
      else if (/姓名|名字|姓名/.test(hc)) score += 7
      else if (/^姓$/.test(hc)) score += 4
      // 資料型態分析：中文姓名通常 2-4 個漢字，無數字
      const vals = rows.slice(0, 15).map(r => String(r[h] || '').trim()).filter(v => v)
      if (!vals.length) { scores[h] = score; continue }
      const chineseNameCount = vals.filter(v => /^[\u4e00-\u9fff]{2,5}$/.test(v)).length
      score += (chineseNameCount / vals.length) * 9
      // 排除明顯非姓名欄（純數字、電話格式、地址長度）
      const allNumeric = vals.every(v => /^\d+$/.test(v))
      const allLong = vals.every(v => v.length > 8)
      if (allNumeric || allLong) score -= 5
      scores[h] = score
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
    return (best && best[1] >= 3) ? best[0] : null
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' })
      const allRows = []
      const errors = []

      // 從工作表名稱判斷管路狀態
      // 支援格式：(A)/(E) 帶括號，或 A1/A5/E1/E5 不帶括號
      const getCatheter = (name) => {
        const u = name.toUpperCase()
        if (u.includes('(A)')) return '有管路'
        if (u.includes('(E)')) return '無管路'
        // 匹配 A 或 E 後面接數字，例如 巾芥A1、林E1、嘉A5
        if (/A\d/.test(u)) return '有管路'
        if (/E\d/.test(u)) return '無管路'
        return null
      }
      // 只處理個案工作表（含 A/E 標記），班表/收費等略過
      const targetSheets = wb.SheetNames.filter(n => getCatheter(n) !== null)
      const sheetsToProcess = targetSheets.length > 0 ? targetSheets : [wb.SheetNames[0]]

      for (const sheetName of sheetsToProcess) {
        const ws = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!rows.length) continue

        const catheterStatus = getCatheter(sheetName)
        const nameCol = detectNameColumn(rows)

        rows.forEach((row, i) => {
          const obj = {}
          Object.entries(row).forEach(([key, val]) => {
            const field = FIELD_MAP[key.trim()]
            if (field) obj[field] = String(val).trim()
            // AI 偵測到的姓名欄（避免重複覆蓋已對應的欄位）
            if (nameCol && key.trim() === nameCol && !obj.name) {
              obj.name = String(val).trim()
            }
          })
          if (catheterStatus) obj.catheter_status = catheterStatus
          obj._sheet = sheetName
          if (!obj.name) errors.push(`工作表「${sheetName}」第 ${i + 2} 行：找不到姓名`)
          allRows.push(obj)
        })
      }

      setImportErrors(errors)
      setImportData(allRows)
      setShowImport(true)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // 清洗資料以符合 DB schema 的型別與 CHECK 約束
  const sanitizePatient = (data) => {
    const out = { ...data }
    // 數值型別轉換
    if (out.age !== undefined) out.age = parseInt(out.age) || null
    if (out.height !== undefined) out.height = parseFloat(out.height) || null
    if (out.weight !== undefined) out.weight = parseFloat(out.weight) || null
    // birth_date：Excel 序列數字轉日期字串
    if (out.birth_date) {
      const raw = String(out.birth_date).trim()
      if (/^\d{5}$/.test(raw)) {
        // Excel serial date → JS Date（Excel epoch: 1900-01-01）
        const d = new Date(Date.UTC(1900, 0, parseInt(raw) - 1))
        out.birth_date = d.toISOString().slice(0, 10)
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        out.birth_date = null  // 無法解析就清空
      }
    }
    // CHECK 約束：不符合就設 null，避免報錯
    if (out.gender && !['男', '女'].includes(out.gender)) out.gender = null
    if (out.admission_type && !['自費收入戶', '中低收入戶', '低收入戶', '一般戶'].includes(out.admission_type)) out.admission_type = null
    if (out.marital_status && !['未婚', '已婚', '離婚', '喪偶'].includes(out.marital_status)) out.marital_status = null
    if (out.status && !['active', 'inactive', 'discharged', 'hospitalized'].includes(out.status)) out.status = null
    // 空字串轉 null
    Object.keys(out).forEach(k => { if (out[k] === '') out[k] = null })
    return out
  }

  const handleImportConfirm = async () => {
    setImporting(true)
    let success = 0, fail = 0
    let firstError = null
    const toImport = importData.filter(p => p.name)
    const baseCount = patients.length
    const total = toImport.length

    for (let idx = 0; idx < total; idx++) {
      const { _sheet, ...raw } = toImport[idx]
      if (!raw.case_number) {
        raw.case_number = `P-${String(baseCount + idx + 1).padStart(5, '0')}`
      }
      const patientData = sanitizePatient(raw)

      // 自動地理編碼：有地址但無座標時呼叫
      if (patientData.address && !patientData.address_lat) {
        setImportProgress(`地理編碼 ${idx + 1}/${total}：${patientData.name}`)
        const coords = await geocodeAddress(patientData.address)
        if (coords) {
          patientData.address_lat = coords.lat
          patientData.address_lng = coords.lng
        }
        // Nominatim 限速：每筆間隔 1.1 秒
        await new Promise(r => setTimeout(r, 1100))
      } else {
        setImportProgress(`匯入 ${idx + 1}/${total}：${patientData.name}`)
      }

      const { error } = await createPatient(patientData)
      if (error) {
        if (!firstError) firstError = error.message
        console.error(`匯入第 ${idx + 1} 筆(${patientData.name})失敗:`, error.message, patientData)
        fail++
      } else success++
    }

    setImporting(false)
    setImportProgress('')
    setShowImport(false)
    setImportData([])
    fetchPatients({ search, status: statusFilter })

    const msg = fail === 0
      ? `成功匯入 ${success} 位個案（含地址座標）`
      : `匯入完成：${success} 成功，${fail} 失敗${firstError ? `（${firstError}）` : ''}`

    if (fail === 0) toast.success(msg)
    else toast.error(msg)

    // 瀏覽器通知（切換分頁也能收到）
    if ('Notification' in window) {
      const send = () => new Notification('居護所系統 - 匯入完成', {
        body: msg,
        icon: '/logo.png'
      })
      if (Notification.permission === 'granted') send()
      else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') send() })
      }
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchPatients({ search, status: statusFilter, nurseId: nurseFilter || undefined })
    }, 300)
    return () => clearTimeout(delayDebounce)
  }, [search, statusFilter, nurseFilter])

  const statusBadge = (status) => {
    const map = {
      active: 'badge-active',
      hospitalized: 'badge-hospitalized',
      inactive: 'badge-inactive',
      discharged: 'badge-discharged',
    }
    const labels = { active: '活躍', hospitalized: '住院', inactive: '暫停', discharged: '結案' }
    return <span className={`badge ${map[status] || 'badge-inactive'}`}>{labels[status] || status}</span>
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`確定要刪除個案「${name}」嗎？此操作無法復原。`)) return
    const { error } = await deletePatient(id)
    if (error) toast.error('刪除失敗：' + error)
    else toast.success(`個案「${name}」已刪除`)
    setOpenMenu(null)
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-primary-600" />
            個案管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            共 {patients.length} 位個案
            {nurseFilter && nurses.length > 0 && (
              <span className="ml-1 text-primary-600 font-medium">
                · {nurses.find(n => n.id === nurseFilter)?.full_name}
              </span>
            )}
          </p>
        </div>

        {/* 護理師 Tabs（管理員）+ 操作按鈕 */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && nurses.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setNurseFilter('')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  nurseFilter === ''
                    ? 'bg-white text-primary-700 shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                全部
              </button>
              {nurses.map(nurse => (
                <button
                  key={nurse.id}
                  onClick={() => setNurseFilter(nurseFilter === nurse.id ? '' : nurse.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    nurseFilter === nurse.id
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {nurse.full_name}
                </button>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5">
            <Upload size={16} />
            匯入 Excel
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} />
            新增個案
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="form-input pl-9"
              placeholder="搜尋個案姓名、案號、電話..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              className="form-select w-36"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Patient List */}
      {loading ? <PageLoader /> : (
        <div className="card p-0 overflow-hidden">
          {patients.length === 0 ? (
            <div className="text-center py-16">
              <Users size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">沒有符合條件的個案</p>
              <button onClick={() => setShowForm(true)} className="mt-4 btn-primary mx-auto">
                <Plus size={16} /> 新增第一位個案
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['案號', '姓名', '年齡/性別', '電話', '居住地址', '身份別', '狀態', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {patients.map(p => (
                      <tr
                        key={p.id}
                        className="table-row"
                        onClick={() => navigate(`/patients/${p.id}`)}
                      >
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.case_number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                              {p.name[0]}
                            </div>
                            <span className="font-medium text-gray-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.age ? `${p.age}歲` : '-'} / {p.gender || '-'}</td>
                        <td className="px-4 py-3">
                          {p.phone ? (
                            <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()}
                              className="text-primary-600 hover:underline text-sm flex items-center gap-1">
                              <Phone size={12} /> {p.phone}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="flex-shrink-0" />
                            {p.address || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.admission_type || '-'}</td>
                        <td className="px-4 py-3">{statusBadge(p.status)}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenu === p.id && (
                              <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-10 py-1">
                                <button onClick={() => { navigate(`/patients/${p.id}`); setOpenMenu(null) }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  <Eye size={14} /> 查看詳情
                                </button>
                                <button onClick={() => { setEditPatient(p); setOpenMenu(null) }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  <Edit size={14} /> 編輯
                                </button>
                                <button onClick={() => handleDelete(p.id, p.name)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 size={14} /> 刪除
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {patients.map(p => (
                  <div key={p.id} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    onClick={() => navigate(`/patients/${p.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold flex-shrink-0">
                        {p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{p.name}</span>
                          {statusBadge(p.status)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.case_number} · {p.age}歲 · {p.gender}</div>
                        {p.phone && (
                          <div className="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
                            <Phone size={10} /> {p.phone}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* New Patient Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="新增個案" size="lg">
        <PatientForm onSuccess={() => { setShowForm(false); fetchPatients() }} onCancel={() => setShowForm(false)} />
      </Modal>

      {/* Edit Patient Modal */}
      <Modal isOpen={!!editPatient} onClose={() => setEditPatient(null)} title="編輯個案" size="lg">
        <PatientForm patient={editPatient} onSuccess={() => { setEditPatient(null); fetchPatients() }} onCancel={() => setEditPatient(null)} />
      </Modal>

      {/* Click outside to close menu */}
      {openMenu && <div className="fixed inset-0 z-0" onClick={() => setOpenMenu(null)} />}

      {/* Import Preview Modal */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="匯入 Excel 個案資料" size="lg">
        <div className="space-y-4">
          {importErrors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                <AlertCircle size={16} /> 資料警告
              </div>
              {importErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 flex items-center gap-2 text-primary-700 text-sm">
            <CheckCircle size={16} />
            共讀取到 {importData.length} 筆個案資料（
            {importData.filter(p => p.catheter_status === '有管路').length} 有管路 /&nbsp;
            {importData.filter(p => p.catheter_status === '無管路').length} 無管路）
            ，確認後將全部匯入
          </div>
          <div className="overflow-x-auto max-h-64 border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['工作表', '案號', '姓名', '管路', '性別', '年齡', '電話', '地址'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {importData.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-400">{p._sheet || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.case_number || '-'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{p.name || <span className="text-red-500">缺少</span>}</td>
                    <td className="px-3 py-2">
                      {p.catheter_status === '有管路'
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">有管路</span>
                        : p.catheter_status === '無管路'
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">無管路</span>
                        : <span className="text-xs text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.gender || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.age ? `${p.age}歲` : '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{p.phone || '-'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{p.address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowImport(false)} className="btn-secondary">取消</button>
            <button
              onClick={handleImportConfirm}
              disabled={importing || importData.filter(p => p.name).length === 0}
              className="btn-primary"
            >
              {importing ? (importProgress || '匯入中...') : `確認匯入 ${importData.filter(p => p.name).length} 筆`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
