import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import Modal from '../ui/Modal'
import { PageLoader } from '../ui/Spinner'
import {
  Receipt, Plus, Search, Printer, CheckCircle,
  DollarSign, Calendar, User, ChevronDown, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'

const DEFAULT_ITEMS = [
  { description: '居家護理訪視費', quantity: 1, unit_price: 0, amount: 0 },
]

export default function Receipts() {
  const toast = useToast()
  const [receipts, setReceipts] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState({
    patient_id: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    service_period_start: '',
    service_period_end: '',
    items: [...DEFAULT_ITEMS],
    payment_method: '現金',
    notes: '',
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [recRes, patRes] = await Promise.all([
      supabase.from('receipts').select('*, patients(name, case_number)').order('created_at', { ascending: false }),
      supabase.from('patients').select('id, name, case_number').eq('status', 'active').order('name')
    ])
    setReceipts(recRes.data || [])
    setPatients(patRes.data || [])
    setLoading(false)
  }

  const calcTotal = (items) => items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)

  const updateItem = (idx, field, value) => {
    setForm(p => {
      const items = [...p.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        items[idx].amount = (parseFloat(items[idx].quantity) || 0) * (parseFloat(items[idx].unit_price) || 0)
      }
      return { ...p, items }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const total = calcTotal(form.items)
    const receiptNumber = `R-${Date.now()}`

    const { error } = await supabase.from('receipts').insert([{
      ...form,
      receipt_number: receiptNumber,
      total,
      subtotal: total,
    }])

    if (error) toast.error('新增失敗：' + error.message)
    else { toast.success('收據已建立'); setShowForm(false); fetchData() }
  }

  const handleMarkPaid = async (id) => {
    await supabase.from('receipts').update({ payment_status: 'paid' }).eq('id', id)
    setReceipts(p => p.map(r => r.id === id ? { ...r, payment_status: 'paid' } : r))
    toast.success('已標記為已付款')
  }

  const filtered = receipts.filter(r =>
    !search || r.patients?.name?.includes(search) || r.receipt_number?.includes(search)
  )

  const totalUnpaid = receipts.filter(r => r.payment_status === 'unpaid').reduce((s, r) => s + (r.total || 0), 0)

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt size={24} className="text-purple-600" />
            收據管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            共 {receipts.length} 筆 · 未收款 NT$ {totalUnpaid.toLocaleString()}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> 開立收據
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '本月收據', value: receipts.length, icon: Receipt, color: 'text-purple-600 bg-purple-50' },
          { label: '已收款', value: receipts.filter(r => r.payment_status === 'paid').length, icon: CheckCircle, color: 'text-medical-600 bg-medical-50' },
          { label: '待收款', value: receipts.filter(r => r.payment_status === 'unpaid').length, icon: DollarSign, color: 'text-yellow-600 bg-yellow-50' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3 py-3">
            <div className={`p-2 rounded-xl ${s.color}`}>
              <s.icon size={18} className={s.color.split(' ')[0]} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="form-input pl-9" placeholder="搜尋個案姓名或收據號碼..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <div className="card p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Receipt size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">尚無收據紀錄</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(r => (
                <div key={r.id}>
                  <div
                    className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <div className="flex-shrink-0 p-2 bg-purple-50 rounded-xl">
                      <Receipt size={18} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{r.patients?.name}</span>
                        <span className="text-xs font-mono text-gray-400">{r.receipt_number}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <Calendar size={10} />
                        {r.issue_date}
                        {r.service_period_start && ` · 服務期間 ${r.service_period_start} ~ ${r.service_period_end}`}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-900">NT$ {(r.total || 0).toLocaleString()}</div>
                      <div className="flex items-center gap-2 mt-1 justify-end">
                        <span className={`badge ${r.payment_status === 'paid' ? 'badge-active' : 'bg-yellow-100 text-yellow-800'}`}>
                          {r.payment_status === 'paid' ? '已收款' : '待收款'}
                        </span>
                        {expandedId === r.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {expandedId === r.id && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="mt-3 space-y-2">
                        {(r.items || []).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700">{item.description} × {item.quantity}</span>
                            <span className="font-medium text-gray-900">NT$ {parseFloat(item.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                          <span>合計</span>
                          <span className="text-primary-700">NT$ {(r.total || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {r.notes && <p className="text-xs text-gray-500 mt-2">備註：{r.notes}</p>}
                      <div className="flex gap-2 mt-3">
                        {r.payment_status === 'unpaid' && (
                          <button onClick={() => handleMarkPaid(r.id)} className="btn-success text-xs py-1.5">
                            <CheckCircle size={14} /> 標記已收款
                          </button>
                        )}
                        <button onClick={() => window.print()} className="btn-secondary text-xs py-1.5">
                          <Printer size={14} /> 列印
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="開立收據" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">個案 *</label>
              <select className="form-select" value={form.patient_id} onChange={e => setForm(p => ({...p, patient_id: e.target.value}))} required>
                <option value="">請選擇個案...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.case_number})</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">開立日期</label>
              <input type="date" className="form-input" value={form.issue_date} onChange={e => setForm(p => ({...p, issue_date: e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">付款方式</label>
              <select className="form-select" value={form.payment_method} onChange={e => setForm(p => ({...p, payment_method: e.target.value}))}>
                {['現金', '轉帳', '信用卡', '健保', '長照補助'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">服務起始日</label>
              <input type="date" className="form-input" value={form.service_period_start} onChange={e => setForm(p => ({...p, service_period_start: e.target.value}))} />
            </div>
            <div>
              <label className="form-label">服務結束日</label>
              <input type="date" className="form-input" value={form.service_period_end} onChange={e => setForm(p => ({...p, service_period_end: e.target.value}))} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">費用明細</label>
              <button type="button" onClick={() => setForm(p => ({...p, items: [...p.items, { description: '', quantity: 1, unit_price: 0, amount: 0 }]}))}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                + 新增項目
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 text-sm">
                  <input className="form-input col-span-5 text-xs" placeholder="項目描述" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                  <input type="number" className="form-input col-span-2 text-xs" placeholder="數量" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="1" />
                  <input type="number" className="form-input col-span-3 text-xs" placeholder="單價" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                  <div className="col-span-2 flex items-center justify-end text-xs font-medium text-gray-700 bg-gray-50 rounded-lg px-2">
                    {(parseFloat(item.amount) || 0).toLocaleString()}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-700">合計</span>
                <span className="text-lg font-bold text-primary-700">NT$ {calcTotal(form.items).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">備註</label>
            <input className="form-input" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="其他說明..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">取消</button>
            <button type="submit" className="btn-primary flex-1"><Receipt size={16} /> 開立收據</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
