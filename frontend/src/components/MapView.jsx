import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ✅ Import marker icons from LOCAL leaflet package (Vite bundles these — works offline)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// ✅ Use leaflet.offline tileLayerOffline — serves tiles from IndexedDB when offline
import { tileLayerOffline, savetiles, getStorageInfo } from 'leaflet.offline'

// Fix default marker icon (uses local bundled images, NOT CDN)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const LAST_POS_KEY = 'fisheries_last_position'
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const pulsingDotStyle = `
  @keyframes gps-pulse {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .gps-dot {
    width: 16px;
    height: 16px;
    background: #3b82f6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    animation: gps-pulse 2s infinite;
  }
  .leaflet-container { font-family: inherit; z-index: 1; }
`

function createGpsIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="gps-dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function MapView({ isOnline }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const accuracyCircleRef = useRef(null)
  const watchIdRef = useRef(null)
  const tileLayerRef = useRef(null)

  const [position, setPosition] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [gpsError, setGpsError] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [savingTiles, setSavingTiles] = useState(false)
  const [tilesSaved, setTilesSaved] = useState(false)
  const [cachedTileCount, setCachedTileCount] = useState(0)
  const [saveProgress, setSaveProgress] = useState(0)
  const [weatherData, setWeatherData] = useState(null)
  const [loadingWeather, setLoadingWeather] = useState(false)

  // Load last known position
  const lastSavedPos = (() => {
    try { return JSON.parse(localStorage.getItem(LAST_POS_KEY)) }
    catch { return null }
  })()

  const initialCenter = lastSavedPos
    ? [lastSavedPos.lat, lastSavedPos.lng]
    : [10.8505, 76.2711] // Kerala coast default

  // Check how many tiles are cached in IndexedDB
  const refreshCacheInfo = useCallback(async () => {
    try {
      const info = await getStorageInfo(OSM_TILE_URL)
      setCachedTileCount(info.length || 0)
    } catch { setCachedTileCount(0) }
  }, [])

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return

    const style = document.createElement('style')
    style.textContent = pulsingDotStyle
    document.head.appendChild(style)

    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: lastSavedPos ? 13 : 7,
      zoomControl: true,
      attributionControl: true,
    })

    // ✅ tileLayerOffline: automatically serves cached tiles from IndexedDB when offline
    //    When online: fetches from OSM AND saves to IndexedDB automatically
    //    When offline: serves from IndexedDB — zero internet needed
    const tileLayer = tileLayerOffline(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 18,
      subdomains: ['a', 'b', 'c'],
      crossOrigin: true,
    })
    tileLayer.addTo(map)
    tileLayerRef.current = tileLayer

    // Show last known position immediately on map
    if (lastSavedPos) {
      const marker = L.marker([lastSavedPos.lat, lastSavedPos.lng], {
        icon: createGpsIcon(),
        title: 'Last known position',
        zIndexOffset: 1000,
      }).addTo(map)
      marker.bindPopup(
        `<b>📍 Last Known Position</b><br>Lat: ${lastSavedPos.lat.toFixed(5)}<br>Lng: ${lastSavedPos.lng.toFixed(5)}<br><em>GPS acquiring...</em>`
      )
      markerRef.current = marker
    }

    mapInstanceRef.current = map
    refreshCacheInfo()

    return () => {
      map.remove()
      mapInstanceRef.current = null
      style.remove()
    }
  }, [])

  // Shared position update function
  const updateMapPosition = useCallback((lat, lng, acc) => {
    setPosition({ lat, lng })
    setAccuracy(acc)
    setGpsStatus('active')
    setGpsError(null)

    // Save to localStorage as offline fallback
    localStorage.setItem(LAST_POS_KEY, JSON.stringify({ lat, lng, acc, ts: Date.now() }))

    const map = mapInstanceRef.current
    if (!map) return

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: createGpsIcon(),
        zIndexOffset: 1000,
      }).addTo(map)
    }
    markerRef.current.bindPopup(
      `<b>📍 Your Location</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}<br>Accuracy: ±${Math.round(acc)}m`
    )

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lng]).setRadius(acc)
    } else {
      accuracyCircleRef.current = L.circle([lat, lng], {
        radius: acc,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map)
    }

    map.panTo([lat, lng], { animate: true })
  }, [])

  // GPS Tracking — two-stage: fast coarse fix first, then high-accuracy GPS
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported by your device.')
      setGpsStatus('error')
      return
    }

    setGpsStatus('acquiring')
    setGpsError(null)

    const onPosition = (pos) => {
      const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords
      updateMapPosition(lat, lng, acc)
    }

    const onError = (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setGpsStatus('error')
          setGpsError('Location permission denied. Please allow access in browser settings.')
          break
        case err.POSITION_UNAVAILABLE:
          setGpsStatus('error')
          setGpsError('GPS signal unavailable. Move to an open area.')
          break
        case err.TIMEOUT:
          // Auto-fallback to low-accuracy (network/WiFi) on timeout
          setGpsError('Switching to network location (GPS timed out)...')
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
          }
          watchIdRef.current = navigator.geolocation.watchPosition(
            onPosition,
            () => {
              setGpsStatus('error')
              setGpsError('Unable to get location. Check browser location permissions.')
            },
            { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
          )
          break
        default:
          setGpsStatus('error')
          setGpsError('Unable to get location.')
      }
    }

    // Stage 1: Quick coarse fix (network/IP — instant, works with low signal)
    navigator.geolocation.getCurrentPosition(
      onPosition,
      () => {}, // Ignore — Stage 2 will handle errors
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    )

    // Stage 2: Precise GPS watch (updates the dot as GPS locks in)
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    )
  }, [updateMapPosition])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setGpsStatus('idle')
  }, [])

  // Auto-start GPS on mount
  useEffect(() => {
    startTracking()
    return () => stopTracking()
  }, [startTracking, stopTracking])

  // Save map area tiles to IndexedDB using leaflet.offline savetiles()
  const saveAreaForOffline = useCallback(async () => {
    const map = mapInstanceRef.current
    const layer = tileLayerRef.current
    if (!map || !layer || !isOnline) return

    setSavingTiles(true)
    setSaveProgress(0)
    setTilesSaved(false)

    const bounds = map.getBounds()
    const currentZoom = map.getZoom()

    // Save tiles from zoom 7 to current zoom + 1 (max 15)
    const minZoom = Math.max(5, currentZoom - 3)
    const maxZoom = Math.min(15, currentZoom + 1)

    try {
      await savetiles(layer, {
        zoomlevels: Array.from(
          { length: maxZoom - minZoom + 1 },
          (_, i) => minZoom + i
        ),
        bounds,
        maxZoom,
        // Progress callback
        confirm: (total, cb) => {
          cb() // auto-confirm
        },
        confirmRemove: (total, cb) => cb(), // auto-confirm removals
        saveError: (err) => console.error('Tile save error:', err),
        loadTileImageUrl: (url, cb) => {
          setSaveProgress(prev => prev + 1)
          cb(url)
        },
      })

      await refreshCacheInfo()
      setTilesSaved(true)
      setSaveProgress(0)
      setTimeout(() => setTilesSaved(false), 4000)
    } catch (e) {
      console.error('savetiles failed:', e)
    } finally {
      setSavingTiles(false)
    }
  }, [isOnline, refreshCacheInfo])

  const statusColor = {
    idle: 'text-slate-400',
    acquiring: 'text-amber-500',
    active: 'text-emerald-500',
    error: 'text-rose-500',
  }

  const statusLabel = {
    idle: 'GPS Inactive',
    acquiring: 'Acquiring GPS Signal...',
    active: position
      ? `${position.lat.toFixed(4)}°N, ${position.lng.toFixed(4)}°E`
      : 'GPS Active',
    error: gpsError || 'GPS Error',
  }

  return (
    <div className="flex flex-col gap-3">
      {/* GPS Status Bar */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-xs font-semibold ${statusColor[gpsStatus]}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${
              gpsStatus === 'active' ? 'bg-emerald-500 animate-pulse' :
              gpsStatus === 'acquiring' ? 'bg-amber-400 animate-pulse' :
              gpsStatus === 'error' ? 'bg-rose-500' : 'bg-slate-300'
            }`} />
            {gpsStatus === 'active' ? '📡 GPS Active — ' : ''}{statusLabel[gpsStatus]}
          </div>
          <div className="flex gap-1">
            {gpsStatus !== 'active' && gpsStatus !== 'acquiring' ? (
              <button
                onClick={startTracking}
                className="text-[10px] bg-sky-600 text-white px-2 py-1 rounded hover:bg-sky-700 transition-colors"
              >
                📡 Start GPS
              </button>
            ) : (
              <button
                onClick={stopTracking}
                className="text-[10px] bg-slate-500 text-white px-2 py-1 rounded hover:bg-slate-600 transition-colors"
              >
                ⏹ Stop
              </button>
            )}
          </div>
        </div>

        {accuracy && (
          <div className="text-[10px] text-slate-500 flex items-center gap-3">
            <span>Accuracy: ±{Math.round(accuracy)}m</span>
            {!isOnline && (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                📴 OFFLINE MODE
              </span>
            )}
          </div>
        )}

        {lastSavedPos && gpsStatus !== 'active' && (
          <div className="text-[10px] text-slate-400 italic">
            📍 Showing last known position (GPS acquiring...)
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <div ref={mapRef} style={{ height: '380px', width: '100%' }} />
      </div>

      {/* Offline Tile Manager */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              💾 Offline Map Storage
              {cachedTileCount > 0 && (
                <span className="ml-2 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                  {cachedTileCount} tiles cached
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {isOnline
                ? 'Save current area so the map works without internet'
                : cachedTileCount > 0
                  ? `✅ Working offline — ${cachedTileCount} tiles available`
                  : '⚠️ No tiles cached. Go online and save the area first.'}
            </p>
          </div>
          <button
            onClick={saveAreaForOffline}
            disabled={!isOnline || savingTiles}
            className={`text-[10px] px-3 py-1.5 rounded font-semibold transition-colors whitespace-nowrap ${
              isOnline && !savingTiles
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {savingTiles
              ? `⏳ ${saveProgress > 0 ? saveProgress + ' saved' : 'Saving...'}`
              : tilesSaved
                ? '✅ Saved!'
                : '⬇ Save for Offline'}
          </button>
        </div>

        {!isOnline && cachedTileCount === 0 && (
          <div className="bg-rose-50 border border-rose-100 rounded p-2 text-[10px] text-rose-700">
            ⚠️ No offline tiles cached yet. Connect to internet, navigate to your fishing area on the map, then tap "Save for Offline".
          </div>
        )}

        {cachedTileCount > 0 && isOnline && (
          <div className="text-[10px] text-slate-500">
            Map will continue working even without internet. Tiles are stored on your device.
          </div>
        )}
      </div>

      {/* Weather ML Prediction */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              ⛅ ML Weather Prediction
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Predict weather safety for your current location.
            </p>
          </div>
          <button
            onClick={async () => {
              const pos = position || lastSavedPos
              if (!pos) {
                alert('Please wait for GPS location or ensure last location is saved.')
                return
              }
              setLoadingWeather(true)
              try {
                // Using relative path assuming API proxy is setup, else localhost fallback
                const baseUrl = window.location.hostname === 'localhost' ? 'http://127.0.0.1:8000' : ''
                const res = await fetch(`${baseUrl}/api/predict-weather?lat=${pos.lat}&lon=${pos.lng}`)
                if (!res.ok) throw new Error('Failed to fetch prediction')
                const data = await res.json()
                setWeatherData(data)
              } catch (err) {
                console.error(err)
                alert('Could not fetch weather prediction. Ensure backend is running.')
              } finally {
                setLoadingWeather(false)
              }
            }}
            disabled={loadingWeather || (!position && !lastSavedPos)}
            className={`text-[10px] px-3 py-1.5 rounded font-semibold transition-colors whitespace-nowrap ${
              loadingWeather || (!position && !lastSavedPos)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {loadingWeather ? '⏳ Predicting...' : '🔮 Predict Safety'}
          </button>
        </div>

        {weatherData && (
          <div className={`mt-2 p-3 rounded border text-sm ${
            weatherData.safety.level === 'safe' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            weatherData.safety.level === 'danger' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="font-bold mb-1 flex items-center gap-2">
              <span className="text-xl">
                {weatherData.safety.level === 'safe' ? '🟢' : weatherData.safety.level === 'danger' ? '🔴' : '🟡'}
              </span>
              {weatherData.prediction.weather} ({(weatherData.prediction.confidence * 100).toFixed(1)}%)
            </div>
            <p className="text-xs opacity-90 leading-tight">
              {weatherData.safety.advice}
            </p>
            <div className="text-[9px] opacity-70 mt-2 text-right">
              Powered by {weatherData.model_info.name} ({weatherData.mode})
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MapView
