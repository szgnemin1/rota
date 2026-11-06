import { useState, useEffect } from 'react';
import { RouteStop, SavedAddress, TravelMode, RouteSummary } from '../types';
import PlaceSearchBox from './PlaceSearchBox';
import {
  MapPin, Plus, Trash2, ArrowUpDown, Navigation,
  Car, Footprints, Bike, Bus, Copy, Check, QrCode, ExternalLink, RefreshCw, Star, GripVertical, FileText,
  Compass, Play, ChevronDown, ChevronUp, Bookmark
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import YandexExportModal from './YandexExportModal';

interface RoutePlannerProps {
  savedAddresses: SavedAddress[];
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  routeSummary: RouteSummary | null;
  onClearRoute: () => void;
  onStartNavigation?: (mode?: 'GPS' | 'SIMULATION') => void;
  defaultOrigin?: RouteStop | null;
  onSetDefaultOrigin?: (stop: RouteStop | null) => void;
  onNavigateToTab?: (tab: 'field' | 'route' | 'saved' | 'visits' | 'settings' | 'map') => void;
}

export default function RoutePlanner({
  savedAddresses,
  routeStops,
  setRouteStops,
  travelMode,
  setTravelMode,
  routeSummary,
  onClearRoute,
  onStartNavigation,
  defaultOrigin,
  onSetDefaultOrigin,
  onNavigateToTab
}: RoutePlannerProps) {
  const [copied, setCopied] = useState(false);
  const [copiedYandex, setCopiedYandex] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showExternalExport, setShowExternalExport] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showYandexExportModal, setShowYandexExportModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleReorderStops = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    // Extract content of stops in their current order
    const stopContents = routeStops.map(s => ({
      label: s.label,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      isSaved: s.isSaved
    }));

    // Reorder contents
    const [draggedContent] = stopContents.splice(fromIndex, 1);
    stopContents.splice(toIndex, 0, draggedContent);

    // Apply back preserving the IDs
    const updated = routeStops.map((origStop, idx) => ({
      ...origStop,
      label: stopContents[idx].label,
      address: stopContents[idx].address,
      lat: stopContents[idx].lat,
      lng: stopContents[idx].lng,
      isSaved: stopContents[idx].isSaved
    }));

    setRouteStops(updated);
  };

  // Default structure of route: must have at least Origin and Destination
  useEffect(() => {
    if (routeStops.length < 2) {
      setRouteStops([
        { id: 'origin', label: '', address: '', lat: 0, lng: 0 },
        { id: 'destination', label: '', address: '', lat: 0, lng: 0 }
      ]);
    }
  }, []);

  const handleUpdateStop = (id: string, updatedFields: Partial<RouteStop>) => {
    setRouteStops(
      routeStops.map((stop) => (stop.id === id ? { ...stop, ...updatedFields } : stop))
    );
  };

  const handleAddWaypoint = () => {
    if (routeStops.length >= 100) {
      showToast("Maksimum 100 durak eklenebilir.");
      return;
    }
    // Insert waypoint before the last item (destination)
    const newId = `waypoint-${Date.now()}`;
    const newWaypoint: RouteStop = { id: newId, label: '', address: '', lat: 0, lng: 0 };
    const updatedStops = [...routeStops];
    updatedStops.splice(routeStops.length - 1, 0, newWaypoint);
    setRouteStops(updatedStops);
  };

  const handleRemoveWaypoint = (id: string) => {
    if (routeStops.length <= 2) return; // Cannot remove origin or destination
    setRouteStops(routeStops.filter((stop) => stop.id !== id));
  };

  const handleSelectFromSaved = (id: string, addrId: string) => {
    const matched = savedAddresses.find((a) => a.id === addrId);
    if (matched) {
      handleUpdateStop(id, {
        label: matched.label,
        address: matched.address,
        lat: matched.lat,
        lng: matched.lng,
        isSaved: true
      });
    }
  };

  const handleSwapStops = () => {
    // Reverse simple arrays of stops, but preserve their logical identifiers
    const reversedLabels = [...routeStops].reverse();
    const updated = routeStops.map((origStop, idx) => {
      const source = reversedLabels[idx];
      return {
        ...origStop,
        label: source.label,
        address: source.address,
        lat: source.lat,
        lng: source.lng,
        isSaved: source.isSaved
      };
    });
    setRouteStops(updated);
  };

  const handleSortStopsByDistance = () => {
    const origin = routeStops.find(s => s.id === 'origin');
    if (!origin || !origin.lat || !origin.lng) {
      showToast("Lütfen önce başlangıç noktası için geçerli bir adres girin veya haritadan seçin.");
      return;
    }

    // Identify if we have a valid destination stop
    const destination = routeStops.find(s => s.id === 'destination');
    const hasDestination = !!(destination && destination.lat && destination.lng);

    // Get all valid stops that have coordinates and are not the origin
    const validWaypoints = routeStops.filter(s => s.id !== 'origin' && s.id !== 'destination' && s.lat && s.lng);
    const unplacedStops = routeStops.filter(s => !s.lat || !s.lng);

    // Haversine distance calculator
    const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // We will build the sorted list starting with origin
    const sortedWaypoints: RouteStop[] = [];
    
    // Gather all stops we want to optimize (all waypoints, and the destination if it's not a "fixed" target)
    const stopsToOptimize = [...validWaypoints];
    if (!hasDestination && destination && destination.lat && destination.lng) {
      stopsToOptimize.push(destination);
    }

    let currentLat = origin.lat;
    let currentLng = origin.lng;

    while (stopsToOptimize.length > 0) {
      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < stopsToOptimize.length; i++) {
        const dist = getDistance(currentLat, currentLng, stopsToOptimize[i].lat, stopsToOptimize[i].lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      const nextStop = stopsToOptimize.splice(closestIdx, 1)[0];
      sortedWaypoints.push(nextStop);
      currentLat = nextStop.lat;
      currentLng = nextStop.lng;
    }

    // Construct the final list of stops
    const finalStops: RouteStop[] = [{ ...origin }];

    // Append sorted waypoints
    sortedWaypoints.forEach((stop, idx) => {
      const isLast = idx === sortedWaypoints.length - 1 && !hasDestination;
      finalStops.push({
        id: isLast ? 'destination' : `waypoint-${Date.now()}-${idx}`,
        label: stop.label,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
        isSaved: stop.isSaved
      });
    });

    // If destination was fixed, append it at the very end
    if (hasDestination && destination) {
      finalStops.push({
        id: 'destination',
        label: destination.label,
        address: destination.address,
        lat: destination.lat,
        lng: destination.lng,
        isSaved: destination.isSaved
      });
    }

    // Add back empty/unplaced stops
    const emptyDestination = unplacedStops.find(s => s.id === 'destination');
    const emptyWaypoints = unplacedStops.filter(s => s.id !== 'origin' && s.id !== 'destination');

    emptyWaypoints.forEach((stop, idx) => {
      finalStops.push({
        ...stop,
        id: `waypoint-empty-${idx}`
      });
    });

    // Ensure we have a destination slot
    if (!finalStops.some(s => s.id === 'destination')) {
      if (emptyDestination) {
        finalStops.push(emptyDestination);
      } else {
        finalStops.push({ id: 'destination', label: '', address: '', lat: 0, lng: 0 });
      }
    }

    setRouteStops(finalStops);
  };

  const validStops = routeStops.filter((s) => s.lat !== 0 && s.lng !== 0);

  // Generate Yandex Maps & Navigator link for full route
  // Format: https://yandex.com.tr/maps/?rtext=lat1,lng1~lat2,lng2~...~latN,lngN&rtt=auto
  // Yandex has NO stop limit (unlimited waypoints supported!)
  const getYandexUrl = () => {
    if (validStops.length < 2) return '';

    const modeMapping: Record<TravelMode, string> = {
      DRIVING: 'auto',
      WALKING: 'pd',
      BICYCLING: 'bc',
      TRANSIT: 'mt'
    };
    const rtt = modeMapping[travelMode] || 'auto';
    const points = validStops.map((w) => `${w.lat},${w.lng}`).join('~');

    return `https://yandex.com.tr/maps/?rtext=${points}&rtt=${rtt}`;
  };

  // Generate Yandex location link for a single stop
  const getStopYandexUrl = (lat: number, lng: number) => {
    return `https://yandex.com.tr/maps/?rtext=~${lat},${lng}&rtt=auto`;
  };

  const yandexUrl = getYandexUrl();

  const intervalLabels: Record<string, string> = {
    'none': 'Belirtilmemiş',
    '15_days': '15 Günde Bir',
    '1_month': 'Ayda 1',
    '2_months': '2 Ayda 1',
    '3_months': '3 Ayda 1',
    '6_months': '6 Ayda 1',
    '1_year': 'Yılda 1',
  };

  const safePdfText = (text: string | undefined): string => {
    if (!text) return '';
    const map: Record<string, string> = {
      'Ç': 'C', 'ç': 'c',
      'Ğ': 'G', 'ğ': 'g',
      'İ': 'I', 'ı': 'i',
      'Ö': 'O', 'ö': 'o',
      'Ş': 'S', 'ş': 's',
      'Ü': 'U', 'ü': 'u'
    };
    return text.split('').map(char => map[char] || char).join('');
  };

  const exportRoutePDF = async () => {
    const activeStops = routeStops.filter(s => s.lat !== 0 && s.lng !== 0);

    if (activeStops.length === 0) {
      showToast("Rotada geçerli durak bulunmuyor.");
      return;
    }

    setIsGeneratingPdf(true);
    showToast("Firma listesi PDF olarak hazırlanıyor...");

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const maxTextWidth = pageWidth - (margin * 2); // 186 mm
      let y = 16;

      const checkPageOverflow = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin - 8) {
          doc.addPage();
          y = margin + 4;
        }
      };

      // Header Brand
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, maxTextWidth, 18, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, maxTextWidth, 18, 2, 2, 'S');

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text(safePdfText("ROTA ZIYARET VE FIRMA LISTESI"), margin + 5, y + 7);

      // Date and Total Stops Subtitle
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const todayStr = new Date().toLocaleDateString('tr-TR');
      let metaStr = `Tarih: ${todayStr}  |  Toplam Durak: ${activeStops.length}`;
      if (routeSummary) {
        metaStr += `  |  Mesafe: ${routeSummary.distance}  |  Tahmini Sure: ${routeSummary.duration}`;
      }
      doc.text(safePdfText(metaStr), margin + 5, y + 13);

      // Right Header Badge
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(79, 70, 229);
      const badgeText = safePdfText("[SAHA ZIYARET FORMU]");
      doc.text(badgeText, pageWidth - margin - doc.getTextWidth(badgeText) - 5, y + 10);

      y += 23;

      // Draw each stop
      activeStops.forEach((stop, index) => {
        const isOrigin = index === 0;
        const isDest = index === activeStops.length - 1;

        const savedAddr = savedAddresses.find(
          (sa) => sa.id === stop.id || (Math.abs(sa.lat - stop.lat) < 0.0001 && Math.abs(sa.lng - stop.lng) < 0.0001)
        );

        const labelVal = stop.label || (isOrigin ? "Baslangic Noktasi" : isDest ? "Varis Noktasi" : `Durak ${index + 1}`);
        const addressVal = stop.address || "Adres belirtilmemis";
        const phone = savedAddr?.phone || stop.phone || '';
        const contactPerson = savedAddr?.contactPerson || stop.contactPerson || '';
        const deficiencies = savedAddr?.deficiencies || stop.note || '';
        const category = savedAddr?.category || 'Genel';
        const interval = savedAddr?.visitInterval && savedAddr?.visitInterval !== 'none' ? intervalLabels[savedAddr.visitInterval] : '';

        let stopTypeStr = `[DURAK #${index + 1}]`;
        if (isOrigin) stopTypeStr = "[BASLANGIC]";
        if (isDest) stopTypeStr = "[VARIS]";

        // Right side Checkbox & Signature column (width 38mm)
        const actionColWidth = 38;
        const contentWidth = maxTextWidth - actionColWidth - 8; // ~ 140 mm for clean, wide text

        // 1. Calculate text wraps accurately
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9.5);
        const splitLabel = doc.splitTextToSize(safePdfText(`${index + 1}. ${labelVal}  ${stopTypeStr}`), contentWidth);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        const splitAddress = doc.splitTextToSize(safePdfText(`Adres: ${addressVal}`), contentWidth);

        let splitContact: string[] = [];
        if (phone || contactPerson) {
          splitContact = doc.splitTextToSize(
            safePdfText(`Iletisim: ${phone}${contactPerson ? `  |  Yetkili: ${contactPerson}` : ''}`),
            contentWidth
          );
        }

        let splitDeficiencies: string[] = [];
        if (deficiencies) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          splitDeficiencies = doc.splitTextToSize(safePdfText(`Not / Eksiklik: ${deficiencies}`), contentWidth);
        }

        // 2. Dynamic card height calculation so firm info never overlaps
        const lineH = 3.8;
        let textCalculatedHeight = 5; // top padding
        textCalculatedHeight += splitLabel.length * 4.2; // title lines
        if (savedAddr) textCalculatedHeight += lineH; // group badge line
        textCalculatedHeight += splitAddress.length * lineH; // address lines
        if (splitContact.length > 0) textCalculatedHeight += splitContact.length * lineH; // contact lines
        if (splitDeficiencies.length > 0) textCalculatedHeight += splitDeficiencies.length * lineH; // deficiency lines
        textCalculatedHeight += 5; // bottom padding

        const blockHeight = Math.max(textCalculatedHeight, 22);

        // Check page overflow
        checkPageOverflow(blockHeight + 4);

        // Background card rectangle
        doc.setFillColor(250, 250, 252);
        doc.roundedRect(margin, y, maxTextWidth, blockHeight, 1.5, 1.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, maxTextWidth, blockHeight, 1.5, 1.5, 'S');

        // Color bar on the left indicating status
        if (isOrigin) {
          doc.setFillColor(16, 185, 129); // emerald
        } else if (isDest) {
          doc.setFillColor(239, 68, 68); // red
        } else {
          doc.setFillColor(79, 70, 229); // indigo
        }
        doc.rect(margin, y, 3, blockHeight, 'F');

        // Text Cursor
        let cursorY = y + 4.5;

        // Render Title & Company Name
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        splitLabel.forEach((line: string) => {
          doc.text(line, margin + 6, cursorY);
          cursorY += 4.2;
        });

        // Render Group / Category & Interval
        if (savedAddr) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          const catText = `Grup: ${category}${interval ? `  |  Periyot: ${interval}` : ''}`;
          doc.text(safePdfText(catText), margin + 6, cursorY);
          cursorY += lineH;
        }

        // Render Address
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        splitAddress.forEach((line: string) => {
          doc.text(line, margin + 6, cursorY);
          cursorY += lineH;
        });

        // Render Contact info
        if (splitContact.length > 0) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(67, 56, 202); // indigo
          splitContact.forEach((line: string) => {
            doc.text(line, margin + 6, cursorY);
            cursorY += lineH;
          });
        }

        // Render Deficiencies / Notes
        if (splitDeficiencies.length > 0) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(220, 38, 38); // red
          splitDeficiencies.forEach((line: string) => {
            doc.text(line, margin + 6, cursorY);
            cursorY += lineH;
          });
        }

        // RIGHT SIDE: Checkbox & Signature Box (Clean, pen-friendly)
        const rightColX = pageWidth - margin - actionColWidth;
        
        // Vertical divider line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(rightColX - 3, y + 2, rightColX - 3, y + blockHeight - 2);

        // [ ] GIDILDI Checkbox
        const boxSize = 5;
        const boxY = y + 4.5;
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(0.4);
        doc.rect(rightColX, boxY, boxSize, boxSize);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text("GIDILDI", rightColX + boxSize + 2.5, boxY + 4);

        // Signature / Note line
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Imza / Not:", rightColX, y + blockHeight - 5);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(rightColX + 13, y + blockHeight - 5, pageWidth - margin - 2, y + blockHeight - 5);

        y += blockHeight + 3.5;
      });

      // Footer
      checkPageOverflow(12);
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4.5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        safePdfText("Rota Planlama Sistemi | Ziyaret Takip Formu. Sahada cihazinizdan tek tikla Yandex Maps ile gitmek icin uygulamadaki 'Saha Takip' sekmesini kullanabilirsiniz."),
        margin,
        y
      );

      doc.save(`rota_firma_ziyaret_listesi_${todayStr.replace(/\./g, '_')}.pdf`);
      showToast("Sade firma listesi PDF olarak indirildi!");
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      showToast("PDF oluşturulurken bir hata oluştu: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyYandexLink = () => {
    if (!yandexUrl) return;
    navigator.clipboard.writeText(yandexUrl);
    setCopiedYandex(true);
    showToast("Yandex Navigasyon linki kopyalandı!");
    setTimeout(() => setCopiedYandex(false), 2000);
  };

  const handleCopyLink = () => {
    if (!yandexUrl) return;
    navigator.clipboard.writeText(yandexUrl);
    setCopied(true);
    showToast("Yandex rota linki panoya kopyalandı!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if we have plotted a real route
  const isRouteConfigured = routeStops.every((s) => s.lat !== 0 && s.lng !== 0);

  // Haversine distance calculator
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const activeCoords = routeStops.filter(s => s.lat !== 0 && s.lng !== 0);

  // We find which groups are represented in the current route stops
  const activeRouteLabels = new Set(routeStops.map(s => s.label.toLowerCase() + '|' + s.address.toLowerCase()));
  const activeRouteSavedAddrs = savedAddresses.filter(addr => 
    activeRouteLabels.has(addr.label.toLowerCase() + '|' + addr.address.toLowerCase())
  );
  const activeRouteCategories = new Set(activeRouteSavedAddrs.map(addr => addr.category || 'Genel'));

  // Candidates: NOT on route, NOT visited, and belong to a different group than represented on the active route stops
  const candidates = savedAddresses.filter(addr => {
    const isAlreadyOnRoute = routeStops.some(s => 
      (s.lat === addr.lat && s.lng === addr.lng) ||
      (s.label.toLowerCase() === addr.label.toLowerCase() && s.address.toLowerCase() === addr.address.toLowerCase())
    );
    if (isAlreadyOnRoute) return false;
    if (addr.visited) return false;

    // Check if the group is already on the route.
    // If activeRouteCategories is populated, candidate's group must NOT be in it.
    const candidateCat = addr.category || 'Genel';
    if (activeRouteCategories.size > 0 && activeRouteCategories.has(candidateCat)) {
      return false;
    }
    return true;
  });

  const nearbySuggestions = activeCoords.length > 0 ? candidates.map(addr => {
    let minDistance = Infinity;
    let closestToStopLabel = '';

    activeCoords.forEach(stop => {
      const d = getDistanceKm(stop.lat, stop.lng, addr.lat, addr.lng);
      if (d < minDistance) {
        minDistance = d;
        closestToStopLabel = stop.label || (stop.id === 'origin' ? 'Başlangıç' : stop.id === 'destination' ? 'Varış' : 'Durak');
      }
    });

    return {
      address: addr,
      distance: minDistance,
      closestTo: closestToStopLabel
    };
  })
  .filter(item => item.distance < 25) // Suggest locations within 25 km
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 4) : []; // Show up to 4 suggestions

  const handleAddNearbyToRoute = (addr: SavedAddress) => {
    if (routeStops.length >= 100) {
      showToast("Maksimum 100 durak eklenebilir.");
      return;
    }
    
    // Check if there is an empty stop in the routeStops we can fill, or create a new waypoint
    const emptyStopIndex = routeStops.findIndex(s => s.id !== 'origin' && s.id !== 'destination' && !s.lat);
    
    if (emptyStopIndex !== -1) {
      const updated = [...routeStops];
      updated[emptyStopIndex] = {
        id: routeStops[emptyStopIndex].id,
        label: addr.label,
        address: addr.address,
        lat: addr.lat,
        lng: addr.lng,
        isSaved: true
      };
      setRouteStops(updated);
    } else {
      // Create new waypoint and insert right before the last element (destination)
      const newWaypoint: RouteStop = {
        id: `waypoint-${Date.now()}`,
        label: addr.label,
        address: addr.address,
        lat: addr.lat,
        lng: addr.lng,
        isSaved: true
      };
      const updated = [...routeStops];
      updated.splice(routeStops.length - 1, 0, newWaypoint);
      setRouteStops(updated);
    }
  };

  const travelModesList: { mode: TravelMode; label: string; icon: any }[] = [
    { mode: 'DRIVING', label: 'Sürüş', icon: Car },
    { mode: 'WALKING', label: 'Yürüyüş', icon: Footprints },
    { mode: 'BICYCLING', label: 'Bisiklet', icon: Bike },
    { mode: 'TRANSIT', label: 'Toplu Taşıma', icon: Bus }
  ];

  return (
    <div id="route-planner-panel" className="flex flex-col h-full bg-white select-none relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-2 left-3 right-3 z-50 bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xl border border-slate-800 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-sm font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Navigation className="h-5 w-5 text-blue-500 fill-blue-50 animate-pulse" />
          Rota Oluşturucu
        </h2>
        
        {isRouteConfigured && (
          <button
            id="clear-route-button"
            onClick={onClearRoute}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Temizle
          </button>
        )}
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stops editor list */}
        <div className="relative space-y-3">
          {/* Action buttons above list: Swap and Sort */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <button
              id="swap-route-stops-btn"
              type="button"
              onClick={handleSwapStops}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
              Sıralamayı Ters Çevir
            </button>

            <button
              id="sort-route-stops-btn"
              type="button"
              onClick={handleSortStopsByDistance}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
              title="Durakları başlangıç konumuna göre yakından uzağa sıralar"
            >
              <Navigation className="h-3.5 w-3.5 rotate-45 text-indigo-600" />
              Yakından Uzağa Sırala
            </button>
          </div>

          {/* Vertical progress line between stops */}
          <div className="absolute left-6 top-16 bottom-8 w-0.5 bg-slate-100 -z-0 pointer-events-none" />

          {routeStops.map((stop, idx) => {
            const isOrigin = idx === 0;
            const isDest = idx === routeStops.length - 1;
            
            let labelText = `Ara Durak ${idx}`;
            let prefixColor = "bg-blue-500 border-blue-100";
            if (isOrigin) {
              labelText = "Başlangıç Noktası";
              prefixColor = "bg-emerald-500 border-emerald-100";
            } else if (isDest) {
              labelText = "Varış Noktası (Hedef)";
              prefixColor = "bg-red-500 border-red-100";
            }

            return (
              <div
                id={`route-stop-block-${stop.id}`}
                key={stop.id}
                draggable
                onDragStart={(e) => setDraggedIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => setDraggedIndex(null)}
                onDrop={(e) => {
                  if (draggedIndex !== null) {
                    handleReorderStops(draggedIndex, idx);
                  }
                }}
                className={`relative bg-slate-50 border p-3 rounded-xl flex flex-col gap-2 shadow-sm transition-all duration-200 cursor-move ${
                  draggedIndex === idx
                    ? 'opacity-40 border-indigo-400 bg-indigo-50/10 scale-95 shadow-inner'
                    : 'border-slate-100 hover:border-slate-200 hover:shadow-md'
                }`}
              >
                {/* Header label */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <GripVertical className="h-3.5 w-3.5 text-slate-400 cursor-grab active:cursor-grabbing shrink-0" />
                    <span className={`h-2.5 w-2.5 rounded-full border-2 ${prefixColor} shrink-0`} />
                    <span className="font-semibold text-slate-600">{labelText}</span>
                    {isOrigin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (defaultOrigin) {
                            onSetDefaultOrigin?.(null);
                          } else if (stop.lat && stop.lng) {
                            onSetDefaultOrigin?.(stop);
                          } else {
                            showToast("Sabit başlangıç yapabilmek için lütfen önce geçerli bir başlangıç konumu arayın veya seçin.");
                          }
                        }}
                        className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                          defaultOrigin
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                        }`}
                        title={defaultOrigin ? "Sabit Başlangıç Konumunu Kaldır" : "Bu konumu kalıcı sabit başlangıç yap"}
                      >
                        <Star className={`h-3 w-3 shrink-0 ${defaultOrigin ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                        {defaultOrigin ? 'Sabit Başlangıç ✓' : 'Sabit Başlangıç Yap'}
                      </button>
                    )}
                  </div>

                  {!isOrigin && !isDest && (
                    <button
                      id={`remove-stop-${stop.id}`}
                      type="button"
                      onClick={() => handleRemoveWaypoint(stop.id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Durağı Kaldır"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Place Search Input */}
                <PlaceSearchBox
                  id={`stop-search-${stop.id}`}
                  placeholder={isOrigin ? "Aramaya başlayın..." : isDest ? "Nereye gidilecek?" : "Durak adresi ara..."}
                  initialValue={stop.address}
                  onPlaceSelected={(place) => {
                    handleUpdateStop(stop.id, {
                      label: place.label,
                      address: place.address,
                      lat: place.lat,
                      lng: place.lng,
                      isSaved: false
                    });
                  }}
                />

                {/* Quick select dropdown from saved addresses */}
                {savedAddresses.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Kayıtlılardan Seç:</span>
                    <select
                      id={`stop-saved-select-${stop.id}`}
                      className="text-xs bg-white text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 max-w-full truncate focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      value={stop.isSaved ? savedAddresses.find((a) => a.address === stop.address)?.id || '' : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleSelectFromSaved(stop.id, e.target.value);
                        }
                      }}
                    >
                      <option value="">-- Adres Filtrele --</option>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          {/* Limit / Provider Info Banner */}
          {validStops.length > 10 ? (
            <div className="bg-red-50/90 border border-red-200 text-red-950 rounded-xl p-3 text-xs leading-relaxed space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-red-900">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {validStops.length} Durak Eklendi (Yandex Navigasyon ile Sınırsız!)
              </span>
              <span className="text-[11px] text-red-900/90 block">
                Yandex Navigasyon ve Dahili Canlı Navigasyonumuzda durak sınırı yoktur; tüm duraklarınıza sınırsız ve kesintisiz rota oluşturulur.
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
              <span>Toplam Durak: <strong className="text-slate-700">{validStops.length}</strong></span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Yandex Navigasyon ile Sınırsız Durak
              </span>
            </div>
          )}

          {/* Action buttons inside list (Swap, Add stop) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              id="add-waypoint-btn"
              type="button"
              disabled={routeStops.length >= 100}
              onClick={handleAddWaypoint}
              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-all ${
                routeStops.length >= 100
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                  : 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer shadow-xs'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Durak Ekle ({routeStops.length})
            </button>

            <button
              id="swap-stops-btn"
              type="button"
              onClick={handleSwapStops}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-750 font-semibold bg-slate-50 hover:bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 transition-all cursor-pointer"
              title="Güzergahı Tersine Çevir"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Tersine Çevir
            </button>
          </div>
        </div>

        {/* Travel Mode Select */}
        <div className="border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold text-slate-500 block mb-2">Ulaşım Tercihi</span>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-150">
            {travelModesList.map(({ mode, label: modeLabel, icon: Icon }) => {
              const isActive = travelMode === mode;
              return (
                <button
                  id={`mode-button-${mode}`}
                  key={mode}
                  type="button"
                  onClick={() => setTravelMode(mode)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-100 font-semibold'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                  }`}
                  title={modeLabel}
                >
                  <Icon className="h-4.5 w-4.5 mb-1" />
                  <span className="text-[10px] sm:text-[11px] font-medium">{modeLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nearby unvisited locations from other groups */}
        {activeCoords.length > 0 && nearbySuggestions.length > 0 && (
          <div className="border-t border-slate-100 pt-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 block">Yakındaki Diğer Grup Konumları</span>
              <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">Öneri</span>
            </div>
            <div className="space-y-1.5">
              {nearbySuggestions.map(({ address, distance, closestTo }) => (
                <div 
                  key={address.id} 
                  className="flex items-center justify-between gap-2 p-2 border border-slate-100 rounded-lg hover:border-indigo-100 bg-slate-50/40 hover:bg-white transition-all text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700 truncate">{address.label}</span>
                      <span className="text-[9px] px-1 bg-indigo-50 text-indigo-600 font-medium rounded-sm">
                        {address.category || 'Genel'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[10px] truncate mt-0.5" title={address.address}>
                      {address.address}
                    </p>
                    <p className="text-[9px] text-indigo-600 font-semibold mt-0.5">
                      {distance.toFixed(1)} km ({closestTo} yakını)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddNearbyToRoute(address)}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-50 hover:bg-indigo-150 text-indigo-600 font-bold border border-indigo-200 transition-colors cursor-pointer shrink-0"
                    title="Rotaya Ekle"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Route Stats & Navigation Steps */}
        {isRouteConfigured && routeSummary ? (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            {/* Stats block */}
            <div className="grid grid-cols-2 gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 p-4 rounded-xl text-white shadow-md">
              <div>
                <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Toplam Mesafe</p>
                <p className="text-xl font-bold mt-0.5">{routeSummary.distance}</p>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Tahmini Süre</p>
                <p className="text-xl font-bold mt-0.5">{routeSummary.duration}</p>
              </div>
            </div>

            {/* Direct In-App Navigation Hero Card */}
            {onStartNavigation && (
              <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-xl border border-indigo-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                      <Navigation className="h-5 w-5 rotate-45 fill-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">Sistem İçi Canlı Navigasyon</h4>
                      <p className="text-[11px] text-indigo-200">Uygulama içinden sesli ve canlı GPS takibi</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-black px-2.5 py-1 rounded-full border border-emerald-500/40 animate-pulse">
                    CANLI GPS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    id="sidebar-start-gps-btn"
                    type="button"
                    onClick={() => onStartNavigation('GPS')}
                    className="flex items-center justify-center gap-2 py-3 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    title="Aracınızı canlı GPS konumuyla adım adım takip edin"
                  >
                    <Compass className="h-4.5 w-4.5 text-slate-950" />
                    Canlı GPS ile Başlat
                  </button>

                  <button
                    id="sidebar-start-sim-btn"
                    type="button"
                    onClick={() => onStartNavigation('SIMULATION')}
                    className="flex items-center justify-center gap-2 py-3 px-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/20 transition-all cursor-pointer"
                    title="Rotayı harita üzerinde simülasyon olarak oynatır"
                  >
                    <Play className="h-4 w-4 fill-current text-indigo-300" />
                    Simülasyon Önizleme
                  </button>
                </div>
              </div>
            )}

            {/* Step-by-step collapse instructions */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 block mb-2">Yol Tarifi Detayları ({routeSummary.steps.length} adım)</span>
              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto bg-slate-50/50">
                {routeSummary.steps.map((step, idx) => (
                  <div id={`nav-step-item-${idx}`} key={idx} className="p-3 text-xs text-slate-600 flex items-start gap-2.5">
                    <span className="h-5 w-5 bg-white border border-slate-200 text-slate-400 font-semibold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div dangerouslySetInnerHTML={{ __html: step.instruction }} className="leading-relaxed font-normal" />
                      <div className="flex gap-2.5 mt-1 text-[10px] text-slate-400">
                        <span>{step.distance}</span>
                        <span>•</span>
                        <span>{step.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isRouteConfigured ? (
          <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            Rota çiziliyor, lütfen bekleyin...
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="font-semibold text-slate-500">Güzergah Yok</p>
            <p className="mt-1 text-slate-400/80">Lütfen haritadan rota oluşturmak için hem Başlangıç hem de Varış noktası seçin.</p>
          </div>
        )}
      </div>

      {/* External Export & Share Section (Pure Yandex Navigator) */}
      {isRouteConfigured && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
          <button
            type="button"
            onClick={() => setShowExternalExport(!showExternalExport)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-red-600 transition-colors py-1 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span>Yandex Navigasyon ile Aç / Aktar (Sınırsız Durak)</span>
            </div>
            {showExternalExport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showExternalExport && (
            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
              {/* Info banner about Yandex Navigator unlimited stops */}
              <div className="p-2.5 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 text-[11px] text-slate-700 flex items-start gap-2.5 shadow-xs">
                <span className="text-lg shrink-0 leading-none">🔴</span>
                <div>
                  <p className="font-extrabold text-red-900">Yandex Navigasyon'da Durak Sınırı Yoktur!</p>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    Sisteminizdeki tüm <strong>{validStops.length} durak</strong> eksiksiz aktarılır ve tek tıkla rotanız başlatılır.
                  </p>
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div className="space-y-2">
                {/* Direct Switch to Mobile Field Tracker */}
                {onNavigateToTab && (
                  <button
                    id="open-field-tracker-action-btn"
                    type="button"
                    onClick={() => onNavigateToTab('field')}
                    className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border border-emerald-500 active:scale-[0.99] group mb-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📱</span>
                      <div className="text-left">
                        <div className="leading-tight">Mobil Saha Ziyaret Modunu Aç</div>
                        <div className="text-[10px] text-emerald-100 font-medium">Yandex linkleri, anlık notlar ve gidildi işaretleme</div>
                      </div>
                    </div>
                    <span className="bg-white/20 text-white text-[11px] px-2.5 py-1 rounded-lg font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">
                      {validStops.length} Firma →
                    </span>
                  </button>
                )}

                {/* Yandex Navigator Big Primary Button */}
                <a
                  id="send-yandex-nav-btn"
                  href={yandexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all text-center cursor-pointer border border-red-700 group active:scale-[0.99]"
                  title="Tüm durakları doğrudan Yandex Navigasyon uygulamasında açar."
                >
                  <Navigation className="h-4.5 w-4.5 fill-white shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Yandex Navigasyon'da Rotayı Başlat</span>
                  <span className="text-[10px] font-bold text-red-100 bg-red-800/80 px-2 py-0.5 rounded-full ml-1">
                    {validStops.length} Durak (Sınırsız) 🚀
                  </span>
                </a>

                {/* Yandex Link Copy Button */}
                <button
                  id="copy-yandex-link-btn"
                  type="button"
                  onClick={handleCopyYandexLink}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs hover:border-slate-300"
                >
                  {copiedYandex ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700 font-extrabold">Yandex Rota Linki Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-red-500" />
                      <span>Yandex Rota Linkini Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {/* QR Code Toggle Button */}
              <button
                id="send-phone-qr-btn"
                type="button"
                onClick={() => setShowQr(!showQr)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 border text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  showQr
                    ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                }`}
              >
                <QrCode className="h-4 w-4 text-red-500" />
                <span>{showQr ? 'QR Kodu Gizle' : 'Telefona Yandex QR Kod ile Aktar'}</span>
              </button>

              {/* QR Code Display Container (Pure Yandex) */}
              {showQr && (
                <div id="qr-display-container" className="pt-3 border-t border-slate-150 flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-slate-200 shadow-inner space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-100 py-1 px-3 rounded-full">
                    <span>🔴 Yandex Navigasyon QR Kodu</span>
                    <span className="text-[10px] text-red-800">({validStops.length} Durak Sınırsız)</span>
                  </div>

                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center">
                    Telefonunuzun kamerasıyla tarayın
                  </span>
                  
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(yandexUrl)}`}
                    alt="Yandex Route QR Code"
                    className="h-44 w-44 object-contain rounded-xl p-1.5 border border-slate-200 bg-white shadow-xs"
                    referrerPolicy="no-referrer"
                  />

                  <p className="text-[11px] text-slate-600 text-center font-medium leading-relaxed max-w-xs">
                    Bu karekod kameradan okutulduğunda rotadaki <strong className="text-red-600">tüm {validStops.length} durak</strong> eksiksiz olarak <strong>Yandex Navigasyon</strong> uygulamasında açılır.
                  </p>
                </div>
              )}

              {/* Yandex Bookmarks Export Button */}
              <button
                id="export-yandex-bookmarks-btn"
                type="button"
                onClick={() => setShowYandexExportModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition-all border border-red-200 cursor-pointer shadow-xs hover:border-red-300"
              >
                <Bookmark className="h-4 w-4 text-red-600 shrink-0" />
                <span>Konumları Yandex Haritalarım'a Aktar (.kml / .gpx)</span>
              </button>

              {/* PDF Report Download Button (Clean Company List) */}
              <button
                id="export-pdf-report-btn"
                type="button"
                disabled={isGeneratingPdf}
                onClick={exportRoutePDF}
                className="w-full flex items-center justify-center gap-2 py-3 px-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-75 disabled:cursor-wait text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer hover:shadow-lg active:scale-[0.99]"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                    <span>Firma Listesi Hazırlanıyor...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 shrink-0 text-indigo-200" />
                    <span>Firma Ziyaret Listesini PDF İndir (Sade Liste)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Yandex Export Modal */}
      <YandexExportModal
        isOpen={showYandexExportModal}
        onClose={() => setShowYandexExportModal(false)}
        savedAddresses={savedAddresses}
        routeStops={routeStops}
        initialMode="route"
      />
    </div>
  );
}
