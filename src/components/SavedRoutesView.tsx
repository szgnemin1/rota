import React, { useState, useRef } from 'react';
import { SavedRoute, SavedAddress, RouteStop } from '../types';
import { startYandexMultiRoute } from '../utils/navigation';
import { parseKMLText } from '../utils/kmlParser';
import {
  FolderKanban, Trash2, Search, Plus, Edit2, X, UploadCloud, Play, Navigation
} from 'lucide-react';

interface SavedRoutesViewProps {
  savedRoutes: SavedRoute[];
  savedAddresses: SavedAddress[];
  onStartLiveRoute: (route: SavedRoute) => void;
  onSaveRoute: (route: {
    title: string;
    description: string;
    category: string;
    color: string;
    stops: RouteStop[];
  }) => Promise<void>;
  onDeleteRoute: (id: string) => Promise<void>;
  onUpdateRoute?: (id: string, updates: Partial<SavedRoute>) => Promise<void>;
  onAddAddressesBulk?: (addresses: SavedAddress[]) => Promise<void>;
}

export default function SavedRoutesView({
  savedRoutes,
  savedAddresses,
  onStartLiveRoute,
  onSaveRoute,
  onDeleteRoute,
  onUpdateRoute,
  onAddAddressesBulk
}: SavedRoutesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // New Route Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRouteTitle, setNewRouteTitle] = useState('');
  const [newRouteDesc, setNewRouteDesc] = useState('');
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
  const [addressSearchInModal, setAddressSearchInModal] = useState('');

  // KML File Input Ref
  const kmlInputRef = useRef<HTMLInputElement>(null);
  const [kmlImportStatus, setKmlImportStatus] = useState<string | null>(null);

  const filteredRoutes = savedRoutes.filter(route => {
    return (
      route.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (route.description && route.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      route.stops.some(s => s.label?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleStartEdit = (route: SavedRoute) => {
    setEditingRouteId(route.id);
    setEditTitle(route.title);
    setEditDesc(route.description || '');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    if (onUpdateRoute) {
      await onUpdateRoute(id, {
        title: editTitle.trim(),
        description: editDesc.trim()
      });
    }
    setEditingRouteId(null);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" rotasını silmek istediğinizden emin misiniz?`)) return;
    setIsDeletingId(id);
    try {
      await onDeleteRoute(id);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleKmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setKmlImportStatus('KML dosyası işleniyor...');
      const text = await file.text();
      const parsed = parseKMLText(text, file.name.replace(/\.[^/.]+$/, ''));

      if (parsed.addresses.length === 0) {
        alert('Seçilen KML dosyasında konum bulunamadı.');
        setKmlImportStatus(null);
        return;
      }

      if (onAddAddressesBulk) {
        await onAddAddressesBulk(parsed.addresses);
      }

      if (parsed.route) {
        await onSaveRoute({
          title: parsed.route.title,
          description: parsed.route.description || '',
          category: 'KML Rotaları',
          color: '#e11d48',
          stops: parsed.route.stops
        });
      }

      setKmlImportStatus(`✓ Başarılı: ${parsed.addresses.length} konum ve rota eklendi!`);
      setTimeout(() => setKmlImportStatus(null), 3500);
    } catch (err: any) {
      alert('KML dosyası okunurken hata oluştu: ' + err.message);
      setKmlImportStatus(null);
    } finally {
      if (kmlInputRef.current) kmlInputRef.current.value = '';
    }
  };

  const handleCreateRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteTitle.trim()) return;
    if (selectedAddressIds.length === 0) {
      alert('Lütfen en az bir durak seçin.');
      return;
    }

    const stops: RouteStop[] = selectedAddressIds
      .map(id => savedAddresses.find(a => a.id === id))
      .filter((a): a is SavedAddress => a !== undefined)
      .map(a => ({
        id: a.id,
        label: a.label,
        address: a.address,
        lat: a.lat,
        lng: a.lng,
        phone: a.phone || '',
        note: a.note || '',
        visited: false
      }));

    await onSaveRoute({
      title: newRouteTitle.trim(),
      description: newRouteDesc.trim() || `${stops.length} duraklı özel rota`,
      category: 'Özel Rotalar',
      color: '#e11d48',
      stops
    });

    setNewRouteTitle('');
    setNewRouteDesc('');
    setSelectedAddressIds([]);
    setShowCreateModal(false);
  };

  const toggleAddressSelection = (id: string) => {
    setSelectedAddressIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      
      {/* HEADER BAR (DARK) */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-3 shrink-0 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-red-600/30">
              🧭
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-white leading-tight">
                Sabit & Kayıtlı Rotalarım
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {savedRoutes.length} Kayıtlı Rota (Yandex Navigasyon Uyumlu)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* KML UPLOAD BUTTON */}
            <input
              type="file"
              ref={kmlInputRef}
              onChange={handleKmlFileUpload}
              accept=".kml,.kmz,application/vnd.google-earth.kml+xml"
              className="hidden"
            />
            <button
              onClick={() => kmlInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="KML dosyasından yeni rota yükle"
            >
              <UploadCloud className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">KML Yükle</span>
            </button>

            {/* NEW ROUTE BUTTON */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-red-600/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Yeni Rota</span>
            </button>
          </div>
        </div>

        {kmlImportStatus && (
          <div className="p-2.5 bg-red-950/80 border border-red-800/80 text-red-300 text-xs rounded-xl font-medium animate-pulse">
            {kmlImportStatus}
          </div>
        )}

        {/* SEARCH BAR (DARK) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Rota adı veya firma ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:bg-slate-950 transition-all"
          />
        </div>
      </div>

      {/* ROUTES LIST (DARK) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">Henüz Rota Bulunamadı</p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                Yukarıdaki "Yeni Rota" veya "KML Yükle" butonuyla ilk sabit rotanızı oluşturabilirsiniz.
              </p>
            </div>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const isEditing = editingRouteId === route.id;
            const validStops = route.stops.filter(s => s.lat !== 0 && s.lng !== 0);

            return (
              <div
                key={route.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg transition-all space-y-3.5"
              >
                {/* TOP TITLE ROW */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="h-8 w-8 rounded-xl bg-red-950 text-red-400 border border-red-800/60 flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5">
                      {route.stops.length}
                    </span>
                    <div>
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="text-xs font-bold px-2 py-1 bg-slate-950 border border-red-500 rounded-lg w-full text-white focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Açıklama"
                            className="text-[10px] px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-lg w-full text-slate-300 focus:outline-none"
                          />
                          <div className="flex gap-1.5 pt-1">
                            <button
                              onClick={() => handleSaveEdit(route.id)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => setEditingRouteId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px]"
                            >
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-extrabold text-white text-sm leading-snug">
                            {route.title}
                          </h3>
                          {route.description && (
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                              {route.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(route)}
                        title="Rotayı Düzenle"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(route.id, route.title)}
                        disabled={isDeletingId === route.id}
                        title="Rotayı Sil"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* STOPS PREVIEW (DARK) */}
                <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                    Örnek Duraklar:
                  </div>
                  {route.stops.slice(0, 3).map((stop, i) => (
                    <div key={stop.id} className="truncate flex items-center gap-1.5">
                      <span className="font-extrabold text-amber-400 text-[10px]">#{i + 1}</span>
                      <span className="truncate text-slate-300">{stop.label}</span>
                    </div>
                  ))}
                  {route.stops.length > 3 && (
                    <div className="text-[10px] text-slate-500 font-medium">
                      ... ve {route.stops.length - 3} firma daha
                    </div>
                  )}
                </div>

                {/* PRIMARY ACTIONS: 1-TAP START LIVE ROUTE & YANDEX MULTI-STOP */}
                <div className="flex items-center gap-2 pt-1">
                  {/* MAIN LIVE FIELD ROUTE BUTTON */}
                  <button
                    onClick={() => onStartLiveRoute(route)}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold rounded-xl shadow-lg shadow-red-950 text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    <span>Rotayı Başlat (Canlı Saha Modu) ➔</span>
                  </button>

                  {/* YANDEX MULTI-STOP BUTTON */}
                  <button
                    onClick={() => startYandexMultiRoute(validStops)}
                    title="Tüm Durakları Tek Rota Halinde Yandex Haritalar'da Aç"
                    className="p-3 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 rounded-xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5"
                  >
                    <Navigation className="h-4 w-4 text-amber-400" />
                    <span className="hidden sm:inline">Yandex Çoklu Aç</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* CREATE NEW ROUTE MODAL (DARK) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="font-extrabold text-white text-sm">Yeni Sabit Rota Oluştur</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRouteSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-300">Rota Başlığı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Pazartesi Çarşı Rotası"
                  value={newRouteTitle}
                  onChange={(e) => setNewRouteTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Açıklama (İsteğe bağlı)</label>
                <input
                  type="text"
                  placeholder="Örn: Çarşı ve Hanlar bölgesi haftalık tahsilat"
                  value={newRouteDesc}
                  onChange={(e) => setNewRouteDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Durakları Seç ({selectedAddressIds.length} Seçili)
                  </label>
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAddressIds.length === savedAddresses.length) {
                          setSelectedAddressIds([]);
                        } else {
                          setSelectedAddressIds(savedAddresses.map(a => a.id));
                        }
                      }}
                      className="text-[11px] text-amber-400 font-bold hover:underline cursor-pointer"
                    >
                      {selectedAddressIds.length === savedAddresses.length ? 'Tümünü Bırak' : 'Tümünü Seç'}
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Firma ara..."
                  value={addressSearchInModal}
                  onChange={(e) => setAddressSearchInModal(e.target.value)}
                  className="w-full mb-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />

                <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-950/60">
                  {savedAddresses
                    .filter(a =>
                      a.label.toLowerCase().includes(addressSearchInModal.toLowerCase()) ||
                      a.address.toLowerCase().includes(addressSearchInModal.toLowerCase())
                    )
                    .map((addr) => {
                      const isSelected = selectedAddressIds.includes(addr.id);
                      return (
                        <div
                          key={addr.id}
                          onClick={() => toggleAddressSelection(addr.id)}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-red-950/70 font-bold text-red-300' : 'hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="truncate text-xs text-white">{addr.label}</p>
                            <p className="text-[10px] text-slate-500 font-normal truncate">{addr.address}</p>
                          </div>
                          <span
                            className={`h-4 w-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                              isSelected
                                ? 'bg-red-600 text-white border-red-600'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isSelected && '✓'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={selectedAddressIds.length === 0}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-md shadow-red-600/30"
                >
                  Rotayı Kaydet ({selectedAddressIds.length} Durak)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
