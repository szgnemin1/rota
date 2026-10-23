import React, { useState } from 'react';
import { X, Download, ExternalLink, CheckCircle2, Bookmark, Navigation, HelpCircle, FileText, Layers } from 'lucide-react';
import { ExportLocationItem, generateKML, generateGPX, generateCSV, generateGeoJSON, triggerFileDownload } from '../utils/yandexExport';

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
  const [format, setFormat] = useState<'kml' | 'gpx' | 'csv' | 'geojson'>('kml');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  const handleDownload = () => {
    if (itemsToExport.length === 0) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const prefix = sourceMode === 'route' ? 'Yandex-Rota-Duraklari' : 'Yandex-Kayitli-Firmalar';
    const baseName = `${prefix}-${dateStr}`;

    let content = '';
    let fileName = '';
    let mimeType = '';

    if (format === 'kml') {
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
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Bookmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">Yandex Haritalarım'a Konumları Aktar</h2>
              <p className="text-xs text-red-100 mt-0.5">Firmalarınızı ve duraklarınızı Yandex'e kaydedilenler olarak aktarın</p>
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
          {/* Source Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              1. Hangi Konumlar Aktarılacak?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('saved')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  sourceMode === 'saved'
                    ? 'bg-red-50 border-red-500 text-red-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bookmark className="h-4 w-4 shrink-0 text-red-600" />
                <span>Kayıtlı Firmalar ({savedAddresses.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceMode('route')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  sourceMode === 'route'
                    ? 'bg-red-50 border-red-500 text-red-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Navigation className="h-4 w-4 shrink-0 text-red-600" />
                <span>Aktif Rota Durakları ({validRouteStops.length})</span>
              </button>
            </div>

            {sourceMode === 'saved' && categories.length > 1 && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Grup Filtresi:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="all">Tüm Gruplar ({savedAddresses.length})</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({savedAddresses.filter(a => (a.category || 'Genel') === cat).length})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              2. Dosya Formatı Seçin
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormat('kml')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'kml'
                    ? 'bg-red-50 border-red-500 text-red-900 shadow-xs ring-1 ring-red-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs">.KML</span>
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">Önerilen</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Yandex Harita Oluşturucu için en uyumlu format</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('gpx')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'gpx'
                    ? 'bg-red-50 border-red-500 text-red-900 shadow-xs ring-1 ring-red-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-extrabold text-xs">.GPX</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">GPS ve navigasyon standart formatı</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'csv'
                    ? 'bg-red-50 border-red-500 text-red-900 shadow-xs ring-1 ring-red-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-extrabold text-xs">.CSV</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Excel ve tablo koordinat listesi</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('geojson')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'geojson'
                    ? 'bg-red-50 border-red-500 text-red-900 shadow-xs ring-1 ring-red-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-extrabold text-xs">.GeoJSON</span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Modern harita ve GIS verisi</p>
              </button>
            </div>
          </div>

          {/* Download & Open Yandex Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              id="yandex-download-export-file-btn"
              type="button"
              disabled={itemsToExport.length === 0}
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-white" />
                  <span>{itemsToExport.length} Konum İndirildi!</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 text-white" />
                  <span>{itemsToExport.length} Konumu İndir (.{format.toUpperCase()})</span>
                </>
              )}
            </button>

            <a
              id="open-yandex-map-constructor-btn"
              href="https://yandex.com.tr/map-constructor/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer text-center shadow-xs"
            >
              <ExternalLink className="h-4 w-4 text-red-400" />
              <span>Yandex Harita Oluşturucu'yu Aç (Yandex Map Constructor) ↗</span>
            </a>
          </div>

          {/* Visual Step-by-Step Guide */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <HelpCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>Yandex Haritalarım'a Nasıl Yüklenir? (3 Basit Adım)</span>
            </div>

            <ol className="text-xs text-slate-600 space-y-2 pl-4 list-decimal marker:font-bold marker:text-red-600 leading-relaxed">
              <li>
                <strong className="text-slate-800">Dosyayı İndirin:</strong> Yukarıdaki kırmızı butona basarak <strong className="text-red-600">.KML</strong> dosyasını cihazınıza indirin.
              </li>
              <li>
                <strong className="text-slate-800">Yandex Harita Oluşturucu'ya Girin:</strong> Siyah butona tıklayarak Yandex Harita Oluşturucu'yu açın ve Yandex hesabınızla giriş yapın.
              </li>
              <li>
                <strong className="text-slate-800">İçe Aktarın (İmport):</strong> Sayfanın üstündeki <strong className="text-slate-900">"İçe Aktar"</strong> (veya sol paneldeki içe aktarma simgesi) butonuna basıp indirdiğiniz <strong className="text-red-600">.kml</strong> dosyasını seçin.
              </li>
            </ol>

            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sonuç:</strong> Tüm firma konumlarınız adları, adresleri ve telefonlarıyla Yandex haritanıza kaydedilir. Telefonunuzda <strong>Yandex Haritalar</strong> uygulamasını açtığınızda <strong>"Kayıtlı Haritalarım"</strong> altında tüm pinler görünür ve tek tıkla navigasyon başlatabilirsiniz!
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
