import React, { useState, useEffect } from 'react';
import { RouteStop, SavedAddress, SavedRoute } from './types';
import SavedRoutesView from './components/SavedRoutesView';
import SavedAddresses from './components/SavedAddresses';
import VisitsAndDeficiencies from './components/VisitsAndDeficiencies';
import ActiveRoutePage from './components/ActiveRoutePage';
import {
  FolderKanban, Bookmark, ClipboardList, Zap
} from 'lucide-react';
import {
  getStoredAddresses,
  saveStoredAddresses,
  getStoredSavedRoutes,
  saveStoredSavedRoutes
} from './services/storage';

export default function App() {
  // Saved Addresses (seeded with the 77 KML addresses, permanently saved in localStorage)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => getStoredAddresses());

  // Saved Routes (seeded with the 77-firm Bursa Saha Rotası, permanently saved in localStorage)
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => getStoredSavedRoutes());

  // Active Live Route Mode (When user clicks "Rotayı Başlat", app becomes a single focused field page)
  const [activeLiveRoute, setActiveLiveRoute] = useState<SavedRoute | null>(null);

  // Tab management: Default first page is 'routes' (Rotalar)
  const [activeTab, setActiveTab] = useState<'routes' | 'saved' | 'visits'>('routes');

  // Persist addresses to localStorage on change
  useEffect(() => {
    saveStoredAddresses(savedAddresses);
  }, [savedAddresses]);

  // Persist routes to localStorage on change
  useEffect(() => {
    saveStoredSavedRoutes(savedRoutes);
  }, [savedRoutes]);

  // Sync to VDS in background if server is running, without blocking or rolling back
  useEffect(() => {
    const syncWithServer = async () => {
      try {
        const res = await fetch('/api/addresses');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setSavedAddresses(prev => {
              const localMap = new Map<string, SavedAddress>(prev.map(a => [a.id, a]));
              const merged = (data as SavedAddress[]).map((serverAddr: SavedAddress) => {
                const local = localMap.get(serverAddr.id);
                return local ? { ...serverAddr, note: local.note || serverAddr.note, visited: local.visited ?? serverAddr.visited } : serverAddr;
              });
              return merged;
            });
          }
        }
      } catch (e) {
        // Offline / local mode active
      }
    };
    syncWithServer();
  }, []);

  // --- ADDRESS ACTIONS (Offline-First) ---
  const handleAddAddress = async (newAddress: SavedAddress) => {
    setSavedAddresses(prev => [newAddress, ...prev.filter(a => a.id !== newAddress.id)]);
    try {
      await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAddress)
      });
    } catch (e) {}
  };

  const handleAddAddressesBulk = async (newAddresses: SavedAddress[]) => {
    setSavedAddresses(prev => [...newAddresses, ...prev]);
    try {
      await fetch('/api/addresses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAddresses)
      });
    } catch (e) {}
  };

  const handleUpdateAddress = async (id: string, updatedAddr: Omit<SavedAddress, 'id'>) => {
    setSavedAddresses(prev => prev.map(a => (a.id === id ? { ...a, ...updatedAddr } : a)));
    try {
      await fetch(`/api/addresses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAddr)
      });
    } catch (e) {}
  };

  const handleDeleteAddress = async (id: string) => {
    setSavedAddresses(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/addresses/${id}`, { method: 'DELETE' });
    } catch (e) {}
  };

  // --- SINGLE NOTE UPDATER (Syncs between Live Route & Eksikler) ---
  const handleUpdateAddressNote = async (addressId: string, note: string) => {
    setSavedAddresses(prev =>
      prev.map(a => (a.id === addressId ? { ...a, note } : a))
    );
    try {
      const target = savedAddresses.find(a => a.id === addressId);
      if (target) {
        await fetch(`/api/addresses/${addressId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...target, note })
        });
      }
    } catch (e) {}
  };

  // --- TOGGLE VISITED (Syncs between Live Route & Eksikler) ---
  const handleToggleVisited = async (addressId: string, visited: boolean) => {
    setSavedAddresses(prev =>
      prev.map(a => (a.id === addressId ? { ...a, visited } : a))
    );
    try {
      const target = savedAddresses.find(a => a.id === addressId);
      if (target) {
        await fetch(`/api/addresses/${addressId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...target, visited })
        });
      }
    } catch (e) {}
  };

  const handleClearAllVisited = async () => {
    setSavedAddresses(prev => prev.map(a => ({ ...a, visited: false })));
  };

  // --- ROUTE ACTIONS (Offline-First) ---
  const handleSaveRoute = async (routeData: {
    title: string;
    description: string;
    category: string;
    color: string;
    stops: RouteStop[];
  }) => {
    const newRoute: SavedRoute = {
      id: `route-${Date.now()}`,
      title: routeData.title,
      description: routeData.description,
      category: routeData.category,
      color: routeData.color,
      stops: routeData.stops,
      createdAt: new Date().toISOString(),
      travelMode: 'DRIVING'
    };

    setSavedRoutes(prev => [newRoute, ...prev]);

    try {
      await fetch('/api/saved-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute)
      });
    } catch (e) {}
  };

  const handleUpdateSavedRoute = async (id: string, updates: Partial<SavedRoute>) => {
    setSavedRoutes(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
    try {
      await fetch(`/api/saved-routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {}
  };

  const handleDeleteSavedRoute = async (id: string) => {
    setSavedRoutes(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/saved-routes/${id}`, { method: 'DELETE' });
    } catch (e) {}
  };

  // --- RENDER 1: CANLI SAHA ROTA EKRANI (SINGLE-PAGE FOCUSED FIELD MODE) ---
  if (activeLiveRoute) {
    return (
      <ActiveRoutePage
        route={activeLiveRoute}
        savedAddresses={savedAddresses}
        onUpdateAddressNote={handleUpdateAddressNote}
        onToggleVisited={handleToggleVisited}
        onCloseRoute={() => setActiveLiveRoute(null)}
      />
    );
  }

  // --- RENDER 2: 3-TAB MAIN APPLICATION WORKSPACE (DARK THEME) ---
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100 select-none">
      
      {/* TOP HEADER */}
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 shrink-0 shadow-lg z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20 text-base">
              🗺️
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-white tracking-tight text-sm">RotaPlan</h1>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 font-bold flex items-center gap-0.5">
                  <Zap className="h-2.5 w-2.5 text-red-400 fill-red-400" /> Yandex Navigasyon
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Saha Takip & Navigasyon</p>
            </div>
          </div>

          {/* DESKTOP TOP NAV TABS */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('routes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'routes'
                  ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderKanban className="h-4 w-4 text-indigo-400" />
              <span>1. Rotalar ({savedRoutes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bookmark className="h-4 w-4 text-emerald-400" />
              <span>2. Adresler ({savedAddresses.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('visits')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'visits'
                  ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="h-4 w-4 text-teal-400" />
              <span>3. Eksikler (A-Z)</span>
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden h-[calc(100vh-120px)] md:h-[calc(100vh-64px)] max-w-4xl mx-auto w-full">
        {activeTab === 'routes' && (
          <SavedRoutesView
            savedRoutes={savedRoutes}
            savedAddresses={savedAddresses}
            onStartLiveRoute={(route) => setActiveLiveRoute(route)}
            onSaveRoute={handleSaveRoute}
            onDeleteRoute={handleDeleteSavedRoute}
            onUpdateRoute={handleUpdateSavedRoute}
            onAddAddressesBulk={handleAddAddressesBulk}
          />
        )}

        {activeTab === 'saved' && (
          <SavedAddresses
            savedAddresses={savedAddresses}
            onAddAddress={handleAddAddress}
            onAddAddressesBulk={handleAddAddressesBulk}
            onUpdateAddress={handleUpdateAddress}
            onDeleteAddress={handleDeleteAddress}
          />
        )}

        {activeTab === 'visits' && (
          <VisitsAndDeficiencies
            savedAddresses={savedAddresses}
            onUpdateAddress={handleUpdateAddress}
            onClearAllVisited={handleClearAllVisited}
          />
        )}
      </main>

      {/* BOTTOM MOBILE NAVIGATION BAR (DARK THEME) */}
      <footer className="fixed bottom-0 left-0 right-0 h-16 bg-slate-950 border-t border-slate-800/90 grid grid-cols-3 md:hidden z-30 shadow-2xl select-none">
        {/* 1. ROTALAR */}
        <button
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer relative ${
            activeTab === 'routes' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className="relative">
            <FolderKanban className="h-5 w-5 mb-0.5" />
            {savedRoutes.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[8px] font-extrabold px-1 rounded-full">
                {savedRoutes.length}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-none">Rotalar</span>
        </button>

        {/* 2. ADRESLER */}
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            activeTab === 'saved' ? 'text-emerald-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Bookmark className="h-5 w-5 mb-0.5" />
          <span className="text-[11px] leading-none">Adresler</span>
        </button>

        {/* 3. EKSİKLER */}
        <button
          onClick={() => setActiveTab('visits')}
          className={`flex flex-col items-center justify-center py-2 cursor-pointer ${
            activeTab === 'visits' ? 'text-teal-400 font-extrabold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ClipboardList className="h-5 w-5 mb-0.5" />
          <span className="text-[11px] leading-none">Eksikler (A-Z)</span>
        </button>
      </footer>

    </div>
  );
}
