import { useState } from 'react'
import { usePatients } from '../../hooks/usePatients'
import { useToast } from '../ui/Toast'
import { Save, MapPin } from 'lucide-react'
import Spinner from '../ui/Spinner'

const DISEASES = ['高血壓', '糖尿病', '心臟病', '中風', '慢性腎病', '慢性阻塞性肺病', '失智症', '癌症', '肝病', '其他']
const LANGUAGES = ['國語', '台語', '客語', '原住民語']

export default function PatientForm({ patient, onSuccess, onCancel }) {
  const { createPatient, updatePatient, geocodeAddress } = usePatients()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  const [form, setForm] = useState({
    name: patient?.name || '',
    gender: patient?.gender || '男',
    birth_date: patient?.birth_date || '',
    age: patient?.age || '',
    id_number: patient?.id_number || '',
    phone: patient?.phone || '',
    address: patient?.address || '',
    referral_unit: patient?.referral_unit || '',
    admission_type: patient?.admission_type || '一般戶',
    language: patient?.language || [],
    education: patient?.education || '',
    marital_status: patient?.marital_status || '已婚',
    religion: patient?.religion || '',
    emergency_contact: patient?.emergency_contact || '',
    emergency_phone: patient?.emergency_phone || '',
    emergency_address: patient?.emergency_address || '',
    height: patient?.height || '',
    weight: patient?.weight || '',
    blood_type: patient?.blood_type || '',
    past_diseases: patient?.past_diseases || [],
    allergy: patient?.allergy || '',
    status: patient?.status || 'active',
    notes: patient?.notes || '',
  })

  const setField = (key, value) => setForm(p => ({ ...p, [key]: value }))

  const toggleArray = (key, value) => {
    setForm(p => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter(v => v !== value) : [...p[key], value]
    }))
  }

  const handleGeocode = async () => {
    if (!form.address) { toast.warning('請先輸入居住地址'); return }
    setGeocoding(true)
    const coords = await geocodeAddress(form.address)
    setGeocoding(false)
    if (coords) {
      setForm(p => ({ ...p, address_lat: coords.lat, address_lng: coords.lng }))
      toast.success('地址座標已取得')
    } else {
      toast.error('無法取得座標，請手動確認地址')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const data = { ...form }
    if (data.age) data.age = parseInt(data.age)
    if (data.height) data.height = parseFloat(data.height)
    if (data.weight) data.weight = parseFloat(data.weight)

    const { error } = patient
      ? await updatePatient(patient.id, data)
      : await createPatient(data)

    setLoading(false)
    if (error) {
      toast.error('儲存失敗：' + error.message)
    } else {
      toast.success(patient ? '個案資料已更新' : '個案已新增')
      onSuccess()
    }
  }

  const SectionTitle = ({ children }) => (
    <div className="col-span-2 border-b border-gray-100 pb-2 mb-1 mt-2">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{children}</h3>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionTitle>基本資料</SectionTitle>

        <div>
          <label className="form-label">姓名 *</label>
          <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} required placeholder="個案姓名" />
        </div>

        <div>
          <label className="form-label">性別</label>
          <div className="flex gap-2">
            {['男', '女'].map(g => (
              <button type="button" key={g}
                onClick={() => setField('gender', g)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.gender === g ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >{g}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">出生年月日</label>
          <input type="date" className="form-input" value={form.birth_date} onChange={e => setField('birth_date', e.target.value)} />
        </div>

        <div>
          <label className="form-label">年齡</label>
          <input type="number" className="form-input" value={form.age} onChange={e => setField('age', e.target.value)} placeholder="歲" min="0" max="150" />
        </div>

        <div>
          <label className="form-label">身分證字號</label>
          <input className="form-input" value={form.id_number} onChange={e => setField('id_number', e.target.value)} placeholder="A123456789" />
        </div>

        <div>
          <label className="form-label">電話</label>
          <input type="tel" className="form-input" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="0912345678" />
        </div>

        <div className="sm:col-span-2">
          <label className="form-label">居住地址</label>
          <div className="flex gap-2">
            <input className="form-input flex-1" value={form.address} onChange={e => setField('address', e.target.value)} placeholder="縣市鄉鎮路段號" />
            <button type="button" onClick={handleGeocode} disabled={geocoding}
              className="btn-secondary flex-shrink-0 whitespace-nowrap">
              {geocoding ? <Spinner size="sm" /> : <MapPin size={14} />}
              定位
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">轉介單位</label>
          <input className="form-input" value={form.referral_unit} onChange={e => setField('referral_unit', e.target.value)} placeholder="A醫院 / 長照中心" />
        </div>

        <div>
          <label className="form-label">身份別</label>
          <select className="form-select" value={form.admission_type} onChange={e => setField('admission_type', e.target.value)}>
            {['一般戶', '中低收入戶', '低收入戶', '自費收入戶'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">婚姻狀況</label>
          <select className="form-select" value={form.marital_status} onChange={e => setField('marital_status', e.target.value)}>
            {['未婚', '已婚', '離婚', '喪偶'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">教育程度</label>
          <select className="form-select" value={form.education} onChange={e => setField('education', e.target.value)}>
            <option value="">請選擇</option>
            {['不識字', '小學（肄）畢', '國中畢', '高中（職）畢', '大學畢', '研究所以上'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">宗教信仰</label>
          <select className="form-select" value={form.religion} onChange={e => setField('religion', e.target.value)}>
            <option value="">無</option>
            {['佛教', '道教', '基督教', '天主教', '回教', '其他'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">使用語言</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {LANGUAGES.map(lang => (
              <button type="button" key={lang}
                onClick={() => toggleArray('language', lang)}
                className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  form.language.includes(lang) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >{lang}</button>
            ))}
          </div>
        </div>

        <SectionTitle>緊急聯絡人</SectionTitle>

        <div>
          <label className="form-label">緊急聯絡人</label>
          <input className="form-input" value={form.emergency_contact} onChange={e => setField('emergency_contact', e.target.value)} placeholder="姓名" />
        </div>

        <div>
          <label className="form-label">緊急聯絡電話</label>
          <input type="tel" className="form-input" value={form.emergency_phone} onChange={e => setField('emergency_phone', e.target.value)} placeholder="0912345678" />
        </div>

        <div className="sm:col-span-2">
          <label className="form-label">緊急聯絡人地址</label>
          <input className="form-input" value={form.emergency_address} onChange={e => setField('emergency_address', e.target.value)} />
        </div>

        <SectionTitle>主要疾病史及身體狀況</SectionTitle>

        <div>
          <label className="form-label">身高 (cm)</label>
          <input type="number" className="form-input" value={form.height} onChange={e => setField('height', e.target.value)} placeholder="165" />
        </div>

        <div>
          <label className="form-label">體重 (kg)</label>
          <input type="number" className="form-input" value={form.weight} onChange={e => setField('weight', e.target.value)} placeholder="65" />
        </div>

        <div>
          <label className="form-label">血型</label>
          <select className="form-select" value={form.blood_type} onChange={e => setField('blood_type', e.target.value)}>
            <option value="">不明</option>
            {['A', 'B', 'AB', 'O'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">個案狀態</label>
          <select className="form-select" value={form.status} onChange={e => setField('status', e.target.value)}>
            <option value="active">活躍</option>
            <option value="hospitalized">住院中</option>
            <option value="inactive">暫停服務</option>
            <option value="discharged">已結案</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="form-label">過去病史</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DISEASES.map(d => (
              <button type="button" key={d}
                onClick={() => toggleArray('past_diseases', d)}
                className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  form.past_diseases.includes(d) ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >{d}</button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="form-label">過敏史</label>
          <input className="form-input" value={form.allergy} onChange={e => setField('allergy', e.target.value)} placeholder="藥物、食物過敏等" />
        </div>

        <div className="sm:col-span-2">
          <label className="form-label">備註</label>
          <textarea className="form-input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="其他補充資訊..." />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">取消</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? <Spinner size="sm" /> : <Save size={16} />}
          {patient ? '更新資料' : '新增個案'}
        </button>
      </div>
    </form>
  )
}
