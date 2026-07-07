import React, { useState } from 'react';
import { SavedAddress, RouteStop } from '../types';
import { 
  ClipboardList, Search, AlertCircle, CheckCircle, Clock, Calendar, 
  Plus, Edit, Route, Check, Trash2, MapPin, Map, Info, Sparkles, Filter
} from 'lucide-react';

interface VisitsAndDeficienciesProps {
  savedAddresses: SavedAddress[];
  onUpdateAddress: (id: string, address: Omit<SavedAddress, 'id'>) => Promise<void>;
  routeStops: RouteStop[];
  setRouteStops: React.Dispatch<React.SetStateAction<RouteStop[]>>;
  onSelectOnMap: (address: SavedAddress) => void;
  setActiveTab: (tab: 'route' | 'saved' | 'settings' | 'visits') => void;
  setMobileTab: (tab: 'route' | 'saved' | 'settings' | 'map' | 'visits') => void;
}

export default function VisitsAndDeficiencies({
  savedAddresses,
  onUpdateAddress,
  routeStops,
  setRouteStops,
  onSelectOnMap,
  setActiveTab,
  setMobileTab,
}: VisitsAndDeficienciesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'due' | 'deficiencies' | 'notes'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Quick inline editing states
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [editingDeficienciesId, setEditingDeficienciesId] = useState<string | null>(null);
  const [tempDeficiencies, setTempDeficiencies] = useState('');

  // Detailed modal edit state
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState('Genel');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDeficiencies, setEditDeficiencies] = useState('');
  const [editVisitInterval, setEditVisitInterval] = useState('none');
  const [editLastVisitedDate, setEditLastVisitedDate] = useState('');
  const [editNextVisitDate, setEditNextVisitDate] = useState('');

  const intervalLabels: Record<string, string> = {
    'none': 'Belirtilmemiş',
    '15_days': '15 Günde Bir',
    '1_month': 'Ayda 1',
    '2_months': '2 Ayda 1',
    '3_months': '3 Ayda 1',
    '6_months': '6 Ayda 1',
    '1_year': 'Yılda 1',
  };

  const calculateNextVisitDate = (lastDateStr: string, interval: string): string => {
    if (!lastDateStr || interval === 'none') return '';
    const date = new Date(lastDateStr);
    if (isNaN(date.getTime())) return '';

    switch (interval) {
      case '15_days':
        date.setDate(date.getDate() + 15);
        break;
      case '1_month':
        date.setMonth(date.getMonth() + 1);
        break;
      case '2_months':
        date.setMonth(date.getMonth() + 2);
        break;
      case '3_months':
        date.setMonth(date.getMonth() + 3);
        break;
      case '6_months':
        date.setMonth(date.getMonth() + 6);
        break;
      case '1_year':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return '';
    }
    return date.toISOString().split('T')[0];
  };

  const getNextVisitRemainingDays = (nextVisitStr?: string) => {
    if (!nextVisitStr) return null;
    const nextDate = new Date(nextVisitStr);
    if (isNaN(nextDate.getTime())) return null;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    nextDate.setHours(0,0,0,0);
    
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Helper filters
  const isDueOrUpcoming = (addr: SavedAddress) => {
    if (!addr.visitInterval || addr.visitInterval === 'none') return false;
    if (!addr.lastVisitedDate) return true; // Interval set but never visited
    
    const remaining = getNextVisitRemainingDays(addr.nextVisitDate);
    if (remaining === null) return false;
    return remaining <= 7; // Overdue, due today, or within 7 days
  };

  const hasDeficiencies = (addr: SavedAddress) => {
    return !!addr.deficiencies?.trim();
  };

  const hasNotes = (addr: SavedAddress) => {
    return !!addr.notes?.trim();
  };

  // Extract unique categories for filter
  const categories = Array.from(new Set(savedAddresses.map(a => a.category || 'Genel')));

  // Filtered list
  const filteredAddresses = savedAddresses.filter(addr => {
    // Search query match
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (addr.label || '').toLowerCase().includes(q) || 
      (addr.address || '').toLowerCase().includes(q) ||
      (addr.notes || '').toLowerCase().includes(q) ||
      (addr.deficiencies || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Category filter
    if (categoryFilter !== 'all') {
      const cat = addr.category || 'Genel';
      if (cat !== categoryFilter) return false;
    }

    // Tab filter type
    if (filterType === 'due') return isDueOrUpcoming(addr);
    if (filterType === 'deficiencies') return hasDeficiencies(addr);
    if (filterType === 'notes') return hasNotes(addr);

    return true;
  });

  // Handle marking visited today
  const handleMarkVisitedToday = async (addr: SavedAddress) => {
    const todayStr = new Date().toISOString().split('T')[0];
    let nextDateStr = '';
    
    if (addr.visitInterval && addr.visitInterval !== 'none') {
      nextDateStr = calculateNextVisitDate(todayStr, addr.visitInterval);
    }

    const { id, ...rest } = addr;
    await onUpdateAddress(id, {
      ...rest,
      lastVisitedDate: todayStr,
      nextVisitDate: nextDateStr,
      visited: true
    });
  };

  // Add/remove stop from route
  const isStopInRoute = (addr: SavedAddress) => {
    return routeStops.some(s => s.lat === addr.lat && s.lng === addr.lng);
  };

  const handleToggleRouteStop = (addr: SavedAddress) => {
    const inRoute = isStopInRoute(addr);
    if (inRoute) {
      setRouteStops(prev => prev.filter(s => !(s.lat === addr.lat && s.lng === addr.lng)));
    } else {
      setRouteStops(prev => {
        const updated = [...prev];
        const newStop: RouteStop = {
          id: addr.id,
          label: addr.label,
          address: addr.address,
          lat: addr.lat,
          lng: addr.lng,
          isSaved: true
        };
        // Insert right before the last element (the destination / target stop)
        if (updated.length > 1) {
          updated.splice(updated.length - 1, 0, newStop);
        } else {
          updated.push(newStop);
        }
        return updated;
      });
    }
  };

  // Inline notes submit
  const handleSaveInlineNotes = async (addr: SavedAddress) => {
    const { id, ...rest } = addr;
    await onUpdateAddress(id, {
      ...rest,
      notes: tempNotes.trim()
    });
    setEditingNotesId(null);
  };

  // Inline deficiencies submit
  const handleSaveInlineDeficiencies = async (addr: SavedAddress) => {
    const { id, ...rest } = addr;
    await onUpdateAddress(id, {
      ...rest,
      deficiencies: tempDeficiencies.trim()
    });
    setEditingDeficienciesId(null);
  };

  // Detailed Modal edit click
  const handleOpenEditModal = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setEditLabel(addr.label);
    setEditCategory(addr.category || 'Genel');
    setEditCustomCategory('');
    setEditNotes(addr.notes || '');
    setEditDeficiencies(addr.deficiencies || '');
    setEditVisitInterval(addr.visitInterval || 'none');
    setEditLastVisitedDate(addr.lastVisitedDate || '');
    setEditNextVisitDate(addr.nextVisitDate || '');
  };

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress) return;

    const finalCat = editCategory === 'custom' ? (editCustomCategory.trim() || 'Genel') : editCategory;
    
    let finalNextVisit = editNextVisitDate;
    if (editLastVisitedDate && editVisitInterval !== 'none') {
      finalNextVisit = calculateNextVisitDate(editLastVisitedDate, editVisitInterval);
    }

    const { id, ...rest } = editingAddress;
    await onUpdateAddress(id, {
      label: editLabel.trim() || editingAddress.label,
      address: editingAddress.address,
      lat: editingAddress.lat,
      lng: editingAddress.lng,
      category: finalCat,
      notes: editNotes.trim(),
      deficiencies: editDeficiencies.trim(),
      visitInterval: editVisitInterval,
      lastVisitedDate: editLastVisitedDate,
      nextVisitDate: finalNextVisit,
      visited: editingAddress.visited
    });

    setEditingAddress(null);
  };

  // Count helper stats
  const totalFirms = savedAddresses.length;
  const dueFirms = savedAddresses.filter(isDueOrUpcoming).length;
  const deficiencyFirms = savedAddresses.filter(hasDeficiencies).length;
  const notesFirms = savedAddresses.filter(hasNotes).length;

  return (
    <div id="visits-deficiencies-panel" className="h-full flex flex-col bg-slate-50 animate-fade-in font-sans">
      
      {/* Header and Quick Stats */}
      <div className="p-4 bg-white border-b border-slate-150 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shadow-xs">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">Ziyaret &amp; Eksiklik Yönetimi</h2>
              <p className="text-[10px] text-slate-400 font-bold">Rutin ziyaretleri, ihtiyaçları ve evrakları takip edin.</p>
            </div>
          </div>
        </div>

        {/* Stats Grid - 2x2 Layout to prevent text overflow on 420px column/mobile */}
        <div className="grid grid-cols-2 gap-2">
          <div 
            onClick={() => { setFilterType('all'); setCategoryFilter('all'); }}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 select-none ${
              filterType === 'all' && categoryFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold block opacity-75">Toplam Kayıtlı</span>
            <span className="text-xl font-black block mt-0.5">{totalFirms} <span className="text-[10px] font-normal">firma</span></span>
          </div>

          <div 
            onClick={() => { setFilterType('due'); setCategoryFilter('all'); }}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 select-none ${
              filterType === 'due' 
                ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.01]' 
                : 'bg-amber-50 hover:bg-amber-100/60 border-amber-200 text-amber-900 shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold block opacity-75 flex items-center gap-1">⏱ Süresi Gelen</span>
            <span className="text-xl font-black block mt-0.5">{dueFirms} <span className="text-[10px] font-normal">firma</span></span>
          </div>

          <div 
            onClick={() => { setFilterType('deficiencies'); setCategoryFilter('all'); }}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 select-none ${
              filterType === 'deficiencies' 
                ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.01]' 
                : 'bg-rose-50 hover:bg-rose-100/60 border-rose-200 text-rose-900 shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold block opacity-75 flex items-center gap-1">🚨 Eksik / İhtiyaç</span>
            <span className="text-xl font-black block mt-0.5">{deficiencyFirms} <span className="text-[10px] font-normal">firma</span></span>
          </div>

          <div 
            onClick={() => { setFilterType('notes'); setCategoryFilter('all'); }}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 select-none ${
              filterType === 'notes' 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.01]' 
                : 'bg-indigo-50 hover:bg-indigo-100/60 border-indigo-200 text-indigo-900 shadow-xs'
            }`}
          >
            <span className="text-[10px] font-bold block opacity-75 flex items-center gap-1">📝 Özel Notlar</span>
            <span className="text-xl font-black block mt-0.5">{notesFirms} <span className="text-[10px] font-normal">firma</span></span>
          </div>
        </div>
      </div>

      {/* Search & Group Filter Bar - Clean Stacked Layout */}
      <div className="p-3 bg-white border-b border-slate-150 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Firma adı, adres, not veya eksiklik ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-xs pl-8.5 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 placeholder-slate-400 shadow-inner"
          />
        </div>

        {/* Horizontal Scrollable Category Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin select-none">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tüm Gruplar
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredAddresses.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-150 text-slate-400 shadow-xs">
            <AlertCircle className="h-8 w-8 mx-auto text-indigo-300 mb-2.5" />
            <p className="text-xs font-semibold text-slate-700">Aramanıza uygun firma bulunamadı.</p>
            <p className="text-[10px] text-slate-400 mt-1">Filtreleri veya grup seçimini sıfırlayabilirsiniz.</p>
            {(searchQuery || categoryFilter !== 'all' || filterType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setCategoryFilter('all');
                }}
                className="mt-3 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl border border-indigo-150 transition-all cursor-pointer"
              >
                Tüm Filtreleri Temizle
              </button>
            )}
          </div>
        ) : (
          filteredAddresses.map((addr) => {
            const isOriginOrDestInRoute = routeStops.some((s, idx) => {
              if (idx === 0 || idx === routeStops.length - 1) {
                return Math.abs(s.lat - addr.lat) < 0.0001 && Math.abs(s.lng - addr.lng) < 0.0001;
              }
              return false;
            });
            const inRoute = isStopInRoute(addr);
            const remaining = getNextVisitRemainingDays(addr.nextVisitDate);

            return (
              <div 
                key={addr.id} 
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-sm transition-all p-4 flex flex-col gap-3.5"
              >
                {/* Info Block */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="bg-indigo-50/80 border border-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase">
                          {addr.category || 'Genel'}
                        </span>
                        <h3 className="text-xs font-black text-slate-800 tracking-tight leading-snug">
                          {addr.label}
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium max-w-full flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-300" />
                        <span className="truncate">{addr.address}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(addr)}
                      title="Firma Bilgilerini Güncelle"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer shrink-0 border border-transparent hover:border-indigo-100"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Deficiencies and Notes Fields with quick inline write */}
                  <div className="flex flex-col gap-2 pt-0.5">
                    
                    {/* Deficiencies Block */}
                    <div className="p-2.5 bg-rose-50/50 border border-rose-100/70 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-rose-800 uppercase tracking-wider flex items-center gap-1">
                          🚨 Eksiklik &amp; İhtiyaç
                        </span>
                        {editingDeficienciesId !== addr.id && (
                          <button
                            onClick={() => {
                              setEditingDeficienciesId(addr.id);
                              setTempDeficiencies(addr.deficiencies || '');
                            }}
                            className="text-[9px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Hızlı Yaz
                          </button>
                        )}
                      </div>
                      {editingDeficienciesId === addr.id ? (
                        <div className="space-y-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={tempDeficiencies}
                            onChange={(e) => setTempDeficiencies(e.target.value)}
                            placeholder="Evrak eksikleri, malzeme ihtiyaçları..."
                            rows={2}
                            className="w-full text-xs bg-white border border-rose-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800 shadow-inner"
                          />
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditingDeficienciesId(null)}
                              className="px-2 py-1 text-[10px] bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-bold"
                            >
                              İptal
                            </button>
                            <button
                              onClick={() => handleSaveInlineDeficiencies(addr)}
                              className="px-2 py-1 text-[10px] bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold shadow-xs"
                            >
                              Kaydet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600 leading-normal pl-0.5">
                          {addr.deficiencies?.trim() ? (
                            <span className="font-semibold text-slate-700">{addr.deficiencies}</span>
                          ) : (
                            <span className="text-slate-400 italic font-medium">Belirtilen eksiklik yok.</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Notes Block */}
                    <div className="p-2.5 bg-indigo-50/40 border border-indigo-100/60 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                          📝 Görüşme Notu
                        </span>
                        {editingNotesId !== addr.id && (
                          <button
                            onClick={() => {
                              setEditingNotesId(addr.id);
                              setTempNotes(addr.notes || '');
                            }}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                          >
                            Hızlı Yaz
                          </button>
                        )}
                      </div>
                      {editingNotesId === addr.id ? (
                        <div className="space-y-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            placeholder="Müşteri görüşmesi veya firma bilgileri..."
                            rows={2}
                            className="w-full text-xs bg-white border border-indigo-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 shadow-inner"
                          />
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="px-2 py-1 text-[10px] bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-bold"
                            >
                              İptal
                            </button>
                            <button
                              onClick={() => handleSaveInlineNotes(addr)}
                              className="px-2 py-1 text-[10px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-xs"
                            >
                              Kaydet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600 leading-normal pl-0.5">
                          {addr.notes?.trim() ? (
                            <span className="font-semibold text-slate-700">{addr.notes}</span>
                          ) : (
                            <span className="text-slate-400 italic font-medium">Kayıtlı özel not yok.</span>
                          )}
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Routine visit indicators */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                    <span className="text-slate-400 font-bold">Döngü:</span>
                    <span className="bg-slate-100 text-slate-700 font-extrabold px-1.5 py-0.5 rounded-md border border-slate-200/60">
                      ⏱ {intervalLabels[addr.visitInterval || 'none']}
                    </span>

                    {addr.lastVisitedDate && (
                      <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md border border-slate-200/60">
                        Son Ziyaret: {addr.lastVisitedDate}
                      </span>
                    )}

                    {addr.visitInterval && addr.visitInterval !== 'none' && (
                      <>
                        {!addr.lastVisitedDate ? (
                          <span className="bg-amber-50 text-amber-800 font-black px-1.5 py-0.5 rounded-md border border-amber-200">
                            Ziyaret Bekleniyor
                          </span>
                        ) : (() => {
                          if (remaining === null) return null;
                          if (remaining < 0) {
                            return (
                              <span className="bg-rose-50 text-rose-700 font-black px-1.5 py-0.5 rounded-md border border-rose-200 animate-pulse flex items-center gap-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 inline-block"></span>
                                {Math.abs(remaining)} Gün Gecikti ({addr.nextVisitDate})
                              </span>
                            );
                          } else if (remaining === 0) {
                            return (
                              <span className="bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded-md border border-amber-300 animate-bounce">
                                📅 Bugün Ziyaret Günü!
                              </span>
                            );
                          } else if (remaining <= 7) {
                            return (
                              <span className="bg-amber-50 text-amber-700 font-black px-1.5 py-0.5 rounded-md border border-amber-200">
                                ⏱ {remaining} Gün Kaldı ({addr.nextVisitDate})
                              </span>
                            );
                          } else {
                            return (
                              <span className="bg-emerald-50 text-emerald-700 font-black px-1.5 py-0.5 rounded-md border border-emerald-200">
                                ⏱ {remaining} Gün Kaldı ({addr.nextVisitDate})
                              </span>
                            );
                          }
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {/* Unified Mobile & Desktop Action Grid - 100% width vertical card flow */}
                <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-3.5 select-none shrink-0">
                  
                  {/* Mark visited check */}
                  <button
                    type="button"
                    onClick={() => handleMarkVisitedToday(addr)}
                    className="flex flex-col items-center justify-center gap-1 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-extrabold text-[9px] rounded-xl transition-all cursor-pointer h-12 active:scale-95"
                    title="Bugün ziyaret edildi olarak kaydet"
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Ziyaret Et
                  </button>

                  {/* Route Add/Remove Toggle */}
                  <button
                    type="button"
                    disabled={isOriginOrDestInRoute}
                    onClick={() => handleToggleRouteStop(addr)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 text-[9px] font-extrabold rounded-xl transition-all h-12 active:scale-95 cursor-pointer ${
                      isOriginOrDestInRoute
                        ? 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200'
                        : inRoute
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                    }`}
                  >
                    <Route className={`h-4 w-4 ${isOriginOrDestInRoute ? 'text-slate-300' : inRoute ? 'text-rose-600' : 'text-indigo-600'}`} />
                    {isOriginOrDestInRoute ? 'Süreçte' : inRoute ? 'Rotadan Çıkar' : 'Rotaya Ekle'}
                  </button>

                  {/* Show on Map link */}
                  <button
                    type="button"
                    onClick={() => onSelectOnMap(addr)}
                    className="flex flex-col items-center justify-center gap-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[9px] rounded-xl border border-slate-200 transition-all cursor-pointer h-12 active:scale-95"
                  >
                    <Map className="h-4 w-4 text-slate-500" />
                    Harita
                  </button>

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* QUICK DETAILED EDIT MODAL */}
      {editingAddress && (
        <div 
          id="detailed-firm-edit-modal-backdrop"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setEditingAddress(null)}
        >
          <div 
            id="detailed-firm-edit-modal"
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Edit className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 tracking-tight">Firma Bilgilerini Güncelle</h3>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase">{editingAddress.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleModalSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Ad/Etiket */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Firma Adı / Etiket</label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="block w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              {/* Kategori / Grup */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Grup / Kategori</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="block w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="Genel">Genel</option>
                    <option value="Müşteriler">Müşteriler</option>
                    <option value="Depolar">Depolar</option>
                    <option value="Şantiyeler">Şantiyeler</option>
                    <option value="Bayiler">Bayiler</option>
                    {categories.filter(c => !['Genel', 'Müşteriler', 'Depolar', 'Şantiyeler', 'Bayiler'].includes(c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="custom"> Yeni Grup Ekle...</option>
                  </select>

                  {editCategory === 'custom' && (
                    <input
                      type="text"
                      placeholder="Yeni Grup Adı"
                      required
                      value={editCustomCategory}
                      onChange={(e) => setEditCustomCategory(e.target.value)}
                      className="block w-full text-xs px-3 py-2.5 bg-slate-50 border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800"
                    />
                  )}
                </div>
              </div>

              {/* Ziyaret Sıklığı ve Son Ziyaret */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">Rutin Ziyaret Rutu</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600">Ziyaret Periyodu</label>
                    <select
                      value={editVisitInterval}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditVisitInterval(val);
                        if (editLastVisitedDate && val !== 'none') {
                          setEditNextVisitDate(calculateNextVisitDate(editLastVisitedDate, val));
                        }
                      }}
                      className="block w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium cursor-pointer"
                    >
                      <option value="none">Belirtilmemiş</option>
                      <option value="15_days">15 Günde Bir</option>
                      <option value="1_month">Ayda 1</option>
                      <option value="2_months">2 Ayda 1</option>
                      <option value="3_months">3 Ayda 1</option>
                      <option value="6_months">6 Ayda 1</option>
                      <option value="1_year">Yılda 1</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600">Son Ziyaret Tarihi</label>
                    <input
                      type="date"
                      value={editLastVisitedDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditLastVisitedDate(val);
                        if (val && editVisitInterval !== 'none') {
                          setEditNextVisitDate(calculateNextVisitDate(val, editVisitInterval));
                        }
                      }}
                      className="block w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-bold text-slate-600">Sıradaki Ziyaret Tarihi</label>
                    {editLastVisitedDate && editVisitInterval !== 'none' && (
                      <span className="text-[9px] text-emerald-600 font-extrabold">✓ Otomatik Hesaplandı</span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={editNextVisitDate}
                    onChange={(e) => setEditNextVisitDate(e.target.value)}
                    className="block w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Notlar ve Eksiklikler */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Firma Notları</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Müşteri detayları, görüşme raporları..."
                    rows={3}
                    className="block w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-rose-600 font-black">Eksiklik ve İhtiyaçlar</label>
                  <textarea
                    value={editDeficiencies}
                    onChange={(e) => setEditDeficiencies(e.target.value)}
                    placeholder="Eksik evrak, malzeme, teslimat detayları..."
                    rows={3}
                    className="block w-full text-xs px-2.5 py-2 bg-rose-50/20 border border-rose-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-rose-800 font-medium resize-none placeholder-rose-300"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAddress(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
