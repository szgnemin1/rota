import { useState, useEffect } from 'react';
import { RouteStop, SavedAddress, TravelMode, RouteSummary } from '../types';
import PlaceSearchBox from './PlaceSearchBox';
import {
  MapPin, Plus, Trash2, ArrowUpDown, Navigation,
  Car, Footprints, Bike, Bus, Copy, Check, QrCode, ExternalLink, RefreshCw
} from 'lucide-react';

interface RoutePlannerProps {
  savedAddresses: SavedAddress[];
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  routeSummary: RouteSummary | null;
  onClearRoute: () => void;
}

export default function RoutePlanner({
  savedAddresses,
  routeStops,
  setRouteStops,
  travelMode,
  setTravelMode,
  routeSummary,
  onClearRoute
}: RoutePlannerProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Default structure of route: must have at least Origin and Destination
  useEffect(() => {
    if (routeStops.length < 2) {
      setRouteStops([
        { id: 'origin', label: '', address: '', lat: 0, lng: 0 },
        { id: 'destination', label: '', address: '', lat: 0, lng: 0 }
      ]);
    }
  }, []);

  const handleUpdateStop = (id: string, updatedFields: Partial<RouteStop>) => {
    setRouteStops(
      routeStops.map((stop) => (stop.id === id ? { ...stop, ...updatedFields } : stop))
    );
  };

  const handleAddWaypoint = () => {
    if (routeStops.length >= 10) {
      alert("Google Haritalar en fazla 10 durağı (başlangıç, varış ve 8 ara durak) desteklemektedir.");
      return;
    }
    // Insert waypoint before the last item (destination)
    const newId = `waypoint-${Date.now()}`;
    const newWaypoint: RouteStop = { id: newId, label: '', address: '', lat: 0, lng: 0 };
    const updatedStops = [...routeStops];
    updatedStops.splice(routeStops.length - 1, 0, newWaypoint);
    setRouteStops(updatedStops);
  };

  const handleRemoveWaypoint = (id: string) => {
    if (routeStops.length <= 2) return; // Cannot remove origin or destination
    setRouteStops(routeStops.filter((stop) => stop.id !== id));
  };

  const handleSelectFromSaved = (id: string, addrId: string) => {
    const matched = savedAddresses.find((a) => a.id === addrId);
    if (matched) {
      handleUpdateStop(id, {
        label: matched.label,
        address: matched.address,
        lat: matched.lat,
        lng: matched.lng,
        isSaved: true
      });
    }
  };

  const handleSwapStops = () => {
    // Reverse simple arrays of stops, but preserve their logical identifiers
    const reversedLabels = [...routeStops].reverse();
    const updated = routeStops.map((origStop, idx) => {
      const source = reversedLabels[idx];
      return {
        ...origStop,
        label: source.label,
        address: source.address,
        lat: source.lat,
        lng: source.lng,
        isSaved: source.isSaved
      };
    });
    setRouteStops(updated);
  };

  // Generate Google Maps Directions link
  // Format: https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&waypoints=LAT1,LNG1%7CLAT2,LNG2&travelmode=driving
  const getMapsUrl = () => {
    const validStops = routeStops.filter((s) => s.lat !== 0 && s.lng !== 0);
    if (validStops.length < 2) return '';

    const originStop = validStops[0];
    const destStop = validStops[validStops.length - 1];
    const origin = `${originStop.lat},${originStop.lng}`;
    const destination = `${destStop.lat},${destStop.lng}`;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

    // Handle waypoints (between origin and destination)
    if (validStops.length > 2) {
      const wpts = validStops.slice(1, validStops.length - 1);
      const wptsString = wpts.map((w) => `${w.lat},${w.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(wptsString)}`;
    }

    // Set travel mode parameter matching google schemes
    const modeMapping: Record<TravelMode, string> = {
      DRIVING: 'driving',
      WALKING: 'walking',
      BICYCLING: 'bicycling',
      TRANSIT: 'transit'
    };
    url += `&travelmode=${modeMapping[travelMode]}`;

    return url;
  };

  const mapsUrl = getMapsUrl();

  const handleCopyLink = () => {
    if (!mapsUrl) return;
    navigator.clipboard.writeText(mapsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if we have plotted a real route
  const isRouteConfigured = routeStops.every((s) => s.lat !== 0 && s.lng !== 0);

  const travelModesList: { mode: TravelMode; label: string; icon: any }[] = [
    { mode: 'DRIVING', label: 'Sürüş', icon: Car },
    { mode: 'WALKING', label: 'Yürüyüş', icon: Footprints },
    { mode: 'BICYCLING', label: 'Bisiklet', icon: Bike },
    { mode: 'TRANSIT', label: 'Toplu Taşıma', icon: Bus }
  ];

  return (
    <div id="route-planner-panel" className="flex flex-col h-full bg-white select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Navigation className="h-5 w-5 text-blue-500 fill-blue-50 animate-pulse" />
          Rota Oluşturucu
        </h2>
        
        {isRouteConfigured && (
          <button
            id="clear-route-button"
            onClick={onClearRoute}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Temizle
          </button>
        )}
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stops editor list */}
        <div className="relative space-y-3">
          {/* Vertical progress line between stops */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-100 -z-0 pointer-events-none" />

          {routeStops.map((stop, idx) => {
            const isOrigin = idx === 0;
            const isDest = idx === routeStops.length - 1;
            
            let labelText = `Ara Durak ${idx}`;
            let prefixColor = "bg-blue-500 border-blue-100";
            if (isOrigin) {
              labelText = "Başlangıç Noktası";
              prefixColor = "bg-emerald-500 border-emerald-100";
            } else if (isDest) {
              labelText = "Varış Noktası (Hedef)";
              prefixColor = "bg-red-500 border-red-100";
            }

            return (
              <div
                id={`route-stop-block-${stop.id}`}
                key={stop.id}
                className="relative bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-2 shadow-sm"
              >
                {/* Header label */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full border-2 ${prefixColor} shrink-0`} />
                    <span className="font-semibold text-slate-600">{labelText}</span>
                  </div>

                  {!isOrigin && !isDest && (
                    <button
                      id={`remove-stop-${stop.id}`}
                      type="button"
                      onClick={() => handleRemoveWaypoint(stop.id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Durağı Kaldır"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Place Search Input */}
                <PlaceSearchBox
                  id={`stop-search-${stop.id}`}
                  placeholder={isOrigin ? "Aramaya başlayın..." : isDest ? "Nereye gidilecek?" : "Durak adresi ara..."}
                  initialValue={stop.address}
                  onPlaceSelected={(place) => {
                    handleUpdateStop(stop.id, {
                      label: place.label,
                      address: place.address,
                      lat: place.lat,
                      lng: place.lng,
                      isSaved: false
                    });
                  }}
                />

                {/* Quick select dropdown from saved addresses */}
                {savedAddresses.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Kayıtlılardan Seç:</span>
                    <select
                      id={`stop-saved-select-${stop.id}`}
                      className="text-xs bg-white text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 max-w-full truncate focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      value={stop.isSaved ? savedAddresses.find((a) => a.address === stop.address)?.id || '' : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleSelectFromSaved(stop.id, e.target.value);
                        }
                      }}
                    >
                      <option value="">-- Adres Filtrele --</option>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          {/* Limit Warning Alert */}
          {routeStops.length >= 10 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs leading-relaxed space-y-1">
              <span className="font-bold block">⚠️ Durak Sınırına Ulaşıldı (Maks. 10)</span>
              <span>Google Haritalar yönlendirme linkleri en fazla 10 durağı (başlangıç + varış + 8 ara durak) desteklemektedir. Daha fazla durak eklenemez.</span>
            </div>
          )}

          {/* Action buttons inside list (Swap, Add stop) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              id="add-waypoint-btn"
              type="button"
              disabled={routeStops.length >= 10}
              onClick={handleAddWaypoint}
              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-all ${
                routeStops.length >= 10
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                  : 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Durak Ekle {routeStops.length >= 10 ? '(Maks.)' : `(${routeStops.length}/10)`}
            </button>

            <button
              id="swap-stops-btn"
              type="button"
              onClick={handleSwapStops}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-750 font-semibold bg-slate-50 hover:bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 transition-all cursor-pointer"
              title="Güzergahı Tersine Çevir"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Tersine Çevir
            </button>
          </div>
        </div>

        {/* Travel Mode Select */}
        <div className="border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold text-slate-500 block mb-2">Ulaşım Tercihi</span>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-150">
            {travelModesList.map(({ mode, label: modeLabel, icon: Icon }) => {
              const isActive = travelMode === mode;
              return (
                <button
                  id={`mode-button-${mode}`}
                  key={mode}
                  type="button"
                  onClick={() => setTravelMode(mode)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-100 font-semibold'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                  }`}
                  title={modeLabel}
                >
                  <Icon className="h-4.5 w-4.5 mb-1" />
                  <span className="text-[10px] sm:text-[11px] font-medium">{modeLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Route Stats & Navigation Steps */}
        {isRouteConfigured && routeSummary ? (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            {/* Stats block */}
            <div className="grid grid-cols-2 gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 p-4 rounded-xl text-white shadow-md">
              <div>
                <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Toplam Mesafe</p>
                <p className="text-xl font-bold mt-0.5">{routeSummary.distance}</p>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Tahmini Süre</p>
                <p className="text-xl font-bold mt-0.5">{routeSummary.duration}</p>
              </div>
            </div>

            {/* Step-by-step collapse instructions */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 block mb-2">Yol Tarifi Detayları ({routeSummary.steps.length} adım)</span>
              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto bg-slate-50/50">
                {routeSummary.steps.map((step, idx) => (
                  <div id={`nav-step-item-${idx}`} key={idx} className="p-3 text-xs text-slate-600 flex items-start gap-2.5">
                    <span className="h-5 w-5 bg-white border border-slate-200 text-slate-400 font-semibold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div dangerouslySetInnerHTML={{ __html: step.instruction }} className="leading-relaxed font-normal" />
                      <div className="flex gap-2.5 mt-1 text-[10px] text-slate-400">
                        <span>{step.distance}</span>
                        <span>•</span>
                        <span>{step.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isRouteConfigured ? (
          <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            Rota çiziliyor, lütfen bekleyin...
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="font-semibold text-slate-500">Güzergah Yok</p>
            <p className="mt-1 text-slate-400/80">Lütfen haritadan rota oluşturmak için hem Başlangıç hem de Varış noktası seçin.</p>
          </div>
        )}
      </div>

      {/* Sending output block on Footer */}
      {isRouteConfigured && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Rotaları Telefondaki Haritaya Gönder
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="send-phone-direct-btn"
              onClick={() => window.open(mapsUrl, '_blank')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              title="Google Haritalar Mobil uygulamasında ya da tarayıcıda açar."
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Mobil Haritada Aç
            </button>

            <button
              id="send-phone-qr-btn"
              onClick={() => setShowQr(!showQr)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 border text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                showQr
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              QR Kod ile Tara
            </button>
          </div>

          <button
            id="copy-maps-link-btn"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-150 text-indigo-700 border border-indigo-200 font-semibold text-xs rounded-lg transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Link Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Rota Linkini Kopyala
              </>
            )}
          </button>

          {showQr && (
            <div id="qr-display-container" className="pt-3 border-t border-slate-150 flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-slate-200 shadow-inner">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center mb-2">Telefonunuzun kamerası ile tarayın</span>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mapsUrl)}`}
                alt="Route QR Code"
                className="h-44 w-44 object-contain rounded p-1 border border-slate-100 bg-white"
                referrerPolicy="no-referrer"
              />
              <p className="text-[10px] text-slate-400 text-center mt-2 font-medium">Bu kod telefonunuzun kamerasından okutulduğunda rotayı doğrudan Google Haritalar uygulamasında açar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
