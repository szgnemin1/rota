import React, { useState, useRef } from 'react';
import { SavedAddress, RouteStop } from '../types';
import { startGoogleMapsNavigation, callPhoneNumber, openWhatsAppChat } from '../utils/navigation';
import { parseKMLText } from '../utils/kmlParser';
import {
  Bookmark, MapPin, Plus, Navigation, UploadCloud, Edit2, Trash2,
  Search, Phone, MessageSquare, Crosshair, X, Loader2
} from 'lucide-react';

interface SavedAddressesProps {
  savedAddresses: SavedAddress[];
  onAddAddress: (address: SavedAddress) => void;
  onAddAddressesBulk: (addresses: SavedAddress[]) => void;
  onUpdateAddress: (id: string, address: Omit<SavedAddress, 'id'>) => Promise<void>;
  onDeleteAddress: (id: string) => void;
  onSelectOnMap?: (address: SavedAddress) => void;
  prefilledAddress?: { address: string; lat: number; lng: number } | null;
  onClearPrefilledAddress?: () => void;
  routeStops?: RouteStop[];
  setRouteStops?: (stops: RouteStop[]) => void;
  setActiveTab?: (tab: any) => void;
  setMobileTab?: (tab: any) => void;
  showGroupCreationModal?: boolean;
  setShowGroupCreationModal?: (show: boolean) => void;
  defaultOrigin?: RouteStop | null;
  onSetDefaultOrigin?: (stop: RouteStop | null) => void;
  onUpdateAddressesBulkVisited?: (ids: string[] | null, visited: boolean) => Promise<void>;
}

