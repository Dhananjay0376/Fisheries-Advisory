import React, { useState, useEffect } from 'react'
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Compass, 
  CloudRain, 
  Phone, 
  Globe, 
  RefreshCw, 
  CheckCircle,
  MapPin,
  ShieldAlert,
  LogOut,
  Trash2,
  Send,
  Plus,
  History,
  List
} from 'lucide-react'

// Import localization bundles
import en from './locales/en.json'
import ta from './locales/ta.json'
import hi from './locales/hi.json'

const locales = { en, ta, hi }
const BACKEND_URL = 'http://127.0.0.1:8000'

function App() {
  // --- STATE SYSTEM ---
  const [currentTab, setCurrentTab] = useState('fisherman') // 'fisherman' or 'admin'
  const [lang, setLang] = useState('en')
  const t = (key) => locales[lang][key] || locales['en'][key] || key

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [subOfflineSaved, setSubOfflineSaved] = useState(false)
  const [advisories, setAdvisories] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  // GPS Radar states
  const [userCoords, setUserCoords] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [localWarnings, setLocalWarnings] = useState([])

  // Admin JWT states
  const [token, setToken] = useState(sessionStorage.getItem('admin_token') || '')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [adminSubTab, setAdminSubTab] = useState('publish') // 'publish', 'regions', 'broadcast', 'logs'

  // Subscriber Form states
  const [phoneNumber, setPhoneNumber] = useState('')
  const [subLanguage, setSubLanguage] = useState('en')
  const [subRegion, setSubRegion] = useState('')
  const [subSuccess, setSubSuccess] = useState(false)
  const [subError, setSubError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Admin Form - Advisory Creation states
  const [advTitle, setAdvTitle] = useState('')
  const [advType, setAdvType] = useState('weather')
  const [advSeverity, setAdvSeverity] = useState('medium')
  const [advLat, setAdvLat] = useState('')
  const [advLng, setAdvLng] = useState('')
  const [advRadius, setAdvRadius] = useState('')
  const [advContentEn, setAdvContentEn] = useState('')
  const [advContentTa, setAdvContentTa] = useState('')
  const [advContentTe, setAdvContentTe] = useState('')
  const [advContentHi, setAdvContentHi] = useState('')
  const [advSuccess, setAdvSuccess] = useState('')
  const [advError, setAdvError] = useState('')

  // Admin Form - Region Creation states
  const [regName, setRegName] = useState('')
  const [regLat, setRegLat] = useState('')
  const [regLng, setRegLng] = useState('')
  const [regSuccess, setRegSuccess] = useState('')
  const [regError, setRegError] = useState('')

  // Broadcast History Logs state
  const [broadcastLogs, setBroadcastLogs] = useState([])

  // Sync pending subscriptions from local storage in background when back online
  const syncPendingSubscriptions = async () => {
    if (!navigator.onLine) return
    const pending = localStorage.getItem('pending_subscriptions')
    if (!pending) return

    let list = []
    try {
      list = JSON.parse(pending)
    } catch {
      return
    }

    if (list.length === 0) return

    console.log(`Syncing ${list.length} pending offline subscriptions...`)
    const remaining = []

    for (const sub of list) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/subscribers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub)
        })
        if (!response.ok) {
          remaining.push(sub)
        }
      } catch (err) {
        console.error('Failed syncing subscription:', err)
        remaining.push(sub)
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem('pending_subscriptions', JSON.stringify(remaining))
    } else {
      localStorage.removeItem('pending_subscriptions')
      console.log('All pending subscriptions synced successfully!')
    }
  }

  // --- CONNECTIVITY MONITOR ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncPendingSubscriptions()
    }
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine) {
      syncPendingSubscriptions()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // --- RECOVERY AND LOCAL CACHING ---
  const fetchGlobalData = async () => {
    setLoading(true)
    setError(null)
    
    // Set 5-second timeout controller for slow local bandwidth/spotty networks
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      if (navigator.onLine) {
        // Fetch advisories
        const advResp = await fetch(`${BACKEND_URL}/api/advisories`, { signal: controller.signal })
        if (advResp.ok) {
          const advData = await advResp.json()
          setAdvisories(advData)
          localStorage.setItem('cached_advisories', JSON.stringify(advData))
        }

        // Fetch regions
        const regResp = await fetch(`${BACKEND_URL}/api/regions`, { signal: controller.signal })
        if (regResp.ok) {
          const regData = await regResp.json()
          setRegions(regData)
          localStorage.setItem('cached_regions', JSON.stringify(regData))
        }
        clearTimeout(timeoutId)
      } else {
        clearTimeout(timeoutId)
        // Load fallback storage cache
        const cachedAdv = localStorage.getItem('cached_advisories')
        if (cachedAdv) setAdvisories(JSON.parse(cachedAdv))
        
        const cachedReg = localStorage.getItem('cached_regions')
        if (cachedReg) setRegions(JSON.parse(cachedReg))
      }
    } catch (err) {
      clearTimeout(timeoutId)
      console.error(err)
      const isTimeout = err.name === 'AbortError'
      setError(isTimeout ? 'Request timed out (low bandwidth). Loaded cached data.' : 'Could not retrieve new records.')
      // Offline fallback on crash
      const cachedAdv = localStorage.getItem('cached_advisories')
      if (cachedAdv) setAdvisories(JSON.parse(cachedAdv))
      const cachedReg = localStorage.getItem('cached_regions')
      if (cachedReg) setRegions(JSON.parse(cachedReg))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGlobalData()
  }, [isOnline])

  // --- CLIENT-SIDE HAVERSINE MATH (OFFLINE RADAR) ---
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in km
  }

  // --- GET DEVICE GPS LOCATION ---
  const fetchUserGPS = () => {
    setGpsLoading(true)
    setGpsError('')
    setLocalWarnings([])

    if (!navigator.geolocation) {
      setGpsError(t('gps_not_supported'))
      setGpsLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setUserCoords({ latitude: lat, longitude: lng })

        // Check GPS coordinates against pre-loaded/cached advisories
        const matchedWarnings = advisories.filter(adv => {
          if (adv.latitude !== null && adv.longitude !== null) {
            const dist = getDistanceKm(lat, lng, adv.latitude, adv.longitude)
            const radius = adv.radius_km !== null ? adv.radius_km : 50.0 // fallback to 50km
            return dist <= radius
          }
          return false
        })

        setLocalWarnings(matchedWarnings)
        setGpsLoading(false)
      },
      (err) => {
        console.error(err)
        setGpsError('Could not acquire GPS satellite fix. Please check location permissions.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }

  // --- ADMIN LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const params = new URLSearchParams()
      params.append('username', loginUsername)
      params.append('password', loginPassword)

      const response = await fetch(`${BACKEND_URL}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      if (!response.ok) {
        throw new Error('Unauthorized')
      }

      const data = await response.json()
      setToken(data.access_token)
      sessionStorage.setItem('admin_token', data.access_token)
      setLoginUsername('')
      setLoginPassword('')
    } catch (err) {
      console.error(err)
      setLoginError(t('login_failed'))
    }
  }

  const handleLogout = () => {
    setToken('')
    sessionStorage.removeItem('admin_token')
  }

  // --- FISHERMAN SMS SIGNUP ---
  const savePendingSubscription = (payload) => {
    try {
      const pending = JSON.parse(localStorage.getItem('pending_subscriptions') || '[]')
      const filtered = pending.filter(item => item.phone_number !== payload.phone_number)
      filtered.push(payload)
      localStorage.setItem('pending_subscriptions', JSON.stringify(filtered))
    } catch (e) {
      console.error('Failed to save pending subscription', e)
    }
  }

  const handleSubscribe = async (e) => {
    e.preventDefault()
    setSubSuccess(false)
    setSubOfflineSaved(false)
    setSubError('')
    
    if (!phoneNumber.trim()) {
      setSubError('Phone number is required.')
      return
    }

    const payload = {
      phone_number: phoneNumber,
      preferred_language: subLanguage,
      region: subRegion || null
    }

    // If completely offline, save locally immediately
    if (!navigator.onLine) {
      savePendingSubscription(payload)
      setSubOfflineSaved(true)
      setSubSuccess(true)
      setPhoneNumber('')
      setSubRegion('')
      return
    }

    setSubmitting(true)
    // 5-second timeout for registering on poor connection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${BACKEND_URL}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) throw new Error('Registration failed')
      
      setSubSuccess(true)
      setPhoneNumber('')
      setSubRegion('')
    } catch (err) {
      clearTimeout(timeoutId)
      console.error(err)
      
      // If we encounter a network timeout or connection failure, save offline and inform user
      if (err.name === 'AbortError' || !navigator.onLine) {
        savePendingSubscription(payload)
        setSubOfflineSaved(true)
        setSubSuccess(true)
        setPhoneNumber('')
        setSubRegion('')
      } else {
        setSubError('Failed to register. Please check your inputs.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // --- ADMIN PUBLISH ADVISORY ---
  const handleCreateAdvisory = async (e) => {
    e.preventDefault()
    setAdvSuccess('')
    setAdvError('')

    if (!advTitle.trim() || !advContentEn.trim()) {
      setAdvError('Title and English content are required.')
      return
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/advisories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: advTitle,
          type: advType,
          severity: advSeverity,
          content_en: advContentEn,
          content_ta: advContentTa || null,
          content_te: advContentTe || null,
          content_hi: advContentHi || null,
          latitude: advLat ? parseFloat(advLat) : null,
          longitude: advLng ? parseFloat(advLng) : null,
          radius_km: advRadius ? parseFloat(advRadius) : null
        })
      })

      if (!response.ok) throw new Error('Failed to create advisory')
      
      setAdvSuccess('Advisory created successfully!')
      setAdvTitle('')
      setAdvContentEn('')
      setAdvContentTa('')
      setAdvContentTe('')
      setAdvContentHi('')
      setAdvLat('')
      setAdvLng('')
      setAdvRadius('')
      fetchGlobalData() // refresh lists
    } catch (err) {
      console.error(err)
      setAdvError('Error publishing advisory. Check authorization.')
    }
  }

  // --- ADMIN REGION CRUD ---
  const handleCreateRegion = async (e) => {
    e.preventDefault()
    setRegSuccess('')
    setRegError('')

    if (!regName.trim() || !regLat || !regLng) {
      setRegError('All fields are required.')
      return
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/regions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: regName,
          latitude: parseFloat(regLat),
          longitude: parseFloat(regLng)
        })
      })

      if (!response.ok) throw new Error('Failed to create region')

      setRegSuccess('Region registered successfully!')
      setRegName('')
      setRegLat('')
      setRegLng('')
      fetchGlobalData() // refresh dropdown list
    } catch (err) {
      console.error(err)
      setRegError('Error adding region.')
    }
  }

  const handleDeleteRegion = async (regionId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/regions/${regionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        fetchGlobalData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // --- ADMIN BROADCAST SMS ---
  const handleBroadcast = async (advisoryId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/advisories/${advisoryId}/broadcast`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Broadcast failed')

      const data = await response.json()
      alert(`Broadcast successful! Sent to ${data.sent_count} subscribers. Skipped ${data.skipped_out_of_zone} out-of-range users.`);
      fetchBroadcastLogs()
    } catch (err) {
      console.error(err)
      alert('Error initiating broadcast.')
    }
  }

  // --- ADMIN AUDIT LOGS RETRIEVAL ---
  const fetchBroadcastLogs = async () => {
    if (!token) return
    try {
      const response = await fetch(`${BACKEND_URL}/api/broadcast-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setBroadcastLogs(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (currentTab === 'admin' && token) {
      fetchBroadcastLogs()
    }
  }, [currentTab, token, adminSubTab])

  // --- FILTER & UTILS ---
  const filteredAdvisories = advisories.filter(item => {
    if (filter === 'all') return true
    return item.type === filter
  })

  const getCardContent = (item) => {
    if (lang === 'ta' && item.content_ta) return item.content_ta
    if (lang === 'te' && item.content_te) return item.content_te
    if (lang === 'hi' && item.content_hi) return item.content_hi
    return item.content_en
  }

  const getIcon = (type) => {
    switch (type) {
      case 'weather':
        return <CloudRain className="h-5 w-5 text-blue-600" />
      case 'fishing_zone':
        return <Compass className="h-5 w-5 text-emerald-600" />
      case 'safety':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />
      default:
        return <Globe className="h-5 w-5 text-slate-600" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-lg font-sans">
      
      {/* 1. Header with View Toggle */}
      <header className="bg-sky-700 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 animate-pulse" />
            <h1 className="font-bold text-base leading-tight">{t('title')}</h1>
          </div>
          
          {/* Language Selector */}
          <div className="flex items-center bg-sky-850 bg-sky-800 rounded px-2 py-0.5 text-xs border border-sky-650">
            <Globe className="h-3 w-3 mr-1 text-sky-200" />
            <select 
              value={lang} 
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
            >
              <option value="en" className="text-slate-800">EN</option>
              <option value="ta" className="text-slate-800">தமிழ்</option>
              <option value="hi" className="text-slate-800">हिन्दी</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-sky-600 pt-2 text-xs">
          <button
            onClick={() => setCurrentTab('fisherman')}
            className={`flex-1 py-1 text-center font-bold transition-all rounded ${
              currentTab === 'fisherman' ? 'bg-sky-900 text-white shadow-inner' : 'text-sky-200 hover:text-white'
            }`}
          >
            {t('fisherman_tab')}
          </button>
          <button
            onClick={() => setCurrentTab('admin')}
            className={`flex-1 py-1 text-center font-bold transition-all rounded flex justify-center items-center gap-1 ${
              currentTab === 'admin' ? 'bg-sky-900 text-white shadow-inner' : 'text-sky-200 hover:text-white'
            }`}
          >
            <ShieldAlert className="h-3 w-3" />
            {t('admin_tab')}
          </button>
        </div>
      </header>

      {/* Connectivity Banner */}
      <div className={`text-[10px] py-1 px-4 font-semibold flex items-center justify-between transition-colors ${
        isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'
      }`}>
        <div className="flex items-center gap-1">
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span>{isOnline ? t('online_mode') : t('offline_mode')}</span>
        </div>
        <button 
          onClick={fetchGlobalData} 
          disabled={loading}
          className="hover:underline flex items-center gap-0.5 text-slate-500 font-bold"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh_btn')}
        </button>
      </div>

      {/* Main Body */}
      <main className="flex-1 p-3 space-y-4 overflow-y-auto">
        
        {/* ==================== VIEW 1: FISHERMAN PUBLIC VIEW ==================== */}
        {currentTab === 'fisherman' && (
          <>
            {/* GPS Location Safety Radar */}
            <section className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                  <MapPin className="h-4.5 w-4.5 text-sky-655 text-sky-600 animate-bounce" />
                  {t('gps_panel_title')}
                </h3>
                <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">Offline Friendly</span>
              </div>

              {!userCoords ? (
                <div className="py-2 flex flex-col items-center gap-2">
                  <button
                    onClick={fetchUserGPS}
                    disabled={gpsLoading}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-1.5 px-4 rounded text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {gpsLoading ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        {t('gps_btn_checking')}
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3.5 w-3.5" />
                        {t('gps_btn_active')}
                      </>
                    )}
                  </button>
                  {gpsError && (
                    <p className="text-[10px] text-rose-600 font-medium text-center">{gpsError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-500 font-bold">{t('gps_coords')}:</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {userCoords.latitude.toFixed(4)}° N, {userCoords.longitude.toFixed(4)}° E
                    </span>
                    <button 
                      onClick={fetchUserGPS}
                      className="text-sky-600 hover:underline font-bold"
                    >
                      Rescan
                    </button>
                  </div>

                  {gpsLoading && (
                    <div className="text-center py-2 text-[10px] text-slate-400">Scanning location...</div>
                  )}

                  {/* Warning Alerts Display */}
                  {!gpsLoading && localWarnings.length > 0 ? (
                    <div className="bg-rose-50 text-rose-800 border border-rose-200 rounded p-3 space-y-1.5 animate-pulse">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                        <h4 className="font-bold text-[11px] uppercase tracking-wide">{t('gps_alert')}</h4>
                      </div>
                      <ul className="list-disc pl-4 text-xs font-bold space-y-1">
                        {localWarnings.map(warn => (
                          <li key={warn.id}>{warn.title} ({warn.type})</li>
                        ))}
                      </ul>
                    </div>
                  ) : !gpsLoading && (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-250 p-2.5 rounded text-[10px] flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-bold">{t('gps_safe')}</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Filters */}
            <section className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
              <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wide">
                {t('filter_label')}
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'all', label: t('filter_all') },
                  { id: 'weather', label: t('filter_weather') },
                  { id: 'fishing_zone', label: t('filter_zone') },
                  { id: 'safety', label: t('filter_safety') }
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => setFilter(btn.id)}
                    className={`text-[10px] font-semibold py-1 rounded transition-colors text-center ${
                      filter === btn.id 
                        ? 'bg-sky-600 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Advisories Grid */}
            <section className="space-y-2.5">
              {loading && advisories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-1 text-sky-600" />
                  Loading...
                </div>
              ) : filteredAdvisories.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg border border-dashed border-slate-250 text-slate-400 text-xs">
                  {t('no_advisories')}
                </div>
              ) : (
                filteredAdvisories.map(item => {
                  const severityColor = 
                    item.severity === 'high' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                    item.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-emerald-100 text-emerald-800 border-emerald-200';
                  
                  return (
                    <article 
                      key={item.id}
                      className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5 relative overflow-hidden flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-start gap-1">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-slate-50">
                            {getIcon(item.type)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 text-xs">{item.title}</h3>
                          </div>
                        </div>
                        <span className={`text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded border uppercase ${severityColor}`}>
                          {t(`severity_${item.severity}`)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-normal font-normal bg-slate-50 p-2 rounded border border-slate-100">
                        {getCardContent(item)}
                      </p>

                      {item.latitude && item.longitude && (
                        <div className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 text-sky-600" />
                          <span>Scope: {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}° ({item.radius_km || 50}km Radius)</span>
                        </div>
                      )}
                    </article>
                  )
                })
              )}
            </section>

            {/* Subscriber form with Dynamic Regions list */}
            <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-sky-700">
                <Phone className="h-4.5 w-4.5" />
                <h2 className="font-bold text-xs">{t('subscribe_title')}</h2>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">{t('subscribe_desc')}</p>
              
              <form onSubmit={handleSubscribe} className="space-y-2">
                <input
                  type="tel"
                  placeholder={t('sub_phone_placeholder')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={submitting}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={subLanguage}
                    onChange={(e) => setSubLanguage(e.target.value)}
                    disabled={submitting}
                    className="text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="en">English</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                  </select>
                  
                  <select
                    value={subRegion}
                    onChange={(e) => setSubRegion(e.target.value)}
                    disabled={submitting}
                    className="text-xs border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value="">{t('sub_region_placeholder')}</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.name}>{r.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-1.5 px-4 rounded text-xs transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : t('sub_submit_btn')}
                </button>
              </form>

              {subSuccess && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded text-[10px] flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <span>
                    {subOfflineSaved
                      ? (t('sub_offline_success') || 'Saved offline! Your registration will sync when your internet connection is restored.')
                      : t('sub_success')}
                  </span>
                </div>
              )}

              {subError && (
                <div className="bg-rose-50 text-rose-800 border border-rose-250 p-2 rounded text-[10px]">
                  {subError}
                </div>
              )}
            </section>
          </>
        )}

        {/* ==================== VIEW 2: ADMIN PROTECTED CONTROL ==================== */}
        {currentTab === 'admin' && (
          <>
            {/* If NOT authenticated -> Login Box */}
            {!token ? (
              <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 space-y-3.5">
                <div className="flex flex-col items-center text-center gap-1">
                  <ShieldAlert className="h-8 w-8 text-sky-700 animate-bounce" />
                  <h2 className="font-extrabold text-slate-800 text-sm">{t('login_title')}</h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('login_username')}</label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('login_password')}</label>
                    <input
                      type="password"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded text-xs transition-colors shadow-sm"
                  >
                    {t('login_submit')}
                  </button>
                </form>

                {loginError && (
                  <div className="bg-rose-50 text-rose-800 border border-rose-200 p-2 rounded text-[10px] text-center font-medium">
                    {loginError}
                  </div>
                )}
              </section>
            ) : (
              // If authenticated -> Full Dashboard
              <div className="space-y-4">
                
                {/* Admin Status & Navigation Header */}
                <div className="flex justify-between items-center bg-slate-850 bg-slate-800 text-white p-2.5 rounded-lg text-xs shadow-inner">
                  <span className="font-semibold text-slate-200">Admin Control Panel</span>
                  <button 
                    onClick={handleLogout}
                    className="bg-slate-700 hover:bg-rose-700 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 font-bold"
                  >
                    <LogOut className="h-3 w-3" />
                    {t('logout_btn')}
                  </button>
                </div>

                {/* Admin Sub-Tabs */}
                <nav className="grid grid-cols-4 gap-1 text-[9px] font-bold uppercase">
                  {[
                    { id: 'publish', label: 'Alerts', icon: <Plus className="h-2.5 w-2.5" /> },
                    { id: 'regions', label: 'Regions', icon: <MapPin className="h-2.5 w-2.5" /> },
                    { id: 'broadcast', label: 'Broadcast', icon: <Send className="h-2.5 w-2.5" /> },
                    { id: 'logs', label: 'Audit Logs', icon: <History className="h-2.5 w-2.5" /> }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setAdminSubTab(tab.id)}
                      className={`py-1.5 rounded flex flex-col items-center gap-0.5 border text-center transition-colors ${
                        adminSubTab === tab.id 
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>

                {/* Sub-tab 1: PUBLISH ADVISORY FORM */}
                {adminSubTab === 'publish' && (
                  <form onSubmit={handleCreateAdvisory} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
                    <h3 className="font-extrabold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center gap-1">
                      <Plus className="h-4 w-4 text-sky-600" />
                      {t('add_advisory_title')}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">{t('input_title')}</label>
                        <input
                          type="text"
                          placeholder="e.g. Rough Sea Advisory"
                          value={advTitle}
                          onChange={(e) => setAdvTitle(e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">{t('input_type')}</label>
                        <select
                          value={advType}
                          onChange={(e) => setAdvType(e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 bg-white"
                        >
                          <option value="weather">Weather</option>
                          <option value="fishing_zone">Fishing Zone</option>
                          <option value="safety">Safety</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                      <div className="col-span-1">
                        <label className="font-bold text-slate-400 uppercase mb-0.5 block">Severity</label>
                        <select
                          value={advSeverity}
                          onChange={(e) => setAdvSeverity(e.target.value)}
                          className="w-full border border-slate-300 rounded py-1 px-0.5 bg-white"
                        >
                          <option value="low">Info</option>
                          <option value="medium">Warning</option>
                          <option value="high">Critical</option>
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className="font-bold text-slate-400 uppercase mb-0.5 block">Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 13.08"
                          value={advLat}
                          onChange={(e) => setAdvLat(e.target.value)}
                          className="w-full border border-slate-300 rounded py-1 px-1"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="font-bold text-slate-400 uppercase mb-0.5 block">Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="80.27"
                          value={advLng}
                          onChange={(e) => setAdvLng(e.target.value)}
                          className="w-full border border-slate-300 rounded py-1 px-1"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="font-bold text-slate-400 uppercase mb-0.5 block">Radius (km)</label>
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          value={advRadius}
                          onChange={(e) => setAdvRadius(e.target.value)}
                          className="w-full border border-slate-300 rounded py-1 px-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-[10px]">
                      <div>
                        <label className="font-bold text-slate-400 uppercase block mb-0.5">{t('input_content_en')} *</label>
                        <textarea
                          rows="2"
                          placeholder="English message content..."
                          value={advContentEn}
                          onChange={(e) => setAdvContentEn(e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-400 uppercase block mb-0.5">{t('input_content_ta')}</label>
                        <textarea
                          rows="1"
                          placeholder="Tamil version..."
                          value={advContentTa}
                          onChange={(e) => setAdvContentTa(e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-400 uppercase block mb-0.5">{t('input_content_hi')}</label>
                        <textarea
                          rows="1"
                          placeholder="Hindi version..."
                          value={advContentHi}
                          onChange={(e) => setAdvContentHi(e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-sky-650 hover:bg-sky-700 text-white font-bold py-2 rounded text-xs transition-colors shadow-sm"
                    >
                      {t('submit_advisory_btn')}
                    </button>

                    {advSuccess && <div className="bg-emerald-50 text-emerald-800 p-2 rounded text-[10px] text-center border border-emerald-100">{advSuccess}</div>}
                    {advError && <div className="bg-rose-50 text-rose-800 p-2 rounded text-[10px] text-center border border-rose-100">{advError}</div>}
                  </form>
                )}

                {/* Sub-tab 2: REGIONS TABLE & FORM */}
                {adminSubTab === 'regions' && (
                  <div className="space-y-3">
                    
                    {/* Add Region Form */}
                    <form onSubmit={handleCreateRegion} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
                      <h3 className="font-extrabold text-slate-800 text-xs border-b pb-1.5 flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        {t('manage_regions')}
                      </h3>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div>
                          <label className="font-bold text-slate-400 uppercase mb-0.5 block">{t('region_name_input')}</label>
                          <input
                            type="text"
                            placeholder="e.g. chennai"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            className="w-full border border-slate-300 rounded p-1"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-400 uppercase mb-0.5 block">Lat</label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="13.08"
                            value={regLat}
                            onChange={(e) => setRegLat(e.target.value)}
                            className="w-full border border-slate-300 rounded p-1"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-400 uppercase mb-0.5 block">Lng</label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="80.27"
                            value={regLng}
                            onChange={(e) => setRegLng(e.target.value)}
                            className="w-full border border-slate-300 rounded p-1"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded text-xs transition-colors"
                      >
                        {t('add_region_btn')}
                      </button>

                      {regSuccess && <div className="bg-emerald-50 text-emerald-800 p-2 rounded text-[10px] text-center border border-emerald-100">{regSuccess}</div>}
                      {regError && <div className="bg-rose-50 text-rose-800 p-2 rounded text-[10px] text-center border border-rose-100">{regError}</div>}
                    </form>

                    {/* Regions List */}
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1 border-b pb-1">
                        <List className="h-4.5 w-4.5" />
                        Ports Index
                      </h4>
                      
                      {regions.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-2">No registered ports found.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                          {regions.map(r => (
                            <div key={r.id} className="flex justify-between items-center py-2 text-xs">
                              <div>
                                <span className="font-bold text-slate-700 capitalize">{r.name}</span>
                                <span className="text-[10px] text-slate-400 block">Coordinates: {r.latitude}°, {r.longitude}°</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteRegion(r.id)}
                                className="text-rose-600 hover:bg-rose-50 p-1 rounded transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 3: BROADCAST TRIGGER PANEL */}
                {adminSubTab === 'broadcast' && (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3.5">
                    <h3 className="font-extrabold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center gap-1">
                      <Send className="h-4 w-4 text-sky-600" />
                      Active Broadcast List
                    </h3>

                    {advisories.length === 0 ? (
                      <p className="text-center py-6 text-slate-400 text-xs">No active advisories to broadcast.</p>
                    ) : (
                      <div className="space-y-3">
                        {advisories.map(adv => (
                          <div key={adv.id} className="border border-slate-200 p-3 rounded-lg flex flex-col gap-2 relative bg-slate-50">
                            <div className="flex justify-between items-start gap-1">
                              <div>
                                <h4 className="font-bold text-slate-800 text-xs">{adv.title}</h4>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{adv.type}</span>
                              </div>
                              <span className="text-[8px] font-bold px-1 py-0.2 rounded border bg-slate-200 text-slate-700">ID #{adv.id}</span>
                            </div>

                            <p className="text-[11px] text-slate-600 font-medium bg-white p-2 rounded border border-slate-100 leading-snug">
                              {adv.content_en}
                            </p>

                            <button
                              onClick={() => handleBroadcast(adv.id)}
                              className="self-end bg-sky-600 hover:bg-sky-700 text-white font-bold py-1 px-3 rounded text-[10px] transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <Send className="h-3 w-3" />
                              {t('broadcast_btn')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 4: BROADCAST AUDIT LOG HISTORY */}
                {adminSubTab === 'logs' && (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3.5">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1">
                        <History className="h-4 w-4 text-sky-600" />
                        {t('broadcast_log_title')}
                      </h3>
                      <button 
                        onClick={fetchBroadcastLogs}
                        className="text-[10px] text-sky-600 font-bold hover:underline"
                      >
                        Refresh Logs
                      </button>
                    </div>

                    {broadcastLogs.length === 0 ? (
                      <p className="text-center py-6 text-slate-400 text-xs">No broadcast history logs found.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto border border-slate-100 rounded">
                        <table className="w-full text-left text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-500">
                              <th className="p-2">Adv</th>
                              <th className="p-2">{t('log_recipient')}</th>
                              <th className="p-2">{t('log_status')}</th>
                              <th className="p-2">{t('log_time')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {broadcastLogs.map(log => {
                              const badgeStyle = 
                                log.status === 'success' ? 'bg-emerald-100 text-emerald-800 font-extrabold' :
                                log.status === 'skipped' ? 'bg-amber-100 text-amber-800 font-bold' :
                                'bg-rose-100 text-rose-800 font-bold';
                                
                              return (
                                <tr key={log.id} className="hover:bg-slate-50 font-medium text-slate-600">
                                  <td className="p-2 font-bold text-slate-700">#{log.advisory_id}</td>
                                  <td className="p-2">{log.recipient_phone}</td>
                                  <td className="p-2">
                                    <span className={`px-1 py-0.2 rounded border text-[9px] ${badgeStyle}`}>
                                      {log.status.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="p-2 font-normal text-slate-400 text-[8px]">
                                    {new Date(log.sent_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 text-center py-4 text-[10px] border-t border-slate-700 space-y-1">
        <p>© 2026 Fisheries Advisory Delivery Initiative</p>
        <p className="text-slate-500">Low-Bandwidth Optimized | Service Worker Cache Enabled</p>
      </footer>
    </div>
  )
}

export default App
