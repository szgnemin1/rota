import { useState, useEffect } from 'react';
import { RouteStop, SavedAddress, TravelMode, RouteSummary } from './types';
import RoutePlanner from './components/RoutePlanner';
import SavedAddresses from './components/SavedAddresses';
import LeafletMap from './components/LeafletMap';
import { Navigation, Bookmark, Map as MapIcon } from 'lucide-react';

export default function App() {
  // Active state lists
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => {
    const saved = localStorage.getItem('rotaplan_saved_addresses');
    return saved ? JSON.parse(saved) : [];
  });

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

  // Save address book state to local storage
  useEffect(() => {
    localStorage.setItem('rotaplan_saved_addresses', JSON.stringify(savedAddresses));
  }, [savedAddresses]);

  const handleAddAddress = (newAddress: SavedAddress) => {
    setSavedAddresses([newAddress, ...savedAddresses]);
  };

  const handleDeleteAddress = (id: string) => {
    setSavedAddresses(savedAddresses.filter(a => a.id !== id));
    if (selectedAddressForMap?.id === id) {
      setSelectedAddressForMap(null);
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* SIDE PANELS (Desktop Side panel / Mobile conditionally hidden based on tabs) */}
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
              <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Ücretsiz ve Sınırsız Rota Asistanı</p>
            </div>
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

      {/* MAP CONTAINER (Renders full desktop map, or interactive mobile map when selected) */}
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

      {/* BOTTOM GLOBAL TAB BAR FOR MOBILE COMPATIBILITY */}
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
    </div>
  );
}
