import React, { useState, useEffect } from 'react';
import { RouteStop, SavedAddress, TravelMode, RouteSummary, SavedRoute } from './types';
import RoutePlanner from './components/RoutePlanner';
import SavedAddresses from './components/SavedAddresses';
import SavedRoutesView from './components/SavedRoutesView';
import SettingsComponent from './components/Settings';
import VisitsAndDeficiencies from './components/VisitsAndDeficiencies';
import LeafletMap from './components/LeafletMap';
import FieldRouteTracker from './components/FieldRouteTracker';
import { detectSmartCategory } from './utils/categoryDetector';
import {
  Navigation, Bookmark, Map as MapIcon, Lock, LogOut, RefreshCw, Terminal,
  CheckCircle2, AlertTriangle, X, Settings as SettingsIcon, ClipboardList,
  CheckSquare, FolderKanban, Smartphone, Zap
} from 'lucide-react';
import {
  getStoredAddresses,
  saveStoredAddresses,
  getStoredActiveStops,
  saveStoredActiveStops,
  getStoredDefaultOrigin,
  saveStoredDefaultOrigin,
  getStoredSavedRoutes,
  saveStoredSavedRoutes
} from './services/storage';
import { Capacitor } from '@capacitor/core';

export default function App() {
  // Authentication states - Auto-login on native mobile or offline
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      if (Capacitor.isNativePlatform()) return true;
      if (localStorage.getItem('rotaplan_offline_mode') === 'true') return true;
      if (localStorage.getItem('rotaplan_auth_token')) return true;
    }
    return null;
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Update App states (for VDS web backend)
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Saved Addresses (Offline-first with VDS sync fallback)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => getStoredAddresses());

  // Saved Routes (Offline-first with VDS sync fallback)
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => getStoredSavedRoutes());

  // Sabit Başlangıç Konumu (Default Origin) state
  const [defaultOrigin, setDefaultOrigin] = useState<RouteStop | null>(() => getStoredDefaultOrigin());

  // Persist addresses to localStorage on change
  useEffect(() => {
    saveStoredAddresses(savedAddresses);
  }, [savedAddresses]);

  // Persist routes to localStorage on change
  useEffect(() => {
    saveStoredSavedRoutes(savedRoutes);
  }, [savedRoutes]);

  const handleSetDefaultOrigin = (stop: RouteStop | null) => {
    setDefaultOrigin(stop);
    saveStoredDefaultOrigin(stop);
    if (stop) {
      setRouteStops(prev => {
        const updated = [...prev];
        updated[0] = {
          id: 'origin',
          label: stop.label,
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng,
          isSaved: true
        };
        return updated;
      });
    }
  };

  // Route state (Offline-first)
  const [routeStops, setRouteStops] = useState<RouteStop[]>(() => getStoredActiveStops());

  // Persist route stops to localStorage on change
  useEffect(() => {
    saveStoredActiveStops(routeStops);
  }, [routeStops]);

  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  
  // Highlighting selected single saved address on map
  const [selectedAddressForMap, setSelectedAddressForMap] = useState<SavedAddress | null>(null);

  // Auto-populating form from map click
  const [prefilledAddress, setPrefilledAddress] = useState<{ address: string; lat: number; lng: number } | null>(null);

  // Triggering live navigation mode across tabs
  const [navigationTriggerCount, setNavigationTriggerCount] = useState(0);
  const [navModePreference, setNavModePreference] = useState<'GPS' | 'SIMULATION'>('GPS');

  // Group creation modal state
  const [showGroupCreationModal, setShowGroupCreationModal] = useState(false);

  const handleStartNavigation = (mode: 'GPS' | 'SIMULATION' = 'GPS') => {
    setNavModePreference(mode);
    setNavigationTriggerCount((prev) => prev + 1);
    setMobileTab('map');
  };

  // Helper to detect device location and set as route origin
  const detectDeviceLocation = () => {
    if (defaultOrigin) {
      setRouteStops(prev => {
        const updated = [...prev];
        updated[0] = {
          id: 'origin',
          label: defaultOrigin.label,
          address: defaultOrigin.address,
          lat: defaultOrigin.lat,
          lng: defaultOrigin.lng,
          isSaved: true
        };
        return updated;
      });
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=tr`
            );
            if (response.ok) {
              const data = await response.json();
              if (data && data.display_name) {
                setRouteStops(prev => {
                  const updated = [...prev];
                  updated[0] = {
                    id: 'origin',
                    label: 'Mevcut Konumunuz',
                    address: data.display_name,
                    lat: latitude,
                    lng: longitude
                  };
                  return updated;
                });
                return;
              }
            }
          } catch (err) {
            console.warn("Startup reverse geocode failed:", err);
          }
          // Fallback if reverse geocode fails or is slow
          setRouteStops(prev => {
            const updated = [...prev];
            updated[0] = {
              id: 'origin',
              label: 'Mevcut Konumunuz',
              address: `Cihaz Konumu (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
              lat: latitude,
              lng: longitude
            };
            return updated;
          });
        },
        (error) => {
          console.warn("Startup geolocation coordinate request denied or failed:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  // Tab management (Mobile & Desktop split) - default to 'field' on mobile for instant Google Maps navigation!
  const [activeTab, setActiveTab] = useState<'route' | 'field' | 'routes' | 'saved' | 'settings' | 'visits'>('field');
  const [mobileTab, setMobileTab] = useState<'route' | 'field' | 'routes' | 'saved' | 'settings' | 'map' | 'visits'>('field');

  // Fetch Saved Routes from VDS (sync if available)
  const fetchSavedRoutes = async () => {
    try {
      const res = await fetch('/api/saved-routes');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSavedRoutes(data);
        }
      }
    } catch (err) {
      console.warn("Kayıtlı rotalar sunucudan çekilemedi, yerel hafıza kullanılıyor.");
    }
  };

  // 1. Authentication Status Check
  useEffect(() => {
    const checkAuthStatus = async () => {
      // If native app, always grant instant access
      if (Capacitor.isNativePlatform()) {
        setIsAuthenticated(true);
        return;
      }

      if (localStorage.getItem('rotaplan_offline_mode') === 'true') {
        setIsAuthenticated(true);
        return;
      }

      const token = localStorage.getItem('rotaplan_auth_token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/check', {
          headers: { 'X-App-Token': token }
        });
        const data = await res.json();
        if (data.valid) {
          setIsAuthenticated(true);
        } else {
          // If token invalid but offline mode not rejected, grant access
          setIsAuthenticated(true);
        }
      } catch (err) {
        // Network unavailable -> keep authenticated offline
        setIsAuthenticated(true);
      }
    };
    checkAuthStatus();
  }, []);

  // 2. Fetch Saved Addresses & Routes from VDS (when logged in)
  useEffect(() => {
    if (isAuthenticated === true) {
      const fetchAddresses = async () => {
        const token = localStorage.getItem('rotaplan_auth_token') || '';
        try {
          const res = await fetch('/api/addresses', {
            headers: { 'X-App-Token': token }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setSavedAddresses(data);
            }
          }
        } catch (err) {
          console.warn("Sunucudan adres çekilemedi, yerel veri korunuyor.");
        }
      };
      fetchAddresses();
      fetchSavedRoutes();
      detectDeviceLocation();
    }
  }, [isAuthenticated]);

  // 3. Login Handler with offline & master password bypass
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    // Master offline password check or standard bypass
    const trimmed = passwordInput.trim();
    if (trimmed === 'Bursa16!' || trimmed === '1234' || trimmed.toLowerCase() === 'admin' || trimmed.toLowerCase() === 'rota') {
      localStorage.setItem('rotaplan_auth_token', 'local-authorized-token');
      localStorage.setItem('rotaplan_offline_mode', 'true');
      setIsAuthenticated(true);
      setPasswordInput('');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('rotaplan_auth_token', data.token);
        setIsAuthenticated(true);
        setPasswordInput('');
      } else {
        setLoginError(data.error || 'Şifre doğrulanamadı. (Çevrimdışı mod için aşağıdaki butonu kullanabilirsiniz)');
      }
    } catch (err) {
      // Server unreachable: automatically allow offline access
      localStorage.setItem('rotaplan_auth_token', 'local-authorized-token');
      localStorage.setItem('rotaplan_offline_mode', 'true');
      setIsAuthenticated(true);
      setPasswordInput('');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartOfflineMode = () => {
    localStorage.setItem('rotaplan_auth_token', 'local-authorized-token');
    localStorage.setItem('rotaplan_offline_mode', 'true');
    setIsAuthenticated(true);
  };

  // 4. Logout Handler
  const handleLogout = async () => {
    const token = localStorage.getItem('rotaplan_auth_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'X-App-Token': token }
        });
      } catch (err) {
        // fail silently
      }
    }
    localStorage.removeItem('rotaplan_auth_token');
    localStorage.removeItem('rotaplan_offline_mode');
    setIsAuthenticated(false);
  };

  // 5. Update Application Trigger (VDS)
  const handleUpdateApp = async () => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    setIsUpdatingApp(true);
    setUpdateLog('VDS üzerinden git güncellemesi başlatılıyor...\n[1/3] update.sh tetikleniyor...\n\n');
    setShowUpdateModal(true);

    try {
      const res = await fetch('/api/update-app', {
        method: 'POST',
        headers: { 'X-App-Token': token }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUpdateLog(prev => prev + `[2/3] Dosyalar başarıyla çekildi ve derlendi!\n\n--- GÜNCELLEME LOGU ---\n${data.log}\n\n[3/3] İŞLEM TAMAMLANDI! PM2 uygulamayı yeniden başlattı.`);
      } else {
        setUpdateLog(prev => prev + `[!] GÜNCELLEME HATASI!\n\n${data.error || 'Bilinmeyen bir hata oluştu.'}\n\nLog:\n${data.log || ''}`);
      }
    } catch (err: any) {
      setUpdateLog(prev => prev + `[!] Bağlantı hatası oluştu: ${err.message}`);
    } finally {
      setIsUpdatingApp(false);
    }
  };

  // 6. Save Address - Offline First (Never Roll Back)
  const handleAddAddress = async (newAddress: SavedAddress) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    
    // Auto grouping logic
    const autoMode = localStorage.getItem('auto_group_mode') || 'off';
    let processedAddress = { ...newAddress };
    if (autoMode === 'fixed') {
      processedAddress.category = localStorage.getItem('auto_group_fixed_name') || 'Genel';
    } else if (autoMode === 'smart') {
      processedAddress.category = detectSmartCategory(processedAddress.label, processedAddress.address);
    }

    // Direct permanent local update
    setSavedAddresses(prev => [processedAddress, ...prev.filter(a => a.id !== processedAddress.id)]);

    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': token
        },
        body: JSON.stringify(processedAddress)
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.addresses)) {
          setSavedAddresses(data.addresses);
        }
      }
    } catch (err) {
      console.warn("Adres yerel hafızaya kaydedildi (VDS senkronizasyonu atlandı).");
    }
  };

  // Save multiple addresses - Offline First
  const handleAddAddressesBulk = async (newAddresses: SavedAddress[]) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    
    const autoMode = localStorage.getItem('auto_group_mode') || 'off';
    const processedAddresses = newAddresses.map(addr => {
      let processed = { ...addr };
      if (autoMode === 'fixed') {
        processed.category = localStorage.getItem('auto_group_fixed_name') || 'Genel';
      } else if (autoMode === 'smart') {
        processed.category = detectSmartCategory(processed.label, processed.address);
      }
      return processed;
    });

    setSavedAddresses(prev => [...processedAddresses, ...prev]);

    try {
      const res = await fetch('/api/addresses/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': token
        },
        body: JSON.stringify(processedAddresses)
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.addresses)) {
          setSavedAddresses(data.addresses);
        }
      }
    } catch (err) {
      console.warn("Toplu adres yerel hafızaya kaydedildi.");
    }
  };

  // 7. Delete Address - Offline First
  const handleDeleteAddress = async (id: string) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    setSavedAddresses(prev => prev.filter(a => a.id !== id));
    if (selectedAddressForMap?.id === id) {
      setSelectedAddressForMap(null);
    }

    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        headers: {
          'X-App-Token': token
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.addresses)) {
          setSavedAddresses(data.addresses);
        }
      }
    } catch (err) {
      console.warn("Adres yerel hafızadan silindi.");
    }
  };

  // Update/Edit Address - Offline First
  const handleUpdateAddress = async (id: string, updatedAddr: Omit<SavedAddress, 'id'>) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    setSavedAddresses(prev => prev.map(a => a.id === id ? { ...a, ...updatedAddr } : a));
    
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': token
        },
        body: JSON.stringify(updatedAddr)
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.addresses)) {
          setSavedAddresses(data.addresses);
        }
      }
    } catch (err) {
      console.warn("Adres yerel hafızada güncellendi.");
    }
  };

  const handleUpdateAddressesBulkVisited = async (ids: string[] | null, visited: boolean) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';

    setSavedAddresses(prev => prev.map(a => {
      if (!ids || ids.length === 0 || ids.includes(a.id)) {
        return { ...a, visited };
      }
      return a;
    }));

    try {
      const res = await fetch('/api/addresses/bulk-visited', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': token
        },
        body: JSON.stringify({ ids, visited })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.addresses)) {
          setSavedAddresses(data.addresses);
        }
      }
    } catch (err) {
      console.warn("Toplu ziyaret durumu güncellendi.");
    }
  };

  // --- SAVED ROUTES HANDLERS ---
  const handleSaveRoute = async (routeData: {
    title: string;
    description: string;
    category: string;
    color: string;
    stops: RouteStop[];
  }) => {
    const newRoute: SavedRoute = {
      id: 'route-' + Date.now(),
      title: routeData.title,
      description: routeData.description,
      category: routeData.category,
      color: routeData.color,
      stops: routeData.stops,
      createdAt: new Date().toISOString(),
      travelMode,
      distance: routeSummary?.distance || '',
      duration: routeSummary?.duration || ''
    };

    setSavedRoutes(prev => [newRoute, ...prev]);

    try {
      const res = await fetch('/api/saved-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.routes) {
          setSavedRoutes(json.routes);
        }
      }
    } catch (err) {
      console.warn("Rota yerel hafızaya kaydedildi.");
    }
  };

  const handleUpdateSavedRoute = async (id: string, updates: Partial<SavedRoute>) => {
    setSavedRoutes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    try {
      const res = await fetch(`/api/saved-routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.routes) {
          setSavedRoutes(json.routes);
        }
      }
    } catch (err) {
      console.warn("Rota yerel hafızada güncellendi.");
    }
  };

  const handleDeleteSavedRoute = async (id: string) => {
    setSavedRoutes(prev => prev.filter(r => r.id !== id));
    try {
      const res = await fetch(`/api/saved-routes/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.routes) {
          setSavedRoutes(json.routes);
        }
      }
    } catch (err) {
      console.warn("Rota silindi.");
    }
  };

  const handleLoadSavedRoute = (route: SavedRoute, targetTab: 'route' | 'field' = 'field') => {
    setRouteStops(route.stops);
    if (route.travelMode) setTravelMode(route.travelMode);
    setActiveTab(targetTab);
    setMobileTab(targetTab);
  };

  const handleSelectOnMap = (address: SavedAddress) => {
    setSelectedAddressForMap({ ...address });
    setMobileTab('map');
  };

  const handleClearRoute = () => {
    if (defaultOrigin) {
      setRouteStops([
        { id: 'origin', label: defaultOrigin.label, address: defaultOrigin.address, lat: defaultOrigin.lat, lng: defaultOrigin.lng, isSaved: true },
        { id: 'destination', label: '', address: '', lat: 0, lng: 0 }
      ]);
      setRouteSummary(null);
    } else {
      setRouteStops([
        { id: 'origin', label: '', address: '', lat: 0, lng: 0 },
        { id: 'destination', label: '', address: '', lat: 0, lng: 0 }
      ]);
      setRouteSummary(null);
      detectDeviceLocation();
    }
  };

  // --- RENDERS ---

  // Loading Splash Screen
  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-900 text-white font-sans antialiased">
        <div className="flex flex-col items-center gap-4">
          <span className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl shadow-xl animate-bounce">
            🗺️
          </span>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold tracking-tight">RotaPlan: Google Haritalar</h2>
            <p className="text-xs text-indigo-300 font-medium">Uygulama hazırlanıyor, lütfen bekleyin...</p>
          </div>
          <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Password / Login Screen with 1-Tap Offline Start
  if (isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-slate-950 p-4 font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-950/20 rounded-full blur-3xl pointer-events-none"></div>

        <div id="login-container-card" className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-white tracking-tight">RotaPlan: Google Haritalar</h2>
              <p className="text-xs text-slate-400">Saha takip & tek dokunuşla navigasyon başlatma</p>
            </div>
          </div>

          <form id="login-form-submit" onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="app-password-field" className="text-xs font-bold text-slate-300 tracking-wide uppercase">Giriş Şifresi</label>
              <input
                id="app-password-field"
                type="password"
                placeholder="Şifre (veya Bursa16!)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 text-white placeholder-slate-600 px-4 py-3 rounded-xl border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm outline-none font-mono"
              />
            </div>

            {loginError && (
              <div id="login-error-alert" className="flex gap-2 p-3.5 bg-rose-950/30 border border-rose-900/50 text-rose-200 text-xs rounded-xl leading-relaxed">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              id="login-btn-submit"
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Doğrulanıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          {/* 1-Tap Offline / Direct Start Button */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleStartOfflineMode}
              className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer text-xs flex items-center justify-center gap-2"
            >
              <Smartphone className="h-4 w-4 text-emerald-400" />
              <span>📱 Çevrimdışı / Mobil Modda Başla (VDS Gerekmez)</span>
            </button>
          </div>

          <div className="text-center pt-1">
            <span className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider uppercase">Google Maps Turn-by-Turn GPS Ready</span>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Main Application
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* SIDE PANELS */}
      <aside 
        id="side-workspace"
        className={`${
          mobileTab === 'map' ? 'hidden' : 'flex'
        } md:flex ${
          activeTab === 'visits' ? 'w-full md:w-full' : (activeTab === 'field' || activeTab === 'routes') ? 'w-full md:w-[480px]' : 'w-full md:w-[420px]'
        } shrink-0 flex-col bg-white border-r border-slate-200 shadow-sm z-10 h-[calc(100vh-64px)] md:h-full overflow-hidden transition-all duration-300`}
      >
        {/* Header Branding */}
        <header className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-md text-lg">
              🗺️
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-slate-900 tracking-tight text-sm">RotaPlan</h1>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-0.5">
                  <Zap className="h-2.5 w-2.5 text-emerald-600 fill-emerald-600" /> Google Maps
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Saha Takip & Navigasyon</p>
            </div>
          </div>

          {/* Actions Header Deck */}
          <div className="flex items-center gap-1">
            <button
              id="btn-settings-header-action"
              onClick={() => {
                setActiveTab('settings');
                setMobileTab('settings');
              }}
              title="Ayarlar"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                activeTab === 'settings'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                  : 'bg-slate-100 hover:bg-violet-50 text-slate-500 hover:text-violet-600 border-slate-200/60'
              }`}
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </button>
            <button
              id="btn-update-app-action"
              onClick={handleUpdateApp}
              title="VDS Üzerinden Güncelle"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer border border-slate-200/60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              id="btn-logout-secure-action"
              onClick={handleLogout}
              title="Çıkış Yap"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer border border-slate-200/60"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Desktop tab selector bar */}
        <nav className="grid grid-cols-6 border-b border-slate-100 bg-slate-50/50 p-1">
          <button
            id="desktop-tab-field"
            onClick={() => {
              setActiveTab('field');
              setMobileTab('field');
            }}
            className={`flex items-center justify-center gap-1 py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer relative ${
              (activeTab === 'field')
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-100 font-bold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
            <span>Saha</span>
            {routeStops.filter(s => s.lat !== 0 && s.lng !== 0).length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full">
                {routeStops.filter(s => s.lat !== 0 && s.lng !== 0).length}
              </span>
            )}
          </button>
          <button
            id="desktop-tab-saved"
            onClick={() => {
              setActiveTab('saved');
              setMobileTab('saved');
            }}
            className={`flex items-center justify-center gap-1 py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              (activeTab === 'saved')
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-100 font-bold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>Adresler</span>
          </button>
          <button
            id="desktop-tab-route"
            onClick={() => {
              setActiveTab('route');
              setMobileTab('route');
            }}
            className={`flex items-center justify-center gap-1 py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              (activeTab === 'route')
                ? 'bg-white text-blue-600 shadow-sm border border-slate-100 font-bold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Planla</span>
          </button>
          <button
            id="desktop-tab-routes"
            onClick={() => {
              setActiveTab('routes');
              setMobileTab('routes');
            }}
            className={`flex items-center justify-center gap-1 py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer relative ${
              (activeTab === 'routes')
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-100 font-bold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
            <span>Rotalar</span>
            {savedRoutes.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full">
                {savedRoutes.length}
              </span>
            )}
          </button>
          <button
            id="desktop-tab-visits"
            onClick={() => {
              setActiveTab('visits');
              setMobileTab('visits');
            }}
            className={`flex items-center justify-center gap-1 py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              (activeTab === 'visits')
                ? 'bg-white text-teal-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Eksikler</span>
          </button>
          <button
            id="desktop-tab-settings"
            onClick={() => {
              setActiveTab('settings');
              setMobileTab('settings');
            }}
            className={`flex items-center justify-center gap-1 py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              (activeTab === 'settings')
                ? 'bg-white text-violet-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span>Ayarlar</span>
          </button>
        </nav>

        {/* Active section lists loader */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'field' && (
            <FieldRouteTracker
              routeStops={routeStops}
              setRouteStops={setRouteStops}
              savedAddresses={savedAddresses}
              onUpdateAddress={handleUpdateAddress}
              onNavigateToTab={(tab) => {
                setActiveTab(tab);
                setMobileTab(tab);
              }}
            />
          )}

          {activeTab === 'saved' && (
            <SavedAddresses
              savedAddresses={savedAddresses}
              onAddAddress={handleAddAddress}
              onAddAddressesBulk={handleAddAddressesBulk}
              onUpdateAddress={handleUpdateAddress}
              onDeleteAddress={handleDeleteAddress}
              onSelectOnMap={handleSelectOnMap}
              prefilledAddress={prefilledAddress}
              onClearPrefilledAddress={() => setPrefilledAddress(null)}
              routeStops={routeStops}
              setRouteStops={setRouteStops}
              setActiveTab={setActiveTab}
              setMobileTab={setMobileTab}
              showGroupCreationModal={showGroupCreationModal}
              setShowGroupCreationModal={setShowGroupCreationModal}
              defaultOrigin={defaultOrigin}
              onSetDefaultOrigin={handleSetDefaultOrigin}
              onUpdateAddressesBulkVisited={handleUpdateAddressesBulkVisited}
            />
          )}

          {activeTab === 'route' && (
            <RoutePlanner
              savedAddresses={savedAddresses}
              routeStops={routeStops}
              setRouteStops={setRouteStops}
              travelMode={travelMode}
              setTravelMode={setTravelMode}
              routeSummary={routeSummary}
              onClearRoute={handleClearRoute}
              onStartNavigation={handleStartNavigation}
              defaultOrigin={defaultOrigin}
              onSetDefaultOrigin={handleSetDefaultOrigin}
              onNavigateToTab={(tab) => {
                setActiveTab(tab);
                setMobileTab(tab === 'map' ? 'map' : tab);
              }}
              savedRoutes={savedRoutes}
              onSaveRoute={handleSaveRoute}
            />
          )}

          {activeTab === 'routes' && (
            <SavedRoutesView
              savedRoutes={savedRoutes}
              onLoadRoute={handleLoadSavedRoute}
              onDeleteRoute={handleDeleteSavedRoute}
              onUpdateRoute={handleUpdateSavedRoute}
              onNavigateToTab={(tab) => {
                setActiveTab(tab);
                setMobileTab(tab === 'map' ? 'map' : tab);
              }}
            />
          )}

          {activeTab === 'visits' && (
            <VisitsAndDeficiencies
              savedAddresses={savedAddresses}
              onUpdateAddress={handleUpdateAddress}
              onClearAllVisited={async () => handleUpdateAddressesBulkVisited(null, false)}
              routeStops={routeStops}
              setRouteStops={setRouteStops}
              onSelectOnMap={handleSelectOnMap}
              setActiveTab={setActiveTab}
              setMobileTab={setMobileTab}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsComponent
              savedAddresses={savedAddresses}
              defaultOrigin={defaultOrigin}
              onSetDefaultOrigin={handleSetDefaultOrigin}
              onAddAddress={handleAddAddress}
            />
          )}
        </div>
      </aside>

      {/* MAP CONTAINER */}
      <main 
        id="map-main-canvas"
        className={`${
          mobileTab === 'map' ? 'flex' : 'hidden'
        } ${
          activeTab === 'visits' ? 'md:hidden' : 'md:flex'
        } flex-1 h-[calc(100vh-64px)] md:h-full relative overflow-hidden`}
      >
        <LeafletMap
          routeStops={routeStops}
          setRouteStops={setRouteStops}
          travelMode={travelMode}
          routeSummary={routeSummary}
          onSummaryCalculated={setRouteSummary}
          savedAddresses={savedAddresses}
          onUpdateAddress={handleUpdateAddress}
          onClearAllVisited={async () => handleUpdateAddressesBulkVisited(null, false)}
          selectedAddressForMap={selectedAddressForMap}
          onSaveClickedAddress={(addr) => setPrefilledAddress(addr)}
          setActiveTab={setActiveTab}
          setMobileTab={setMobileTab}
          mobileTab={mobileTab}
          navigationTriggerCount={navigationTriggerCount}
          initialNavMode={navModePreference}
          onTriggerGroupCreation={() => {
            setActiveTab('saved');
            setMobileTab('saved');
            setShowGroupCreationModal(true);
          }}
        />
      </main>

      {/* BOTTOM GLOBAL TAB BAR FOR MOBILE - Optimized for field work */}
      <footer 
        id="mobile-bottom-tabs"
        className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 grid grid-cols-6 md:hidden z-20 shadow-lg select-none"
      >
        {/* 1. SAHA (Field Tracker with Google Maps Navigation) */}
        <button
          id="mobile-tab-btn-field"
          onClick={() => {
            setActiveTab('field');
            setMobileTab('field');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer relative ${
            mobileTab === 'field' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="relative">
            <CheckSquare className="h-5 w-5 mb-0.5 text-emerald-600" />
            {routeStops.filter(s => s.lat !== 0 && s.lng !== 0).length > 0 && (
              <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[8px] font-extrabold px-1 rounded-full">
                {routeStops.filter(s => s.lat !== 0 && s.lng !== 0).length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold leading-none">Saha</span>
        </button>

        {/* 2. ADRESLER (Saved Address Book) */}
        <button
          id="mobile-tab-btn-saved"
          onClick={() => {
            setActiveTab('saved');
            setMobileTab('saved');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'saved' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bookmark className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] font-semibold leading-none">Adresler</span>
        </button>

        {/* 3. HARİTA (Interactive Map) */}
        <button
          id="mobile-tab-btn-map"
          onClick={() => {
            setMobileTab('map');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'map' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapIcon className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] font-semibold leading-none">Harita</span>
        </button>

        {/* 4. PLANLA (Route planner) */}
        <button
          id="mobile-tab-btn-route"
          onClick={() => {
            setActiveTab('route');
            setMobileTab('route');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'route' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Navigation className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] font-semibold leading-none">Planla</span>
        </button>

        {/* 5. ROTALAR (Saved Routes) */}
        <button
          id="mobile-tab-btn-routes"
          onClick={() => {
            setActiveTab('routes');
            setMobileTab('routes');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer relative ${
            mobileTab === 'routes' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="relative">
            <FolderKanban className="h-5 w-5 mb-0.5 text-indigo-600" />
            {savedRoutes.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[8px] font-extrabold px-1 rounded-full">
                {savedRoutes.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold leading-none">Rotalar</span>
        </button>

        {/* 6. EKSİKLER (Visits & Deficiencies) */}
        <button
          id="mobile-tab-btn-visits"
          onClick={() => {
            setActiveTab('visits');
            setMobileTab('visits');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'visits' ? 'text-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] font-semibold leading-none">Eksikler</span>
        </button>
      </footer>

      {/* DETAILED REMOTE APP UPDATE MODAL */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Terminal className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">VDS Sistem Güncelleyici</h3>
                  <p className="text-[10px] text-slate-400">GitHub otomatik derleme ve PM2 yeniden başlatıcı</p>
                </div>
              </div>
              <button
                id="close-update-modal"
                disabled={isUpdatingApp}
                onClick={() => setShowUpdateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-5 bg-slate-950 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
              {updateLog}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isUpdatingApp ? (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                    Derleme sürüyor...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    İşlem hazır / tamamlandı
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  id="modal-trigger-update-retry"
                  type="button"
                  disabled={isUpdatingApp}
                  onClick={handleUpdateApp}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isUpdatingApp ? 'Güncelleniyor...' : 'Güncellemeyi Tekrar Başlat'}
                </button>
                <button
                  id="modal-close-action-footer"
                  type="button"
                  disabled={isUpdatingApp}
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
