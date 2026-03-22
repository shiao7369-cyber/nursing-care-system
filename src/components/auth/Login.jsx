import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff, AlertCircle, ChevronRight } from 'lucide-react'
import Spinner from '../ui/Spinner'

export default function Login() {
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', password: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!form.name.trim()) { setError('請輸入姓名'); return }
      const { data: email, error: rpcError } = await supabase.rpc('get_email_by_name', { p_name: form.name.trim() })
      if (rpcError || !email) { setError('找不到此姓名的帳號，請確認姓名是否正確'); return }
      let pwd = form.password
      while (pwd.length < 6) pwd += form.password
      const { error: signInError } = await signIn(email, pwd)
      if (signInError) setError('密碼錯誤，請重新輸入')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">

      {/* ── 全螢幕大樓背景 ── */}
      <img src="/building.png" alt=""
        className="absolute inset-0 w-full h-full object-cover object-center scale-105"
        style={{ filter: 'brightness(0.45)' }} />

      {/* 斜向色帶遮罩 */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(120deg, rgba(21,101,192,0.75) 0%, rgba(0,0,0,0.1) 45%, rgba(245,166,35,0.55) 100%)' }} />

      {/* 左上橘色光暈 */}
      <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: '#F5A623' }} />
      {/* 右下藍色光暈 */}
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: '#1565C0' }} />

      {/* ── 主卡片 ── */}
      <div className="relative z-10 w-full max-w-4xl mx-4 flex rounded-3xl overflow-hidden shadow-2xl"
        style={{ backdropFilter: 'blur(0px)', minHeight: 460 }}>

        {/* 左側品牌區 */}
        <div className="flex flex-col justify-between p-10 w-5/12"
          style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.15)' }}>

          {/* Logo + 名稱 */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <img src="/logo.png" alt="logo"
                className="w-14 h-14 object-contain rounded-xl bg-white p-1.5 shadow-lg"
                onError={e => { e.target.style.display = 'none' }} />
              <div>
                <p className="text-white font-bold text-lg leading-tight">敏盛綜合醫院</p>
                <p className="text-white/60 text-xs tracking-widest">MIN-SHENG GENERAL HOSPITAL</p>
              </div>
            </div>

            {/* 大標語 */}
            <h2 className="text-white text-4xl font-black leading-tight mb-3">
              居家護理<br />
              <span style={{ color: '#F5A623' }}>管理系統</span>
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              整合個案管理、訪視排程<br />路線規劃與收據開立
            </p>
          </div>

          {/* 底部標語 */}
          <div className="space-y-3">
            {[['🤝', '誠信'], ['🩺', '專業'], ['⭐', '價值']].map(([emoji, w]) => (
              <div key={w} className="flex items-center gap-3">
                <span className="text-3xl leading-none drop-shadow-lg">{emoji}</span>
                <span className="text-white font-black text-2xl tracking-widest drop-shadow-lg"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)', letterSpacing: '0.15em' }}>{w}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
              </div>
            ))}
          </div>
        </div>

        {/* 右側登入區 */}
        <div className="flex-1 flex flex-col justify-center p-10"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(30px)' }}>

          <div className="max-w-xs w-full mx-auto">
            <h3 className="text-2xl font-black text-gray-800 mb-1">歡迎登入</h3>
            <p className="text-gray-400 text-sm mb-8">請輸入您的姓名與密碼</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 姓名 */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">姓名</label>
                <input
                  type="text"
                  className="w-full px-4 py-3.5 rounded-2xl border-2 text-sm font-medium transition-all focus:outline-none"
                  style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}
                  onFocus={e => e.target.style.borderColor = '#F5A623'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  placeholder="請輸入您的姓名"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required autoFocus
                />
              </div>

              {/* 密碼 */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">密碼</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-4 py-3.5 pr-12 rounded-2xl border-2 text-sm font-medium transition-all focus:outline-none"
                    style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}
                    onFocus={e => e.target.style.borderColor = '#F5A623'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                    placeholder="輸入密碼"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 ml-1">初始密碼與姓名相同，登入後可自行更改</p>
              </div>

              {/* 錯誤 */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs bg-red-50 text-red-600 border border-red-100">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* 登入按鈕 */}
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: loading ? '#ccc' : 'linear-gradient(135deg, #F5A623 0%, #F08000 60%, #E65100 100%)' }}>
                {loading ? <Spinner size="sm" /> : null}
                {loading ? '登入中...' : '登入系統'}
                {!loading && <ChevronRight size={16} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 底部版權 */}
      <p className="absolute bottom-4 left-0 right-0 text-center text-white/40 text-xs">
        敏盛綜合醫院居家護理所 &copy; {new Date().getFullYear()} ・ v1.0.0
      </p>
    </div>
  )
}
