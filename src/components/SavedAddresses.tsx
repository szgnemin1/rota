import React, { useState } from 'react';
import { SavedAddress, RouteStop } from '../types';
import PlaceSearchBox from './PlaceSearchBox';
import { Bookmark, Trash2, Home, Briefcase, MapPin, Plus, CheckCircle, Navigation } from 'lucide-react';

interface SavedAddressesProps {
  savedAddresses: SavedAddress[];
  onAddAddress: (address: SavedAddress) => void;
  onDeleteAddress: (id: string) => void;
  onSelectOnMap: (address: SavedAddress) => void;
  prefilledAddress?: { address: string; lat: number; lng: number } | null;
  onClearPrefilledAddress?: () => void;
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  setActiveTab: (tab: 'route' | 'saved') => void;
  setMobileTab: (tab: 'route' | 'saved' | 'map') => void;
}

export default function SavedAddresses({
  savedAddresses,
  onAddAddress,
  onDeleteAddress,
  onSelectOnMap,
  prefilledAddress,
  onClearPrefilledAddress,
  routeStops,
  setRouteStops,
  setActiveTab,
  setMobileTab
}: SavedAddressesProps) {
  const [label, setLabel] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<{
    label: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  
  const [successMessage, setSuccessMessage] = useState('');
  
  // States for multi route selection
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Handle auto-populating from map clicks
  React.useEffect(() => {
    if (prefilledAddress) {
      setSelectedPlace({
        label: 'Haritadan Seçilen Konum',
        address: prefilledAddress.address,
        lat: prefilledAddress.lat,
        lng: prefilledAddress.lng
      });
      setLabel(''); // Clear label to allow custom user typing
    }
  }, [prefilledAddress]);

  const handlePlaceSelect = (place: { label: string; address: string; lat: number; lng: number }) => {
    setSelectedPlace(place);
    if (!label) {
      setLabel(place.label); // Auto prepopulate label if empty
    }
  };

  const handleSetAsOrigin = (addr: SavedAddress) => {
    const updated = [...routeStops];
    updated[0] = {
      id: 'origin',
      label: addr.label,
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      isSaved: true
    };
    setRouteStops(updated);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleSetAsDestination = (addr: SavedAddress) => {
    const updated = [...routeStops];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      id: 'destination',
      label: addr.label,
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      isSaved: true
    };
    setRouteStops(updated);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleAddAsWaypoint = (addr: SavedAddress) => {
    if (routeStops.length >= 10) {
      alert("Google Haritalar en fazla 10 durağı (başlangıç, varış ve 8 ara durak) desteklemektedir.");
      return;
    }
    const newId = `waypoint-${Date.now()}`;
    const newWaypoint: RouteStop = {
      id: newId,
      label: addr.label,
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      isSaved: true
    };
    const updated = [...routeStops];
    // Insert waypoint right before destination
    updated.splice(routeStops.length - 1, 0, newWaypoint);
    setRouteStops(updated);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleCardClick = (addr: SavedAddress) => {
    if (isMultiSelectMode) {
      if (selectedIds.includes(addr.id)) {
        setSelectedIds(selectedIds.filter(id => id !== addr.id));
      } else {
        if (selectedIds.length >= 10) {
          alert("Google Haritalar en fazla 10 durağı (başlangıç, varış ve 8 ara durak) desteklemektedir.");
          return;
        }
        setSelectedIds([...selectedIds, addr.id]);
      }
    } else {
      onSelectOnMap(addr);
    }
  };

  const buildRouteFromSelected = () => {
    if (selectedIds.length === 0) return;

    const selectedAddresses = selectedIds
      .map(id => savedAddresses.find(a => a.id === id))
      .filter(Boolean) as SavedAddress[];

    if (selectedAddresses.length === 0) return;

    const newStops: RouteStop[] = [];

    if (selectedAddresses.length === 1) {
      const single = selectedAddresses[0];
      newStops.push({
        id: 'origin',
        label: single.label,
        address: single.address,
        lat: single.lat,
        lng: single.lng,
        isSaved: true
      });
      newStops.push({ id: 'destination', label: '', address: '', lat: 0, lng: 0 });
    } else {
      // First is origin
      const first = selectedAddresses[0];
      newStops.push({
        id: 'origin',
        label: first.label,
        address: first.address,
        lat: first.lat,
        lng: first.lng,
        isSaved: true
      });

      // Middle ones are waypoints
      for (let i = 1; i < selectedAddresses.length - 1; i++) {
        const wp = selectedAddresses[i];
        newStops.push({
          id: `waypoint-${Date.now()}-${i}`,
          label: wp.label,
          address: wp.address,
          lat: wp.lat,
          lng: wp.lng,
          isSaved: true
        });
      }

      // Last is destination
      const last = selectedAddresses[selectedAddresses.length - 1];
      newStops.push({
        id: 'destination',
        label: last.label,
        address: last.address,
        lat: last.lat,
        lng: last.lng,
        isSaved: true
      });
    }

    setRouteStops(newStops);
    setActiveTab('route');
    setMobileTab('route');
    setIsMultiSelectMode(false);
    setSelectedIds([]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace || !label.trim()) return;

    const newAddress: SavedAddress = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      label: label.trim(),
      address: selectedPlace.address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng
    };

    onAddAddress(newAddress);
    
    // Clear form
    setLabel('');
    setSelectedPlace(null);
    if (onClearPrefilledAddress) {
      onClearPrefilledAddress();
    }
    setSuccessMessage('Adres başarıyla kaydedildi!');
    
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  // Helper to determine icon based on tag
  const getIcon = (addrLabel: string) => {
    const lLower = addrLabel.toLowerCase();
    if (lLower.includes('ev') || lLower.includes('home')) {
      return <Home className="h-4 w-4 text-emerald-600" />;
    } else if (lLower.includes('iş') || lLower.includes('ofis') || lLower.includes('work') || lLower.includes('depo')) {
      return <Briefcase className="h-4 w-4 text-amber-600" />;
    }
    return <Bookmark className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div id="saved-addresses-panel" className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-indigo-500 fill-indigo-100" />
          Kayıtlı Adreslerim
        </h2>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
          {savedAddresses.length} Adres
        </span>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Save Address Form */}
        <form onSubmit={handleSave} className="bg-slate-50/70 rounded-xl p-4 border border-slate-100 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Yeni Adres Ekle</h3>
          
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">Adres Ara</label>
            <PlaceSearchBox
              id="new-address-search"
              placeholder="Haritada arayıp seçin..."
              onPlaceSelected={handlePlaceSelect}
              initialValue={selectedPlace ? selectedPlace.address : ""}
            />
          </div>

          {selectedPlace && (
            <div className="space-y-3 pt-1">
              <div className="text-xs text-slate-500 bg-white border border-slate-100 p-2.5 rounded-lg">
                <span className="font-semibold text-slate-700">Bulunan Adres: </span>
                {selectedPlace.address}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Adres İsmi / Etiketi</label>
                <input
                  id="new-address-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="örn. Ev, Merkez Depo, İzmir Ofis"
                  className="block w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                  required
                />
              </div>

              <button
                id="save-address-submit"
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150"
              >
                <Plus className="h-4 w-4" />
                Adres Defterine Kaydet
              </button>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-150 p-2 rounded-lg animate-pulse">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {successMessage}
            </div>
          )}
        </form>

        {/* Multi Route Selection Tool Deck */}
        {savedAddresses.length > 0 && (
          <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Çoklu Rota Sihirbazı</span>
                <span className="text-[10px] text-slate-500">Adresleri sırayla seçip tek tıkla rotaya dökün</span>
              </div>
              <button
                id="toggle-multi-route-mode"
                type="button"
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  setSelectedIds([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer ${
                  isMultiSelectMode
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50/60'
                }`}
              >
                {isMultiSelectMode ? 'Seçimi Kapat' : 'Çoklu Seçim Başlat'}
              </button>
            </div>

            {isMultiSelectMode && (
              <div className="bg-white border border-indigo-100 rounded-lg p-2.5 space-y-2.5 transition-all">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    Seçilen Duraklar: <strong className="text-indigo-600">{selectedIds.length} / 10</strong>
                  </span>
                  {selectedIds.length > 0 && (
                    <button
                      id="clear-multi-selections"
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-slate-400 hover:text-rose-500 font-medium transition-colors"
                    >
                      Seçimleri Temizle
                    </button>
                  )}
                </div>

                {selectedIds.length > 0 ? (
                  <div className="space-y-2">
                    {/* Tiny representation of the current custom route path */}
                    <div className="flex items-center gap-1.5 flex-wrap overflow-hidden p-1.5 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-600">
                      {selectedIds.map((id, index) => {
                        const addr = savedAddresses.find(a => a.id === id);
                        if (!addr) return null;
                        return (
                          <React.Fragment key={id}>
                            {index > 0 && <span className="text-slate-300 font-mono">→</span>}
                            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium text-slate-700 max-w-[80px] truncate" title={addr.label}>
                              {index + 1}. {addr.label}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <button
                      id="generate-route-from-selected-btn"
                      type="button"
                      onClick={buildRouteFromSelected}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                      Seçilen {selectedIds.length} Adresle Rota Oluştur
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 py-1 text-center">
                    Aşağıdaki listeden rotaya dahil etmek istediğiniz adresleri <strong className="text-slate-500">sırasıyla</strong> seçin.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Saved Addresses List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Adres Listesi</h3>
            {isMultiSelectMode && (
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 animate-pulse">
                Çoklu Seçim Aktif
              </span>
            )}
          </div>

          {savedAddresses.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-150 text-slate-400">
              <Bookmark className="h-8 w-8 mx-auto text-slate-300 stroke-1 mb-2" />
              <p className="text-sm font-medium">Henüz kayıtlı adres yok</p>
              <p className="text-xs mt-1 text-slate-400/80">Yukarıdaki arama çubuğunu kullanarak ilk adresinizi kaydedebilirsiniz.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedAddresses.map((addr) => {
                const isSelected = selectedIds.includes(addr.id);
                const selectIndex = selectedIds.indexOf(addr.id);

                return (
                  <div
                    id={`saved-addr-card-${addr.id}`}
                    key={addr.id}
                    onClick={() => handleCardClick(addr)}
                    className={`group relative flex flex-col p-3 border rounded-xl transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-300 shadow-sm'
                        : isMultiSelectMode
                        ? 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/10'
                        : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2.5 min-w-0 pr-8">
                        {/* Circle Checkbox / Order Indicator or default Icon */}
                        {isMultiSelectMode ? (
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border font-bold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300'
                          }`}>
                            {isSelected ? (
                              <span className="text-xs">{selectIndex + 1}</span>
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                            {getIcon(addr.label)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-800 text-sm truncate">{addr.label}</h4>
                          <p className="text-slate-500 text-xs truncate mt-0.5" title={addr.address}>
                            {addr.address}
                          </p>
                          <div className="flex gap-2.5 mt-1 text-[10px] text-slate-400 font-mono">
                            <span>Enl: {addr.lat.toFixed(4)}</span>
                            <span>Boy: {addr.lng.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        id={`delete-addr-${addr.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          onDeleteAddress(addr.id);
                        }}
                        className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Adresi Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Quick routing selectors from this address (Only visible if not in multi select mode) */}
                    {!isMultiSelectMode && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                        <button
                          id={`set-origin-btn-${addr.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsOrigin(addr);
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-all cursor-pointer"
                        >
                          <Navigation className="h-3 w-3 shrink-0" />
                          Başlangıç
                        </button>
                        <button
                          id={`add-waypoint-btn-${addr.id}`}
                          type="button"
                          disabled={routeStops.length >= 10}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddAsWaypoint(addr);
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded font-bold text-[10px] border transition-all ${
                            routeStops.length >= 10
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 cursor-pointer'
                          }`}
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          Durak Ekle
                        </button>
                        <button
                          id={`set-dest-btn-${addr.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsDestination(addr);
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-200 transition-all cursor-pointer"
                        >
                          <MapPin className="h-3 w-3 shrink-0" />
                          Varış
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
