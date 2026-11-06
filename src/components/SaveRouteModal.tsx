import React, { useState } from 'react';
import { RouteStop, SavedRoute } from '../types';
import { Bookmark, MapPin, X, Check, Save, Sparkles, Navigation } from 'lucide-react';

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeStops: RouteStop[];
  onSaveRoute: (routeData: {
    title: string;
    description: string;
    category: string;
    color: string;
    stops: RouteStop[];
  }) => Promise<void>;
  existingCategories?: string[];
}

export default function SaveRouteModal({
  isOpen,
  onClose,
  routeStops,
  onSaveRoute,
  existingCategories = []
}: SaveRouteModalProps) {
  const validStops = routeStops.filter(s => s.lat !== 0 && s.lng !== 0);

  const defaultTitle = `Rota - ${new Date().toLocaleDateString('tr-TR')} (${validStops.length} Durak)`;

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Genel');
  const [customCategory, setCustomCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2563eb');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const colorOptions = [
    { name: 'Mavi', hex: '#2563eb' },
    { name: 'Yeşil', hex: '#059669' },
    { name: 'Kırmızı', hex: '#dc2626' },
    { name: 'Mor', hex: '#7c3aed' },
    { name: 'Turuncu', hex: '#ea580c' },
    { name: 'Lacivert', hex: '#1e293b' },
  ];

  const categories = Array.from(new Set(['Genel', 'Pazartesi', 'Haftalık', 'Nilüfer', 'Osmangazi', 'Sanayi', ...existingCategories]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || validStops.length === 0) return;

    setIsSaving(true);
    try {
      const finalCategory = customCategory.trim() ? customCategory.trim() : category;
      await onSaveRoute({
        title: title.trim(),
        description: description.trim(),
        category: finalCategory,
        color: selectedColor,
        stops: validStops
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-base shadow-sm">
              💾
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Bu Rotayı Kaydet
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Daha sonra tek tıkla yüklemek veya sahaya göndermek için kaydedin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>Rota Adı *</span>
              <span className="text-[10px] text-slate-400 font-normal">Zorunlu</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Pazartesi Nilüfer Sanayi Rotası"
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Açıklama / Not (İsteğe Bağlı)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: Saat 10:00'dan önce gidilecek, teslimatlar yapılacak..."
              className="w-full px-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs resize-none"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Grup / Kategori</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setCustomCategory('');
                  }}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer border ${
                    category === cat && !customCategory
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Veya yeni grup adı yazın..."
              className="w-full mt-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Color tag */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Etiket Rengi</label>
            <div className="flex items-center gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  className={`h-6 w-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                    selectedColor === c.hex ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {selectedColor === c.hex && <Check className="h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Stops Summary Preview */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>Kaydedilecek Duraklar ({validStops.length})</span>
            </label>
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 max-h-36 overflow-y-auto space-y-1.5">
              {validStops.map((stop, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === validStops.length - 1;
                return (
                  <div key={stop.id || idx} className="flex items-center gap-2 text-[11px]">
                    <span className="shrink-0 text-xs">
                      {isFirst ? '🟢' : isLast ? '🏁' : `${idx}.`}
                    </span>
                    <span className="font-extrabold text-slate-900 truncate flex-1">
                      {stop.label || 'Durak'}
                    </span>
                    {stop.address && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {stop.address}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-center"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSaving || validStops.length === 0}
              className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Kaydediliyor..." : "Rotayı Kaydet"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
