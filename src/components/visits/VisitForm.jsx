import { useState, useRef, useEffect } from 'react'
import { useVisitRecords } from '../../hooks/usePatients'
import { useToast } from '../ui/Toast'
import { Save, Eraser, MapPin } from 'lucide-react'
import Spinner from '../ui/Spinner'
import { format } from 'date-fns'

export default function VisitForm({ patientId, patientName, visit, onSuccess, onCancel }) {
  const { createVisit, updateVisit } = useVisitRecords(patientId)
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSig, setHasSig] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  const [form, setForm] = useState({
    visit_date: visit?.visit_date || format(new Date(), 'yyyy-MM-dd'),
    visit_start_time: visit?.visit_start_time?.slice(11, 16) || format(new Date(), 'HH:mm'),
    visit_end_time: visit?.visit_end_time?.slice(11, 16) || '',
    nurse_name: visit?.nurse_name || '',
    visit_notes: visit?.visit_notes || '',
    blood_pressure_systolic: visit?.blood_pressure_systolic || '',
    blood_pressure_diastolic: visit?.blood_pressure_diastolic || '',
    heart_rate: visit?.heart_rate || '',
    temperature: visit?.temperature || '',
    respiratory_rate: visit?.respiratory_rate || '',
    spo2: visit?.spo2 || '',
    blood_sugar: visit?.blood_sugar || '',
    wound_condition: visit?.wound_condition || '',
    next_visit_date: visit?.next_visit_date || '',
    status: visit?.status || 'completed',
    visit_location_lat: visit?.visit_location_lat || null,
    visit_location_lng: visit?.visit_location_lng || null,
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Signature Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch?.clientX || e.clientX) - rect.left,
      y: (touch?.clientY || e.clientY) - rect.top
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setHasSig(true)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDraw = (e) => { e?.preventDefault(); setIsDrawing(false) }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  const getGPS = () => {
    if (!navigator.geolocation) { toast.warning('您的設備不支援GPS'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('visit_location_lat', pos.coords.latitude)
        set('visit_location_lng', pos.coords.longitude)
        setGpsLoading(false)
        toast.success(`GPS定位成功 (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`)
      },
      () => { setGpsLoading(false); toast.error('GPS定位失敗，請確認定位權限') }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Get signature data
    let signatureData = null
    if (hasSig) {
      signatureData = canvasRef.current.toDataURL('image/png')
    }

    const today = form.visit_date
    const data = {
      ...form,
      patient_id: patientId,
      nurse_signature: signatureData,
      visit_start_time: form.visit_start_time ? `${today}T${form.visit_start_time}:00+08:00` : null,
      visit_end_time: form.visit_end_time ? `${today}T${form.visit_end_time}:00+08:00` : null,
      blood_pressure_systolic: form.blood_pressure_systolic ? parseInt(form.blood_pressure_systolic) : null,
      blood_pressure_diastolic: form.blood_pressure_diastolic ? parseInt(form.blood_pressure_diastolic) : null,
      heart_rate: form.heart_rate ? parseInt(form.heart_rate) : null,
      temperature: form.temperature ? parseFloat(form.temperature) : null,
      respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate) : null,
      spo2: form.spo2 ? parseFloat(form.spo2) : null,
      blood_sugar: form.blood_sugar ? parseFloat(form.blood_sugar) : null,
    }

    const { error } = visit
      ? await updateVisit(visit.id, data)
      : await createVisit(data)

    setLoading(false)
    if (error) toast.error('儲存失敗：' + error.message)
    else { toast.success(visit ? '訪視紀錄已更新' : '訪視紀錄已儲存'); onSuccess() }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {patientName && (
        <div className="bg-primary-50 rounded-xl px-4 py-3 border border-primary-100">
          <p className="text-sm text-primary-700"><span className="font-medium">個案：</span>{patientName}</p>
        </div>
      )}

      {/* Visit Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">訪視資訊</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">訪視日期 *</label>
            <input type="date" className="form-input" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} required />
          </div>
          <div>
            <label className="form-label">開始時間</label>
            <input type="time" className="form-input" value={form.visit_start_time} onChange={e => set('visit_start_time', e.target.value)} />
          </div>
          <div>
            <label className="form-label">結束時間</label>
            <input type="time" className="form-input" value={form.visit_end_time} onChange={e => set('visit_end_time', e.target.value)} />
          </div>
          <div>
            <label className="form-label">護理師</label>
            <input className="form-input" value={form.nurse_name} onChange={e => set('nurse_name', e.target.value)} placeholder="護理師姓名" />
          </div>
          <div>
            <label className="form-label">訪視狀態</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="completed">已完成</option>
              <option value="scheduled">已排程</option>
              <option value="cancelled">已取消</option>
              <option value="no_answer">未應答</option>
            </select>
          </div>
          <div>
            <label className="form-label">下次訪視</label>
            <input type="date" className="form-input" value={form.next_visit_date} onChange={e => set('next_visit_date', e.target.value)} />
          </div>
        </div>
      </div>

      {/* GPS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">GPS 定位</h3>
          <button type="button" onClick={getGPS} disabled={gpsLoading} className="btn-secondary text-xs py-1.5">
            {gpsLoading ? <Spinner size="sm" /> : <MapPin size={14} />}
            取得目前位置
          </button>
        </div>
        {form.visit_location_lat && (
          <div className="bg-medical-50 border border-medical-100 rounded-lg px-3 py-2 text-xs text-medical-700">
            已定位：{form.visit_location_lat.toFixed(6)}, {form.visit_location_lng.toFixed(6)}
          </div>
        )}
      </div>

      {/* Vitals */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">生命徵象</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">收縮壓 (mmHg)</label>
            <input type="number" className="form-input" value={form.blood_pressure_systolic} onChange={e => set('blood_pressure_systolic', e.target.value)} placeholder="120" min="60" max="250" />
          </div>
          <div>
            <label className="form-label">舒張壓 (mmHg)</label>
            <input type="number" className="form-input" value={form.blood_pressure_diastolic} onChange={e => set('blood_pressure_diastolic', e.target.value)} placeholder="80" min="40" max="150" />
          </div>
          <div>
            <label className="form-label">心跳 (bpm)</label>
            <input type="number" className="form-input" value={form.heart_rate} onChange={e => set('heart_rate', e.target.value)} placeholder="72" min="30" max="200" />
          </div>
          <div>
            <label className="form-label">體溫 (°C)</label>
            <input type="number" step="0.1" className="form-input" value={form.temperature} onChange={e => set('temperature', e.target.value)} placeholder="36.5" min="34" max="42" />
          </div>
          <div>
            <label className="form-label">呼吸次數</label>
            <input type="number" className="form-input" value={form.respiratory_rate} onChange={e => set('respiratory_rate', e.target.value)} placeholder="16" min="8" max="40" />
          </div>
          <div>
            <label className="form-label">血氧 SpO2 (%)</label>
            <input type="number" step="0.1" className="form-input" value={form.spo2} onChange={e => set('spo2', e.target.value)} placeholder="98" min="70" max="100" />
          </div>
          <div>
            <label className="form-label">血糖 (mg/dL)</label>
            <input type="number" step="0.1" className="form-input" value={form.blood_sugar} onChange={e => set('blood_sugar', e.target.value)} placeholder="100" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <div>
          <label className="form-label">訪視紀錄</label>
          <textarea
            className="form-input"
            rows={4}
            value={form.visit_notes}
            onChange={e => set('visit_notes', e.target.value)}
            placeholder="本次訪視情況描述、處置、觀察等..."
          />
        </div>
        <div>
          <label className="form-label">傷口狀況</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.wound_condition}
            onChange={e => set('wound_condition', e.target.value)}
            placeholder="傷口位置、大小、顏色、滲液等描述..."
          />
        </div>
      </div>

      {/* Signature */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="form-label mb-0">護理人員簽章</label>
          {hasSig && (
            <button type="button" onClick={clearSignature} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
              <Eraser size={12} /> 清除
            </button>
          )}
        </div>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="signature-canvas w-full"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        <p className="text-xs text-gray-400 mt-1">請用滑鼠或觸控筆在上方框線內簽名</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">取消</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? <Spinner size="sm" /> : <Save size={16} />}
          {visit ? '更新紀錄' : '儲存訪視'}
        </button>
      </div>
    </form>
  )
}
