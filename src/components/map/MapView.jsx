import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { PageLoader } from '../ui/Spinner'
import {
  Map, Navigation, Phone, MapPin, RefreshCw,
  Route, Layers, X, ChevronUp, ChevronDown, Wand2, Calendar, Sun, Moon
} from 'lucide-react'

import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Circle, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const createIcon = (color, label) => L.divIcon({
  html: `<div style="background:${color};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-weight:bold;font-size:11px;">${label ?? ''}</span></div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
})

const gpsIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#2563eb;border-radius:50%;border:4px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3),0 2px 8px rgba(0,0,0,0.3);"></div>`,
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
})

function haversine([lat1, lng1], [lat2, lng2]) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 最近鄰居法由遠到近，有時間限制者依時間固定位置
function optimizeRoute(start, patients) {
  if (!patients.length) return []
  const fixed = [...patients].filter(p => p._visitTime).sort((a, b) => a._visitTime.localeCompare(b._visitTime))
  const free = [...patients].filter(p => !p._visitTime)
  let current = start
  const ordered = []
  let remaining = [...free]
  if (remaining.length) {
    remaining.sort((a, b) => haversine(current, [b.address_lat, b.address_lng]) - haversine(current, [a.address_lat, a.address_lng]))
    const far = remaining.shift()
    ordered.push(far)
    current = [far.address_lat, far.address_lng]
  }
  while (remaining.length) {
    remaining.sort((a, b) => haversine(current, [a.address_lat, a.address_lng]) - haversine(current, [b.address_lat, b.address_lng]))
    const next = remaining.shift()
    ordered.push(next)
    current = [next.address_lat, next.address_lng]
  }
  // 將 fixed 依時間穿插進 ordered
  const result = []
  let fi = 0
  const freeQueue = [...ordered]
  while (result.length < patients.length) {
    if (fi < fixed.length && (freeQueue.length === 0 || result.length === fi)) {
      result.push(fixed[fi++])
    } else if (freeQueue.length) {
      result.push(freeQueue.shift())
    } else {
      result.push(fixed[fi++])
    }
  }
  return result
}

function GPSTracker({ position, setPosition }) {
  const map = useMap()
  const watchRef = useRef(null)
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return
    watchRef.current = navigator.geolocation.watchPosition(
      pos => setPosition({ latlng: [pos.coords.latitude, pos.coords.longitude], accuracy: pos.coords.accuracy }),
      () => {}, { enableHighAccuracy: true, maximumAge: 3000 }
    )
  }, [setPosition])
  useEffect(() => {
    startTracking()
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current) }
  }, [startTracking])
  return (
    <button onClick={() => position && map.flyTo(position.latlng, 15, { animate: true })}
      className="leaflet-control absolute bottom-4 right-4 z-[1000] bg-white shadow-lg rounded-xl p-3 text-primary-600 hover:bg-primary-50 border border-gray-200 transition-colors" title="定位至目前位置">
      <Navigation size={20} />
    </button>
  )
}

function FlyTo({ flyTo, zoom }) {
  const map = useMap()
  useEffect(() => { if (flyTo?.center) map.flyTo(flyTo.center, zoom || 15, { animate: true }) }, [flyTo])
  return null
}

const toDateStr = (d) => d.toISOString().slice(0, 10)

// 敏盛綜合醫院固定座標（桃園市桃園區經國路168號）
const HOSPITAL_LATLNG = [25.0169, 121.3054]
const HOSPITAL_NAME = '敏盛綜合醫院'