export default function SavedAddresses({
  savedAddresses,
  onAddAddress,
  onAddAddressesBulk,
  onUpdateAddress,
  onDeleteAddress
}: SavedAddressesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // GPS Locating State
  const [isLocating, setIsLocating] = useState(false);

  // Add / Edit Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Form States
  const [formLabel, setFormLabel] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState<number>(0);
  const [formLng, setFormLng] = useState<number>(0);
  const [formPhone, setFormPhone] = useState('');
  const [formCategory, setFormCategory] = useState('Genel');
  const [formNote, setFormNote] = useState('');

  // KML Upload Ref
  const kmlInputRef = useRef<HTMLInputElement>(null);
  const [kmlNotice, setKmlNotice] = useState<string | null>(null);

  // Categories
  const categories = Array.from(new Set(savedAddresses.map(a => a.category || 'Genel'))).filter(Boolean);

  const filteredAddresses = savedAddresses.filter(addr => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      addr.label.toLowerCase().includes(q) ||
      addr.address.toLowerCase().includes(q) ||
      (addr.note && addr.note.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategory === 'all' || (addr.category || 'Genel') === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // GPS Current Location Grabber
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Cihazınızda GPS / Konum servisi desteklenmiyor.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=tr`
          );
          if (res.ok) {
            const data = await res.json();
            const display = data.display_name || `Mevcut Konum (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
            setFormLabel('Mevcut Konumum');
            setFormAddress(display);
            setFormLat(latitude);
            setFormLng(longitude);
            setFormCategory('Saha Konumları');
            setFormPhone('');
            setFormNote('');
            setShowAddModal(true);
          } else {
            throw new Error('Adres çözümlenemedi');
          }
        } catch (err) {
          setFormLabel('Mevcut Konumum');
          setFormAddress(`GPS (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
          setFormLat(latitude);
          setFormLng(longitude);
          setFormCategory('Saha Konumları');
          setFormPhone('');
          setFormNote('');
          setShowAddModal(true);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        alert('Konum alınamadı: ' + err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleOpenAddModal = () => {
    setFormLabel('');
    setFormAddress('');
    setFormLat(0);
    setFormLng(0);
    setFormPhone('');
    setFormCategory('Genel');
    setFormNote('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setFormLabel(addr.label);
    setFormAddress(addr.address);
    setFormLat(addr.lat);
    setFormLng(addr.lng);
    setFormPhone(addr.phone || '');
    setFormCategory(addr.category || 'Genel');
    setFormNote(addr.note || '');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      alert('Lütfen firma veya konum adı girin.');
      return;
    }

    if (editingAddress) {
      await onUpdateAddress(editingAddress.id, {
        label: formLabel.trim(),
        address: formAddress.trim(),
        lat: formLat,
        lng: formLng,
        phone: formPhone.trim(),
        category: formCategory.trim() || 'Genel',
        note: formNote.trim(),
        visited: editingAddress.visited
      });
      setEditingAddress(null);
    } else {
      const newAddr: SavedAddress = {
        id: `addr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        label: formLabel.trim(),
        address: formAddress.trim() || `${formLabel.trim()}, Bursa`,
        lat: formLat,
        lng: formLng,
        phone: formPhone.trim(),
        category: formCategory.trim() || 'Genel',
        note: formNote.trim(),
        visited: false
      };
      onAddAddress(newAddr);
      setShowAddModal(false);
    }
  };

  const handleDelete = (addr: SavedAddress) => {
    if (window.confirm(`"${addr.label}" adresini silmek istediğinizden emin misiniz?`)) {
      onDeleteAddress(addr.id);
    }
  };

  const handleKmlImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setKmlNotice('KML işleniyor...');
      const text = await file.text();
      const parsed = parseKMLText(text);

      if (parsed.addresses.length === 0) {
        alert('Seçilen KML dosyasında konum bulunamadı.');
        setKmlNotice(null);
        return;
      }

      onAddAddressesBulk(parsed.addresses);
      setKmlNotice(`✓ ${parsed.addresses.length} firma/adres başarıyla eklendi!`);
      setTimeout(() => setKmlNotice(null), 3500);
    } catch (err: any) {
      alert('KML okuma hatası: ' + err.message);
      setKmlNotice(null);
    } finally {
      if (kmlInputRef.current) kmlInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* HEADER BAR (DARK) */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-3 shrink-0 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/30">
              <Bookmark className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-white leading-tight">
                Firma & Adres Defteri
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {savedAddresses.length} Kayıtlı Konum
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* GPS LOCATION BUTTON */}
            <button
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              title="Mevcut konumumu GPS'ten al ve yeni adres olarak kaydet"
              className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  <span className="hidden sm:inline">Alınıyor...</span>
                </>
              ) : (
                <>
                  <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Konumumu Al</span>
                </>
              )}
            </button>

            {/* KML UPLOAD */}
            <input
              type="file"
              ref={kmlInputRef}
              onChange={handleKmlImport}
              accept=".kml,.kmz"
              className="hidden"
            />
            <button
              onClick={() => kmlInputRef.current?.click()}
              title="KML dosyasından toplu firma içe aktar"
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <UploadCloud className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">KML Yükle</span>
            </button>

            {/* NEW ADDRESS BUTTON */}
            <button
              onClick={handleOpenAddModal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-indigo-600/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Yeni Adres</span>
            </button>
          </div>
        </div>

        {kmlNotice && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs rounded-xl font-medium animate-pulse">
            {kmlNotice}
          </div>
        )}

        {/* SEARCH & CATEGORY FILTER */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Firma adı, adres veya notlarda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-950 transition-all"
            />
          </div>

          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Tümü ({savedAddresses.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat} ({savedAddresses.filter(a => (a.category || 'Genel') === cat).length})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADDRESSES LIST (DARK) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredAddresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500">
            <MapPin className="h-10 w-10 text-slate-700 mb-2" />
            <p className="text-xs font-bold text-slate-400">Adres Bulunamadı</p>
            <p className="text-[11px] text-slate-600 mt-1">Arama kriterinize uygun adres bulunamadı.</p>
          </div>
        ) : (
          filteredAddresses.map((addr, index) => (
            <div
              key={addr.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg transition-all space-y-3"
            >
              {/* TOP ROW: NAME & ACTIONS */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="h-7 w-7 rounded-xl bg-slate-950 text-slate-400 border border-slate-800 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-white text-sm leading-snug">
                      {addr.label}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {addr.address}
                    </p>
                    {addr.note && (
                      <p className="text-[11px] text-indigo-300 bg-indigo-950/80 border border-indigo-800/50 px-2 py-0.5 rounded-md mt-1.5 inline-block font-semibold">
                        📝 {addr.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEditModal(addr)}
                    title="Adresi Düzenle"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr)}
                    title="Adresi Sil"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* ACTION ROW: GOOGLE MAPS + PHONE + WHATSAPP */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
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

            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT ADDRESS MODAL (DARK) */}
      {(showAddModal || editingAddress) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col text-slate-100">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="font-extrabold text-white text-sm">
                {editingAddress ? 'Adresi / Firmayı Düzenle' : 'Yeni Adres Ekle'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAddress(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 space-y-3.5 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="text-xs font-bold text-slate-300">Firma / Konum Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: ABC Ticaret Ltd. Şti."
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Açık Adres</label>
                <textarea
                  rows={2}
                  placeholder="Cadde, sokak, mahalle, ilçe..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300">Enlem (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    value={formLat || ''}
                    onChange={(e) => setFormLat(parseFloat(e.target.value) || 0)}
                    placeholder="40.18..."
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Boylam (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    value={formLng || ''}
                    onChange={(e) => setFormLng(parseFloat(e.target.value) || 0)}
                    placeholder="29.06..."
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300">Telefon</label>
                  <input
                    type="text"
                    placeholder="05xxxxxxxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Kategori</label>
                  <input
                    type="text"
                    placeholder="Genel / Müşteriler"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Firma Notu (Eksikler sekmesiyle senkronize)</label>
                <input
                  type="text"
                  placeholder="Örn: Pazartesi fatura teslim edilecek"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingAddress(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/30"
                >
                  {editingAddress ? 'Güncellemeyi Kaydet' : 'Adresi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
