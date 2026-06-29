import React, { useState, useEffect } from 'react';
import { SavedAddress, RouteStop } from '../types';
import PlaceSearchBox from './PlaceSearchBox';
import { 
  Settings as SettingsIcon, 
  MapPin, 
  CheckCircle, 
  Star, 
  Trash2, 
  FolderKanban, 
  Compass, 
  Info, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles,
  HelpCircle,
  Tag
} from 'lucide-react';

interface SettingsProps {
  savedAddresses: SavedAddress[];
  defaultOrigin: RouteStop | null;
  onSetDefaultOrigin: (stop: RouteStop | null) => void;
  onAddAddress?: (address: SavedAddress) => void;
}

export default function Settings({
  savedAddresses,
  defaultOrigin,
  onSetDefaultOrigin,
  onAddAddress
}: SettingsProps) {
  // Auto-grouping state loaded from localStorage
  const [autoGroupMode, setAutoGroupMode] = useState<'off' | 'fixed' | 'smart'>(() => {
    return (localStorage.getItem('auto_group_mode') as 'off' | 'fixed' | 'smart') || 'off';
  });

  const [autoGroupFixedName, setAutoGroupFixedName] = useState(() => {
    return localStorage.getItem('auto_group_fixed_name') || 'Genel';
  });

  const [autoGroupFallbackName, setAutoGroupFallbackName] = useState(() => {
    return localStorage.getItem('auto_group_fallback_name') || 'Genel';
  });

  const [successMsg, setSuccessMsg] = useState('');

  // Extract existing categories to show in dropdown
  const existingCategories = Array.from(new Set(savedAddresses.map(a => a.category || 'Genel')));

  // Save auto-grouping configuration
  const handleSaveAutoGroupConfig = (mode: 'off' | 'fixed' | 'smart', fixedName: string, fallbackName: string) => {
    localStorage.setItem('auto_group_mode', mode);
    localStorage.setItem('auto_group_fixed_name', fixedName);
    localStorage.setItem('auto_group_fallback_name', fallbackName);
    
    // Trigger custom event to notify App component if needed
    window.dispatchEvent(new Event('storage'));
    
    showSuccess('Grup ayarları başarıyla kaydedildi!');
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSelectSavedAsDefault = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      onSetDefaultOrigin(null);
      showSuccess('Sabit başlangıç konumu kaldırıldı.');
      return;
    }

    const addr = savedAddresses.find(a => a.id === selectedId);
    if (addr) {
      onSetDefaultOrigin({
        id: 'origin',
        label: addr.label,
        address: addr.address,
        lat: addr.lat,
        lng: addr.lng,
        isSaved: true
      });
      showSuccess(`Başlangıç konumu "${addr.label}" olarak ayarlandı.`);
    }
  };

  const handleSearchDefaultSelected = (place: { label: string; address: string; lat: number; lng: number }) => {
    onSetDefaultOrigin({
      id: 'origin',
      label: place.label || 'Sabit Başlangıç',
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      isSaved: false
    });
    showSuccess('Aranan konum sabit başlangıç yapıldı.');
  };

  return (
    <div id="settings-panel-container" className="flex flex-col h-full bg-slate-50/50 overflow-y-auto">
      {/* Panel header banner */}
      <div className="p-5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Sistem Ayarları</h2>
            <p className="text-xs text-slate-400">Sabit başlangıç konumu ve otomatik gruplandırma tercihleri</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1 max-w-xl mx-auto w-full">
        {/* Success Alert */}
        {successMsg && (
          <div id="settings-success-alert" className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl animate-fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* SECTION 1: PERMANENT STARTING LOCATION (SABİT BAŞLANGIÇ KONUMU) */}
        <section id="settings-section-default-origin" className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                Sabit Başlangıç Konumu
              </h3>
              <p className="text-xs text-slate-400">Rota temizlendiğinde veya açılışta rota başlangıcının otomatik olarak ayarlanacağı kalıcı konum.</p>
            </div>
          </div>

          {/* Current Start Location Indicator Card */}
          {defaultOrigin ? (
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Kayıtlı Sabit Konum</span>
                <button
                  type="button"
                  onClick={() => {
                    onSetDefaultOrigin(null);
                    showSuccess('Sabit başlangıç konumu kaldırıldı.');
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                  title="Sabit başlangıç konumunu kaldır"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  {defaultOrigin.label}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{defaultOrigin.address}</p>
                <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-slate-400">
                  <span>Enl: {defaultOrigin.lat.toFixed(5)}</span>
                  <span>Boy: {defaultOrigin.lng.toFixed(5)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl border-dashed text-center">
              <Compass className="h-8 w-8 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-500">Sabit başlangıç konumu atanmamış</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Rota temizlendiğinde cihazınızın anlık GPS konumu kullanılır.</p>
            </div>
          )}

          {/* Set from saved addresses */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Adres Defterinden Seç</label>
            <select
              value={defaultOrigin ? savedAddresses.find(a => a.lat === defaultOrigin.lat && a.lng === defaultOrigin.lng)?.id || '' : ''}
              onChange={handleSelectSavedAsDefault}
              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">-- Sabit Konum Yok (GPS Kullan) --</option>
              {savedAddresses.map(addr => (
                <option key={addr.id} value={addr.id}>
                  {addr.label} ({addr.category || 'Genel'})
                </option>
              ))}
            </select>
          </div>

          {/* Search to set default */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">Haritada Arayarak Yeni Konum Belirle</label>
            <PlaceSearchBox
              id="settings-default-origin-search"
              placeholder="Sabit başlangıç için adres veya koordinat arayın..."
              onPlaceSelected={handleSearchDefaultSelected}
              className="border-slate-200"
            />
          </div>
        </section>

        {/* SECTION 2: AUTO-GROUPING ON ADDRESS CREATION (GRUPLARA OTOMATİK EKLENSİN) */}
        <section id="settings-section-auto-group" className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4 text-indigo-600 shrink-0" />
              Gruplara Otomatik Eklensin
            </h3>
            <p className="text-xs text-slate-400">Yeni aranan, haritadan tıklanan veya kaydedilen adreslerin otomatik olarak bir gruba/kategoriye atanması seçeneği.</p>
          </div>

          {/* Options Segment buttons */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
            <button
              type="button"
              onClick={() => {
                setAutoGroupMode('off');
                handleSaveAutoGroupConfig('off', autoGroupFixedName, autoGroupFallbackName);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                autoGroupMode === 'off'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              Kapalı
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoGroupMode('fixed');
                handleSaveAutoGroupConfig('fixed', autoGroupFixedName, autoGroupFallbackName);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                autoGroupMode === 'fixed'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              Sabit Grup
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoGroupMode('smart');
                handleSaveAutoGroupConfig('smart', autoGroupFixedName, autoGroupFallbackName);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                autoGroupMode === 'smart'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Akıllı Grup
            </button>
          </div>

          {/* Conditional Sub-settings for mode */}
          {autoGroupMode === 'off' && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-2 text-xs text-slate-500 leading-relaxed">
              <Info className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
              <span>Otomatik gruplandırma devre dışı. Yeni kaydedilen adresler varsayılan olarak "Genel" grubuna atanır ya da ekleme ekranında manuel kategori seçersiniz.</span>
            </div>
          )}

          {autoGroupMode === 'fixed' && (
            <div className="space-y-4 p-4 border border-indigo-100 bg-indigo-50/20 rounded-2xl animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-indigo-600" />
                  Yeni Kayıtlar İçin Sabit Grup Seçin
                </label>
                <select
                  value={autoGroupFixedName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAutoGroupFixedName(val);
                    handleSaveAutoGroupConfig('fixed', val, autoGroupFallbackName);
                  }}
                  className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {existingCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="Müşteriler">Müşteriler</option>
                  <option value="Depolar">Depolar</option>
                  <option value="Ev/İş">Ev/İş</option>
                </select>
                <p className="text-[10px] text-slate-400 leading-relaxed">Yeni aranan veya eklenen her adres doğrudan bu seçilen sabit gruba otomatik olarak kaydedilecektir.</p>
              </div>
            </div>
          )}

          {autoGroupMode === 'smart' && (
            <div className="space-y-4 p-4 border border-violet-100 bg-violet-50/20 rounded-2xl animate-fade-in">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-violet-800 bg-violet-100 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 w-max">
                  <Sparkles className="h-3 w-3" /> Akıllı Yapay Zeka Kuralları
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">Yeni bir yer arandığında veya haritadan adresi kaydedildiğinde, isim ve adres metni akıllıca taranarak ilgili gruba atanır:</p>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 text-slate-500 font-medium">
                  <div className="p-2 bg-white rounded-lg border border-slate-100">🏠 "ev", "daire", "site" → <b className="text-indigo-600">Ev</b></div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">🏢 "iş", "ofis", "depo" → <b className="text-indigo-600">İş</b></div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">🍔 "kafe", "restoran" → <b className="text-indigo-600">Gıda</b></div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">🏥 "eczane", "hastane" → <b className="text-indigo-600">Sağlık</b></div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">🎓 "okul", "kampüs" → <b className="text-indigo-600">Eğitim</b></div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">📦 "kargo", "teslim" → <b className="text-indigo-600">Teslimat</b></div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-violet-100 mt-2">
                  <label className="text-xs font-bold text-violet-950">Eşleşme Olmazsa Hangi Gruba Eklensin?</label>
                  <select
                    value={autoGroupFallbackName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAutoGroupFallbackName(val);
                      handleSaveAutoGroupConfig('smart', autoGroupFixedName, val);
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {existingCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Genel">Genel</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