export default function MapView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const [patients, setPatients] = useState([])
  const [schedules, setSchedules] = useState([]) // 選定日期的排程
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [gpsPosition, setGpsPosition] = useState(null)
  const [mapCenter, setMapCenter] = useState([24.99, 121.31])
  const [flyTo, setFlyTo] = useState(null) // { center, ts } 用 ts 強制觸發
  const [routeOrder, setRouteOrder] = useState([])
  const [routeETA, setRouteETA] = useState([]) // [{ duration, distanceKm, arrivalTime }]
  const [etaLoading, setEtaLoading] = useState(false)
  const [showPanel, setShowPanel] = useState(true)
  const [mapTile, setMapTile] = useState('street')
  const [routeStart, setRouteStart] = useState('hospital') // 'hospital' | 'gps'
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState('')
  const [tab, setTab] = useState('all') // 'am' | 'pm' | 'all'
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  // 從個案詳情頁跳轉過來時，自動聚焦該個案
  useEffect(() => {
    const focusId = searchParams.get('focus')
    if (focusId && patients.length > 0) {
      const p = patients.find(pt => pt.id === focusId)
      if (p?.address_lat && p?.address_lng) {
        setFlyTo({ center: [p.address_lat, p.address_lng], ts: Date.now() })
        setTab('all')
      }
    }
  }, [searchParams, patients])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setMapCenter([pos.coords.latitude, pos.coords.longitude]); setGpsPosition({ latlng: [pos.coords.latitude, pos.coords.longitude], accuracy: pos.coords.accuracy }) },
        () => {}
      )
    }
  }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: pts }, { data: scheds }] = await Promise.all([
      supabase.from('patients').select('id, name, case_number, phone, address, address_lat, address_lng, status').neq('status', 'discharged').order('name'),
      supabase.from('visit_schedules').select('patient_id, scheduled_date, notes, scheduled_time').eq('scheduled_date', selectedDate),
    ])
    setPatients(pts || [])
    setSchedules(scheds || [])
    setLoading(false)
    setSelected([])
    setRouteOrder([])
  }

  // 排程 map
  const scheduleMap = {}
  schedules.forEach(s => {
    scheduleMap[s.patient_id] = s
  })
  const scheduledIds = new Set(schedules.map(s => s.patient_id))

  const mappedPatients = patients.filter(p => p.address_lat && p.address_lng)
  const unmappedPatients = patients.filter(p => !p.address_lat || !p.address_lng)

  // 有排程且有座標的個案
  const scheduledMapped = mappedPatients.filter(p => scheduledIds.has(p.id))

  // 分上午/下午
  const getHour = (pid) => {
    const t = scheduleMap[pid]?.scheduled_time
    if (!t) return null
    return parseInt(t.slice(0, 2), 10)
  }
  const amPatients = scheduledMapped.filter(p => { const h = getHour(p.id); return h !== null && h < 12 })
  const pmPatients = scheduledMapped.filter(p => { const h = getHour(p.id); return h !== null && h >= 12 })
  const noTimePatients = scheduledMapped.filter(p => getHour(p.id) === null)

  const panelList = tab === 'am' ? [...amPatients, ...noTimePatients] :
                    tab === 'pm' ? [...pmPatients, ...noTimePatients] :
                    scheduledMapped

  const toggleSelect = (patient) => {
    setSelected(prev => {
      const isIn = prev.find(p => p.id === patient.id)
      if (isIn) { setRouteOrder(ro => ro.filter(id => id !== patient.id)); return prev.filter(p => p.id !== patient.id) }
      setRouteOrder(ro => [...ro, patient.id])
      return [...prev, patient]
    })
  }

  const moveRoute = (id, dir) => {
    setRouteOrder(prev => {
      const idx = prev.indexOf(id); const next = [...prev]
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  const handleAutoRoute = (subset) => {
    // 先清除舊路徑，避免重複
    setSelected([])
    setRouteOrder([])
    const targets = subset || scheduledMapped
    if (!targets.length) { toast.error('沒有已設定座標的訪視個案'); return }
    const start = routeStart === 'hospital' ? HOSPITAL_LATLNG : (gpsPosition?.latlng || HOSPITAL_LATLNG)
    const withTime = targets.map(p => ({
      ...p,
      _visitTime: scheduleMap[p.id]?.scheduled_time || null
    }))
    const ordered = optimizeRoute(start, withTime)
    setSelected(ordered)
    setRouteOrder(ordered.map(p => p.id))
    setRouteETA([])
    toast.success(`已規劃 ${ordered.length} 位個案的最佳路徑`)
    if (ordered.length > 0) {
      const mid = ordered[Math.floor(ordered.length / 2)]
      setFlyTo({ center: [mid.address_lat, mid.address_lng], ts: Date.now() })
      // 計算各站 ETA
      calcETA(ordered, start)
    }
  }

  // 呼叫 Mapbox Directions API 計算各站行車時間與預估到達時間
  const calcETA = async (orderedPatients, startLatlng) => {
    if (orderedPatients.length === 0) return
    setEtaLoading(true)
    const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
    try {
      // 組合座標字串：起點 + 各站 (lng,lat 格式)
      const coords = [
        `${startLatlng[1]},${startLatlng[0]}`,
        ...orderedPatients.map(p => `${p.address_lng},${p.address_lat}`)
      ].join(';')

      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${TOKEN}&language=zh&overview=false`
      )
      if (!res.ok) { setEtaLoading(false); return }
      const data = await res.json()
      const legs = data?.routes?.[0]?.legs || []

      // 計算各站的累積到達時間
      // 從現在時間（或第一個有排程時間的個案）作基準
      const now = new Date()
      let baseMs = now.getTime()

      const eta = []
      let cumSec = 0
      for (let i = 0; i < orderedPatients.length; i++) {
        const leg = legs[i]
        if (leg) cumSec += leg.duration // 秒
        const arrivalMs = baseMs + cumSec * 1000
        const arrivalDate = new Date(arrivalMs)
        const hh = String(arrivalDate.getHours()).padStart(2, '0')
        const mm = String(arrivalDate.getMinutes()).padStart(2, '0')
        const distKm = leg ? (leg.distance / 1000).toFixed(1) : null
        const durMin = leg ? Math.round(leg.duration / 60) : null
        eta.push({ arrivalTime: `${hh}:${mm}`, distanceKm: distKm, durationMin: durMin })

        // 若有排程時間，下一段從排程時間 + 30分鐘（預設訪視時長）開始算
        const sched = scheduleMap[orderedPatients[i].id]
        if (sched?.scheduled_time) {
          const [sh, sm] = sched.scheduled_time.split(':').map(Number)
          const schedMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0).getTime()
          // 取較晚者（不可早於排程時間）
          const visitEndMs = Math.max(arrivalMs, schedMs) + 30 * 60 * 1000
          baseMs = visitEndMs
          cumSec = 0
        } else {
          baseMs = arrivalMs + 30 * 60 * 1000 // 預設停留 30 分鐘
          cumSec = 0
        }
      }
      setRouteETA(eta)
    } catch (e) {
      console.error('Directions API error:', e)
    }
    setEtaLoading(false)
  }

  const handleBatchGeocode = async (forceAll = false) => {
    const targets = (forceAll ? patients : unmappedPatients).filter(p => p.address)
    if (!targets.length) { toast.error('沒有可處理的地址'); return }
    setGeocoding(true)
    const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
    let ok = 0
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      setGeocodeProgress(`${i + 1}/${targets.length} ${p.name}`)
      try {
        const prox = gpsPosition ? `${gpsPosition.latlng[1]},${gpsPosition.latlng[0]}` : '121.31,24.99'
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(p.address)}.json?country=TW&language=zh&limit=1&bbox=121.0,24.65,121.45,25.15&proximity=${prox}&access_token=${TOKEN}`)
        if (res.ok) {
          const d = await res.json()
          if (d?.features?.length > 0) {
            const [lng, lat] = d.features[0].center
            await supabase.from('patients').update({ address_lat: lat, address_lng: lng }).eq('id', p.id)
            setPatients(prev => prev.map(pt => pt.id === p.id ? { ...pt, address_lat: lat, address_lng: lng } : pt))
            ok++
          }
        }
      } catch (_) {}
    }
    setGeocoding(false); setGeocodeProgress('')
    toast.success(`完成：${ok}/${targets.length} 筆取得座標`)
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('居護所系統', { body: `${ok}/${targets.length} 位個案已取得地址座標`, icon: '/logo.png' })
  }

  const routePoints = routeOrder
    .map(id => { const p = patients.find(pt => pt.id === id); return p?.address_lat ? [p.address_lat, p.address_lng] : null })
    .filter(Boolean)
  if (gpsPosition?.latlng && routePoints.length > 0) routePoints.unshift(gpsPosition.latlng)

  const isToday = selectedDate === toDateStr(new Date())

  const tileUrls = {
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  }

  return (
    <div className="fade-in h-[calc(100vh-2rem)] -mx-6 -my-6 flex overflow-hidden">
      {/* ── 左側面板 ── */}
      <div className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${showPanel ? 'w-80' : 'w-0 overflow-hidden'} flex-shrink-0`}>

        {/* 標題 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
            <Map size={16} className="text-primary-600" /> 訪視地圖
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400" title="重新整理"><RefreshCw size={14} /></button>
            <button onClick={() => setShowPanel(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400"><X size={16} /></button>
          </div>
        </div>

        {/* 日期選擇器 */}
        <div className="px-3 py-2.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-primary-600 flex-shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {!isToday && (
              <button onClick={() => setSelectedDate(toDateStr(new Date()))}
                className="text-xs px-2 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 font-medium whitespace-nowrap">
                今天
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"/>{amPatients.length} 上午</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-400"/>{pmPatients.length} 下午</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-400"/>{noTimePatients.length} 未定時</span>
            <span className="ml-auto font-medium text-gray-700">共 {scheduledMapped.length} 位</span>
          </div>
        </div>

        {/* 上午/下午/全部 Tab */}
        <div className="flex border-b border-gray-100 text-xs font-semibold">
          {[
            { key: 'all', label: `全部（${scheduledMapped.length}）`, icon: null },
            { key: 'am', label: `上午（${amPatients.length}）`, icon: <Sun size={11} /> },
            { key: 'pm', label: `下午（${pmPatients.length}）`, icon: <Moon size={11} /> },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 flex items-center justify-center gap-1 transition-colors ${
                tab === t.key ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* 自動規劃路徑 */}
        <div className="px-3 py-2 border-b border-gray-100 space-y-2">
          {/* 起點選擇 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 flex-shrink-0">起點：</span>
            <div className="flex flex-1 gap-1">
              <button onClick={() => setRouteStart('hospital')}
                className={`flex-1 py-1 rounded-lg font-medium transition-colors ${routeStart === 'hospital' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                🏥 {HOSPITAL_NAME}
              </button>
              <button onClick={() => setRouteStart('gps')}
                className={`flex-1 py-1 rounded-lg font-medium transition-colors ${routeStart === 'gps' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                📍 目前位置
              </button>
            </div>
          </div>
          <button onClick={() => handleAutoRoute(panelList)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white text-sm font-semibold shadow transition-all">
            <Wand2 size={15} />
            {tab === 'am' ? '規劃上午路徑' : tab === 'pm' ? '規劃下午路徑' : '自動規劃最佳路徑'}
          </button>
          <p className="text-xs text-gray-400 text-center">由遠到近 · 有時間限制者依時間排序</p>
        </div>

        {/* 個案列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><PageLoader /></div>
          ) : (
            <div className="p-2 space-y-1">
              {panelList.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">
                  {scheduledMapped.length === 0 ? '此日期沒有訪視排程' : '此時段沒有排程'}
                </div>
              )}

              {/* 上午區塊 */}
              {tab === 'all' && amPatients.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-orange-600">
                    <Sun size={11} /> 上午
                  </div>
                  {amPatients.map(p => <PatientRow key={p.id} p={p} scheduleMap={scheduleMap} selected={selected} routeOrder={routeOrder} toggleSelect={toggleSelect} setFlyTo={setFlyTo} color="orange" />)}
                </div>
              )}

              {/* 下午區塊 */}
              {tab === 'all' && pmPatients.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-indigo-600">
                    <Moon size={11} /> 下午
                  </div>
                  {pmPatients.map(p => <PatientRow key={p.id} p={p} scheduleMap={scheduleMap} selected={selected} routeOrder={routeOrder} toggleSelect={toggleSelect} setFlyTo={setFlyTo} color="indigo" />)}
                </div>
              )}

              {/* 未定時 */}
              {tab === 'all' && noTimePatients.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-1 text-xs font-bold text-gray-400">未定時</div>
                  {noTimePatients.map(p => <PatientRow key={p.id} p={p} scheduleMap={scheduleMap} selected={selected} routeOrder={routeOrder} toggleSelect={toggleSelect} setFlyTo={setFlyTo} color="gray" />)}
                </div>
              )}

              {/* 單一 tab 列表 */}
              {tab !== 'all' && panelList.map(p =>
                <PatientRow key={p.id} p={p} scheduleMap={scheduleMap} selected={selected} routeOrder={routeOrder} toggleSelect={toggleSelect} setFlyTo={setFlyTo} color={tab === 'am' ? 'orange' : 'indigo'} />
              )}

              {/* 未設座標 */}
              {unmappedPatients.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between px-2 mb-1">
                    <p className="text-xs text-gray-400">未設定座標（{unmappedPatients.length}位）</p>
                    <div className="flex gap-1">
                      <button onClick={() => handleBatchGeocode(false)} disabled={geocoding}
                        className="text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50 font-medium">
                        {geocoding ? geocodeProgress : '補齊座標'}
                      </button>
                      <button onClick={() => handleBatchGeocode(true)} disabled={geocoding}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 font-medium"
                        title="重新取得全部個案座標（含已有座標者）">
                        重新全取
                      </button>
                    </div>
                  </div>
                  {unmappedPatients.filter(p => scheduledIds.has(p.id)).map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg opacity-70 cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/patients/${p.id}`)}>
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-500 flex-shrink-0">{p.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600">{p.name}</div>
                        <div className="text-xs text-red-400">需設定地址座標</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 路徑順序 */}
        {routeOrder.length > 0 && (
          <div className="border-t border-gray-200 p-3 max-h-52 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Route size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-gray-700">訪視順序（{routeOrder.length}站）</span>
              {etaLoading && <span className="text-xs text-gray-400 animate-pulse">計算行程中...</span>}
              <button onClick={() => { setSelected([]); setRouteOrder([]); setRouteETA([]) }} className="ml-auto text-xs text-gray-400 hover:text-red-500">清除</button>
            </div>

            {/* 起點 */}
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 bg-blue-50 rounded-lg">
              <span className="text-base">🏥</span>
              <span className="text-xs font-medium text-blue-700 flex-1">{routeStart === 'hospital' ? HOSPITAL_NAME : '目前位置'}</span>
              <span className="text-xs text-blue-500">出發點</span>
            </div>

            <div className="space-y-1">
              {routeOrder.map((id, idx) => {
                const p = patients.find(pt => pt.id === id)
                if (!p) return null
                const t = scheduleMap[id]?.scheduled_time
                const eta = routeETA[idx]
                return (
                  <div key={id} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</span>
                      <span className="text-xs font-medium text-gray-700 flex-1">{p.name}</span>
                      {t && <span className="text-xs text-orange-500 font-medium">{t.slice(0, 5)}</span>}
                      <div className="flex gap-0.5">
                        <button onClick={() => moveRoute(id, 'up')} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-30"><ChevronUp size={14} /></button>
                        <button onClick={() => moveRoute(id, 'down')} disabled={idx === routeOrder.length - 1} className="p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-30"><ChevronDown size={14} /></button>
                      </div>
                    </div>
                    {eta && (
                      <div className="flex items-center gap-3 mt-1 pl-7 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <span>🚗</span> {eta.durationMin} 分鐘
                        </span>
                        <span className="flex items-center gap-0.5">
                          <span>📍</span> {eta.distanceKm} km
                        </span>
                        <span className="flex items-center gap-0.5 text-primary-600 font-medium">
                          <span>🕐</span> 預估 {eta.arrivalTime} 抵達
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 地圖 ── */}
      <div className="flex-1 relative">
        {!showPanel && (
          <button onClick={() => setShowPanel(true)}
            className="absolute top-4 left-4 z-[1000] bg-white shadow-lg rounded-xl px-3 py-2 text-primary-600 hover:bg-primary-50 border border-gray-200 transition-colors flex items-center gap-2 text-sm font-medium">
            <Map size={16} /> 個案列表
          </button>
        )}

        <div className="absolute top-4 right-4 z-[1000] flex gap-2">
          <button onClick={() => setMapTile(t => t === 'street' ? 'satellite' : 'street')}
            className="bg-white shadow-lg rounded-xl px-3 py-2 text-gray-600 hover:bg-gray-50 border border-gray-200 transition-colors text-xs font-medium flex items-center gap-1">
            <Layers size={14} /> {mapTile === 'street' ? '衛星圖' : '街道圖'}
          </button>
        </div>

        <MapContainer center={mapCenter} zoom={13} className="w-full h-full" zoomControl={true}>
          <TileLayer url={tileUrls[mapTile]} attribution='&copy; OpenStreetMap contributors' maxZoom={19} />
          {flyTo && <FlyTo flyTo={flyTo} zoom={15} />}

          {/* 醫院起點標記（固定，不可移動） */}
          <Marker
            position={HOSPITAL_LATLNG}
            icon={L.divIcon({
              html: `<div style="background:#0369a1;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;">🏥</div>`,
              className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
            })}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.95} permanent={false}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>🏥 {HOSPITAL_NAME}</span>
            </Tooltip>
            <Popup>
              <div className="text-sm font-bold text-primary-700">{HOSPITAL_NAME}</div>
              <div className="text-xs text-gray-500 mt-1">路徑起點</div>
            </Popup>
          </Marker>

          {gpsPosition && (
            <>
              <Marker position={gpsPosition.latlng} icon={gpsIcon}>
                <Popup><div className="text-sm font-medium text-primary-700">📍 目前位置</div><div className="text-xs text-gray-500">精確度: {Math.round(gpsPosition.accuracy)}m</div></Popup>
              </Marker>
              <Circle center={gpsPosition.latlng} radius={gpsPosition.accuracy} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.1, weight: 1 }} />
            </>
          )}

          {/* 所有有座標的個案 */}
          {mappedPatients.map(p => {
            const isSelected = !!selected.find(s => s.id === p.id)
            const sched = scheduleMap[p.id]
            const h = getHour(p.id)
            const orderNum = routeOrder.indexOf(p.id) + 1

            // 顏色：已選=深紅, 上午排程=橘, 下午排程=靛, 無排程=灰
            const color = isSelected ? '#b91c1c'
              : sched ? (h !== null && h < 12 ? '#f97316' : h !== null ? '#6366f1' : '#ef4444')
              : '#d1d5db'
            const icon = createIcon(color, isSelected ? orderNum : '')

            return (
              <Marker
                key={p.id}
                position={[p.address_lat, p.address_lng]}
                icon={icon}
                draggable={true}
                eventHandlers={{
                  dragend: async (e) => {
                    const { lat, lng } = e.target.getLatLng()
                    await supabase.from('patients').update({ address_lat: lat, address_lng: lng }).eq('id', p.id)
                    setPatients(prev => prev.map(pt => pt.id === p.id ? { ...pt, address_lat: lat, address_lng: lng } : pt))
                    toast.success(`${p.name} 座標已更新`)
                  }
                }}
              >
                <Tooltip direction="top" offset={[0, -30]} opacity={0.95}>
                  <div style={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: '#111' }}>
                    {orderNum > 0 && <span style={{ color: '#b91c1c', marginRight: 4 }}>#{orderNum}</span>}
                    {p.name}
                    {sched?.scheduled_time && (
                      <span style={{ color: h !== null && h < 12 ? '#f97316' : '#6366f1', marginLeft: 6, fontWeight: 400, fontSize: '12px' }}>
                        {sched.scheduled_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                </Tooltip>
                <Popup minWidth={200}>
                  <div className="space-y-2 py-1">
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center gap-1 flex-wrap">
                        {p.name}
                        {sched && <span className={`text-xs px-1.5 py-0.5 rounded-full ${h !== null && h < 12 ? 'bg-orange-100 text-orange-600' : h !== null ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'}`}>
                          {h !== null && h < 12 ? '上午' : h !== null ? '下午' : '今日訪視'}
                          {sched.scheduled_time ? ` ${sched.scheduled_time.slice(0,5)}` : ''}
                        </span>}
                      </div>
                      <div className="text-xs text-gray-500">{p.case_number}</div>
                    </div>
                    <div className="text-xs text-orange-500 font-medium">⟵ 可直接拖動 Pin 調整位置</div>
                    <div className="text-xs text-gray-600 flex items-start gap-1">
                      <MapPin size={12} className="flex-shrink-0 mt-0.5 text-gray-400" />{p.address}
                    </div>
                    {sched?.notes && <div className="text-xs text-gray-500">📝 {sched.notes}</div>}
                    {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Phone size={12} /> {p.phone}</a>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => toggleSelect(p)}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${isSelected ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                        {isSelected ? '移除路徑' : '加入路徑'}
                      </button>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.address_lat},${p.address_lng}&travelmode=driving`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-xs py-1.5 rounded-lg font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 text-center">導航</a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {routePoints.length > 1 && (
            <Polyline positions={routePoints} pathOptions={{ color: '#ef4444', weight: 3, opacity: 0.75, dashArray: '8 5' }} />
          )}

          <GPSTracker position={gpsPosition} setPosition={setGpsPosition} />
        </MapContainer>

        {/* 底部統計 */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm shadow-lg rounded-xl px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-400"/> 上午 {amPatients.length}</span>
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-indigo-400"/> 下午 {pmPatients.length}</span>
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-gray-300"/> 全 {mappedPatients.length}</span>
            {routeOrder.length > 0 && <span className="flex items-center gap-1 text-red-600 font-medium"><Route size={10} /> {routeOrder.length} 站</span>}
            {gpsPosition && <span className="flex items-center gap-1 text-primary-600"><Navigation size={10} /> GPS</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// 獨立出個案列表列
function PatientRow({ p, scheduleMap, selected, routeOrder, toggleSelect, setFlyTo, color }) {
  const isSelected = !!selected.find(s => s.id === p.id)
  const orderNum = routeOrder.indexOf(p.id) + 1
  const sched = scheduleMap[p.id]
  const t = sched?.scheduled_time

  const avatarBg = isSelected ? 'bg-red-500 text-white' :
    color === 'orange' ? 'bg-orange-100 text-orange-600' :
    color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
    'bg-gray-100 text-gray-500'

  return (
    <div
      className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50 border border-transparent'}`}
      onClick={() => { toggleSelect(p); if (p.address_lat && p.address_lng) setFlyTo({ center: [p.address_lat, p.address_lng], ts: Date.now() }) }}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarBg}`}>
        {isSelected ? orderNum : p.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm flex items-center gap-1">
          {p.name}
          {t && <span className="text-xs text-gray-400">{t.slice(0,5)}</span>}
        </div>
        <div className="text-xs text-gray-400 truncate">{p.address}</div>
      </div>
      {p.phone && (
        <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <Phone size={14} />
        </a>
      )}
    </div>
  )
}
