import React, { useState } from 'react';
import { SavedRoute, RouteStop } from '../types';
import {
  FolderKanban, MapPin, Navigation, Trash2, Calendar, Share2,
  Clock, CheckSquare, Search, Plus, ExternalLink, QrCode,
  FileText, Edit2, Check, X, ArrowRight, Sparkles, RefreshCw
} from 'lucide-react';

interface SavedRoutesViewProps {
  savedRoutes: SavedRoute[];
  onLoadRoute: (route: SavedRoute, targetTab?: 'route' | 'field') => void;
  onDeleteRoute: (id: string) => Promise<void>;
  onUpdateRoute?: (id: string, updates: Partial<SavedRoute>) => Promise<void>;
  onNavigateToTab?: (tab: 'route' | 'field' | 'map') => void;
  onOpenShareModal?: (stops: RouteStop[], title: string) => void;
}

export default function SavedRoutesView({
  savedRoutes,
  onLoadRoute,
  onDeleteRoute,
  onUpdateRoute,
  onNavigateToTab,
  onOpenShareModal
}: SavedRoutesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Categories
  const categories = Array.from(new Set(savedRoutes.map(r => r.category || 'Genel'))).filter(Boolean);

  // Filter routes
  const filteredRoutes = savedRoutes.filter(route => {
    const matchesSearch =
      route.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (route.description && route.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      route.stops.some(s => s.label?.toLowerCase().includes(searchQuery.toLowerCase()) || s.address?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || (route.category || 'Genel') === selectedCategory;

    return matchesSearch && matchesCategory;
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

  // Generate full Yandex Maps link for this saved route
  const getYandexUrlForRoute = (stops: RouteStop[]) => {
    const valid = stops.filter(s => s.lat !== 0 && s.lng !== 0);
    if (valid.length === 0) return '';
    const points = valid.map(s => `${s.lat},${s.lng}`).join('~');
    return `https://yandex.com.tr/maps/?rtext=${points}&rtt=auto`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden select-none">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              📁
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                Kayıtlı Rotalarım
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">
                {savedRoutes.length} Kayıtlı Rota Şablonu
              </p>
            </div>
          </div>

          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('route')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Yeni Rota Planla</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rota adı, firma adı veya açıklama ile ara..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tümü ({savedRoutes.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Routes List Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center min-h-[350px]">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-3 shadow-xs border border-indigo-100">
              <FolderKanban className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 mb-1">
              {searchQuery ? "Aramanıza Uygun Rota Bulunamadı" : "Henüz Kayıtlı Rota Yok"}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4 leading-relaxed">
              {searchQuery
                ? "Farklı bir arama terimi deneyin veya filtreleri temizleyin."
                : "Planladığınız rotaları tek tıkla kaydetmek için Rota Planlayıcı'daki 'Rotayı Kaydet' butonunu kullanabilirsiniz."}
            </p>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('route')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Hemen Rota Oluştur</span>
              </button>
            )}
          </div>
        ) : (
          filteredRoutes.map((route, idx) => {
            const validStops = route.stops.filter(s => s.lat !== 0 && s.lng !== 0);
            const isEditing = editingRouteId === route.id;
            const yandexUrl = getYandexUrlForRoute(route.stops);
            const dateStr = route.createdAt
              ? new Date(route.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '';

            return (
              <div
                key={route.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden space-y-2.5 p-3.5"
              >
                {/* Header: Title & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs font-bold border border-indigo-400 rounded-lg focus:outline-hidden"
                          placeholder="Rota Başlığı"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full px-2.5 py-1 text-[11px] border border-slate-300 rounded-lg focus:outline-hidden"
                          placeholder="Açıklama (isteğe bağlı)"
                        />
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(route.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            <span>Kaydet</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRouteId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md cursor-pointer"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                            {route.title}
                          </h3>
                          {route.category && route.category !== 'Genel' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {route.category}
                            </span>
                          )}
                        </div>
                        {route.description && (
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            {route.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-semibold mt-1">
                          {dateStr && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              {dateStr}
                            </span>
                          )}
                          <span>•</span>
                          <span className="font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                            {validStops.length} Durak
                          </span>
                          {route.distance && (
                            <>
                              <span>•</span>
                              <span>{route.distance}</span>
                            </>
                          )}
                          {route.duration && (
                            <>
                              <span>•</span>
                              <span>{route.duration}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions Top Right */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(route)}
                        title="Rotayı Düzenle"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingId === route.id}
                        onClick={() => handleDelete(route.id, route.title)}
                        title="Rotayı Sil"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {isDeletingId === route.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Stops Preview Bar */}
                <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[10px]">
                    {validStops.map((stop, sIdx) => {
                      const isFirst = sIdx === 0;
                      const isLast = sIdx === validStops.length - 1;
                      return (
                        <div key={stop.id || sIdx} className="flex items-center shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold truncate max-w-[130px] border shadow-2xs ${
                              isFirst
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isLast
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                            title={`${stop.label || 'Durak'} - ${stop.address || ''}`}
                          >
                            {isFirst ? '🟢 ' : isLast ? '🏁 ' : `${sIdx}. `}
                            {stop.label || 'Durak'}
                          </span>
                          {!isLast && (
                            <span className="text-slate-300 mx-1">→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onLoadRoute(route, 'route')}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <Navigation className="h-3 w-3" />
                    <span>Planlayıcıda Aç</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLoadRoute(route, 'field')}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <CheckSquare className="h-3 w-3" />
                    <span>Saha Takipte Aç</span>
                  </button>

                  {onOpenShareModal ? (
                    <button
                      type="button"
                      onClick={() => onOpenShareModal(route.stops, route.title)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <QrCode className="h-3 w-3 text-emerald-300" />
                      <span>Telefona Gönder</span>
                    </button>
                  ) : yandexUrl ? (
                    <a
                      href={yandexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 text-center"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Yandex Harita</span>
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
