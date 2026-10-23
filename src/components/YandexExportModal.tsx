import React, { useState } from 'react';
import { 
  X, Download, ExternalLink, CheckCircle2, Bookmark, Navigation, 
  HelpCircle, Smartphone, Share2, Copy, Check, FileSpreadsheet, MapPin, 
  ChevronRight, AlertCircle, Info, Star
} from 'lucide-react';
import { 
  ExportLocationItem, generateKML, generateGPX, generateCSV, 
  generateGeoJSON, generateVCF, triggerFileDownload 
} from '../utils/yandexExport';

interface YandexExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedAddresses?: ExportLocationItem[];
  routeStops?: ExportLocationItem[];
  initialMode?: 'saved' | 'route';
}

export default function YandexExportModal({
  isOpen,
  onClose,
  savedAddresses = [],
  routeStops = [],
  initialMode = 'saved'
}: YandexExportModalProps) {
  const [sourceMode, setSourceMode] = useState<'saved' | 'route'>(initialMode);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadSuccessType, setDownloadSuccessType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'phone' | 'route' | 'onebyone' | 'files'>('phone');

  if (!isOpen) return null;

  // Filter valid route stops
  const validRouteStops = routeStops.filter(s => s.lat !== 0 && s.lng !== 0 && !isNaN(s.lat) && !isNaN(s.lng));

  // Extract categories for saved addresses
  const categories = Array.from(new Set(savedAddresses.map(a => a.category || 'Genel').filter(Boolean)));

  // Filter items based on source and category
  let itemsToExport: ExportLocationItem[] = [];
  if (sourceMode === 'route') {
    itemsToExport = validRouteStops;
  } else {
    itemsToExport = selectedCategory === 'all' 
      ? savedAddresses 
      : savedAddresses.filter(a => (a.category || 'Genel') === selectedCategory);
  }

  // Generate full Yandex multi-stop route link
  const yandexRouteUrl = itemsToExport.length > 0
    ? `https://yandex.com.tr/maps/?rtext=${itemsToExport.map(s => `${s.lat},${s.lng}`).join('~')}&rtt=auto`
    : 'https://yandex.com.tr/maps/';

  const handleCopyYandexRoute = async () => {
    try {
      await navigator.clipboard.writeText(yandexRouteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (e) {
      // Fallback
    }
  };

  const handleDownloadFile = (format: 'vcf' | 'kml' | 'gpx' | 'csv' | 'geojson') => {
    if (itemsToExport.length === 0) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const prefix = sourceMode === 'route' ? 'Yandex-Rota-Duraklari' : 'Yandex-Kayitli-Firmalar';
    const baseName = `${prefix}-${dateStr}`;

    let content = '';
    let fileName = '';
    let mimeType = '';

    if (format === 'vcf') {
      content = generateVCF(itemsToExport);
      fileName = `${baseName}.vcf`;
      mimeType = 'text/vcard;charset=utf-8';
    } else if (format === 'kml') {
      content = generateKML(itemsToExport, `RotaPlan - ${sourceMode === 'route' ? 'Rota Durakları' : 'Kayıtlı Firmalar'}`);
      fileName = `${baseName}.kml`;
      mimeType = 'application/vnd.google-earth.kml+xml';
    } else if (format === 'gpx') {
      content = generateGPX(itemsToExport, `RotaPlan - ${sourceMode === 'route' ? 'Rota Durakları' : 'Kayıtlı Firmalar'}`);
      fileName = `${baseName}.gpx`;
      mimeType = 'application/gpx+xml';
    } else if (format === 'csv') {
      content = generateCSV(itemsToExport);
      fileName = `${baseName}.csv`;
      mimeType = 'text/csv;charset=utf-8';
    } else if (format === 'geojson') {
      content = generateGeoJSON(itemsToExport);
      fileName = `${baseName}.geojson`;
      mimeType = 'application/json';
    }

    triggerFileDownload(content, fileName, mimeType);
    setDownloadSuccessType(format.toUpperCase());
    setTimeout(() => setDownloadSuccessType(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-red-700 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Navigation className="h-5 w-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight">Yandex'e Konumları Aktarma Merkezi</h2>
              <p className="text-xs text-red-100 mt-0.5">Telefonda ve navigasyonda konumlarınıza kolayca erişin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700 text-sm">
          
          {/* Important Technical Note */}
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Yandex Kısıtlaması Hakkında Bilgi:</strong> Yandex Haritalar ve Yandex Navigasyon cep telefonu uygulamasında dışarıdan dosya (.kml/.gpx) yükleme butonu bulunmamaktadır. Bunun yerine aşağıda telefonunuzda <strong>%100 çalışan 3 pratik yöntem</strong> hazırlanmıştır:
            </div>
          </div>

          {/* Source Selection & Filter */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Aktarılacak Liste:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
                <button
                  type="button"
                  onClick={() => setSourceMode('saved')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    sourceMode === 'saved' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kayıtlı Firmalar ({savedAddresses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('route')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    sourceMode === 'route' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Aktif Rota Durakları ({validRouteStops.length})
                </button>
              </div>
            </div>

            {sourceMode === 'saved' && categories.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">Grup:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">Tümü ({savedAddresses.length})</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({savedAddresses.filter(a => (a.category || 'Genel') === cat).length})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tabs for Solutions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('phone')}
              className={`py-2 px-1 text-center rounded-lg font-black text-xs transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeTab === 'phone'
                  ? 'bg-white text-red-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              <span>1. Telefon Rehberine (.VCF)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('route')}
              className={`py-2 px-1 text-center rounded-lg font-black text-xs transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeTab === 'route'
                  ? 'bg-white text-red-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="h-3.5 w-3.5 shrink-0" />
              <span>2. Toplu Rota Olarak Aç</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('onebyone')}
              className={`py-2 px-1 text-center rounded-lg font-black text-xs transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeTab === 'onebyone'
                  ? 'bg-white text-red-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="h-3.5 w-3.5 shrink-0" />
              <span>3. Tek Tek ⭐ Kaydet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`py-2 px-1 text-center rounded-lg font-black text-xs transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-white text-red-600 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>4. Dosya İndir (KML/GPX)</span>
            </button>
          </div>

          {/* TAB 1: PHONE CONTACTS (.VCF) - THE BEST REALISTIC MOBILE SOLUTION */}
          {activeTab === 'phone' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Telefon Rehberi Kartı Olarak Aktar (.VCF) — En Pratik Yöntem!
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Bu dosya indirildiğinde Android veya iPhone telefonunuz <strong>"Kişileri Rehbere Ekle"</strong> der. Eklediğinizde tüm firmalarınız isimleri, adresleri, telefonları ve Yandex navigasyon bağlantılarıyla telefon rehberinize kaydedilir.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Yandex Navigasyon Nasıl Bulur?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-950">
                  Yandex Navigasyon arama çubuğuna firma adını yazdığınızda veya <strong>"Rehber"</strong> seçeneğine dokunduğunuzda, firma hemen çıkar ve tek tıkla navigasyon başlar!
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadFile('vcf')}
                disabled={itemsToExport.length === 0}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {downloadSuccessType === 'VCF' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{itemsToExport.length} Firma Rehber Dosyası (.VCF) İndirildi!</span>
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    <span>{itemsToExport.length} Firmayı Telefon Rehberine İndir (.VCF)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: MULTI-STOP ROUTE LINK */}
          {activeTab === 'route' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Tüm Durakları Yandex'te Aç & "Rotayı Kaydet" Yap
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Aşağıdaki butona tıkladığınızda Yandex Haritalar tüm durakları sırasıyla birleştirerek açar. Yandex ekranındaki <strong>"Rotayı Kaydet (⭐ Yer İmlerine Ekle)"</strong> butonuna basarak tüm listeyi Yandex profilinize tek seferde kaydedebilirsiniz.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={yandexRouteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-center"
                >
                  <Navigation className="h-5 w-5 fill-white text-white" />
                  <span>Yandex Haritalar'da Aç & Rotayı Kaydet ↗</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyYandexRoute}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700 font-extrabold">Yandex Rota Linki Kopyalandı! (WhatsApp'tan Gönderebilirsiniz)</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 text-red-500" />
                      <span>Yandex Rota Linkini Kopyala (WhatsApp / Mesaj İçin)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ONE BY ONE BOOKMARKING */}
          {activeTab === 'onebyone' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Star className="h-5 w-5 fill-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Firma Firma Yandex'te Açıp Yer İmlerine Ekleme
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    İstediğiniz firmanın yanındaki <strong>"Yandex'te Aç"</strong> butonuna basın. Yandex açıldığında ekranın altındaki <strong>"⭐ Kaydet"</strong> butonuna basmanız yeterlidir; o firma Yandex Yer İmlerinize kalıcı olarak eklenir.
                  </p>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/60">
                {itemsToExport.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate">{item.label}</p>
                      <p className="text-[11px] text-slate-400 truncate">{item.address}</p>
                    </div>
                    <a
                      href={`https://yandex.com.tr/maps/?rtext=~${item.lat},${item.lng}&rtt=auto`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Star className="h-3 w-3 fill-white" />
                      <span>Yandex'te Aç & ⭐ Kaydet</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: RAW FILE EXPORTS (KML, GPX, CSV) */}
          {activeTab === 'files' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Dosya Olarak İndir (Masaüstü & Harita Araçları İçin)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Eğer bilgisayarda harita yazılımları, GIS veya harici navigasyon cihazları kullanıyorsanız aşağıdaki formatlardan birini indirebilirsiniz:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile('kml')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50 text-left transition-all cursor-pointer group"
                >
                  <span className="font-black text-xs text-slate-900 group-hover:text-red-700 block">.KML Dosyası</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Google Earth / Harita Araçları</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFile('gpx')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50 text-left transition-all cursor-pointer group"
                >
                  <span className="font-black text-xs text-slate-900 group-hover:text-red-700 block">.GPX Dosyası</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">GPS Cihazları ve Navigasyon</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFile('csv')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50 text-left transition-all cursor-pointer group"
                >
                  <span className="font-black text-xs text-slate-900 group-hover:text-red-700 block">.CSV (Excel)</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Tablo ve koordinat listesi</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFile('geojson')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50 text-left transition-all cursor-pointer group"
                >
                  <span className="font-black text-xs text-slate-900 group-hover:text-red-700 block">.GeoJSON</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">GIS ve Web Harita Verisi</span>
                </button>
              </div>

              {downloadSuccessType && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{downloadSuccessType} dosyası başarıyla indirildi!</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
