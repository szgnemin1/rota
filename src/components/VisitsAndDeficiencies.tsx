import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SavedAddress, RouteStop } from '../types';
import { 
  ClipboardList, Search, AlertCircle, CheckCircle, Clock, Calendar, 
  Plus, Edit, Route, Check, Trash2, MapPin, Map, Info, Sparkles, Filter,
  FileText, Download, Copy, Printer
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
  const [showListReportModal, setShowListReportModal] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  
  // Quick inline editing states
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [tempPhone, setTempPhone] = useState('');
  const [tempContactPerson, setTempContactPerson] = useState('');
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

  const hasContactInfo = (addr: SavedAddress) => {
    return !!(addr.phone?.trim() || addr.contactPerson?.trim());
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
      (addr.phone || '').toLowerCase().includes(q) ||
      (addr.contactPerson || '').toLowerCase().includes(q) ||
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
    if (filterType === 'notes') return hasContactInfo(addr);

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

  // Detailed Modal edit state
  const [editPhone, setEditPhone] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');

  // Inline contact info submit
  const handleSaveInlineContact = async (addr: SavedAddress) => {
    const { id, ...rest } = addr;
    await onUpdateAddress(id, {
      ...rest,
      phone: tempPhone.trim(),
      contactPerson: tempContactPerson.trim()
    });
    setEditingContactId(null);
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

  // Inline update visit cycle
  const handleUpdateVisitInterval = async (addr: SavedAddress, newInterval: string) => {
    const { id, ...rest } = addr;
    
    let nextDateStr = addr.nextVisitDate || '';
    if (addr.lastVisitedDate && newInterval !== 'none') {
      nextDateStr = calculateNextVisitDate(addr.lastVisitedDate, newInterval);
    } else if (newInterval === 'none') {
      nextDateStr = '';
    } else if (!addr.lastVisitedDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      nextDateStr = calculateNextVisitDate(todayStr, newInterval);
    }

    await onUpdateAddress(id, {
      ...rest,
      visitInterval: newInterval as any,
      nextVisitDate: nextDateStr
    });
  };

  // Detailed Modal edit click
  const handleOpenEditModal = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setEditLabel(addr.label);
    setEditCategory(addr.category || 'Genel');
    setEditCustomCategory('');
    setEditPhone(addr.phone || '');
    setEditContactPerson(addr.contactPerson || '');
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
      phone: editPhone.trim(),
      contactPerson: editContactPerson.trim(),
      deficiencies: editDeficiencies.trim(),
      visitInterval: editVisitInterval,
      lastVisitedDate: editLastVisitedDate,
      nextVisitDate: finalNextVisit,
      visited: editingAddress.visited
    });

    setEditingAddress(null);
  };

  const handleCopyAsText = () => {
    const sorted = [...savedAddresses].sort((a, b) => 
      (a.label || '').localeCompare(b.label || '', 'tr')
    );

    let text = "FİRMA ZİYARET VE EKSİKLİK RAPORU\n";
    text += `Tarih: ${new Date().toLocaleDateString('tr-TR')}\n`;
    text += "============================================================\n\n";

    sorted.forEach((addr, idx) => {
      text += `${idx + 1}. FİRMA: ${addr.label}\n`;
      text += `   Telefon: ${addr.phone || 'Belirtilmedi'}\n`;
      text += `   Yetkili Kişi: ${addr.contactPerson || 'Belirtilmedi'}\n`;
      text += `   Adres: ${addr.address || ''}\n`;
      text += `   Son Ziyaret Tarihi: ${addr.lastVisitedDate || 'Ziyaret Edilmedi'}\n`;
      text += `   Eksiklik & İhtiyaç: ${addr.deficiencies?.trim() || 'Yok'}\n`;
      text += "----------------------------------------\n";
    });

    navigator.clipboard.writeText(text);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2000);
  };

  const handleDownloadExcel = () => {
    const sorted = [...savedAddresses].sort((a, b) => 
      (a.label || '').localeCompare(b.label || '', 'tr')
    );

    const data = sorted.map((addr, idx) => ({
      "Sıra No": idx + 1,
      "Firma Unvanı": addr.label || '',
      "Telefon Numarası": addr.phone || '',
      "Yetkili Kişi İsmi": addr.contactPerson || '',
      "Adres": addr.address || '',
      "Son Ziyaret Tarihi": addr.lastVisitedDate || 'Ziyaret Edilmedi',
      "Eksiklik & İhtiyaçlar": addr.deficiencies || 'Yok'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Firma Raporu");

    // Auto-adjust column widths for premium looking excel
    const maxLengths = data.reduce<Record<string, number>>((acc, row) => {
      Object.entries(row).forEach(([key, val]) => {
        const len = String(val).length;
        acc[key] = Math.max(acc[key] || 0, len);
      });
      return acc;
    }, {});

    worksheet["!cols"] = Object.keys(maxLengths).map(key => ({
      wch: Math.max(maxLengths[key] + 3, key.length + 3)
    }));

    XLSX.writeFile(workbook, `Firma_Ziyaret_ve_Eksiklik_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintPDF = () => {
    const sorted = [...savedAddresses].sort((a, b) => 
      (a.label || '').localeCompare(b.label || '', 'tr')
    );

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Yazdırma penceresi engellendi. Lütfen izin verin.");
      return;
    }

    let rowsHtml = '';
    sorted.forEach((addr, idx) => {
      const label = addr.label || '';
      const phone = addr.phone ? `<div><b>Tel:</b> ${addr.phone}</div>` : '';
      const contact = addr.contactPerson ? `<div><b>Yetkili:</b> ${addr.contactPerson}</div>` : '';
      const phoneAndContact = (phone || contact) ? `${phone}${contact}` : '<span style="color: #94a3b8; font-style: italic;">Yok</span>';
      const lastVisit = addr.lastVisitedDate || 'Ziyaret Edilmedi';
      const defText = addr.deficiencies?.trim() 
        ? '<div style="color: #991b1b; background-color: #fef2f2; border: 1px solid #fee2e2; padding: 4px 8px; border-radius: 4px; font-weight: bold; line-height: 1.3;">' + addr.deficiencies + '</div>'
        : '<span style="color: #cbd5e1; font-style: italic;">Yok</span>';

      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px 10px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 8px 10px; font-weight: bold; color: #0f172a;">${label}</td>
          <td style="padding: 8px 10px; color: #334155;">${phoneAndContact}</td>
          <td style="padding: 8px 10px; color: #475569; max-width: 200px;">${addr.address || ''}</td>
          <td style="padding: 8px 10px; color: #0f766e; font-weight: bold;">${lastVisit}</td>
          <td style="padding: 8px 10px;">${defText}</td>
        </tr>
      `;
    });

    const reportDate = new Date().toLocaleDateString('tr-TR');
    const totalCount = sorted.length;

    const htmlContent = 
      '<!DOCTYPE html>' +
      '<html>' +
      '<head>' +
      '  <title>Firma Ziyaret & Eksiklik Raporu</title>' +
      '  <meta charset="utf-8">' +
      '  <style>' +
      '    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");' +
      '    body { ' +
      '      font-family: "Inter", sans-serif; ' +
      '      padding: 40px; ' +
      '      color: #1e293b; ' +
      '      background-color: white;' +
      '      -webkit-print-color-adjust: exact;' +
      '      print-color-adjust: exact;' +
      '    }' +
      '    .header-container { ' +
      '      display: flex; ' +
      '      justify-content: space-between; ' +
      '      align-items: flex-start; ' +
      '      border-bottom: 3px solid #4f46e5; ' +
      '      padding-bottom: 20px; ' +
      '      margin-bottom: 30px; ' +
      '    }' +
      '    .app-title { ' +
      '      font-size: 24px; ' +
      '      font-weight: 800; ' +
      '      color: #1e1b4b; ' +
      '      letter-spacing: -0.5px;' +
      '      margin: 0;' +
      '    }' +
      '    .app-subtitle { ' +
      '      font-size: 12px; ' +
      '      color: #4f46e5; ' +
      '      font-weight: 700; ' +
      '      margin: 4px 0 0 0;' +
      '      text-transform: uppercase;' +
      '      letter-spacing: 0.5px;' +
      '    }' +
      '    .meta-box { ' +
      '      text-align: right; ' +
      '      font-size: 11px; ' +
      '      color: #64748b; ' +
      '      line-height: 1.6;' +
      '    }' +
      '    .meta-val {' +
      '      font-weight: 700;' +
      '      color: #0f172a;' +
      '    }' +
      '    table { ' +
      '      width: 100%; ' +
      '      border-collapse: collapse; ' +
      '      margin-top: 10px; ' +
      '    }' +
      '    th { ' +
      '      background-color: #f8fafc; ' +
      '      padding: 12px 10px; ' +
      '      border-bottom: 2px solid #cbd5e1; ' +
      '      text-align: left; ' +
      '      font-size: 10px; ' +
      '      font-weight: 800; ' +
      '      text-transform: uppercase; ' +
      '      color: #475569; ' +
      '      letter-spacing: 0.5px;' +
      '    }' +
      '    @media print {' +
      '      body { padding: 0; }' +
      '      @page { size: A4 landscape; margin: 15mm; }' +
      '    }' +
      '  </style>' +
      '</head>' +
      '<body>' +
      '  <div class="header-container">' +
      '    <div>' +
      '      <h1 class="app-title">FİRMA ZİYARET VE EKSİKLİK RAPORU</h1>' +
      '      <p class="app-subtitle">Alfabetik Sıralı Tüm Kayıtlı Firmalar</p>' +
      '    </div>' +
      '    <div class="meta-box">' +
      '      <div>Rapor Tarihi: <span class="meta-val">' + reportDate + '</span></div>' +
      '      <div>Toplam Firma Sayısı: <span class="meta-val">' + totalCount + '</span></div>' +
      '    </div>' +
      '  </div>' +
      '  <table>' +
      '    <thead>' +
      '      <tr>' +
      '        <th style="width: 40px; text-align: center;">Sıra</th>' +
      '        <th style="width: 200px;">Firma Unvanı</th>' +
      '        <th style="width: 160px;">Telefon / Yetkili</th>' +
      '        <th style="width: 220px;">Adres</th>' +
      '        <th style="width: 120px;">Son Ziyaret</th>' +
      '        <th>Eksiklik &amp; İhtiyaçlar</th>' +
      '      </tr>' +
      '    </thead>' +
      '    <tbody>' +
             rowsHtml +
      '    </tbody>' +
      '  </table>' +
      '  <script>' +
      '    window.onload = function() {' +
      '      setTimeout(function() {' +
      '        window.print();' +
      '      }, 400);' +
      '    };' +
      '  </script>' +
      '</body>' +
      '</html>';

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Count helper stats
  const totalFirms = savedAddresses.length;
  const dueFirms = savedAddresses.filter(isDueOrUpcoming).length;
  const deficiencyFirms = savedAddresses.filter(hasDeficiencies).length;
  const contactFirms = savedAddresses.filter(hasContactInfo).length;

  return (
    <div id="visits-deficiencies-panel" className="h-full flex flex-col bg-slate-50 animate-fade-in font-sans">
      
      {/* Header and Quick Stats - Ultra Compact Single Row */}
      <div className="py-2.5 px-4 bg-white border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-black text-slate-800 tracking-tight">Ziyaret &amp; Eksiklik Takibi</span>
          </div>
          <button
            onClick={() => setShowListReportModal(true)}
            className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/50 transition-colors cursor-pointer shadow-3xs"
            title="Tüm firmaların alfabetik listesi ve raporu"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Firma Listesi Al</span>
          </button>
        </div>

        {/* Horizontal Compact Stats Pill List */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button 
            onClick={() => { setFilterType('all'); setCategoryFilter('all'); }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              filterType === 'all' && categoryFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
            }`}
          >
            <span>Toplam:</span>
            <span className="font-extrabold">{totalFirms}</span>
          </button>

          <button 
            onClick={() => { setFilterType('due'); setCategoryFilter('all'); }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              filterType === 'due' 
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                : 'bg-amber-50 hover:bg-amber-100/60 border-amber-200 text-amber-900 shadow-2xs'
            }`}
          >
            <span>⏱ Süresi Gelen:</span>
            <span className="font-extrabold">{dueFirms}</span>
          </button>

          <button 
            onClick={() => { setFilterType('deficiencies'); setCategoryFilter('all'); }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              filterType === 'deficiencies' 
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                : 'bg-rose-50 hover:bg-rose-100/60 border-rose-200 text-rose-950 shadow-2xs'
            }`}
          >
            <span>🚨 Eksik/İhtiyaç:</span>
            <span className="font-extrabold">{deficiencyFirms}</span>
          </button>

          <button 
            onClick={() => { setFilterType('notes'); setCategoryFilter('all'); }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              filterType === 'notes' 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                : 'bg-indigo-50 hover:bg-indigo-100/60 border-indigo-200 text-indigo-950 shadow-2xs'
            }`}
          >
            <span>📞 İletişim Var:</span>
            <span className="font-extrabold">{contactFirms}</span>
          </button>
        </div>
      </div>

      {/* Search & Group Filter Bar - Clean Stacked Layout (Compact padding) */}
      <div className="p-3 bg-white border-b border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Firma adı, adres, not veya eksiklik ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-[11px] pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 placeholder-slate-400 shadow-inner"
          />
        </div>

        {/* Horizontal Scrollable Category Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin select-none max-w-full">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main List Area - Styled as stacked rows */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/60">
        {filteredAddresses.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-150 text-slate-400 shadow-xs max-w-md mx-auto mt-8">
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
          <div className="flex flex-col gap-2 max-w-6xl mx-auto pb-10">
            {filteredAddresses.map((addr) => {
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
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  {/* Left Section: Company Name, Category, Address */}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="bg-indigo-50/80 border border-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {addr.category || 'Genel'}
                        </span>
                        <h3 className="text-xs font-black text-slate-800 truncate" title={addr.label}>
                          {addr.label}
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-300" />
                        <span className="truncate">{addr.address}</span>
                      </p>
                    </div>

                    {/* Last visit & Status badge */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {addr.lastVisitedDate && (
                        <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px] border border-slate-200/50">
                          Son: {addr.lastVisitedDate}
                        </span>
                      )}

                      {addr.visitInterval && addr.visitInterval !== 'none' && (
                        <>
                          {!addr.lastVisitedDate ? (
                            <span className="bg-amber-50 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-amber-200">
                              Bekleniyor
                            </span>
                          ) : (() => {
                            if (remaining === null) return null;
                            if (remaining < 0) {
                              return (
                                <span className="bg-rose-50 text-rose-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-rose-200 animate-pulse flex items-center gap-0.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 inline-block"></span>
                                  {Math.abs(remaining)} G Gecikti
                                </span>
                              );
                            } else if (remaining === 0) {
                              return (
                                <span className="bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-amber-300">
                                  📅 Bugün!
                                </span>
                              );
                            } else if (remaining <= 7) {
                              return (
                                <span className="bg-amber-50 text-amber-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-amber-200">
                                  ⏱ {remaining} Gün
                                </span>
                              );
                            } else {
                              return (
                                <span className="bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-emerald-200">
                                  ⏱ {remaining} Gün
                                </span>
                              );
                            }
                          })()}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Middle Section: Direct Inputs for Deficiencies and Notes */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 lg:mx-3">
                    {/* Deficiency Section */}
                    <div className="p-2 bg-rose-50/40 border border-rose-100/50 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black text-rose-800 uppercase tracking-wider">🚨 Eksiklik</span>
                          {editingDeficienciesId !== addr.id && (
                            <button
                              onClick={() => {
                                setEditingDeficienciesId(addr.id);
                                setTempDeficiencies(addr.deficiencies || '');
                              }}
                              className="text-[8px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                            >
                              Düzenle
                            </button>
                          )}
                        </div>
                        {editingDeficienciesId === addr.id ? (
                          <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={tempDeficiencies}
                              onChange={(e) => setTempDeficiencies(e.target.value)}
                              placeholder="Eksik evrak vs..."
                              className="flex-1 text-[10px] bg-white border border-rose-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                            />
                            <button
                              onClick={() => handleSaveInlineDeficiencies(addr)}
                              className="px-1.5 py-0.5 text-[9px] bg-rose-600 text-white rounded font-bold hover:bg-rose-700"
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => setEditingDeficienciesId(null)}
                              className="px-1 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded font-bold hover:bg-slate-200"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-600 truncate mt-0.5">
                            {addr.deficiencies?.trim() ? (
                              <span className="font-semibold text-slate-700">{addr.deficiencies}</span>
                            ) : (
                              <span className="text-slate-400 italic">Eksiklik yok.</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Phone & Contact Person Section */}
                    <div className="p-2 bg-indigo-50/40 border border-indigo-100/40 rounded-lg flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-indigo-800 uppercase tracking-wider block">📞 İletişim Bilgileri</span>
                        {editingContactId !== addr.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContactId(addr.id);
                              setTempPhone(addr.phone || '');
                              setTempContactPerson(addr.contactPerson || '');
                            }}
                            className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline"
                          >
                            {addr.phone || addr.contactPerson ? 'Düzenle' : '+ İletişim Ekle'}
                          </button>
                        )}
                      </div>

                      {editingContactId === addr.id ? (
                        <div className="flex flex-col gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="tel"
                              value={tempPhone}
                              onChange={(e) => setTempPhone(e.target.value)}
                              placeholder="Tel (0532 123 4567)"
                              className="text-[10px] bg-white border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                            <input
                              type="text"
                              value={tempContactPerson}
                              onChange={(e) => setTempContactPerson(e.target.value)}
                              placeholder="Yetkili Kişi İsmi"
                              className="text-[10px] bg-white border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            />
                          </div>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveInlineContact(addr)}
                              className="px-2 py-0.5 text-[9px] bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 cursor-pointer"
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingContactId(null)}
                              className="px-2 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded font-bold hover:bg-slate-200 cursor-pointer"
                            >
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                          {addr.phone ? (
                            <a href={`tel:${addr.phone}`} className="font-bold text-indigo-700 hover:underline">
                              Tel: {addr.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Telefon yok</span>
                          )}
                          {addr.contactPerson && (
                            <span className="text-slate-600 font-semibold">
                              Yetkili: {addr.contactPerson}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Section: Döngü Dropdown & Actions */}
                  <div className="flex flex-row items-center justify-between lg:justify-end gap-2.5 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0">
                    
                    {/* Direct Döngü Dropdown */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-450 font-bold shrink-0">Döngü:</span>
                      <select
                        value={addr.visitInterval || 'none'}
                        onChange={(e) => handleUpdateVisitInterval(addr, e.target.value as any)}
                        className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold py-1 px-1.5 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:bg-slate-200 transition-colors"
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

                    {/* Buttons */}
                    <div className="flex items-center gap-1 select-none">
                      <button
                        type="button"
                        onClick={() => handleMarkVisitedToday(addr)}
                        className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-800 font-extrabold text-[9px] rounded-lg transition-all cursor-pointer"
                        title="Bugün ziyaret edildi olarak kaydet"
                      >
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                        Ziyaret
                      </button>

                      <button
                        type="button"
                        disabled={isOriginOrDestInRoute}
                        onClick={() => handleToggleRouteStop(addr)}
                        className={`flex items-center gap-1 px-2 py-1.5 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
                          isOriginOrDestInRoute
                            ? 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200'
                            : inRoute
                            ? 'bg-indigo-600 text-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-indigo-600'
                            : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                        title={inRoute ? "Rotadan çıkarmak için tıklayın" : "Sıradaki durak olarak ekle"}
                      >
                        <Route className={`h-3 w-3 ${isOriginOrDestInRoute ? 'text-slate-300' : inRoute ? 'text-current' : 'text-indigo-600'}`} />
                        {isOriginOrDestInRoute ? 'Süreçte' : inRoute ? 'Rotaya Eklendi ✓' : 'Rotaya Ekle'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectOnMap(addr)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        title="Haritada Göster"
                      >
                        <Map className="h-3.5 w-3.5 text-slate-550" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(addr)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        title="Detaylı Düzenle"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
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

              {/* İletişim Bilgileri ve Eksiklikler */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-600">Telefon Numarası</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="0532 123 4567"
                      className="block w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-600">Yetkili Kişi İsmi</label>
                    <input
                      type="text"
                      value={editContactPerson}
                      onChange={(e) => setEditContactPerson(e.target.value)}
                      placeholder="Ahmet Yılmaz"
                      className="block w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-rose-600 font-black">Eksiklik ve İhtiyaçlar</label>
                  <textarea
                    value={editDeficiencies}
                    onChange={(e) => setEditDeficiencies(e.target.value)}
                    placeholder="Eksik evrak, malzeme, teslimat detayları..."
                    rows={2.5}
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

      {/* ALPHABETICAL FIRM LIST REPORT MODAL */}
      {showListReportModal && (() => {
        const reportSortedFirms = [...savedAddresses]
          .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'tr'))
          .filter(addr => {
            const q = reportSearchQuery.toLowerCase().trim();
            if (!q) return true;
            return (addr.label || '').toLowerCase().includes(q) ||
                   (addr.category || '').toLowerCase().includes(q) ||
                   (addr.deficiencies || '').toLowerCase().includes(q) ||
                   (addr.phone || '').toLowerCase().includes(q) ||
                   (addr.contactPerson || '').toLowerCase().includes(q);
          });

        return (
          <div 
            id="firm-list-report-modal-backdrop"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={() => { setShowListReportModal(false); setReportSearchQuery(''); }}
          >
            <div 
              id="firm-list-report-modal"
              className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">Alfabetik Firma Listesi &amp; Raporu</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Toplam {reportSortedFirms.length} Firma Listeleniyor</p>
                  </div>
                </div>

                {/* Search in Report */}
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rapor içinde ara..."
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    className="w-full bg-white text-[11px] pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="px-5 py-3 bg-indigo-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[10px] font-bold text-indigo-900/70">
                  ⚠️ Bu liste alfabetik olarak sıralanmıştır. Excel olarak indirebilir veya kopyalayabilirsiniz.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyAsText}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                      copiedList 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                    }`}
                  >
                    {copiedList ? <Check className="h-3.5 w-3.5 animate-bounce" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedList ? 'Kopyalandı!' : 'Metin Olarak Kopyala'}</span>
                  </button>

                  <button
                    onClick={handlePrintPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-all shadow-2xs cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>PDF Olarak Yazdır</span>
                  </button>

                  <button
                    onClick={handleDownloadExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Excel (.xlsx) İndir</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Report Content */}
              <div className="flex-1 overflow-auto p-5">
                {reportSortedFirms.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <AlertCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold">Firma bulunamadı.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                          <th className="py-2.5 px-3">Firma Unvanı</th>
                          <th className="py-2.5 px-3">Telefon / Yetkili</th>
                          <th className="py-2.5 px-3">Adres</th>
                          <th className="py-2.5 px-3">Son Ziyaret Tarihi</th>
                          <th className="py-2.5 px-3">Eksiklik &amp; İhtiyaçlar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {reportSortedFirms.map((addr) => (
                          <tr key={addr.id} className="hover:bg-slate-50/70 transition-colors text-xs">
                            <td className="py-3 px-3 font-black text-slate-900">{addr.label}</td>
                            <td className="py-3 px-3">
                              {addr.phone ? (
                                <a href={`tel:${addr.phone}`} className="font-bold text-indigo-600 hover:underline block">
                                  {addr.phone}
                                </a>
                              ) : null}
                              {addr.contactPerson && (
                                <span className="text-slate-600 font-medium text-[11px] block">
                                  {addr.contactPerson}
                                </span>
                              )}
                              {!addr.phone && !addr.contactPerson && (
                                <span className="text-slate-400 italic text-[11px]">Belirtilmedi</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-600 text-[11px] max-w-xs">{addr.address || '-'}</td>
                            <td className="py-3 px-3 font-semibold text-slate-600">
                              {addr.lastVisitedDate ? (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold">
                                  {addr.lastVisitedDate}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Ziyaret edilmedi</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {addr.deficiencies?.trim() ? (
                                <div className="text-[11px] bg-rose-50 border border-rose-100 text-rose-800 font-bold rounded p-1.5 max-w-xs leading-normal">
                                  {addr.deficiencies}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Yok</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-150 flex justify-end bg-slate-50">
                <button
                  type="button"
                  onClick={() => { setShowListReportModal(false); setReportSearchQuery(''); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-all cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
