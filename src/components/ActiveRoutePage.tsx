import React, { useState } from 'react';
import { SavedRoute, SavedAddress, RouteStop } from '../types';
import { startGoogleMapsNavigation, startGoogleMapsMultiRoute, callPhoneNumber, openWhatsAppChat } from '../utils/navigation';
import {
  ArrowLeft, Navigation, Phone, MessageSquare, CheckCircle2,
  Circle, Edit3, Search, MapPin, Check, Save, ExternalLink
} from 'lucide-react';

interface ActiveRoutePageProps {
  route: SavedRoute;
  savedAddresses: SavedAddress[];
  onUpdateAddressNote: (addressId: string, note: string) => void;
  onToggleVisited: (addressId: string, visited: boolean) => void;
  onCloseRoute: () => void;
}

export default function ActiveRoutePage({
  route,
  savedAddresses,
  onUpdateAddressNote,
  onToggleVisited,
  onCloseRoute
}: ActiveRoutePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savedNoteNotification, setSavedNoteNotification] = useState<string | null>(null);

  // Map stops to their latest saved address data (to keep notes and visited statuses in sync)
  const addressMap = new Map<string, SavedAddress>();
  savedAddresses.forEach(a => addressMap.set(a.id, a));

  const stopsWithData = route.stops.map((stop, index) => {
    const matched = addressMap.get(stop.id);
    return {
      ...stop,
      orderNumber: index + 1,
      visited: matched?.visited ?? stop.visited ?? false,
      note: matched?.note ?? stop.note ?? '',
      phone: matched?.phone || stop.phone || ''
    };
  });

  const totalStops = stopsWithData.length;
  const visitedStops = stopsWithData.filter(s => s.visited).length;
  const progressPercent = totalStops > 0 ? Math.round((visitedStops / totalStops) * 100) : 0;

  const filteredStops = stopsWithData.filter(s => {
    const matchesSearch =
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.note && s.note.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterMode === 'pending') return !s.visited;
    if (filterMode === 'completed') return s.visited;
    return true;
  });

  const handleNoteChange = (stopId: string, value: string) => {
    setEditingNotes(prev => ({ ...prev, [stopId]: value }));
  };

  const handleSaveNote = (stopId: string, fallbackNote: string) => {
    const newNote = editingNotes[stopId] !== undefined ? editingNotes[stopId] : fallbackNote;
    onUpdateAddressNote(stopId, newNote);
    setSavedNoteNotification(stopId);
    setTimeout(() => {
      setSavedNoteNotification(null);
    }, 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* TOP HEADER - FOCUSED LIVE FIELD BAR */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 py-3 shrink-0 shadow-xl z-20">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onCloseRoute}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-700 shadow-sm shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Rotalara Dön</span>
          </button>

          <div className="flex-1 text-center min-w-0">
            <h1 className="text-sm md:text-base font-extrabold text-white truncate">
              {route.title}
            </h1>
            <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-400 font-semibold mt-0.5">
              <span>{visitedStops} / {totalStops} Firma Tamamlandı</span>
              <span>•</span>
              <span>%{progressPercent}</span>
            </div>
          </div>

          <button
            onClick={() => startGoogleMapsMultiRoute(route.stops)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5 shrink-0"
          >
            <Navigation className="h-4 w-4 fill-white" />
            <span className="hidden sm:inline">Tümünü Google'da Başlat</span>
            <span className="sm:hidden">Tümü</span>
          </button>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Firma veya adres ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-[10px] font-bold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tümü ({totalStops})
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kalan ({totalStops - visitedStops})
            </button>
            <button
              onClick={() => setFilterMode('completed')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'completed' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Biten ({visitedStops})
            </button>
          </div>
        </div>
      </header>

      {/* SINGLE-PAGE STOPS LIST */}
      <main className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 max-w-4xl mx-auto w-full">
        {filteredStops.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">Bu filtreye uygun firma bulunamadı.</p>
          </div>
        ) : (
          filteredStops.map((stop) => {
            const currentNote = editingNotes[stop.id] !== undefined ? editingNotes[stop.id] : stop.note;
            const isNoteSaved = savedNoteNotification === stop.id;

            return (
              <div
                key={stop.id}
                className={`p-4 rounded-2xl border transition-all ${
                  stop.visited
                    ? 'bg-slate-950/60 border-slate-800/60 opacity-80'
                    : 'bg-slate-950 border-slate-800 shadow-lg hover:border-slate-700'
                }`}
              >
                {/* TOP ROW: ORDER NUMBER & FIRM NAME */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`h-7 w-7 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        stop.visited
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      }`}
                    >
                      {stop.orderNumber}
                    </span>
                    <div>
                      <h3
                        className={`font-bold text-sm md:text-base leading-snug ${
                          stop.visited ? 'line-through text-slate-400' : 'text-white'
                        }`}
                      >
                        {stop.label}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {stop.address}
                      </p>
                    </div>
                  </div>

                  {/* VISITED CHECKBOX */}
                  <button
                    onClick={() => onToggleVisited(stop.id, !stop.visited)}
                    title={stop.visited ? 'Ziyaret tamamlandı (Geri al)' : 'Ziyareti tamamla'}
                    className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                      stop.visited
                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-400 hover:border-slate-700'
                    }`}
                  >
                    {stop.visited ? (
                      <CheckCircle2 className="h-5 w-5 fill-emerald-500/20 text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* PRIMARY ACTIONS: GOOGLE MAPS + PHONE + WHATSAPP */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {/* HERO GOOGLE MAPS LAUNCH BUTTON */}
                  <button
                    onClick={() => startGoogleMapsNavigation(stop.lat, stop.lng, stop.label, stop.address)}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-900/40 text-xs md:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <Navigation className="h-4 w-4 fill-white" />
                    <span>Google Haritalar'da Başlat ➔</span>
                  </button>

                  {/* Direct Phone Call */}
                  {stop.phone && (
                    <button
                      onClick={() => callPhoneNumber(stop.phone)}
                      title={`Ara: ${stop.phone}`}
                      className="p-3 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  )}

                  {/* WhatsApp Chat */}
                  {stop.phone && (
                    <button
                      onClick={() => openWhatsAppChat(stop.phone, stop.label)}
                      title="WhatsApp Mesajı Gönder"
                      className="p-3 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* SINGLE NOTE BOX (SYNCS DIRECTLY WITH EKSİKLER) */}
                <div className="mt-3 pt-3 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="h-3 w-3 text-indigo-400" />
                      Firma Notu / Eksikler Listesi:
                    </span>
                    {isNoteSaved && (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold animate-pulse">
                        <Check className="h-3 w-3" /> Eksikler sekmesine işlendi!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bu firma için not / eksik bilgisi yazın..."
                      value={currentNote}
                      onChange={(e) => handleNoteChange(stop.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveNote(stop.id, currentNote);
                        }
                      }}
                      className="flex-1 bg-slate-900 text-white placeholder-slate-600 px-3 py-2 rounded-xl border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs outline-none"
                    />
                    <button
                      onClick={() => handleSaveNote(stop.id, currentNote)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Kaydet</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </main>

    </div>
  );
}
