import React, { useState, useEffect } from 'react';
import { RouteStop, SavedAddress, TravelMode, RouteSummary } from './types';
import RoutePlanner from './components/RoutePlanner';
import SavedAddresses from './components/SavedAddresses';
import LeafletMap from './components/LeafletMap';
import { Navigation, Bookmark, Map as MapIcon, Lock, LogOut, RefreshCw, Terminal, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Update App states
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Saved Addresses (synced with VDS)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Route state
  const [routeStops, setRouteStops] = useState<RouteStop[]>([
    { id: 'origin', label: '', address: '', lat: 0, lng: 0 },
    { id: 'destination', label: '', address: '', lat: 0, lng: 0 }
  ]);

  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  
  // Highlighting selected single saved address on map
  const [selectedAddressForMap, setSelectedAddressForMap] = useState<SavedAddress | null>(null);

  // Auto-populating form from map click
  const [prefilledAddress, setPrefilledAddress] = useState<{ address: string; lat: number; lng: number } | null>(null);

  // Tab management (Mobile & Desktop split)
  const [activeTab, setActiveTab] = useState<'route' | 'saved'>('route');
  const [mobileTab, setMobileTab] = useState<'route' | 'saved' | 'map'>('route');

  // 1. Authentication Status Check
  useEffect(() => {
    const checkAuthStatus = async () => {
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
          localStorage.removeItem('rotaplan_auth_token');
          setIsAuthenticated(false);
        }
      } catch (err) {
        // Fallback for network issues
        setIsAuthenticated(false);
      }
    };
    checkAuthStatus();
  }, []);

  // 2. Fetch Saved Addresses from VDS (when logged in)
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
            setSavedAddresses(data);
          } else if (res.status === 401) {
            handleLogout();
          }
        } catch (err) {
          console.error("Adresler sunucudan çekilirken hata oluştu:", err);
        }
      };
      fetchAddresses();
    }
  }, [isAuthenticated]);

  // 3. Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('rotaplan_auth_token', data.token);
        setIsAuthenticated(true);
        setPasswordInput('');
      } else {
        setLoginError(data.error || 'Şifre doğrulanamadı. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      setLoginError('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    } finally {
      setIsLoggingIn(false);
    }
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
    setIsAuthenticated(false);
    setSavedAddresses([]);
    handleClearRoute();
  };

  // 5. Update Application Trigger
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

  // 6. Save Address to VDS
  const handleAddAddress = async (newAddress: SavedAddress) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    // Optimistic UI update
    const previousAddresses = [...savedAddresses];
    setSavedAddresses([newAddress, ...savedAddresses]);

    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': token
        },
        body: JSON.stringify(newAddress)
      });
      if (res.ok) {
        const data = await res.json();
        setSavedAddresses(data.addresses);
      } else {
        // Rollback on failure
        setSavedAddresses(previousAddresses);
        if (res.status === 401) handleLogout();
      }
    } catch (err) {
      console.error("Adres sunucuya kaydedilirken hata:", err);
      setSavedAddresses(previousAddresses);
    }
  };

  // 7. Delete Address from VDS
  const handleDeleteAddress = async (id: string) => {
    const token = localStorage.getItem('rotaplan_auth_token') || '';
    // Optimistic UI update
    const previousAddresses = [...savedAddresses];
    setSavedAddresses(savedAddresses.filter(a => a.id !== id));
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
        setSavedAddresses(data.addresses);
      } else {
        // Rollback
        setSavedAddresses(previousAddresses);
        if (res.status === 401) handleLogout();
      }
    } catch (err) {
      console.error("Adres sunucudan silinirken hata:", err);
      setSavedAddresses(previousAddresses);
    }
  };

  const handleSelectOnMap = (address: SavedAddress) => {
    setSelectedAddressForMap(address);
    // Switch mobile view to Map
    setMobileTab('map');
  };

  const handleClearRoute = () => {
    setRouteStops([
      { id: 'origin', label: '', address: '', lat: 0, lng: 0 },
      { id: 'destination', label: '', address: '', lat: 0, lng: 0 }
    ]);
    setRouteSummary(null);
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
            <h2 className="text-lg font-bold tracking-tight">RotaPlan v1.0</h2>
            <p className="text-xs text-indigo-300 font-medium">Güvenlik kontrolü yapılıyor, lütfen bekleyin...</p>
          </div>
          <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // High-Security Password Screen
  if (isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-slate-950 p-4 font-sans antialiased selection:bg-indigo-500 selection:text-white">
        {/* Abstract background blur shapes */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-950/20 rounded-full blur-3xl pointer-events-none"></div>

        <div id="login-container-card" className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-white tracking-tight">RotaPlan Yetkilendirme</h2>
              <p className="text-xs text-slate-400">Bu panele erişmek için lütfen VDS güvenlik şifresini girin.</p>
            </div>
          </div>

          <form id="login-form-submit" onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="app-password-field" className="text-xs font-bold text-slate-300 tracking-wide uppercase">Giriş Şifresi</label>
              <input
                id="app-password-field"
                type="password"
                placeholder="••••••••"
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
                'Güvenli Giriş Yap'
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <span className="text-[10px] text-slate-600 font-mono font-semibold tracking-wider uppercase">High-Security IP Locked & Rate Limited</span>
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
        } md:flex w-full md:w-[420px] shrink-0 flex-col bg-white border-r border-slate-200 shadow-sm z-10 h-[calc(100vh-64px)] md:h-full overflow-hidden`}
      >
        {/* Header Branding */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md text-base">
              🗺️
            </span>
            <div>
              <h1 className="font-bold text-slate-900 tracking-tight text-sm">RotaPlan v1.0</h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">VDS Bulut Kayıtlı Rota Planlayıcı</p>
            </div>
          </div>

          {/* Secure Actions Header Deck */}
          <div className="flex items-center gap-1">
            <button
              id="btn-update-app-action"
              onClick={handleUpdateApp}
              title="VDS Üzerinden Uygulamayı Güncelle"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer border border-slate-200/60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              id="btn-logout-secure-action"
              onClick={handleLogout}
              title="Oturumu Güvenli Kapat"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer border border-slate-200/60"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* Desktop tab selector bar */}
        <nav className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50 p-1">
          <button
            id="desktop-tab-route"
            onClick={() => {
              setActiveTab('route');
              setMobileTab('route');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              (activeTab === 'route')
                ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Navigation className="h-4 w-4" />
            Rota Oluştur
          </button>
          <button
            id="desktop-tab-saved"
            onClick={() => {
              setActiveTab('saved');
              setMobileTab('saved');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              (activeTab === 'saved')
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
            }`}
          >
            <Bookmark className="h-4 w-4" />
            Adres Defteri
          </button>
        </nav>

        {/* Active section lists loader */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'route' && (
            <RoutePlanner
              savedAddresses={savedAddresses}
              routeStops={routeStops}
              setRouteStops={setRouteStops}
              travelMode={travelMode}
              setTravelMode={setTravelMode}
              routeSummary={routeSummary}
              onClearRoute={handleClearRoute}
            />
          )}

          {activeTab === 'saved' && (
            <SavedAddresses
              savedAddresses={savedAddresses}
              onAddAddress={handleAddAddress}
              onDeleteAddress={handleDeleteAddress}
              onSelectOnMap={handleSelectOnMap}
              prefilledAddress={prefilledAddress}
              onClearPrefilledAddress={() => setPrefilledAddress(null)}
              routeStops={routeStops}
              setRouteStops={setRouteStops}
              setActiveTab={setActiveTab}
              setMobileTab={setMobileTab}
            />
          )}
        </div>
      </aside>

      {/* MAP CONTAINER */}
      <main 
        id="map-main-canvas"
        className={`${
          mobileTab === 'map' ? 'flex' : 'hidden'
        } md:flex flex-1 h-[calc(100vh-64px)] md:h-full relative overflow-hidden`}
      >
        <LeafletMap
          routeStops={routeStops}
          setRouteStops={setRouteStops}
          travelMode={travelMode}
          routeSummary={routeSummary}
          onSummaryCalculated={setRouteSummary}
          savedAddresses={savedAddresses}
          selectedAddressForMap={selectedAddressForMap}
          onSaveClickedAddress={(addr) => setPrefilledAddress(addr)}
          setActiveTab={setActiveTab}
          setMobileTab={setMobileTab}
          mobileTab={mobileTab}
        />
      </main>

      {/* BOTTOM GLOBAL TAB BAR FOR MOBILE */}
      <footer 
        id="mobile-bottom-tabs"
        className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 grid grid-cols-3 md:hidden z-20 shadow-lg select-none"
      >
        <button
          id="mobile-tab-btn-route"
          onClick={() => {
            setActiveTab('route');
            setMobileTab('route');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'route' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Navigation className="h-5 w-5 mb-1" />
          <span className="text-[10px] font-medium">Rota Planla</span>
        </button>

        <button
          id="mobile-tab-btn-saved"
          onClick={() => {
            setActiveTab('saved');
            setMobileTab('saved');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'saved' ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bookmark className="h-5 w-5 mb-1" />
          <span className="text-[10px] font-medium">Adreslerim</span>
        </button>

        <button
          id="mobile-tab-btn-map"
          onClick={() => {
            setMobileTab('map');
          }}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            mobileTab === 'map' ? 'text-emerald-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MapIcon className="h-5 w-5 mb-1" />
          <span className="text-[10px] font-medium">Harita Görünümü</span>
        </button>
      </footer>

      {/* DETAILED REMOTE APP UPDATE MODAL */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
            {/* Modal Header */}
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

            {/* Terminal Log Output */}
            <div className="flex-1 p-5 bg-slate-950 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
              {updateLog}
            </div>

            {/* Modal Footer Controls */}
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
