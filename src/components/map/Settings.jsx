import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import {
  Settings, User, Lock, Database, Info, Save,
  Users, Plus, Key, Shield, Trash2, Edit, Eye, EyeOff
} from 'lucide-react'

const ROLE_LABELS = { admin: '管理員', nurse: '護理師', consultant: '顧問護理師' }
const ROLE_COLORS = { admin: 'bg-red-100 text-red-700', nurse: 'bg-primary-100 text-primary-700', consultant: 'bg-purple-100 text-purple-700' }

export default function SettingsPage() {
  const { profile, updateProfile } = useAuth()
  const toast = useToast()
  const isAdmin = profile?.role === 'admin'

  // --- 個人資料 ---
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    license_number: profile?.license_number || '',
  })

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await updateProfile(form)
    setSaving(false)
    if (error) toast.error('更新失敗：' + error.message)
    else toast.success('個人資料已更新')
  }

  // --- 修改密碼 ---
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleChangePw = async (e) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { toast.error('兩次密碼不一致'); return }
    if (!pwForm.next) { toast.error('請輸入新密碼'); return }
    let padded = pwForm.next
    while (padded.length < 6) padded += pwForm.next
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: padded })
    setPwLoading(false)
    if (error) toast.error('密碼修改失敗：' + error.message)
    else { toast.success('密碼已更新'); setPwForm({ current: '', next: '', confirm: '' }) }
  }

  // --- 使用者管理（管理員專用）---
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showResetPw, setShowResetPw] = useState(null) // user object
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'nurse', phone: '', license_number: '' })
  const [resetPw, setResetPw] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const callAdminFn = async (body) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body)
    })
    return res.json()
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    const result = await callAdminFn({ action: 'list' })
    setUsersLoading(false)
    if (result.error) toast.error(result.error)
    else setUsers(result.users || [])
  }

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin])

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!newUser.full_name) {
      toast.error('請填寫姓名'); return
    }
    const rawPwd = newUser.password || newUser.full_name
    // 若不足 6 字元則重複名字補齊（Supabase 最低限制）
    let pwd = rawPwd
    while (pwd.length < 6) pwd += rawPwd
    // 若未填信箱，自動以時間戳記產生 ASCII 信箱
    const autoEmail = newUser.email || `user_${Date.now()}@nursing.local`
    setActionLoading(true)
    const result = await callAdminFn({ action: 'create', ...newUser, email: autoEmail, password: pwd })
    setActionLoading(false)
    if (result.error) toast.error('新增失敗：' + result.error)
    else {
      toast.success(`使用者「${newUser.full_name}」已新增`)
      setShowAddUser(false)
      setNewUser({ email: '', password: '', full_name: '', role: 'nurse', phone: '', license_number: '' })
      fetchUsers()
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetPw) { toast.error('請輸入密碼'); return }
    let padded = resetPw
    while (padded.length < 6) padded += resetPw
    setActionLoading(true)
    const result = await callAdminFn({ action: 'update_password', user_id: showResetPw.id, password: padded })
    setActionLoading(false)
    if (result.error) toast.error('重設失敗：' + result.error)
    else { toast.success(`「${showResetPw.full_name}」密碼已重設`); setShowResetPw(null); setResetPw('') }
  }

  const handleUpdateRole = async (userId, role, name) => {
    const result = await callAdminFn({ action: 'update_role', user_id: userId, role })
    if (result.error) toast.error(result.error)
    else { toast.success(`「${name}」角色已更新`); fetchUsers() }
  }

  const handleDeleteUser = async (userId, name) => {
    if (!confirm(`確定要刪除使用者「${name}」嗎？此操作無法復原。`)) return
    const result = await callAdminFn({ action: 'delete', user_id: userId })
    if (result.error) toast.error(result.error)
    else { toast.success(`「${name}」已刪除`); fetchUsers() }
  }

  return (
    <div className="space-y-5 fade-in max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Settings size={24} className="text-gray-600" />
        系統設定
      </h1>

      {/* 個人資料 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User size={18} className="text-primary-600" />
          個人資料
        </h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-2xl font-bold text-primary-700">
              {form.full_name?.[0] || profile?.email?.[0]?.toUpperCase() || 'N'}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{form.full_name || '護理師'}</div>
              <div className="text-sm text-gray-500">{profile?.email}</div>
              <div className={`text-xs mt-1 inline-flex px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[profile?.role] || 'bg-gray-100 text-gray-600'}`}>
                <Shield size={10} className="mr-1 mt-0.5" />
                {ROLE_LABELS[profile?.role] || '護理師'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">姓名</label>
              <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">電話</label>
              <input type="tel" className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0912345678" />
            </div>
            <div>
              <label className="form-label">護理師執照號碼</label>
              <input className="form-input" value={form.license_number} onChange={e => setForm(p => ({ ...p, license_number: e.target.value }))} placeholder="執照字號" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : <Save size={16} />}
            儲存變更
          </button>
        </form>
      </div>

      {/* 修改密碼 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock size={18} className="text-primary-600" />
          修改密碼
        </h2>
        <form onSubmit={handleChangePw} className="space-y-4">
          <div className="relative">
            <label className="form-label">新密碼</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="form-input pr-10"
              value={pwForm.next}
              onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
              placeholder="輸入新密碼"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div>
            <label className="form-label">確認新密碼</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="form-input"
              value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              placeholder="再次輸入新密碼"
            />
          </div>
          <button type="submit" disabled={pwLoading || !pwForm.next} className="btn-primary">
            {pwLoading ? <Spinner size="sm" /> : <Key size={16} />}
            更新密碼
          </button>
        </form>
      </div>

      {/* 使用者管理（管理員專用）*/}
      {isAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users size={18} className="text-primary-600" />
              使用者管理
            </h2>
            <button onClick={() => setShowAddUser(true)} className="btn-primary text-sm py-1.5">
              <Plus size={15} /> 新增使用者
            </button>
          </div>

          {/* 統計列 */}
          {!usersLoading && users.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: '全部帳號', count: users.length, color: 'bg-primary-50 text-primary-700 border-primary-100' },
                { label: '護理師', count: users.filter(u => u.role === 'nurse' || !u.role).length, color: 'bg-medical-50 text-medical-700 border-medical-100' },
                { label: '管理員', count: users.filter(u => u.role === 'admin').length, color: 'bg-red-50 text-red-700 border-red-100' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
                  <div className="text-2xl font-bold">{s.count}</div>
                  <div className="text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {usersLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map(u => (
                <div key={u.id} className={`rounded-xl border p-4 flex flex-col gap-3 transition-all hover:shadow-sm ${u.id === profile?.id ? 'border-primary-200 bg-primary-50/40' : 'border-gray-100 bg-gray-50'}`}>
                  {/* 頭部：頭像 + 姓名 + 角色 */}
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                      u.role === 'admin' ? 'bg-red-100 text-red-700' :
                      u.role === 'consultant' ? 'bg-purple-100 text-purple-700' :
                      'bg-primary-100 text-primary-700'
                    }`}>
                      {u.full_name?.[0] || u.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {u.full_name || '（未設定姓名）'}
                        {u.id === profile?.id && <span className="ml-1 text-xs text-primary-500">（我）</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{u.email}</div>
                    </div>
                  </div>

                  {/* 角色選擇 */}
                  <select
                    value={u.role || 'nurse'}
                    onChange={e => handleUpdateRole(u.id, e.target.value, u.full_name)}
                    disabled={u.id === profile?.id}
                    className={`text-xs rounded-lg px-2 py-1.5 border w-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                  >
                    <option value="nurse">護理師</option>
                    <option value="consultant">顧問護理師</option>
                    <option value="admin">管理員</option>
                  </select>

                  {/* 操作按鈕 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowResetPw(u); setResetPw('') }}
                      className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
                    >
                      <Key size={12} /> 重設密碼
                    </button>
                    {u.id !== profile?.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.full_name)}
                      className="flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={12} /> 刪除
                    </button>
                  )}
                </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">目前沒有其他使用者</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 系統資訊 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Info size={18} className="text-gray-500" />
          關於系統
        </h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between"><span>系統版本</span><span className="font-medium">1.0.0</span></div>
          <div className="flex justify-between"><span>技術架構</span><span className="font-medium">React + Supabase + Leaflet</span></div>
          <div className="flex justify-between"><span>適用機構</span><span className="font-medium">居家護理所</span></div>
          <div className="flex justify-between"><span>資料隔離</span><span className="font-medium text-green-600">每位護理師獨立管理</span></div>
        </div>
      </div>

      {/* 新增使用者 Modal */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="新增使用者" size="md">
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">姓名 *</label>
              <input className="form-input" value={newUser.full_name}
                onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value, password: e.target.value }))}
                placeholder="護理師姓名" />
            </div>
            <div>
              <label className="form-label">角色</label>
              <select className="form-select" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                <option value="nurse">護理師</option>
                <option value="consultant">顧問護理師</option>
                <option value="admin">管理員</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">登入信箱 <span className="text-gray-400 font-normal">（選填，未填自動產生）</span></label>
            <input type="email" className="form-input" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="留空則自動以姓名產生" />
          </div>
          <div>
            <label className="form-label">初始密碼（預設同姓名，可自行修改）</label>
            <input type="text" className="form-input" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="初始密碼" />
            <p className="text-xs text-gray-400 mt-1">使用者登入後可至「系統設定」自行更改密碼</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">電話</label>
              <input className="form-input" value={newUser.phone} onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))} placeholder="0912345678" />
            </div>
            <div>
              <label className="form-label">執照號碼</label>
              <input className="form-input" value={newUser.license_number} onChange={e => setNewUser(p => ({ ...p, license_number: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary">取消</button>
            <button type="submit" disabled={actionLoading} className="btn-primary">
              {actionLoading ? <Spinner size="sm" /> : <Plus size={16} />}
              新增使用者
            </button>
          </div>
        </form>
      </Modal>

      {/* 重設密碼 Modal */}
      <Modal isOpen={!!showResetPw} onClose={() => setShowResetPw(null)} title={`重設「${showResetPw?.full_name}」的密碼`} size="sm">
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="form-label">新密碼（至少 6 個字元）</label>
            <input type="text" className="form-input" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="輸入新密碼" autoFocus />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowResetPw(null)} className="btn-secondary">取消</button>
            <button type="submit" disabled={actionLoading || resetPw.length < 6} className="btn-primary">
              {actionLoading ? <Spinner size="sm" /> : <Key size={16} />}
              確認重設
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
