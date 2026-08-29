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
  MapPin
} from 'lucide-react'

// Import localization bundles
import en from './locales/en.json'
import ta from './locales/ta.json'
import hi from './locales/hi.json'

const locales = { en, ta, hi }
const BACKEND_URL = 'http://127.0.0.1:8000'

function App() {
  // 1. Language & Localization Setup
  const [lang, setLang] = useState('en')
  const t = (key) => locales[lang][key] || locales['en'][key] || key

  // 2. Connectivity & Online/Offline Handling
  const [isOnline, setIsOnline] = useState(navigator.onLine)
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

  // 3. Advisory Fetching and LocalStorage Caching (Offline First)
  const [advisories, setAdvisories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const fetchAdvisories = async () => {
    setLoading(true)
    setError(null)
    try {
      if (navigator.onLine) {
        const response = await fetch(`${BACKEND_URL}/api/advisories`)
        if (!response.ok) throw new Error('Network response was not ok')
        const data = await response.json()
        setAdvisories(data)
        // Store in local storage for offline retrieval
        localStorage.setItem('cached_advisories', JSON.stringify(data))
      } else {
        // Load from local storage cache
        const cached = localStorage.getItem('cached_advisories')
        if (cached) {
          setAdvisories(JSON.parse(cached))
        }
      }
    } catch (err) {
      console.error('Error fetching advisories:', err)
      setError('Could not retrieve new advisories.')
      // Fallback to cache on api crash
      const cached = localStorage.getItem('cached_advisories')
      if (cached) {
        setAdvisories(JSON.parse(cached))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdvisories()
  }, [isOnline])

  // 4. SMS Registration form state
  const [phoneNumber, setPhoneNumber] = useState('')
  const [subLanguage, setSubLanguage] = useState('en')
  const [region, setRegion] = useState('')
  const [subSuccess, setSubSuccess] = useState(false)
  const [subError, setSubError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubscribe = async (e) => {
    e.preventDefault()
    setSubSuccess(false)
    setSubError('')
    
    if (!phoneNumber.trim()) {
      setSubError('Phone number is required.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          preferred_language: subLanguage,
          region: region || null
        })
      })

      if (!response.ok) throw new Error('Registration failed')
      
      setSubSuccess(true)
      setPhoneNumber('')
      setRegion('')
    } catch (err) {
      console.error(err)
      setSubError('Failed to register. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper: Get translated card content
  const getCardContent = (item) => {
    if (lang === 'ta' && item.content_ta) return item.content_ta
    if (lang === 'te' && item.content_te) return item.content_te
    if (lang === 'hi' && item.content_hi) return item.content_hi
    return item.content_en
  }

  // Filter logic
  const filteredAdvisories = advisories.filter(item => {
    if (filter === 'all') return true
    return item.type === filter
  })

  // Advisory icons mapping
  const getIcon = (type) => {
    switch (type) {
      case 'weather':
        return <CloudRain className="h-6 w-6 text-blue-600" />
      case 'fishing_zone':
        return <Compass className="h-6 w-6 text-emerald-600" />
      case 'safety':
        return <AlertTriangle className="h-6 w-6 text-amber-600" />
      default:
        return <Globe className="h-6 w-6 text-slate-600" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto border-x border-slate-200 shadow-lg">
      
      {/* 1. Header & Connectivity Banner */}
      <header className="bg-sky-700 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 animate-pulse" />
            <h1 className="font-bold text-lg leading-tight">{t('title')}</h1>
          </div>
          
          {/* Language Selector */}
          <div className="flex items-center bg-sky-800 rounded px-2 py-1 text-sm border border-sky-600">
            <Globe className="h-4 w-4 mr-1 text-sky-200" />
            <select 
              value={lang} 
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
            >
              <option value="en" className="text-slate-800">English</option>
              <option value="ta" className="text-slate-800">தமிழ் (Tamil)</option>
              <option value="hi" className="text-slate-800">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-sky-100 mt-1">{t('subtitle')}</p>
      </header>

      {/* Connectivity Banner */}
      <div className={`text-xs py-1.5 px-4 font-semibold flex items-center justify-between transition-colors ${
        isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'
      }`}>
        <div className="flex items-center gap-1.5">
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span>{isOnline ? t('online_mode') : t('offline_mode')}</span>
        </div>
        <button 
          onClick={fetchAdvisories} 
          disabled={loading}
          className="hover:underline flex items-center gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh_btn')}
        </button>
      </div>

      <main className="flex-1 p-4 space-y-6">

        {/* 2. Advisory Filters */}
        <section className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <label className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wide">
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
                className={`text-[10px] sm:text-xs font-medium py-1.5 px-1 rounded transition-colors text-center ${
                  filter === btn.id 
                    ? 'bg-sky-600 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </section>

        {/* 3. Advisories List */}
        <section className="space-y-3">
          {loading && advisories.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-sky-600" />
              Loading advisories...
            </div>
          ) : filteredAdvisories.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm">
              <Compass className="h-8 w-8 mx-auto mb-2 text-slate-300" />
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
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 relative overflow-hidden flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100">
                        {getIcon(item.type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                        <span className="text-[10px] text-slate-400 capitalize">{item.type}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${severityColor}`}>
                      {t(`severity_${item.severity}`)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-650 leading-relaxed font-normal bg-slate-50 p-2.5 rounded border border-slate-100">
                    {getCardContent(item)}
                  </p>

                  {item.valid_until && (
                    <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                      <span>{t('card_expires')}:</span>
                      <span className="font-medium text-slate-500">
                        {new Date(item.valid_until).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </section>

        {/* 4. SMS Alerts Registration Panel */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-sky-700">
            <Phone className="h-5 w-5" />
            <h2 className="font-bold text-sm">{t('subscribe_title')}</h2>
          </div>
          <p className="text-xs text-slate-500 leading-normal">{t('subscribe_desc')}</p>
          
          <form onSubmit={handleSubscribe} className="space-y-2">
            <div>
              <input
                type="tel"
                placeholder={t('sub_phone_placeholder')}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={submitting}
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <select
                value={subLanguage}
                onChange={(e) => setSubLanguage(e.target.value)}
                disabled={submitting}
                className="text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 bg-white"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('sub_region_placeholder')}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  disabled={submitting}
                  className="w-full text-xs border border-slate-300 rounded p-2 pl-7 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
                <MapPin className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-sky-650 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded text-xs transition-colors shadow-sm focus:outline-none bg-sky-600 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : t('sub_submit_btn')}
            </button>
          </form>

          {subSuccess && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-250 p-2.5 rounded text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{t('sub_success')}</span>
            </div>
          )}

          {subError && (
            <div className="bg-rose-50 text-rose-800 border border-rose-250 p-2.5 rounded text-xs">
              {subError}
            </div>
          )}
        </section>
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
