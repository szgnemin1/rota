import React, { useState, useEffect, useRef } from 'react';
import { RouteStop, SavedAddress } from '../types';
import {
  Navigation, CheckCircle2, Circle, Phone, User, FileText,
  MapPin, RotateCcw, Sparkles, ExternalLink, ArrowRight,
  Clock, Check, AlertCircle, Share2, Compass, Eye, Filter
} from 'lucide-react';

interface FieldRouteTrackerProps {
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  savedAddresses: SavedAddress[];
  onUpdateAddress?: (id: string, address: Omit<SavedAddress, 'id'>) => Promise<void>;
  onNavigateToTab?: (tab: 'route' | 'saved' | 'map') => void;
}

export default function FieldRouteTracker({
  routeStops,
  setRouteStops,
  savedAddresses,
  onUpdateAddress,
  onNavigateToTab
}: FieldRouteTrackerProps) {
  // Filter for valid coordinates
  const validStops = routeStops.filter(
    (s) => s.lat !== 0 && s.lng !== 0 && !isNaN(s.lat) && !isNaN(s.lng)
  );

  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeNoteStopId, setActiveNoteStopId] = useState<string | null>(null);

  // References for scrolling
  const stopRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Find saved address match for extra details (phone, contact, category, deficiencies)
  const getSavedAddressMatch = (stop: RouteStop): SavedAddress | undefined => {
    return savedAddresses.find(
      (sa) => sa.id === stop.id || (Math.abs(sa.lat - stop.lat) < 0.0001 && Math.abs(sa.lng - stop.lng) < 0.0001)
    );
  };

  // Compute full Yandex Route URL for all valid stops
  const getBulkYandexUrl = () => {
    if (validStops.length === 0) return '';
    const points = validStops.map((s) => `${s.lat},${s.lng}`).join('~');
    return `https://yandex.com.tr/maps/?rtext=${points}&rtt=auto`;
  };

  // Single stop Yandex URL
  const getStopYandexUrl = (lat: number, lng: number) => {
    return `https://yandex.com.tr/maps/?rtext=~${lat},${lng}&rtt=auto`;
  };

  // Toggle visited status for a stop
  const handleToggleVisited = async (stopId: string) => {
    const targetStop = routeStops.find((s) => s.id === stopId);
    if (!targetStop) return;

    const newVisitedStatus = !targetStop.visited;
    const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // 1. Update in route stops state
    const updatedStops = routeStops.map((s) => {
      if (s.id === stopId) {
        return {
          ...s,
          visited: newVisitedStatus,
          visitedAt: newVisitedStatus ? nowTimeStr : undefined
        };
      }
      return s;
    });
    setRouteStops(updatedStops);

    // 2. Persist in localStorage for route state
    try {
      localStorage.setItem('rotaplan_field_stops_status', JSON.stringify(
        updatedStops.map(s => ({ id: s.id, visited: s.visited, visitedAt: s.visitedAt, note: s.note }))
      ));
    } catch (e) {}

    // 3. If it corresponds to a saved address, update database / saved addresses
    const matchedSaved = getSavedAddressMatch(targetStop);
    if (matchedSaved && onUpdateAddress) {
      try {
        await onUpdateAddress(matchedSaved.id, {
          label: matchedSaved.label,
          address: matchedSaved.address,
          lat: matchedSaved.lat,
          lng: matchedSaved.lng,
          category: matchedSaved.category,
          phone: matchedSaved.phone,
          contactPerson: matchedSaved.contactPerson,
          deficiencies: matchedSaved.deficiencies,
          visitInterval: matchedSaved.visitInterval,
          lastVisitedDate: newVisitedStatus ? new Date().toISOString().split('T')[0] : matchedSaved.lastVisitedDate,
          nextVisitDate: matchedSaved.nextVisitDate,
          visited: newVisitedStatus
        });
      } catch (err) {
        console.warn("Could not sync visited status to saved addresses:", err);
      }
    }

    if (newVisitedStatus) {
      showToast(`✓ "${targetStop.label || 'Durak'}" gidildi olarak işaretlendi.`);
    }
  };

  // Handle note change
  const handleNoteChange = (stopId: string, newNote: string) => {
    const updatedStops = routeStops.map((s) => (s.id === stopId ? { ...s, note: newNote } : s));
    setRouteStops(updatedStops);

    try {
      localStorage.setItem('rotaplan_field_stops_status', JSON.stringify(
        updatedStops.map(s => ({ id: s.id, visited: s.visited, visitedAt: s.visitedAt, note: s.note }))
      ));
    } catch (e) {}
  };

  // Save note to database when blur or quick tag added
  const handleSaveNoteToDatabase = async (stop: RouteStop) => {
    const matchedSaved = getSavedAddressMatch(stop);
    if (matchedSaved && onUpdateAddress && stop.note !== undefined) {
      try {
        await onUpdateAddress(matchedSaved.id, {
          label: matchedSaved.label,
          address: matchedSaved.address,
          lat: matchedSaved.lat,
          lng: matchedSaved.lng,
          category: matchedSaved.category,
          phone: matchedSaved.phone,
          contactPerson: matchedSaved.contactPerson,
          deficiencies: stop.note,
          visitInterval: matchedSaved.visitInterval,
          lastVisitedDate: matchedSaved.lastVisitedDate,
          nextVisitDate: matchedSaved.nextVisitDate,
          visited: matchedSaved.visited
        });
        showToast("Not firma kartına kaydedildi!");
      } catch (err) {
        console.warn("Note sync failed:", err);
      }
    }
  };

  // Add quick tag to note
  const handleAddQuickTag = (stop: RouteStop, tag: string) => {
    const currentNote = stop.note || '';
    const separator = currentNote.trim().length > 0 ? ' | ' : '';
    const updatedNote = `${currentNote}${separator}${tag}`;
    handleNoteChange(stop.id, updatedNote);

    // Save to DB
    setTimeout(() => {
      handleSaveNoteToDatabase({ ...stop, note: updatedNote });
    }, 100);
  };

  // Reset all visited statuses
  const handleResetAllVisited = () => {
    if (!window.confirm("Rotadaki tüm durakların 'Gidildi' işaretlerini sıfırlamak istiyor musunuz?")) return;

    const resetStops = routeStops.map((s) => ({ ...s, visited: false, visitedAt: undefined }));
    setRouteStops(resetStops);

    try {
      localStorage.setItem('rotaplan_field_stops_status', JSON.stringify(
        resetStops.map(s => ({ id: s.id, visited: false, visitedAt: undefined, note: s.note }))
      ));
    } catch (e) {}

    showToast("Tüm durak işaretleri sıfırlandı.");
  };

  // Scroll to next unvisited stop
  const handleScrollToNextPending = () => {
    const nextStop = validStops.find((s) => !s.visited);
    if (nextStop && stopRefs.current[nextStop.id]) {
      stopRefs.current[nextStop.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`Sıradaki: ${nextStop.label || 'Durak'}`);
    } else {
      showToast("Tüm duraklar tamamlandı! Harika iş 🚀");
    }
  };

  // Calculated Stats
  const completedCount = validStops.filter((s) => s.visited).length;
  const pendingCount = validStops.length - completedCount;
  const progressPercent = validStops.length > 0 ? Math.round((completedCount / validStops.length) * 100) : 0;

  // Filtered List
  const displayedStops = validStops.filter((stop) => {
    if (filterMode === 'pending') return !stop.visited;
    if (filterMode === 'completed') return !!stop.visited;
    return true;
  });

  if (validStops.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 min-h-[500px]">
        <div className="h-16 w-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm border border-red-100">
          <Navigation className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">Rotada Henüz Durak Yok</h3>
        <p className="text-xs text-slate-500 max-w-xs mb-5 leading-relaxed">
          Saha takibini başlatmak için lütfen önce "Rota Planla" sekmesinden duraklarınızı belirleyin veya kayıtlı adreslerinizden rota oluşturun.
        </p>
        {onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab('route')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Navigation className="h-4 w-4" />
            <span>Rota Planlayıcıya Git</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-100 h-full overflow-hidden select-none">
      {/* Sticky Top Header / Progress Board */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-xs shrink-0 z-10 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              📍
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 leading-none">
                Saha Rota &amp; Ziyaret Takibi
              </h2>
              <span className="text-[10px] text-slate-500 font-medium">
                {validStops.length} Durak | Yandex Maps Mobil Modu
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAllVisited}
            title="Tüm Ziyaretleri Sıfırla"
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Sıfırla</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              İlerleme Durumu: <span className="text-emerald-600">{completedCount}</span> / {validStops.length} Gidildi
            </span>
            <span className="font-extrabold text-xs text-red-600">
              %{progressPercent}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Fast Action Buttons Bar */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <a
            id="field-top-bulk-yandex-btn"
            href={getBulkYandexUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all text-center cursor-pointer active:scale-95"
            title="Tüm durakları sıralı olarak doğrudan Yandex Navigasyon uygulamasında açar."
          >
            <Navigation className="h-4 w-4 shrink-0 fill-white" />
            <span>Tüm Rotayı Yandex'te Aç</span>
          </a>

          <button
            type="button"
            onClick={handleScrollToNextPending}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <ArrowRight className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Sıradaki Durağa Git ({pendingCount})</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tümü ({validStops.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('pending')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            Kalanlar ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('completed')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            Gidilenler ({completedCount})
          </button>
        </div>
      </div>

      {/* Main Stops List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {displayedStops.map((stop, index) => {
          const originalIndex = validStops.findIndex((s) => s.id === stop.id);
          const isOrigin = originalIndex === 0;
          const isDest = originalIndex === validStops.length - 1;
          const matchedSaved = getSavedAddressMatch(stop);
          const phone = matchedSaved?.phone || stop.phone || '';
          const contact = matchedSaved?.contactPerson || stop.contactPerson || '';
          const category = matchedSaved?.category || 'Genel';
          const yandexSingleUrl = getStopYandexUrl(stop.lat, stop.lng);
          const isVisited = !!stop.visited;

          return (
            <div
              key={stop.id}
              ref={(el) => (stopRefs.current[stop.id] = el)}
              className={`rounded-2xl border transition-all duration-200 bg-white shadow-xs overflow-hidden ${
                isVisited
                  ? 'border-emerald-300/80 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Header */}
              <div className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {/* Index Badge */}
                    <div
                      className={`h-7 w-7 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs ${
                        isVisited
                          ? 'bg-emerald-600 text-white'
                          : isOrigin
                          ? 'bg-blue-600 text-white'
                          : isDest
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-white'
                      }`}
                    >
                      {isVisited ? <Check className="h-4 w-4 stroke-[3]" /> : originalIndex + 1}
                    </div>

                    {/* Company Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            isOrigin
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : isDest
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isOrigin ? 'Başlangıç' : isDest ? 'Varış' : `Durak #${originalIndex + 1}`}
                        </span>

                        {matchedSaved && (
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                            {category}
                          </span>
                        )}

                        {isVisited && (
                          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Gidildi {stop.visitedAt && `(${stop.visitedAt})`}
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-sm sm:text-base font-extrabold mt-1 text-slate-900 leading-snug break-words ${
                          isVisited ? 'line-through text-slate-500' : ''
                        }`}
                      >
                        {stop.label || (isOrigin ? 'Başlangıç Noktası' : 'İsimsiz Durak')}
                      </h3>

                      {/* Address */}
                      <p className="text-xs text-slate-600 mt-0.5 flex items-start gap-1 leading-relaxed">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="break-words">{stop.address || 'Adres bilgisi girilmedi'}</span>
                      </p>

                      {/* Phone & Contact Person */}
                      {(phone || contact) && (
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
                          {contact && (
                            <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              {contact}
                            </span>
                          )}

                          {phone && (
                            <a
                              href={`tel:${phone}`}
                              className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/80 transition-colors"
                            >
                              <Phone className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{phone} (Ara)</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* YANDEX MAPS DIRECT BUTTON */}
                <div className="pt-1">
                  <a
                    id={`yandex-open-stop-${stop.id}`}
                    href={yandexSingleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all text-center cursor-pointer border border-red-700 active:scale-[0.98]"
                    title="Cihazdaki Yandex Maps / Navigasyon uygulamasını bu firmanın konumuna açar."
                  >
                    <Navigation className="h-4.5 w-4.5 fill-white shrink-0" />
                    <span>Yandex Maps'te Konumu Aç ↗</span>
                  </a>
                </div>

                {/* NOTE WRITING SECTION */}
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wider">
                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Firma Notu / Eksiklik / Sipariş:</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Yazınca otomatik kaydedilir</span>
                  </div>

                  <textarea
                    rows={2}
                    value={stop.note || ''}
                    onChange={(e) => handleNoteChange(stop.id, e.target.value)}
                    onBlur={() => handleSaveNoteToDatabase(stop)}
                    placeholder="Sipariş, teslimat notu veya eksiklikleri buraya yazın..."
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 leading-relaxed transition-all"
                  />

                  {/* Quick Tags for 1-tap note entry on mobile */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold">Hızlı Not:</span>
                    <button
                      type="button"
                      onClick={() => handleAddQuickTag(stop, 'Sipariş Alındı')}
                      className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      + Sipariş Alındı
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickTag(stop, 'Eksik Ürün Var')}
                      className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      + Eksik Var
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickTag(stop, 'Kapalıydı')}
                      className="text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      + Kapalıydı
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickTag(stop, 'Yarın Tekrar Uğra')}
                      className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      + Yarın Tekrar
                    </button>
                  </div>
                </div>

                {/* VISITED CHECKBOX / TOGGLE BUTTON */}
                <div className="pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleToggleVisited(stop.id)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                      isVisited
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-300 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    {isVisited ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-white" />
                        <span>✓ Ziyaret Edildi Olarak Tamamlandı {stop.visitedAt && `(${stop.visitedAt})`}</span>
                      </>
                    ) : (
                      <>
                        <Circle className="h-4 w-4 text-slate-400" />
                        <span>Bu Firmayı "Gidildi" Olarak İşaretle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 border border-slate-700/80 max-w-[90vw]">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
