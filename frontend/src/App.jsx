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
  List,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react'

// Import localization bundles
import en from './locales/en.json'
import ta from './locales/ta.json'
import hi from './locales/hi.json'

const locales = { en, ta, hi }
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

function App() {
  // --- STATE SYSTEM ---
  const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'light')
  const [fishermanProfile, setFishermanProfile] = useState(() => {
    const saved = localStorage.getItem('fisherman_profile')
    return saved ? JSON.parse(saved) : null
  })
  const [currentTab, setCurrentTab] = useState('fisherman') // 'fisherman' or 'admin'
  const [lang, setLang] = useState('en')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (fishermanProfile && fishermanProfile.preferred_language) {
      setLang(fishermanProfile.preferred_language)
    }
  }, [fishermanProfile])

  useEffect(() => {
    localStorage.setItem('app_theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])
  const t = (key) => locales[lang][key] || locales['en'][key] || key

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [advisories, setAdvisories] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Admin JWT states
  const [token, setToken] = useState(sessionStorage.getItem('admin_token') || '')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [adminSubTab, setAdminSubTab] = useState('publish') // 'publish', 'regions', 'broadcast', 'logs'

  // Subscriber Form states
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [subLanguage, setSubLanguage] = useState('en')
  const [subRegion, setSubRegion] = useState('')
  const [subSuccess, setSubSuccess] = useState(false)
  const [subError, setSubError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Onboarding Form states
  const [onboardingPhone, setOnboardingPhone] = useState('')
  const [onboardingEmail, setOnboardingEmail] = useState('')
  const [onboardingName, setOnboardingName] = useState('')
  const [onboardingLang, setOnboardingLang] = useState('en')
  const [onboardingCountry, setOnboardingCountry] = useState('India')
  const [onboardingRegion, setOnboardingRegion] = useState('')
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false)
  const [onboardingError, setOnboardingError] = useState('')
  const [showSmsPopup, setShowSmsPopup] = useState(false)

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

  // --- CONNECTIVITY MONITOR ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // --- RECOVERY AND LOCAL CACHING ---
  const fetchGlobalData = async () => {
    setLoading(true)
    setError(null)
    try {
      if (navigator.onLine) {
        // Fetch advisories
        const advResp = await fetch(`${BACKEND_URL}/api/advisories`)
        if (advResp.ok) {
          const advData = await advResp.json()
          setAdvisories(advData)
          localStorage.setItem('cached_advisories', JSON.stringify(advData))
        }

        // Fetch regions
        const regResp = await fetch(`${BACKEND_URL}/api/regions`)
        if (regResp.ok) {
          const regData = await regResp.json()
          setRegions(regData)
          localStorage.setItem('cached_regions', JSON.stringify(regData))
        }
      } else {
        // Load fallback storage cache
        const cachedAdv = localStorage.getItem('cached_advisories')
        if (cachedAdv) setAdvisories(JSON.parse(cachedAdv))
        
        const cachedReg = localStorage.getItem('cached_regions')
        if (cachedReg) setRegions(JSON.parse(cachedReg))
      }
    } catch (err) {
      console.error(err)
      setError('Could not retrieve new records.')
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

  // --- ADMIN LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      // OAuth2 request requires application/x-www-form-urlencoded format
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

  // --- FISHERMAN ONBOARDING / SIGN-IN ---
  const handleBasicInfoSubmit = (e) => {
    e.preventDefault()
    setOnboardingError('')
    if (!onboardingPhone.trim() && !onboardingEmail.trim()) {
      setOnboardingError('Either Phone Number or Email is required.')
      return
    }
    if (!onboardingName.trim()) {
      setOnboardingError('Name is required.')
      return
    }
    if (!onboardingCountry.trim()) {
      setOnboardingError('Country is required.')
      return
    }
    if (!onboardingRegion) {
      setOnboardingError('Please select a Coastal Port.')
      return
    }
    setLang(onboardingLang)
    setShowSmsPopup(true)
  }

  const handleSmsAlertRegister = async (e) => {
    e.preventDefault()
    setOnboardingError('')
    if (!onboardingPhone.trim() && !onboardingEmail.trim()) {
      setOnboardingError('Either Phone Number or Email is required.')
      return
    }

    setOnboardingSubmitting(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: onboardingPhone.trim() || null,
          email: onboardingEmail.trim() || null,
          preferred_language: onboardingLang,
          region: onboardingRegion || null
        })
      })

      if (!response.ok) throw new Error('Registration failed')

      const profile = {
        phone_number: onboardingPhone.trim() || onboardingEmail.trim(),
        name: onboardingName,
        preferred_language: onboardingLang,
        country: onboardingCountry,
        region: onboardingRegion
      }
      localStorage.setItem('fisherman_profile', JSON.stringify(profile))
      setFishermanProfile(profile)
      setLang(onboardingLang)
      setShowSmsPopup(false)
    } catch (err) {
      console.error(err)
      setOnboardingError('Registration failed. Please check your connection.')
    } finally {
      setOnboardingSubmitting(false)
    }
  }

  const handleSmsSkip = () => {
    const profile = {
      phone_number: 'Guest / SMS Disabled',
      name: onboardingName,
      preferred_language: onboardingLang,
      country: onboardingCountry,
      region: onboardingRegion
    }
    localStorage.setItem('fisherman_profile', JSON.stringify(profile))
    setFishermanProfile(profile)
    setLang(onboardingLang)
    setShowSmsPopup(false)
  }

  // --- FISHERMAN SMS & EMAIL SIGNUP ---
  const handleSubscribe = async (e) => {
    e.preventDefault()
    setSubSuccess(false)
    setSubError('')
    
    if (!phoneNumber.trim() && !email.trim()) {
      setSubError('Either Phone Number or Email is required.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber.trim() || null,
          email: email.trim() || null,
          preferred_language: subLanguage,
          region: subRegion || null
        })
      })

      if (!response.ok) throw new Error('Registration failed')
      
      setSubSuccess(true)
      setPhoneNumber('')
      setEmail('')
    } catch (err) {
      console.error(err)
      setSubError('Failed to register. Please check your connection.')
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
  const [filter, setFilter] = useState('all')
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
        return <Globe className="h-5 w-5 text-slate-650" />
    }
  }

  return (
    <div className={`min-h-screen flex flex-col max-w-md mx-auto border-x shadow-lg font-sans transition-all duration-200 relative overflow-hidden ${
      theme === 'dark' 
        ? 'bg-[#1E6E6F] text-[#B6E6E9] border-[#71C7BD]' 
        : 'bg-[#F3B900] text-black font-bold border-slate-200'
    }`}>
      
      {/* Sidebar Navigation Drawer */}
      {fishermanProfile && isSidebarOpen && (
        <>
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity duration-200"
          />

          {/* Sidebar Panel Drawer */}
          <aside className={`absolute left-0 top-0 bottom-0 w-64 z-50 shadow-2xl flex flex-col justify-between transition-transform duration-300 p-4 border-r ${
            theme === 'dark' 
              ? 'bg-[#1E6E6F] text-[#B6E6E9] border-[#71C7BD]/30' 
              : 'bg-[#F3B900] text-black font-bold border-slate-200'
          }`}>
            
            {/* Left Upper Side Options */}
            <div className="space-y-6">
              {/* Header inside sidebar */}
              <div className="flex items-center justify-between border-b pb-3 dark:border-[#71C7BD]/20">
                <div className="flex items-center gap-1.5">
                  <Compass className={`h-5 w-5 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
                  <span className="font-bold text-xs uppercase tracking-wider">Portal Menu</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className={`p-1 rounded transition-colors ${
                    theme === 'dark' ? 'text-[#71C7BD] hover:bg-[#71C7BD]/20' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Theme Settings Selector */}
              <div className="space-y-2">
                <span className={`text-[9px] font-bold uppercase tracking-wider block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>
                  Theme Style
                </span>
                <button
                  onClick={() => {
                    setTheme(theme === 'dark' ? 'light' : 'dark')
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full py-1.5 px-3 rounded border text-xs font-semibold flex items-center justify-between transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#71C7BD]/15 border-[#71C7BD]/30 text-[#4EC6D4] hover:bg-[#71C7BD]/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-[#F3B900]/10 uppercase">
                    {theme}
                  </span>
                </button>
              </div>

              {/* Quick Filters Short-cuts */}
              <div className="space-y-2">
                <span className={`text-[9px] font-bold uppercase tracking-wider block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>
                  Filter Alerts
                </span>
                <div className="flex flex-col gap-1 text-xs font-semibold">
                  {[
                    { id: 'all', label: t('filter_all'), icon: <List className="h-3.5 w-3.5" /> },
                    { id: 'weather', label: t('filter_weather'), icon: <CloudRain className="h-3.5 w-3.5 text-blue-500" /> },
                    { id: 'fishing_zone', label: t('filter_zone'), icon: <Compass className="h-3.5 w-3.5 text-emerald-500" /> },
                    { id: 'safety', label: t('filter_safety'), icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => {
                        setFilter(btn.id)
                        setIsSidebarOpen(false)
                      }}
                      className={`w-full py-2 px-3 rounded flex items-center gap-2.5 transition-colors text-left ${
                        filter === btn.id 
                          ? (theme === 'dark' ? 'bg-[#4EC6D4]/20 border border-[#4EC6D4]/30 text-[#4EC6D4]' : 'bg-[#FA7301]/15 text-[#FA7301] border border-[#FA7301]/25')
                          : (theme === 'dark' ? 'hover:bg-[#71C7BD]/10 text-[#B6E6E9]' : 'hover:bg-slate-100 text-slate-700')
                      }`}
                    >
                      {btn.icon}
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Left Lower Side Options */}
            <div className="border-t pt-3 dark:border-[#71C7BD]/20">
              <button
                onClick={() => {
                  localStorage.removeItem('fisherman_profile')
                  setFishermanProfile(null)
                  setIsSidebarOpen(false)
                }}
                className={`w-full py-2 px-3 rounded flex items-center gap-2.5 font-bold transition-colors text-xs text-left ${
                  theme === 'dark'
                    ? 'hover:bg-rose-500/10 text-rose-300'
                    : 'hover:bg-rose-50 text-rose-600'
                }`}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>

          </aside>
        </>
      )}

      {/* SMS Alert Registration Pop-up Tab/Modal */}
      {showSmsPopup && (
        <div className="absolute inset-0 bg-black/75 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-lg border shadow-xl p-5 space-y-4 transition-all duration-200 ${
            theme === 'dark' ? 'bg-[#1E6E6F] border-[#71C7BD]/40 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
          }`}>
            
            {/* Modal Header */}
            <div className="flex flex-col items-center text-center gap-1.5 pb-2 border-b dark:border-[#71C7BD]/20">
              <Phone className={`h-8 w-8 animate-bounce ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
              <h2 className="font-extrabold text-sm uppercase tracking-wider">SMS Alert Registration</h2>
              <p className={`text-xs leading-normal font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                Receive direct SMS advisories in your preferred language.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSmsAlertRegister} className="space-y-4">
              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>
                  Enter phone number with country code
                </label>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={onboardingPhone}
                  onChange={(e) => setOnboardingPhone(e.target.value)}
                  disabled={onboardingSubmitting}
                  className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                      : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>
                  Enter email address
                </label>
                <input
                  type="email"
                  placeholder="fisherman@example.com"
                  value={onboardingEmail}
                  onChange={(e) => setOnboardingEmail(e.target.value)}
                  disabled={onboardingSubmitting}
                  className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                      : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>Language</label>
                  <select
                    value={onboardingLang}
                    onChange={(e) => setOnboardingLang(e.target.value)}
                    disabled={onboardingSubmitting}
                    className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                      theme === 'dark' 
                        ? 'bg-[#1E6E6F]/60 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                        : 'bg-[#F3B900] border border-slate-350 rounded p-2 focus:ring-1 focus:ring-[#FA7301]'
                    }`}
                  >
                    <option value="en" className="text-slate-800">English</option>
                    <option value="ta" className="text-slate-800">தமிழ் (Tamil)</option>
                    <option value="hi" className="text-slate-800">हिन्दी (Hindi)</option>
                  </select>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>Select Harbor / Port</label>
                  <select
                    value={onboardingRegion}
                    onChange={(e) => setOnboardingRegion(e.target.value)}
                    disabled={onboardingSubmitting}
                    className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                      theme === 'dark' 
                        ? 'bg-[#1E6E6F]/60 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                        : 'bg-[#F3B900] border border-slate-350 rounded p-2 focus:ring-1 focus:ring-[#FA7301]'
                    }`}
                  >
                    <option value="" className="text-slate-800">Select Harbor / Port</option>
                    <option value="chennai" className="text-slate-800">CHENNAI HARBOR (DEMO)</option>
                    <option value="mumbai" className="text-slate-800">MUMBAI HARBOR (DEMO)</option>
                    {regions.map(r => {
                      if (r.name === 'chennai' || r.name === 'mumbai') return null;
                      return (
                        <option key={r.id} value={r.name} className="text-slate-800">{r.name.toUpperCase()}</option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSmsSkip}
                  disabled={onboardingSubmitting}
                  className={`flex-1 font-bold py-2 rounded text-xs transition-colors border ${
                    theme === 'dark'
                      ? 'border-[#71C7BD]/30 hover:bg-[#71C7BD]/15 text-[#B6E6E9]'
                      : 'border-slate-300 hover:bg-[#F3B900] text-slate-600'
                  }`}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={onboardingSubmitting}
                  className={`flex-1 font-bold py-2 rounded text-xs transition-colors shadow-sm ${
                    theme === 'dark'
                      ? 'bg-[#4EC6D4] hover:bg-[#B6E6E9] text-[#1E6E6F]'
                      : 'bg-[#FA7301] hover:bg-[#FA7301]/90 text-white'
                  }`}
                >
                  {onboardingSubmitting ? 'Registering...' : 'Register for Alerts'}
                </button>
              </div>
            </form>

            {onboardingError && (
              <div className={`p-2 rounded text-[10px] text-center border font-semibold ${
                theme === 'dark' ? 'bg-[#F2D9B7]/20 border-[#F2D9B7]/30 text-[#F2D9B7]' : 'bg-rose-50 text-rose-800 border-rose-250'
              }`}>
                {onboardingError}
              </div>
            )}

          </div>
        </div>
      )}

      {/* 1. Header with View & Theme Toggle (Visible only after onboarding) */}
      {fishermanProfile && (
        <header className={`p-4 sticky top-0 z-50 shadow-md transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#1E6E6F] text-[#B6E6E9] border-b border-[#71C7BD]' : 'bg-[#FFA43A] text-white'
        }`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-1 rounded transition-colors ${
                  theme === 'dark' ? 'text-[#4EC6D4] hover:bg-[#71C7BD]/20' : 'text-white hover:bg-[#FFA43A]/50'
                }`}
                title="Open Sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="font-bold text-base leading-tight">{t('title')}</h1>
            </div>
            
            {/* Header Controls (Theme & Lang) */}
            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <div className={`flex items-center rounded px-2 py-0.5 text-xs border ${
                theme === 'dark'
                  ? 'bg-[#71C7BD]/20 text-[#B6E6E9] border-[#71C7BD]'
                  : 'bg-[#FFA43A]/50 text-white border-[#FFA43A]/60'
              }`}>
                <Globe className="h-3 w-3 mr-1 text-[#B6E6E9] dark:text-[#B6E6E9]" />
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value)}
                  className="bg-transparent text-inherit focus:outline-none cursor-pointer font-medium"
                >
                  <option value="en" className="text-slate-800">EN</option>
                  <option value="ta" className="text-slate-800">தமிழ்</option>
                  <option value="hi" className="text-slate-800">हिन्दी</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className={`flex border-t pt-2 text-xs transition-colors duration-200 ${
            theme === 'dark' ? 'border-[#71C7BD]/30' : 'border-[#FFA43A]/50'
          }`}>
            <button
              onClick={() => setCurrentTab('fisherman')}
              className={`flex-1 py-1 text-center font-bold transition-all rounded ${
                currentTab === 'fisherman' 
                  ? (theme === 'dark' ? 'bg-[#71C7BD] text-[#1E6E6F] shadow-inner' : 'bg-[#E45B11] text-white shadow-inner')
                  : (theme === 'dark' ? 'text-[#B6E6E9] hover:text-[#4EC6D4]' : 'text-emerald-100 hover:text-white')
              }`}
            >
              {t('fisherman_tab')}
            </button>
            <button
              onClick={() => setCurrentTab('admin')}
              className={`flex-1 py-1 text-center font-bold transition-all rounded flex justify-center items-center gap-1 transition-all ${
                currentTab === 'admin' 
                  ? (theme === 'dark' ? 'bg-[#71C7BD] text-[#1E6E6F] shadow-inner' : 'bg-[#E45B11] text-white shadow-inner')
                  : (theme === 'dark' ? 'text-[#B6E6E9] hover:text-[#4EC6D4]' : 'text-emerald-100 hover:text-white')
              }`}
            >
              <ShieldAlert className="h-3 w-3" />
              {t('admin_tab')}
            </button>
          </div>
        </header>
      )}

      {/* Connectivity Banner (Visible only after onboarding) */}
      {fishermanProfile && (
        <div className={`text-[10px] py-1.5 px-4 font-semibold flex items-center justify-between transition-colors border-b ${
          isOnline 
            ? (theme === 'dark' ? 'bg-[#71C7BD]/20 text-[#B6E6E9] border-[#71C7BD]/30' : 'bg-emerald-50 text-[#FA7301] border-emerald-100')
            : (theme === 'dark' ? 'bg-[#F2D9B7]/20 text-[#F2D9B7] border-[#F2D9B7]/30 animate-pulse' : 'bg-rose-50 text-[#E45B11] border-rose-100 animate-pulse')
        }`}>
          <div className="flex items-center gap-1">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{isOnline ? t('online_mode') : t('offline_mode')}</span>
          </div>
          <button 
            onClick={fetchGlobalData} 
            disabled={loading}
            className={`hover:underline flex items-center gap-0.5 font-bold ${
              theme === 'dark' ? 'text-[#4EC6D4]' : 'text-slate-500'
            }`}
          >
            <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh_btn')}
          </button>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 p-3 space-y-4 overflow-y-auto">
        {!fishermanProfile ? (
          /* Step 1: Onboarding Basic Info Setup Screen (Root Guard) */
          <section className={`border rounded-lg shadow-md p-5 my-auto space-y-4 transition-colors duration-200 ${
            theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
          }`}>
            <div className="flex flex-col items-center text-center gap-1.5 pb-2 border-b border-slate-100 dark:border-[#71C7BD]/20">
              <Compass className={`h-8 w-8 animate-spin-slow ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
              <h2 className="font-extrabold text-sm uppercase tracking-wider">Fisherman Sign-In</h2>
              <p className={`text-[10px] ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-500'}`}>
                Set up your portal options to access live advisories & safety reports.
              </p>
            </div>

            <form onSubmit={handleBasicInfoSubmit} className="space-y-3.5">
              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={onboardingName}
                  onChange={(e) => setOnboardingName(e.target.value)}
                  className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                      : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={onboardingPhone}
                  onChange={(e) => setOnboardingPhone(e.target.value)}
                  className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                      : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="fisherman@example.com"
                  value={onboardingEmail}
                  onChange={(e) => setOnboardingEmail(e.target.value)}
                  className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                      : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>Language</label>
                  <select
                    value={onboardingLang}
                    onChange={(e) => setOnboardingLang(e.target.value)}
                    className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                      theme === 'dark' 
                        ? 'bg-[#1E6E6F]/60 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                        : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                    }`}
                  >
                    <option value="en" className="text-slate-800">English</option>
                    <option value="ta" className="text-slate-800">தமிழ் (Tamil)</option>
                    <option value="hi" className="text-slate-800">हिन्दी (Hindi)</option>
                  </select>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>Country</label>
                  <input
                    type="text"
                    placeholder="Country"
                    value={onboardingCountry}
                    onChange={(e) => setOnboardingCountry(e.target.value)}
                    className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                      theme === 'dark' 
                        ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                        : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-455'}`}>Coastal Port</label>
                <select
                  value={onboardingRegion}
                  onChange={(e) => setOnboardingRegion(e.target.value)}
                  className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'bg-[#1E6E6F]/60 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                      : 'bg-[#F3B900] border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                  }`}
                >
                  <option value="" className="text-slate-800">Select Coastal Port</option>
                  <option value="chennai" className="text-slate-800">CHENNAI HARBOR (DEMO)</option>
                  <option value="mumbai" className="text-slate-800">MUMBAI HARBOR (DEMO)</option>
                  {regions.map(r => {
                    if (r.name === 'chennai' || r.name === 'mumbai') return null;
                    return (
                      <option key={r.id} value={r.name} className="text-slate-800">{r.name.toUpperCase()}</option>
                    )
                  })}
                </select>
              </div>

              <button
                type="submit"
                className={`w-full font-bold py-2 rounded text-xs transition-colors shadow-sm ${
                  theme === 'dark'
                    ? 'bg-[#4EC6D4] hover:bg-[#B6E6E9] text-[#1E6E6F]'
                    : 'bg-[#FA7301] hover:bg-[#FA7301]/90 text-white'
                }`}
              >
                Continue to SMS Registration
              </button>
            </form>

            {onboardingError && (
              <div className={`p-2 rounded text-[10px] text-center border font-semibold ${
                theme === 'dark' ? 'bg-[#F2D9B7]/20 border-[#F2D9B7]/30 text-[#F2D9B7]' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {onboardingError}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* ==================== VIEW 1: FISHERMAN PUBLIC VIEW ==================== */}
            {currentTab === 'fisherman' && (
              <>
                {/* Fisherman Active Profile Card */}
                <div className={`p-2.5 rounded-lg border shadow-sm flex items-center justify-between transition-colors duration-200 text-xs ${
                  theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <Compass className={`h-4 w-4 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
                    <div>
                      <span className="font-semibold block">Profile: {fishermanProfile.phone_number}</span>
                      <span className={`text-[10px] ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>
                        Region: {fishermanProfile.region ? fishermanProfile.region.toUpperCase() : 'Global'} | Lang: {fishermanProfile.preferred_language.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Advisories Grid */}
                <section className="space-y-2.5">
                  {loading && advisories.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      <RefreshCw className={`h-6 w-6 animate-spin mx-auto mb-1 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
                      Loading...
                    </div>
                  ) : filteredAdvisories.length === 0 ? (
                    <div className={`text-center py-8 rounded-lg border border-dashed text-xs ${
                      theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#71C7BD]' : 'bg-[#F3B900] border-slate-250 text-slate-405'
                    }`}>
                      {t('no_advisories')}
                    </div>
                  ) : (
                    filteredAdvisories.map(item => {
                      const severityColor = 
                        item.severity === 'high' 
                          ? (theme === 'dark' ? 'bg-[#F2D9B7]/10 text-[#F2D9B7] border-[#F2D9B7]/30' : 'bg-[#E45B11]/10 text-[#E45B11] border-[#E45B11]/25') :
                        item.severity === 'medium'
                          ? (theme === 'dark' ? 'bg-[#71C7BD]/10 text-[#71C7BD] border-[#71C7BD]/30' : 'bg-[#F3B900]/10 text-[#F3B900] border-[#F3B900]/25') :
                          (theme === 'dark' ? 'bg-[#4EC6D4]/10 text-[#4EC6D4] border-[#4EC6D4]/30' : 'bg-[#FA7301]/10 text-[#FA7301] border-[#FA7301]/25');
                      
                      return (
                        <article 
                          key={item.id}
                          className={`rounded-lg border shadow-sm p-3.5 relative overflow-hidden flex flex-col gap-1.5 transition-colors duration-200 ${
                            theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${theme === 'dark' ? 'bg-[#1E6E6F]/60' : 'bg-[#F3B900]'}`}>
                                {getIcon(item.type)}
                              </div>
                              <div>
                                <h3 className={`font-bold text-xs ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{item.title}</h3>
                              </div>
                            </div>
                            <span className={`text-[8px] font-extrabold tracking-wider px-1.5 py-0.5 rounded border uppercase ${severityColor}`}>
                              {t(`severity_${item.severity}`)}
                            </span>
                          </div>

                          <p className={`text-xs leading-normal font-normal p-2 rounded border transition-colors duration-200 ${
                            theme === 'dark' ? 'bg-[#1E6E6F]/40 text-[#B6E6E9] border-[#71C7BD]/20' : 'bg-[#F3B900] text-slate-600 border-slate-100'
                          }`}>
                            {getCardContent(item)}
                          </p>

                          {item.latitude && item.longitude && (
                            <div className={`text-[9px] font-medium flex items-center gap-1 ${
                              theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'
                            }`}>
                              <MapPin className={`h-2.5 w-2.5 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
                              <span>Scope: {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}° ({item.radius_km || 50}km Radius)</span>
                            </div>
                          )}
                        </article>
                      )
                    })
                  )}
                </section>

              </>
            )}
          </>
        )}

        {/* ==================== VIEW 2: ADMIN PROTECTED CONTROL ==================== */}
        {currentTab === 'admin' && (
          <>
            {/* If NOT authenticated -> Login Box */}
            {!token ? (
              <section className={`border rounded-lg shadow-sm p-5 space-y-3.5 transition-colors duration-200 ${
                theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
              }`}>
                <div className="flex flex-col items-center text-center gap-1">
                  <ShieldAlert className={`h-8 w-8 animate-bounce ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#E45B11]'}`} />
                  <h2 className="font-extrabold text-sm">{t('login_title')}</h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>{t('login_username')}</label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                        theme === 'dark'
                          ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]'
                          : 'border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] font-bold uppercase block mb-1 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>{t('login_password')}</label>
                    <input
                      type="password"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className={`w-full text-xs rounded p-2 focus:outline-none transition-colors duration-200 ${
                        theme === 'dark'
                          ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]'
                          : 'border border-slate-350 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full font-bold py-2 rounded text-xs transition-colors shadow-sm ${
                      theme === 'dark'
                        ? 'bg-[#4EC6D4] hover:bg-[#B6E6E9] text-[#1E6E6F]'
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
                  >
                    {t('login_submit')}
                  </button>
                </form>

                {loginError && (
                  <div className={`p-2 rounded text-[10px] text-center font-medium border ${
                    theme === 'dark' ? 'bg-[#F2D9B7]/25 text-[#F2D9B7] border-[#F2D9B7]/40' : 'bg-rose-50 text-rose-800 border-rose-250'
                  }`}>
                    {loginError}
                  </div>
                )}
              </section>
            ) : (
              // If authenticated -> Full Dashboard
              <div className="space-y-4">
                
                {/* Admin Status & Navigation Header */}
                <div className={`flex justify-between items-center p-2.5 rounded-lg text-xs shadow-inner transition-colors duration-200 ${
                  theme === 'dark' ? 'bg-[#1E6E6F] text-white border border-[#71C7BD]/30' : 'bg-slate-800 text-white'
                }`}>
                  <span className="font-semibold">Admin Control Panel</span>
                  <button 
                    onClick={handleLogout}
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 font-bold ${
                      theme === 'dark' 
                        ? 'bg-[#71C7BD] hover:bg-[#F2D9B7] text-[#1E6E6F]' 
                        : 'bg-slate-700 hover:bg-rose-700 text-white'
                    }`}
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
                          ? (theme === 'dark' ? 'bg-[#71C7BD] text-[#1E6E6F] border-[#71C7BD] shadow-sm' : 'bg-[#FA7301] text-white border-[#FA7301] shadow-sm')
                          : (theme === 'dark' ? 'bg-[#1E6E6F]/20 text-[#B6E6E9] border-[#71C7BD]/20 hover:bg-[#71C7BD]/20' : 'bg-[#F3B900] text-slate-600 hover:bg-[#F3B900] border-slate-250')
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>

                {/* Sub-tab 1: PUBLISH ADVISORY FORM */}
                {adminSubTab === 'publish' && (
                  <form onSubmit={handleCreateAdvisory} className={`border rounded-lg shadow-sm p-4 space-y-3 transition-colors duration-200 ${
                    theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                  }`}>
                    <h3 className={`font-extrabold text-xs border-b pb-1.5 flex items-center gap-1 ${
                      theme === 'dark' ? 'text-white border-[#71C7BD]/20' : 'text-slate-800 border-slate-100'
                    }`}>
                      <Plus className={`h-4 w-4 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-sky-600'}`} />
                      {t('add_advisory_title')}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className={`text-[9px] font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>{t('input_title')}</label>
                        <input
                          type="text"
                          placeholder="e.g. Rough Sea Advisory"
                          value={advTitle}
                          onChange={(e) => setAdvTitle(e.target.value)}
                          className={`w-full text-xs rounded p-1.5 focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[9px] font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>{t('input_type')}</label>
                        <select
                          value={advType}
                          onChange={(e) => setAdvType(e.target.value)}
                          className={`w-full text-xs rounded p-1.5 focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/60 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        >
                          <option value="weather" className="text-slate-800">Weather</option>
                          <option value="fishing_zone" className="text-slate-800">Fishing Zone</option>
                          <option value="safety" className="text-slate-800">Safety</option>
                          <option value="general" className="text-slate-800">General</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                      <div className="col-span-1">
                        <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>Severity</label>
                        <select
                          value={advSeverity}
                          onChange={(e) => setAdvSeverity(e.target.value)}
                          className={`w-full text-[9px] rounded py-1 px-0.5 focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/60 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        >
                          <option value="low" className="text-slate-800">Info</option>
                          <option value="medium" className="text-slate-800">Warning</option>
                          <option value="high" className="text-slate-800">Critical</option>
                        </select>
                      </div>
                      <div className="col-span-1">
                        <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>Latitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 13.08"
                          value={advLat}
                          onChange={(e) => setAdvLat(e.target.value)}
                          className={`w-full rounded py-1 px-1 text-xs focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>Longitude</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="80.27"
                          value={advLng}
                          onChange={(e) => setAdvLng(e.target.value)}
                          className={`w-full rounded py-1 px-1 text-xs focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>Radius (km)</label>
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          value={advRadius}
                          onChange={(e) => setAdvRadius(e.target.value)}
                          className={`w-full rounded py-1 px-1 text-xs focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-[10px]">
                      <div>
                        <label className={`font-bold uppercase block mb-0.5 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>{t('input_content_en')} *</label>
                        <textarea
                          rows="2"
                          placeholder="English message content..."
                          value={advContentEn}
                          onChange={(e) => setAdvContentEn(e.target.value)}
                          className={`w-full text-xs rounded p-1.5 focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`font-bold uppercase block mb-0.5 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>{t('input_content_ta')}</label>
                        <textarea
                          rows="1"
                          placeholder="Tamil version..."
                          value={advContentTa}
                          onChange={(e) => setAdvContentTa(e.target.value)}
                          className={`w-full text-xs rounded p-1.5 focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`font-bold uppercase block mb-0.5 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>{t('input_content_hi')}</label>
                        <textarea
                          rows="1"
                          placeholder="Hindi version..."
                          value={advContentHi}
                          onChange={(e) => setAdvContentHi(e.target.value)}
                          className={`w-full text-xs rounded p-1.5 focus:outline-none transition-colors duration-200 ${
                            theme === 'dark' 
                              ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                              : 'bg-[#F3B900] border border-slate-300 text-slate-800 focus:ring-1 focus:ring-[#FA7301]'
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`w-full font-bold py-2 rounded text-xs transition-colors shadow-sm ${
                        theme === 'dark'
                          ? 'bg-[#4EC6D4] hover:bg-[#B6E6E9] text-[#1E6E6F]'
                          : 'bg-[#FA7301] hover:bg-[#FA7301]/90 text-white'
                      }`}
                    >
                      {t('submit_advisory_btn')}
                    </button>

                    {advSuccess && (
                      <div className={`p-2 rounded text-[10px] text-center border ${
                        theme === 'dark' ? 'bg-[#71C7BD]/20 border-[#71C7BD]/30 text-[#4EC6D4]' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                      }`}>
                        {advSuccess}
                      </div>
                    )}
                    {advError && (
                      <div className={`p-2 rounded text-[10px] text-center border ${
                        theme === 'dark' ? 'bg-[#F2D9B7]/20 border-[#F2D9B7]/30 text-[#F2D9B7]' : 'bg-rose-50 text-rose-800 border-rose-100'
                      }`}>
                        {advError}
                      </div>
                    )}
                  </form>
                )}

                {/* Sub-tab 2: REGIONS TABLE & FORM */}
                {adminSubTab === 'regions' && (
                  <div className="space-y-3">
                    
                    {/* Add Region Form */}
                    <form onSubmit={handleCreateRegion} className={`border rounded-lg shadow-sm p-4 space-y-3 transition-colors duration-200 ${
                      theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                    }`}>
                      <h3 className={`font-extrabold text-xs border-b pb-1.5 flex items-center gap-1 ${
                        theme === 'dark' ? 'text-white border-[#71C7BD]/20' : 'text-slate-800 border-slate-100'
                      }`}>
                        <MapPin className={`h-4 w-4 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-[#FA7301]'}`} />
                        {t('manage_regions')}
                      </h3>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div>
                          <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>{t('region_name_input')}</label>
                          <input
                            type="text"
                            placeholder="e.g. chennai"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            className={`w-full text-xs rounded p-1 focus:outline-none transition-colors duration-200 ${
                              theme === 'dark' 
                                ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                                : 'bg-[#F3B900] border border-slate-300 text-slate-850 focus:ring-1 focus:ring-[#FA7301]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>Lat</label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="13.08"
                            value={regLat}
                            onChange={(e) => setRegLat(e.target.value)}
                            className={`w-full text-xs rounded p-1 focus:outline-none transition-colors duration-200 ${
                              theme === 'dark' 
                                ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                                : 'bg-[#F3B900] border border-slate-300 text-slate-850 focus:ring-1 focus:ring-[#FA7301]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`font-bold uppercase mb-0.5 block ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>Lng</label>
                          <input
                            type="number"
                            step="0.0001"
                            placeholder="80.27"
                            value={regLng}
                            onChange={(e) => setRegLng(e.target.value)}
                            className={`w-full text-xs rounded p-1 focus:outline-none transition-colors duration-200 ${
                              theme === 'dark' 
                                ? 'bg-[#1E6E6F]/30 border border-[#71C7BD]/40 text-white focus:ring-1 focus:ring-[#4EC6D4]' 
                                : 'bg-[#F3B900] border border-slate-300 text-slate-850 focus:ring-1 focus:ring-[#FA7301]'
                            }`}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className={`w-full font-bold py-1.5 rounded text-xs transition-colors ${
                          theme === 'dark'
                            ? 'bg-[#4EC6D4] hover:bg-[#B6E6E9] text-[#1E6E6F]'
                            : 'bg-[#FA7301] hover:bg-[#FA7301]/90 text-white'
                        }`}
                      >
                        {t('add_region_btn')}
                      </button>

                      {regSuccess && (
                        <div className={`p-2 rounded text-[10px] text-center border ${
                          theme === 'dark' ? 'bg-[#71C7BD]/20 border-[#71C7BD]/30 text-[#4EC6D4]' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                        }`}>{regSuccess}</div>
                      )}
                      {regError && (
                        <div className={`p-2 rounded text-[10px] text-center border ${
                          theme === 'dark' ? 'bg-[#F2D9B7]/20 border-[#F2D9B7]/30 text-[#F2D9B7]' : 'bg-rose-50 text-rose-800 border-rose-100'
                        }`}>{regError}</div>
                      )}
                    </form>

                    {/* Regions List */}
                    <div className={`border rounded-lg shadow-sm p-4 space-y-2 transition-colors duration-200 ${
                      theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                    }`}>
                      <h4 className={`font-bold text-xs flex items-center gap-1 border-b pb-1 ${
                        theme === 'dark' ? 'text-white border-[#71C7BD]/20' : 'text-slate-800 border-slate-100'
                      }`}>
                        <List className="h-4.5 w-4.5" />
                        Ports Index
                      </h4>
                      
                      {regions.length === 0 ? (
                        <p className={`text-[10px] text-center py-2 ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>No registered ports found.</p>
                      ) : (
                        <div className={`divide-y max-h-48 overflow-y-auto ${theme === 'dark' ? 'divide-[#71C7BD]/10' : 'divide-slate-100'}`}>
                          {regions.map(r => (
                            <div key={r.id} className="flex justify-between items-center py-2 text-xs">
                              <div>
                                <span className="font-bold text-slate-700 capitalize">{r.name}</span>
                                <span className="text-[10px] text-slate-450 block">Coordinates: {r.latitude}°, {r.longitude}°</span>
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
                  <div className={`border rounded-lg shadow-sm p-4 space-y-3.5 transition-colors duration-200 ${
                    theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                  }`}>
                    <h3 className={`font-extrabold text-xs border-b pb-1.5 flex items-center gap-1 ${
                      theme === 'dark' ? 'text-white border-[#71C7BD]/20' : 'text-slate-800 border-slate-100'
                    }`}>
                      <Send className={`h-4 w-4 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-sky-655 text-sky-600'}`} />
                      Active Broadcast List
                    </h3>

                    {advisories.length === 0 ? (
                      <p className={`text-center py-6 text-xs ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>No active advisories to broadcast.</p>
                    ) : (
                      <div className="space-y-3">
                        {advisories.map(adv => (
                          <div key={adv.id} className={`border p-3 rounded-lg flex flex-col gap-2 relative transition-colors duration-200 ${
                            theme === 'dark' ? 'bg-[#1E6E6F]/40 border-[#71C7BD]/25 text-[#B6E6E9]' : 'border-slate-150 bg-[#F3B900] text-slate-800'
                          }`}>
                            <div className="flex justify-between items-start gap-1">
                              <div>
                                <h4 className={`font-bold text-xs ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{adv.title}</h4>
                                <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>{adv.type}</span>
                              </div>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                                theme === 'dark' ? 'bg-[#1E6E6F] text-[#B6E6E9] border-[#71C7BD]/30' : 'bg-slate-200 text-slate-700 border-slate-300'
                              }`}>ID #{adv.id}</span>
                            </div>

                            <p className={`text-[11px] font-medium p-2 rounded border leading-snug transition-colors duration-200 ${
                              theme === 'dark' ? 'bg-[#1E6E6F]/65 border-[#71C7BD]/15 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-100 text-slate-600'
                            }`}>
                              {adv.content_en}
                            </p>

                            <button
                              onClick={() => handleBroadcast(adv.id)}
                              className={`self-end font-bold py-1 px-3 rounded text-[10px] transition-colors flex items-center gap-1 shadow-sm ${
                                theme === 'dark'
                                  ? 'bg-[#4EC6D4] hover:bg-[#B6E6E9] text-[#1E6E6F]'
                                  : 'bg-[#FA7301] hover:bg-[#FA7301]/90 text-white'
                              }`}
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
                  <div className={`border rounded-lg shadow-sm p-4 space-y-3.5 transition-colors duration-200 ${
                    theme === 'dark' ? 'bg-[#1E6E6F]/20 border-[#71C7BD]/30 text-[#B6E6E9]' : 'bg-[#F3B900] border-slate-200 text-slate-800'
                  }`}>
                    <div className={`flex justify-between items-center border-b pb-1.5 ${
                      theme === 'dark' ? 'border-[#71C7BD]/20' : 'border-slate-100'
                    }`}>
                      <h3 className="font-extrabold text-xs flex items-center gap-1">
                        <History className={`h-4 w-4 ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-sky-655 text-sky-600'}`} />
                        {t('broadcast_log_title')}
                      </h3>
                      <button 
                        onClick={fetchBroadcastLogs}
                        className={`text-[10px] font-bold hover:underline ${theme === 'dark' ? 'text-[#4EC6D4]' : 'text-sky-655 text-sky-600'}`}
                      >
                        Refresh Logs
                      </button>
                    </div>

                    {broadcastLogs.length === 0 ? (
                      <p className={`text-center py-6 text-xs ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-400'}`}>No broadcast history logs found.</p>
                    ) : (
                      <div className={`max-h-80 overflow-y-auto border rounded ${theme === 'dark' ? 'border-[#71C7BD]/20' : 'border-slate-105'}`}>
                        <table className="w-full text-left text-[10px] border-collapse">
                          <thead>
                            <tr className={`border-b font-bold ${
                              theme === 'dark' ? 'bg-[#1E6E6F]/45 border-[#71C7BD]/20 text-[#B6E6E9]' : 'bg-slate-100 border-slate-200 text-slate-650'
                            }`}>
                              <th className="p-2">Adv</th>
                              <th className="p-2">{t('log_recipient')}</th>
                              <th className="p-2">{t('log_status')}</th>
                              <th className="p-2">{t('log_time')}</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#71C7BD]/10' : 'divide-slate-100'}`}>
                            {broadcastLogs.map(log => {
                              const badgeStyle = 
                                log.status === 'success' 
                                  ? (theme === 'dark' ? 'bg-[#71C7BD]/20 text-[#4EC6D4] border-[#71C7BD]/30' : 'bg-emerald-100 text-emerald-800 font-extrabold border-emerald-200')
                                  : log.status === 'skipped'
                                  ? (theme === 'dark' ? 'bg-[#F2D9B7]/20 text-[#F2D9B7] border-[#F2D9B7]/30' : 'bg-amber-100 text-amber-800 font-bold border-amber-200')
                                  : (theme === 'dark' ? 'bg-[#E45B11]/20 text-[#E45B11] border-[#E45B11]/30' : 'bg-rose-100 text-rose-800 font-bold border-rose-250');
                                
                              return (
                                <tr key={log.id} className={`transition-colors duration-150 ${
                                  theme === 'dark' ? 'hover:bg-[#F3B900]/5 text-[#B6E6E9]' : 'hover:bg-[#F3B900] text-slate-600'
                                }`}>
                                  <td className="p-2 font-bold text-slate-700 dark:text-white">#{log.advisory_id}</td>
                                  <td className="p-2">{log.recipient_phone || log.recipient_email}</td>
                                  <td className="p-2">
                                    <span className={`px-1 py-0.2 rounded border text-[9px] ${badgeStyle}`}>
                                      {log.status.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className={`p-2 font-normal text-[8px] ${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-450'}`}>
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
      <footer className={`text-center py-4 text-[10px] border-t space-y-1 transition-colors duration-200 ${
        theme === 'dark' ? 'bg-[#1E6E6F] text-[#B6E6E9] border-[#71C7BD]/20' : 'bg-slate-800 text-slate-400 border-slate-700'
      }`}>
        <p>© 2026 Fisheries Advisory Delivery Initiative</p>
        <p className={`${theme === 'dark' ? 'text-[#71C7BD]' : 'text-slate-550 text-slate-500'}`}>Low-Bandwidth Optimized | Service Worker Cache Enabled</p>
      </footer>
    </div>
  )
}

export default App
