import React, { useState } from 'react';
import { SavedAddress, RouteStop } from '../types';
import { startGoogleMapsNavigation, callPhoneNumber, openWhatsAppChat } from '../utils/navigation';
import {
  ClipboardList, Search, CheckCircle2, Circle, Save, Navigation,
  Phone, MessageSquare, Edit3, ArrowDownAZ, Check, MapPin
} from 'lucide-react';

interface VisitsAndDeficienciesProps {
  savedAddresses: SavedAddress[];
  onUpdateAddress: (id: string, address: Omit<SavedAddress, 'id'>) => Promise<void>;
  onClearAllVisited?: () => Promise<void>;
  routeStops?: RouteStop[];
  setRouteStops?: React.Dispatch<React.SetStateAction<RouteStop[]>>;
  onSelectOnMap?: (address: SavedAddress) => void;
  setActiveTab?: (tab: any) => void;
  setMobileTab?: (tab: any) => void;
}

export default function VisitsAndDeficiencies({
  savedAddresses,
  onUpdateAddress,
  onClearAllVisited
}: VisitsAndDeficienciesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with_notes' | 'pending' | 'completed'>('all');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savedBadgeId, setSavedBadgeId] = useState<string | null>(null);

  // Alphabetical sort (Turkish A-Z)
  const sortedAddresses = [...savedAddresses].sort((a, b) => {
    return a.label.localeCompare(b.label, 'tr', { sensitivity: 'base' });
  });

  const filteredAddresses = sortedAddresses.filter(addr => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      addr.label.toLowerCase().includes(q) ||
      addr.address.toLowerCase().includes(q) ||
      (addr.note && addr.note.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterType === 'with_notes') return !!(addr.note && addr.note.trim().length > 0);
    if (filterType === 'pending') return !addr.visited;
    if (filterType === 'completed') return !!addr.visited;
    return true;
  });

  const handleNoteChange = (id: string, value: string) => {
    setEditingNotes(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveNote = async (addr: SavedAddress) => {
    const newNote = editingNotes[addr.id] !== undefined ? editingNotes[addr.id] : (addr.note || '');
    await onUpdateAddress(addr.id, {
      ...addr,
      note: newNote
    });
    setSavedBadgeId(addr.id);
    setTimeout(() => {
      setSavedBadgeId(null);
    }, 2500);
  };

  const handleToggleVisited = async (addr: SavedAddress) => {
    await onUpdateAddress(addr.id, {
      ...addr,
      visited: !addr.visited
    });
  };

  const totalCount = savedAddresses.length;
  const withNotesCount = savedAddresses.filter(a => a.note && a.note.trim().length > 0).length;
  const completedCount = savedAddresses.filter(a => a.visited).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* HEADER BAR (DARK) */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-3 shrink-0 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-teal-600/30">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-white leading-tight">
                  Eksikler & Firma Not Defteri
                </h2>
                <span className="text-[10px] bg-teal-950/80 border border-teal-800/60 text-teal-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowDownAZ className="h-3 w-3" /> A-Z Sıralı
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {totalCount} Firma • {withNotesCount} Notlu • {completedCount} Ziyaret Edildi
              </p>
            </div>
          </div>

          {onClearAllVisited && completedCount > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Tüm firmaların ziyaret edildi durumunu sıfırlamak istiyor musunuz?')) {
                  onClearAllVisited();
                }
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Sıfırla
            </button>
          )}
        </div>

        {/* SEARCH & FILTERS (DARK) */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Firma adı, adres veya notlarda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:bg-slate-950 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                filterType === 'all'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Tümü ({totalCount})
            </button>
            <button
              onClick={() => setFilterType('with_notes')}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                filterType === 'with_notes'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              📝 Notlu ({withNotesCount})
            </button>
            <button
              onClick={() => setFilterType('pending')}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                filterType === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ⏳ Kalan ({totalCount - completedCount})
            </button>
            <button
              onClick={() => setFilterType('completed')}
              className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                filterType === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ✓ Biten ({completedCount})
            </button>
          </div>
        </div>
      </div>

      {/* ALPHABETICAL FIRMS LIST (DARK) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {filteredAddresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500">
            <MapPin className="h-10 w-10 text-slate-700 mb-2" />
            <p className="text-xs font-bold text-slate-400">Firma Bulunamadı</p>
            <p className="text-[11px] text-slate-600 mt-1">Arama kriterinize uygun firma veya eksik notu yok.</p>
          </div>
        ) : (
          filteredAddresses.map((addr, index) => {
            const currentNote = editingNotes[addr.id] !== undefined ? editingNotes[addr.id] : (addr.note || '');
            const isSaved = savedBadgeId === addr.id;

            return (
              <div
                key={addr.id}
                className={`bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all space-y-3 ${
                  addr.visited
                    ? 'border-emerald-900/60 bg-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* TOP ROW: FIRM NAME & VISITED TOGGLE */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="h-7 w-7 rounded-xl bg-slate-950 text-slate-400 border border-slate-800 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className={`font-extrabold text-sm leading-snug ${addr.visited ? 'line-through text-slate-500' : 'text-white'}`}>
                        {addr.label}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {addr.address}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleVisited(addr)}
                    title={addr.visited ? 'Ziyaret tamamlandı (Geri al)' : 'Ziyareti tamamla'}
                    className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                      addr.visited
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-emerald-400 hover:border-slate-700'
                    }`}
                  >
                    {addr.visited ? (
                      <CheckCircle2 className="h-5 w-5 fill-emerald-950 text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* ACTION BUTTONS (GOOGLE MAPS + PHONE + WHATSAPP) */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => startGoogleMapsNavigation(addr.lat, addr.lng, addr.label, addr.address)}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-xs text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Navigation className="h-3.5 w-3.5 fill-white" />
                    <span>Google Haritalar'da Başlat ➔</span>
                  </button>

                  {addr.phone && (
                    <button
                      onClick={() => callPhoneNumber(addr.phone!)}
                      title={`Ara: ${addr.phone}`}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  )}

                  {addr.phone && (
                    <button
                      onClick={() => openWhatsAppChat(addr.phone!, addr.label)}
                      title="WhatsApp Mesajı Gönder"
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* NOTE / DEFICIENCIES BOX */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span className="flex items-center gap-1 text-indigo-400">
                      <Edit3 className="h-3 w-3" />
                      Firma Saha Notu / Eksikler:
                    </span>
                    {isSaved && (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5 animate-pulse">
                        <Check className="h-3 w-3" /> Kaydedildi!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Bu firma için not veya eksik yazın... (Örn: Sipariş alınacak)"
                      value={currentNote}
                      onChange={(e) => handleNoteChange(addr.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNote(addr);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <button
                      onClick={() => handleSaveNote(addr)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
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
      </div>

    </div>
  );
}
