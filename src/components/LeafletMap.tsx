import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteStop, SavedAddress, TravelMode, RouteSummary } from '../types';
import { 
  Compass, Loader2, MapPin, Navigation, Plus, Bookmark, HelpCircle,
  ArrowUp, CornerUpLeft, CornerUpRight, RotateCcw, Volume2, VolumeX,
  Play, Pause, ChevronRight, ChevronLeft, X, Flag, Eye, Check, Gauge, Target
} from 'lucide-react';

interface LeafletMapProps {
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  travelMode: TravelMode;
  routeSummary: RouteSummary | null;
  onSummaryCalculated: (summary: RouteSummary | null) => void;
  savedAddresses: SavedAddress[];
  onUpdateAddress?: (id: string, address: Omit<SavedAddress, 'id'>) => Promise<void>;
  onClearAllVisited?: () => Promise<void>;
  selectedAddressForMap: SavedAddress | null;
  onSaveClickedAddress: (address: { address: string; lat: number; lng: number }) => void;
  setActiveTab: (tab: 'route' | 'saved') => void;
  setMobileTab: (tab: 'route' | 'saved' | 'map') => void;
  mobileTab: 'route' | 'saved' | 'map';
  navigationTriggerCount?: number;
  initialNavMode?: 'GPS' | 'SIMULATION';
  onTriggerGroupCreation?: () => void;
}

export default function LeafletMap({
  routeStops,
  setRouteStops,
  travelMode,
  routeSummary,
  onSummaryCalculated,
  savedAddresses,
  onUpdateAddress,
  onClearAllVisited,
  selectedAddressForMap,
  onSaveClickedAddress,
  setActiveTab,
  setMobileTab,
  mobileTab,
  navigationTriggerCount,
  initialNavMode,
  onTriggerGroupCreation
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // States for interactive clicked point
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clickedAddress, setClickedAddress] = useState<string>('');
  const [clickedLabel, setClickedLabel] = useState<string>('');
  const [clickedSavedAddressId, setClickedSavedAddressId] = useState<string | null>(null);
  const [mapDeficiencyInput, setMapDeficiencyInput] = useState<string>('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Navigation & Live Simulation States
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [simulatedCoords, setSimulatedCoords] = useState<[number, number] | null>(null);
  const [currentCoordsIdx, setCurrentCoordsIdx] = useState<number>(0);
  const [simSpeed, setSimSpeed] = useState<number>(4); // default 4x speed
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const navigationMarkerRef = useRef<L.Marker | null>(null);

  // Live Vehicle Heading, Speed & Auto-follow Camera Tracking
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(true);
  const [navToast, setNavToast] = useState<{ message: string; type?: 'info' | 'success' | 'warning' } | null>(null);
  const [arrivedStop, setArrivedStop] = useState<RouteStop | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(1);
  const [confirmClearVisited, setConfirmClearVisited] = useState<boolean>(false);
  const lastRerouteTimeRef = useRef<number>(0);
  const prevCoordsRef = useRef<[number, number] | null>(null);
  const prevTimeRef = useRef<number>(0);
  const announcedStopsRef = useRef<Set<string>>(new Set());

  const showNavToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setNavToast({ message, type });
    setTimeout(() => setNavToast(null), 3500);
  };

  // Live GPS Tracking & Navigation Mode state
  const [navMode, setNavMode] = useState<'SIMULATION' | 'GPS'>('GPS');
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Group selection & filtering states on map
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  const validStops = routeStops.filter(s => s.lat !== 0 && s.lng !== 0);

  const availableCategories = Array.from(new Set(savedAddresses.map(addr => addr.category || 'Genel')));

  const getCategoryColor = (category?: string) => {
    const cat = category || 'Genel';
    switch (cat) {
      case 'Müşteriler': return '#ef4444'; // Red/Rose
      case 'Depolar': return '#06b6d4'; // Cyan
      case 'Ev/İş': return '#10b981'; // Emerald
      case 'Genel': return '#6366f1'; // Indigo
      default:
        let hash = 0;
        for (let i = 0; i < cat.length; i++) {
          hash = cat.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colors = ['#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7'];
        return colors[Math.abs(hash) % colors.length];
    }
  };

  const handleSelectGroupForRoute = (catName: string) => {
    const groupAddresses = savedAddresses.filter(addr => (addr.category || 'Genel') === catName && !addr.visited);
    if (groupAddresses.length === 0) {
      showNavToast(`"${catName}" grubundaki tüm adresler zaten 'Gidildi' olarak işaretlenmiş!`, "warning");
      return;
    }

    const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let sortedAddresses = [...groupAddresses];
    const existingOrigin = routeStops[0];
    const hasExistingOrigin = existingOrigin && existingOrigin.lat && existingOrigin.lng;

    if (hasExistingOrigin) {
      sortedAddresses.sort((a, b) => {
        const distA = getDistance(existingOrigin.lat!, existingOrigin.lng!, a.lat, a.lng);
        const distB = getDistance(existingOrigin.lat!, existingOrigin.lng!, b.lat, b.lng);
        return distA - distB;
      });
    } else {
      const center = mapInstanceRef.current ? mapInstanceRef.current.getCenter() : null;
      if (center) {
        sortedAddresses.sort((a, b) => {
          const distA = getDistance(center.lat, center.lng, a.lat, a.lng);
          const distB = getDistance(center.lat, center.lng, b.lat, b.lng);
          return distA - distB;
        });
      }
    }

    const newStops: RouteStop[] = [];

    if (hasExistingOrigin) {
      newStops.push({ ...existingOrigin });
      sortedAddresses.forEach((addr, idx) => {
        const isLast = idx === sortedAddresses.length - 1;
        newStops.push({
          id: isLast ? 'destination' : `waypoint-${Date.now()}-${idx}`,
          label: addr.label,
          address: addr.address,
          lat: addr.lat,
          lng: addr.lng,
          isSaved: true
        });
      });
    } else {
      sortedAddresses.forEach((addr, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === sortedAddresses.length - 1 && sortedAddresses.length > 1;
        
        let id = `waypoint-${Date.now()}-${idx}`;
        if (isFirst) id = 'origin';
        else if (isLast) id = 'destination';

        newStops.push({
          id,
          label: addr.label,
          address: addr.address,
          lat: addr.lat,
          lng: addr.lng,
          isSaved: true
        });
      });
    }

    if (!newStops.some(s => s.id === 'destination')) {
      newStops.push({ id: 'destination', label: '', address: '', lat: 0, lng: 0 });
    }

    setRouteStops(newStops);
    setActiveTab('route');
    setMobileTab('route');
  };

  // Custom marker icon creator (pure HTML & CSS, avoids Vite bundle asset errors)
  const createCustomMarkerIcon = (color: string, label: string, isStar = false, addressLabel?: string) => {
    const glyph = isStar ? '★' : label;
    const labelHtml = addressLabel ? `
      <span class="absolute bottom-full mb-1.5 bg-indigo-950/90 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-md border border-slate-700/30 whitespace-nowrap pointer-events-none tracking-wide text-center uppercase min-w-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        ${addressLabel}
      </span>
    ` : '';
    return L.divIcon({
      html: `
        <div class="relative flex flex-col items-center group">
          <!-- Floating label -->
          ${labelHtml}
          <!-- Marker pin body -->
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs text-white transition-transform duration-150 scale-100 group-hover:scale-110" style="background-color: ${color}">
            ${glyph}
          </div>
          <!-- Pin point shadow/arrow -->
          <div class="w-2.5 h-2.5 -mt-1.5 rotate-45 border-r border-b border-white shadow-md" style="background-color: ${color}"></div>
        </div>
      `,
      className: 'custom-leaflet-marker',
      iconSize: [32, 38],
      iconAnchor: [16, 38],
      popupAnchor: [0, -32]
    });
  };

  // Speaks an instruction aloud in Turkish using the Web Speech Synthesis API
  const speakInstruction = (text: string) => {
    if ('speechSynthesis' in window && voiceEnabled) {
      try {
        window.speechSynthesis.cancel(); // Clear any ongoing text readouts
        const cleanText = text.replace(/<[^>]*>/g, ''); // strip HTML tags if present in OSRM description
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'tr-TR';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("TTS SpeechSynthesis failed:", err);
      }
    }
  };

  // Selects appropriate maneuver icon based on turn keywords (sol, sağ, kavşak, vb.)
  const getManeuverIcon = (instruction: string) => {
    const text = (instruction || '').toLowerCase();
    if (text.includes('sol')) {
      return <CornerUpLeft className="h-7 w-7 text-indigo-400 shrink-0" />;
    }
    if (text.includes('sağ')) {
      return <CornerUpRight className="h-7 w-7 text-indigo-400 shrink-0" />;
    }
    if (text.includes('kavşak') || text.includes('döner')) {
      return <RotateCcw className="h-7 w-7 text-indigo-400 shrink-0" />;
    }
    if (text.includes('ulaştınız') || text.includes('hedef') || text.includes('varış') || text.includes('sonunda')) {
      return <Flag className="h-7 w-7 text-emerald-400 shrink-0 animate-bounce" />;
    }
    return <ArrowUp className="h-7 w-7 text-indigo-400 shrink-0 animate-pulse" />;
  };

  // Geo Helpers: Bearing, Distance & ETA
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  };

  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateEta = (durationStr?: string): string => {
    if (!durationStr) return '--:--';
    const match = durationStr.match(/(\d+)\s*dk/);
    const minutes = match ? parseInt(match[1], 10) : 0;
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  // Autonomous re-routing when user veers off course (> 80 meters)
  const triggerReroute = (currentLocation: [number, number]) => {
    lastRerouteTimeRef.current = Date.now();
    speakInstruction("Rotadan çıkıldı. Yeni rota hesaplanıyor.");
    showNavToast("Rotadan çıkıldı, yeni rota hesaplanıyor...", "warning");

    const remainingStops = validStops.slice(Math.max(1, currentStopIndex));
    if (remainingStops.length === 0) return;

    const rerouteStopsList = [
      {
        id: 'gps-live-origin',
        label: 'Mevcut Konum',
        address: 'Mevcut Konum',
        lat: currentLocation[0],
        lng: currentLocation[1]
      },
      ...remainingStops
    ];

    let osrmProfile = 'driving';
    if (travelMode === 'WALKING') osrmProfile = 'foot';
    else if (travelMode === 'BICYCLING') osrmProfile = 'bike';

    const coordinateString = rerouteStopsList.map(s => `${s.lng},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinateString}?overview=full&geometries=geojson&steps=true&languages=tr`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('OSRM rerouting failed');
        return res.json();
      })
      .then(data => {
        if (data && data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates;
          const pathLatLngs: [number, number][] = coordinates.map((coord: any) => [coord[1], coord[0]]);
          setRouteCoordinates(pathLatLngs);
          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(pathLatLngs);
          }

          const distanceM = route.distance || 0;
          const durationS = route.duration || 0;
          const totalDistance = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${Math.round(distanceM)} m`;
          const totalDuration = durationS >= 60 ? `${Math.round(durationS / 60)} dk` : `${Math.round(durationS)} sn`;

          const steps = route.legs?.flatMap((leg: any) => leg.steps || []).map((step: any) => {
            const dist = step.distance || 0;
            const dur = step.duration || 0;
            return {
              instruction: step.maneuver?.instruction || "Düz ilerleyin",
              distance: dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`,
              duration: dur >= 60 ? `${Math.round(dur / 60)} dk` : `${Math.round(dur)} sn`
            };
          }) || [];

          onSummaryCalculated({
            distance: totalDistance,
            duration: totalDuration,
            steps
          });

          setCurrentCoordsIdx(0);
          setCurrentStepIdx(0);
          if (steps[0]) {
            speakInstruction("Yeni rota hazır. " + steps[0].instruction);
          }
          showNavToast("Yeni rota oluşturuldu ✓", "success");
        }
      })
      .catch(err => {
        console.warn("Reroute fetch failed:", err);
      });
  };

  // Setup core Navigation Trigger actions
  const startNavigation = (mode: 'SIMULATION' | 'GPS' = 'GPS') => {
    if (routeCoordinates.length === 0) return;
    
    // Clear existing watch if active
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsNavigating(true);
    setNavMode(mode);
    setIsCameraLocked(true);
    setArrivedStop(null);
    setCurrentStopIndex(1);
    prevCoordsRef.current = null;
    prevTimeRef.current = Date.now();
    announcedStopsRef.current.clear();

    if (mode === 'GPS') {
      setIsSimulating(false);
      setIsGpsLoading(true);

      if (!navigator.geolocation) {
        showNavToast("Cihazınız GPS konum takibini desteklemiyor. Simülasyon moduna geçiliyor.", "warning");
        setNavMode('SIMULATION');
        setIsSimulating(true);
        setIsGpsLoading(false);
        startSimulationMode();
        return;
      }

      const successCallback = (position: GeolocationPosition) => {
        setIsGpsLoading(false);
        const { latitude, longitude, heading, speed } = position.coords;
        const userLoc: [number, number] = [latitude, longitude];
        setSimulatedCoords(userLoc);

        // Heading / Bearing calculation
        if (heading !== null && !isNaN(heading) && heading >= 0) {
          setCurrentHeading(heading);
        } else if (prevCoordsRef.current) {
          const distMoved = getDistanceMeters(prevCoordsRef.current[0], prevCoordsRef.current[1], latitude, longitude);
          if (distMoved >= 2.5) {
            const bearing = calculateBearing(prevCoordsRef.current[0], prevCoordsRef.current[1], latitude, longitude);
            setCurrentHeading(bearing);
          }
        }

        // Speed in km/h
        if (speed !== null && !isNaN(speed) && speed >= 0) {
          setCurrentSpeed(Math.round(speed * 3.6));
        } else if (prevCoordsRef.current && prevTimeRef.current) {
          const distMoved = getDistanceMeters(prevCoordsRef.current[0], prevCoordsRef.current[1], latitude, longitude);
          const timeSec = (Date.now() - prevTimeRef.current) / 1000;
          if (timeSec > 0 && distMoved > 1.5) {
            setCurrentSpeed(Math.round((distMoved / timeSec) * 3.6));
          }
        }

        prevCoordsRef.current = userLoc;
        prevTimeRef.current = Date.now();

        // Smooth camera follow
        if (isCameraLocked && mapInstanceRef.current) {
          mapInstanceRef.current.setView(userLoc, 17, { animate: true });
        }

        // Check arrival at upcoming stop
        const upcomingStop = validStops[currentStopIndex] || validStops[validStops.length - 1];
        if (upcomingStop && upcomingStop.lat && upcomingStop.lng) {
          const distToStop = getDistanceMeters(latitude, longitude, upcomingStop.lat, upcomingStop.lng);
          if (distToStop < 45 && !announcedStopsRef.current.has(upcomingStop.id)) {
            announcedStopsRef.current.add(upcomingStop.id);
            setArrivedStop(upcomingStop);
            speakInstruction(`${upcomingStop.label || 'Durağa'} ulaştınız!`);
            showNavToast(`${upcomingStop.label || 'Durağa'} ulaştınız!`, "success");
          }
        }

        // Find closest point in routeCoordinates
        if (routeCoordinates.length > 0) {
          let minDistance = Infinity;
          let closestIdx = 0;
          routeCoordinates.forEach((coord, idx) => {
            const dist = getDistanceMeters(coord[0], coord[1], latitude, longitude);
            if (dist < minDistance) {
              minDistance = dist;
              closestIdx = idx;
            }
          });

          setCurrentCoordsIdx(closestIdx);

          if (routeSummary && routeSummary.steps.length > 0) {
            const stepIdx = Math.min(
              routeSummary.steps.length - 1,
              Math.floor((closestIdx / routeCoordinates.length) * routeSummary.steps.length)
            );
            if (stepIdx !== currentStepIdx) {
              setCurrentStepIdx(stepIdx);
            }
          }

          // Off-route check (> 80 meters away from route and not rerouted in last 12s)
          if (minDistance > 80 && Date.now() - lastRerouteTimeRef.current > 12000) {
            triggerReroute(userLoc);
          }
        }
      };

      const errorCallback = (error: GeolocationPositionError) => {
        console.warn("GPS tracking error:", error);
        setIsGpsLoading(false);
        showNavToast("GPS sinyali bekleniyor veya izin gerekli. Simülasyon moduna geçiliyor.", "warning");
        setNavMode('SIMULATION');
        setIsSimulating(true);
        startSimulationMode();
      };

      // Watch user's live position with high accuracy
      const watchId = navigator.geolocation.watchPosition(successCallback, errorCallback, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000
      });
      watchIdRef.current = watchId;

      if (routeSummary && routeSummary.steps[0]) {
        speakInstruction("Canlı GPS navigasyonu başlatıldı. " + routeSummary.steps[0].instruction);
      }
    } else {
      // SIMULATION
      setIsSimulating(true);
      startSimulationMode();
    }
  };

  const startSimulationMode = () => {
    setCurrentCoordsIdx(0);
    setCurrentStepIdx(0);
    setSimulatedCoords(routeCoordinates[0]);
    setIsCameraLocked(true);
    setArrivedStop(null);
    setCurrentStopIndex(1);
    if (mapInstanceRef.current && routeCoordinates[0]) {
      mapInstanceRef.current.setView(routeCoordinates[0], 17, { animate: true });
    }
    if (routeCoordinates.length > 1) {
      const p1 = routeCoordinates[0];
      const p2 = routeCoordinates[1];
      setCurrentHeading(calculateBearing(p1[0], p1[1], p2[0], p2[1]));
    }
    if (routeSummary && routeSummary.steps[0]) {
      speakInstruction("Navigasyon simülasyonu başlatıldı. " + routeSummary.steps[0].instruction);
    }
  };

  const exitNavigation = () => {
    setIsNavigating(false);
    setIsSimulating(false);
    setSimulatedCoords(null);
    setCurrentCoordsIdx(0);
    setCurrentStepIdx(0);
    setArrivedStop(null);
    setCurrentSpeed(0);
    setIsCameraLocked(true);
    
    // Clear GPS watchPosition
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsLoading(false);

    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove();
      navigationMarkerRef.current = null;
    }
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleNextStep = () => {
    if (!routeSummary || currentStepIdx >= routeSummary.steps.length - 1) return;
    const nextStep = currentStepIdx + 1;
    setCurrentStepIdx(nextStep);
    const nextIdx = Math.floor((nextStep / routeSummary.steps.length) * routeCoordinates.length);
    setCurrentCoordsIdx(nextIdx);
    setSimulatedCoords(routeCoordinates[nextIdx]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(routeCoordinates[nextIdx], mapInstanceRef.current.getZoom(), { animate: true });
    }
  };

  const handlePrevStep = () => {
    if (currentStepIdx <= 0) return;
    const prevStep = currentStepIdx - 1;
    setCurrentStepIdx(prevStep);
    const prevIdx = Math.floor((prevStep / routeSummary.steps.length) * routeCoordinates.length);
    setCurrentCoordsIdx(prevIdx);
    setSimulatedCoords(routeCoordinates[prevIdx]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(routeCoordinates[prevIdx], mapInstanceRef.current.getZoom(), { animate: true });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center on Bursa, Turkey
    const map = L.map(mapContainerRef.current, {
      center: [40.1826, 29.0660],
      zoom: 12,
      zoomControl: false // Move zoom control to bottom-right or custom location
    });

    // OpenStreetMap Standard Tiles (100% free, reliable, no API key required)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 20,
      maxNativeZoom: 19
    }).addTo(map);

    // Humanitarian OpenStreetMap Tiles (Clean, high contrast street rendering)
    const hotLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, <a href="https://www.hotosm.org/" target="_blank" rel="noreferrer">HOT</a>',
      subdomains: 'abc',
      maxZoom: 20,
      maxNativeZoom: 19
    });

    // OpenTopoMap (Terrain / Topographic map)
    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a>',
      subdomains: 'abc',
      maxZoom: 17
    });

    // Layer switch control (allows switching map styles easily)
    L.control.layers({
      'Standart Harita (OSM)': osmLayer,
      'Ayrıntılı Sokak (HOT)': hotLayer,
      'Arazi / Topo': topoLayer
    }, undefined, { position: 'bottomright' }).addTo(map);

    // Custom Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create a group layer for markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    mapInstanceRef.current = map;

    // Listen to user map interactions to unlock camera auto-follow
    map.on('dragstart', () => {
      setIsCameraLocked(false);
    });

    // Listen to Map click events
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat, lng });
      setClickedAddress('Adres aranıyor...');
      setClickedLabel('');
      setIsReverseGeocoding(true);

      // Perform fast, completely free reverse geocoding via Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr`
        );
        if (!response.ok) throw new Error('OSM Reverse lookup failed');
        const data = await response.json();
        
        if (data && data.display_name) {
          setClickedAddress(data.display_name);
        } else {
          setClickedAddress(`Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      } catch (err) {
        console.warn("Reverse geocode failed:", err);
        setClickedAddress(`Seçilen Konum (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } finally {
        setIsReverseGeocoding(false);
      }
    });

    // Watch resizing using ResizeObserver (Constraint rule)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Trigger size invalidation when mobileTab changes (e.g. from hidden to visible)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Call once immediately
    map.invalidateSize();

    // Call after a small timeout to let CSS layout transitions settle
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [mobileTab]);

  // Update Markers and route plotting whenever stops or selectedAddress changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    // Clear previous markers
    markersGroup.clearLayers();

    const validStops = routeStops.filter(s => s.lat !== 0 && s.lng !== 0);

    // 1. Draw ALL Saved Address markers
    savedAddresses.forEach((addr) => {
      if (!addr.lat || !addr.lng || addr.lat === 0 || addr.lng === 0) return;
      const cat = addr.category || 'Genel';
      if (excludedCategories.includes(cat)) return; // Skip if filtered out on map

      const isSelected = selectedAddressForMap && selectedAddressForMap.id === addr.id;
      const isVisited = !!addr.visited;
      const markerGlyph = isVisited ? '✓' : '★';
      const markerColor = isVisited ? '#10b981' : addr.customRouteColor ? addr.customRouteColor : '#ef4444';
      const savedIcon = createCustomMarkerIcon(markerColor, markerGlyph, true, addr.label);
      const marker = L.marker([addr.lat, addr.lng], { icon: savedIcon });

      marker.bindPopup(`
        <div class="p-1 font-sans text-slate-800 min-w-[200px]">
          <p class="font-bold text-sm text-indigo-600 flex items-center justify-between gap-1">
            <span>${isVisited ? '✓' : '★'} ${addr.label}</span>
          </p>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide bg-slate-100 px-1 py-0.2 rounded">${cat}</span>
            <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isVisited ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${isVisited ? 'Gidildi ✓' : 'Gidilmedi ⏱'}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1.5">${addr.address}</p>
          ${addr.phone ? `<p class="text-xs text-slate-700 mt-1"><b>Tel:</b> ${addr.phone}</p>` : ''}
          ${addr.contactPerson ? `<p class="text-xs text-slate-700 mt-0.5"><b>Yetkili:</b> ${addr.contactPerson}</p>` : ''}
          ${addr.deficiencies ? `<p class="text-xs text-rose-600 font-semibold mt-1 bg-rose-50 p-1 rounded border border-rose-100"><b>Eksiklik:</b> ${addr.deficiencies}</p>` : ''}
        </div>
      `);

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        setClickedCoords({ lat: addr.lat, lng: addr.lng });
        setClickedAddress(addr.address);
        setClickedLabel(addr.label);
        setClickedSavedAddressId(addr.id);
        setMapDeficiencyInput(addr.deficiencies || '');
      });

      markersGroup.addLayer(marker);

      if (isSelected) {
        // Automatically open the popup for selected address
        setTimeout(() => {
          marker.openPopup();
        }, 150);
      }
    });

    // 2. Draw Active Route markers
    validStops.forEach((stop, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === validStops.length - 1;

      let color = '#3b82f6'; // intermediate blue
      let label = `${idx}`;

      if (isFirst) {
        color = '#10b981'; // origin green
        label = 'B';
      } else if (isLast) {
        color = '#ef4444'; // destination red
        label = 'V';
      }

      const icon = createCustomMarkerIcon(color, label);
      const marker = L.marker([stop.lat, stop.lng], { icon });

      const name = isFirst ? 'Başlangıç' : isLast ? 'Varış' : `${idx}. Durak`;
      marker.bindPopup(`
        <div class="p-1 font-sans text-slate-800">
          <p class="font-bold text-xs" style="color: ${color}">${name}: ${stop.label || 'Belirlenmemiş'}</p>
          <p class="text-[11px] text-slate-500 mt-1">${stop.address}</p>
        </div>
      `);

      markersGroup.addLayer(marker);
    });

    // 3. Draw Route Line from OSRM
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (validStops.length >= 2) {
      let osrmProfile = 'driving';
      if (travelMode === 'WALKING') {
        osrmProfile = 'foot';
      } else if (travelMode === 'BICYCLING') {
        osrmProfile = 'bike';
      }

      const coordinateString = validStops.map(s => `${s.lng},${s.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinateString}?overview=full&geometries=geojson&steps=true&languages=tr`;

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('OSRM routing request failed');
          return res.json();
        })
        .then(data => {
          if (data && data.routes && data.routes[0]) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates;

            // Convert OSRM GeoJSON coords [lng, lat] to Leaflet [lat, lng]
            const pathLatLngs = coordinates.map((coord: any) => [coord[1], coord[0]]);
            setRouteCoordinates(pathLatLngs);

            const polyline = L.polyline(pathLatLngs, {
              color: '#3b82f6',
              weight: 5,
              opacity: 0.8,
              lineJoin: 'round'
            }).addTo(map);

            routePolylineRef.current = polyline;

            // Fit bounds to show entire route
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

            // Package Route summary details to display in client panel
            const distanceM = route.distance || 0;
            const durationS = route.duration || 0;

            const totalDistance = distanceM >= 1000 
              ? `${(distanceM / 1000).toFixed(1)} km` 
              : `${Math.round(distanceM)} m`;

            const totalDuration = durationS >= 60 
              ? `${Math.round(durationS / 60)} dk` 
              : `${Math.round(durationS)} sn`;

            const steps = route.legs?.flatMap((leg: any) => leg.steps || []).map((step: any) => {
              const dist = step.distance || 0;
              const dur = step.duration || 0;
              const stepDist = dist >= 1000 
                ? `${(dist / 1000).toFixed(1)} km` 
                : `${Math.round(dist)} m`;
              const stepDur = dur >= 60 
                ? `${Math.round(dur / 60)} dk` 
                : `${Math.round(dur)} sn`;

              return {
                instruction: step.maneuver?.instruction || "Düz ilerleyin",
                distance: stepDist,
                duration: stepDur
              };
            }) || [];

            onSummaryCalculated({
              distance: totalDistance,
              duration: totalDuration,
              steps
            });
          } else {
            setRouteCoordinates([]);
            onSummaryCalculated(null);
          }
        })
        .catch(err => {
          console.warn("OSRM calculation failed:", err);
          setRouteCoordinates([]);
          onSummaryCalculated(null);
        });
    } else {
      setRouteCoordinates([]);
      onSummaryCalculated(null);
    }
  }, [routeStops, travelMode, selectedAddressForMap, savedAddresses, excludedCategories]);

  // explicitly center map only when a user selects an address from the list
  useEffect(() => {
    if (selectedAddressForMap && mapInstanceRef.current) {
      mapInstanceRef.current.setView([selectedAddressForMap.lat, selectedAddressForMap.lng], 14, { animate: true });
    }
  }, [selectedAddressForMap]);

  // Reset navigation when route stops change
  useEffect(() => {
    setIsNavigating(false);
    setIsSimulating(false);
    setSimulatedCoords(null);
    setCurrentCoordsIdx(0);
    setCurrentStepIdx(0);
    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.remove();
      navigationMarkerRef.current = null;
    }
  }, [routeStops]);

  // Manage Navigation Marker
  useEffect(() => {
    if (!isNavigating || !simulatedCoords || !mapInstanceRef.current) {
      if (navigationMarkerRef.current) {
        navigationMarkerRef.current.remove();
        navigationMarkerRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;

    // Create custom vehicle navigation arrow dynamically rotating with currentHeading
    const navIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute h-10 w-10 rounded-full bg-blue-500/30 animate-ping"></div>
          <div class="relative h-9 w-9 rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 border-2 border-white flex items-center justify-center shadow-2xl text-white transform transition-transform duration-200" style="transform: rotate(${currentHeading}deg);">
            <svg class="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      className: 'nav-vehicle-marker'
    });

    if (navigationMarkerRef.current) {
      navigationMarkerRef.current.setLatLng(simulatedCoords);
      navigationMarkerRef.current.setIcon(navIcon);
    } else {
      navigationMarkerRef.current = L.marker(simulatedCoords, { icon: navIcon }).addTo(map);
    }
  }, [isNavigating, simulatedCoords, currentHeading]);

  // Handle active simulation updates
  useEffect(() => {
    if (!isNavigating || !isSimulating || routeCoordinates.length === 0 || navMode !== 'SIMULATION') return;

    // Control speed tick rate dynamically based on simSpeed
    const intervalTime = Math.max(50, 400 / simSpeed);

    const timer = setTimeout(() => {
      if (currentCoordsIdx < routeCoordinates.length - 1) {
        const nextIdx = currentCoordsIdx + 1;
        setCurrentCoordsIdx(nextIdx);
        setSimulatedCoords(routeCoordinates[nextIdx]);

        // Calculate heading & simulated speed
        const p1 = routeCoordinates[currentCoordsIdx];
        const p2 = routeCoordinates[nextIdx];
        const heading = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
        setCurrentHeading(heading);
        setCurrentSpeed(Math.round(simSpeed * 10));

        // Smooth camera follow
        if (isCameraLocked && mapInstanceRef.current) {
          mapInstanceRef.current.setView(routeCoordinates[nextIdx], mapInstanceRef.current.getZoom(), { animate: true });
        }

        // Dynamically progress current instruction step proportionally to coordinate index
        if (routeSummary && routeSummary.steps.length > 0) {
          const stepIdx = Math.min(
            routeSummary.steps.length - 1,
            Math.floor((nextIdx / routeCoordinates.length) * routeSummary.steps.length)
          );
          if (stepIdx !== currentStepIdx) {
            setCurrentStepIdx(stepIdx);
          }
        }
      } else {
        // Reached destination end of coordinates!
        setIsSimulating(false);
        setCurrentSpeed(0);
        speakInstruction("Tebrikler, hedefinize ulaştınız!");
        showNavToast("Tebrikler, hedefinize ulaştınız! 🎉", "success");
      }
    }, intervalTime);

    return () => clearTimeout(timer);
  }, [isNavigating, isSimulating, currentCoordsIdx, routeCoordinates, simSpeed, currentStepIdx, routeSummary, navMode, isCameraLocked]);

  // Voice guidance prompt read-out on step changes
  useEffect(() => {
    if (isNavigating && routeSummary && routeSummary.steps[currentStepIdx]) {
      speakInstruction(routeSummary.steps[currentStepIdx].instruction);
    }
  }, [currentStepIdx, isNavigating]);

  // Listen to external navigation triggers from the sidebar
  useEffect(() => {
    if (navigationTriggerCount && navigationTriggerCount > 0 && routeCoordinates.length > 0) {
      startNavigation(initialNavMode || 'GPS'); // default to GPS for real live tracking!
    }
  }, [navigationTriggerCount, routeCoordinates, initialNavMode]);

  // Watch position clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Handle current location trigger
  const handleLocateUser = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        mapInstanceRef.current?.setView([latitude, longitude], 14, { animate: true });

        // Auto insert location into active origin if it is currently empty
        if (!routeStops[0].address) {
          // Perform Osm nominatim lookup to get textual address
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=tr`)
            .then(res => res.json())
            .then(data => {
              if (data && data.display_name) {
                setRouteStops([
                  {
                    id: 'origin',
                    label: 'Konumunuz',
                    address: data.display_name,
                    lat: latitude,
                    lng: longitude
                  },
                  ...routeStops.slice(1)
                ]);
              }
            })
            .catch(err => {
              console.warn("Locate reverse lookup failed:", err);
            });
        }
      },
      (error) => {
        setIsLocating(false);
        console.warn("Geolocation coordinate request denied:", error);
      }
    );
  };

  // Actions for the clicked map location popup
  const handleSetAsOrigin = () => {
    if (!clickedCoords) return;
    const updated = [...routeStops];
    updated[0] = {
      id: 'origin',
      label: clickedLabel || 'Haritadan Seçilen Nokta',
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    };
    setRouteStops(updated);
    setClickedCoords(null);
    setClickedLabel('');
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleSetAsDestination = () => {
    if (!clickedCoords) return;
    const updated = [...routeStops];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      id: 'destination',
      label: clickedLabel || 'Haritadan Seçilen Nokta',
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    };
    setRouteStops(updated);
    setClickedCoords(null);
    setClickedLabel('');
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleAddAsWaypoint = () => {
    if (!clickedCoords) return;
    const newId = `waypoint-${Date.now()}`;
    const newWaypoint: RouteStop = {
      id: newId,
      label: clickedLabel || 'Haritadan Seçilen Durak',
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    };
    const updated = [...routeStops];
    updated.splice(routeStops.length - 1, 0, newWaypoint); // insert before destination
    setRouteStops(updated);
    setClickedCoords(null);
    setClickedLabel('');
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleSaveToAddressBook = () => {
    if (!clickedCoords) return;
    onSaveClickedAddress({
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    });
    setClickedCoords(null);
    setActiveTab('saved');
    setMobileTab('saved');
  };

  const handleQuickAddToRoute = () => {
    if (!clickedCoords) return;
    const updated = [...routeStops];
    const origin = updated.find(s => s.id === 'origin');
    const destination = updated.find(s => s.id === 'destination');

    const labelVal = clickedLabel || 'Haritadan Seçilen Nokta';
    
    const isOriginEmpty = !origin || !origin.lat || origin.lat === 0;
    const isDestinationEmpty = !destination || !destination.lat || destination.lat === 0;

    if (isOriginEmpty) {
      const origIdx = updated.findIndex(s => s.id === 'origin');
      const stop = {
        id: 'origin',
        label: labelVal,
        address: clickedAddress,
        lat: clickedCoords.lat,
        lng: clickedCoords.lng
      };
      if (origIdx !== -1) {
        updated[origIdx] = stop;
      } else {
        updated.unshift(stop);
      }
    } else if (isDestinationEmpty) {
      const destIdx = updated.findIndex(s => s.id === 'destination');
      const stop = {
        id: 'destination',
        label: labelVal,
        address: clickedAddress,
        lat: clickedCoords.lat,
        lng: clickedCoords.lng
      };
      if (destIdx !== -1) {
        updated[destIdx] = stop;
      } else {
        updated.push(stop);
      }
    } else {
      const newId = `waypoint-${Date.now()}`;
      const newWaypoint: RouteStop = {
        id: newId,
        label: labelVal,
        address: clickedAddress,
        lat: clickedCoords.lat,
        lng: clickedCoords.lng
      };
      const destIdx = updated.findIndex(s => s.id === 'destination');
      if (destIdx !== -1) {
        updated.splice(destIdx, 0, newWaypoint);
      } else {
        updated.push(newWaypoint);
      }
    }

    setRouteStops(updated);
    setClickedCoords(null);
    setClickedLabel('');
    setActiveTab('route');
    setMobileTab('route');
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map HTML Canvas container */}
      <div id="leaflet-map-canvas" ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Group Control Panel - top-left */}
      {!isNavigating && (
        <div className="absolute top-4 left-12 md:left-14 z-[1000] max-w-[240px] xs:max-w-xs animate-in slide-in-from-left-5 duration-200">
          {showCategoryPanel ? (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/80 p-3.5 flex flex-col gap-2.5 max-h-[320px] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider select-none">
                  <Bookmark className="h-4 w-4 text-indigo-600 fill-indigo-100/40" />
                  Grup Yönetimi
                </span>
                <div className="flex items-center gap-1.5">
                  {onTriggerGroupCreation && (
                    <button
                      type="button"
                      onClick={onTriggerGroupCreation}
                      className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1 rounded-lg transition-all cursor-pointer"
                      title="Yeni Grup Oluştur"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCategoryPanel(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                    title="Grubu Gizle"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {availableCategories.length === 0 ? (
                <div className="text-[11px] text-slate-400 font-medium py-3 text-center">
                  Adres defterinde henüz gruplandırılmış adresiniz bulunmamaktadır.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-extrabold tracking-wide mb-1 select-none">
                    <span>GÖSTER</span>
                    <span>GRUP / HIZLI ROTA</span>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    {availableCategories.map((cat) => {
                      const isExcluded = excludedCategories.includes(cat);
                      const groupAddresses = savedAddresses.filter(addr => (addr.category || 'Genel') === cat);
                      const color = getCategoryColor(cat);
                      
                      return (
                        <div key={cat} className="flex items-center justify-between gap-3 py-1 px-1.5 hover:bg-slate-50/80 rounded-lg transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Toggle visibility checkbox */}
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => {
                                if (isExcluded) {
                                  setExcludedCategories(prev => prev.filter(c => c !== cat));
                                } else {
                                  setExcludedCategories(prev => [...prev, cat]);
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                              title={isExcluded ? "Haritada Göster" : "Haritadan Gizle"}
                            />
                            <span 
                              className="h-2 w-2 rounded-full shrink-0" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-bold text-slate-700 truncate" title={`${cat} (${groupAddresses.length} Adres)`}>
                              {cat}
                            </span>
                            <span className="text-[9px] text-slate-400 font-extrabold bg-slate-100 px-1 py-0.2 rounded-md">
                              {groupAddresses.length}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectGroupForRoute(cat)}
                            className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md border border-indigo-200 transition-all cursor-pointer whitespace-nowrap shrink-0 hover:shadow-xs"
                            title="Bu grubun tüm adreslerini en yakından en uzağa rota haline getirir"
                          >
                            Rota Çiz
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCategoryPanel(true)}
              className="bg-white/95 backdrop-blur-sm hover:bg-slate-50 border border-slate-200/80 text-slate-700 py-2 px-3 rounded-xl shadow-md transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer select-none"
              title="Grup Yönetim Panelini Aç"
            >
              <Bookmark className="h-4 w-4 text-indigo-600 fill-indigo-100/30" />
              <span>Grupları Yönet</span>
            </button>
          )}
        </div>
      )}

      {/* In-App Toast Notification */}
      {navToast && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[1002] px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-black flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200 select-none ${
          navToast.type === 'warning' ? 'bg-amber-950/95 text-amber-200 border-amber-700/80' :
          navToast.type === 'success' ? 'bg-emerald-950/95 text-emerald-200 border-emerald-700/80' :
          'bg-slate-950/95 text-slate-100 border-slate-700/80'
        }`}>
          <span className={`h-2.5 w-2.5 rounded-full ${
            navToast.type === 'warning' ? 'bg-amber-400 animate-ping' :
            navToast.type === 'success' ? 'bg-emerald-400' : 'bg-blue-400'
          }`} />
          <span>{navToast.message}</span>
        </div>
      )}

      {/* Floating Action Panels overlayed on top of map */}
      {!isNavigating && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col sm:flex-row gap-2">
          {onClearAllVisited && (
            <button
              id="clear-all-visited-map-btn"
              type="button"
              onClick={() => setConfirmClearVisited(true)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer"
              title="Tüm Gidildi İşaretlerini Temizle"
            >
              <RotateCcw className="h-4.5 w-4.5 text-amber-500" />
              İşaretleri Temizle
            </button>
          )}

          {routeCoordinates.length > 0 && (
            <button
              id="start-navigation-overlay-btn"
              type="button"
              onClick={() => startNavigation('GPS')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 px-3.5 rounded-xl shadow-lg transition-all flex items-center gap-2 font-black text-xs cursor-pointer animate-pulse hover:scale-105"
              title="Sistem İçi Canlı GPS Navigasyonunu Başlat"
            >
              <Navigation className="h-4 w-4 text-white fill-white rotate-45" />
              Canlı GPS Navigasyon
            </button>
          )}

          <button
            id="leaflet-locate-me-btn"
            type="button"
            onClick={handleLocateUser}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer"
            title="Konumumu Bul ve Rota Başlangıcı Yap"
          >
            {isLocating ? (
              <Loader2 className="h-4.5 w-4.5 text-blue-500 animate-spin" />
            ) : (
              <Compass className="h-4.5 w-4.5 text-blue-500" />
            )}
            Konumumu Bul
          </button>
        </div>
      )}

      {/* Live Speedometer & Trip HUD floating widget */}
      {isNavigating && routeSummary && (
        <div className="absolute top-24 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
          {/* Speedometer badge */}
          <div className="bg-slate-950/90 backdrop-blur-md text-white border border-slate-800 rounded-2xl p-2.5 px-3.5 shadow-xl flex items-center gap-2.5 select-none">
            <div className="h-8 w-8 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <Gauge className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white">{currentSpeed}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">km/s</span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold block -mt-1">
                {navMode === 'GPS' ? 'Canlı Hız' : 'Simülasyon'}
              </span>
            </div>
          </div>

          {/* ETA / Arrival Time badge */}
          <div className="bg-slate-950/90 backdrop-blur-md text-white border border-slate-800 rounded-xl py-1.5 px-3 shadow-xl flex items-center gap-2 text-xs font-extrabold select-none">
            <span className="text-[10px] text-emerald-400 font-black">VARIŞ</span>
            <span className="text-white text-sm">{calculateEta(routeSummary.duration)}</span>
          </div>
        </div>
      )}

      {/* Floating Recenter Camera Follow Button */}
      {isNavigating && !isCameraLocked && (
        <button
          id="recenter-camera-btn"
          type="button"
          onClick={() => {
            setIsCameraLocked(true);
            if (simulatedCoords && mapInstanceRef.current) {
              mapInstanceRef.current.setView(simulatedCoords, 17, { animate: true });
            }
          }}
          className="absolute bottom-36 right-4 z-[1000] bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-black text-xs cursor-pointer animate-in fade-in transition-all hover:scale-105 active:scale-95"
        >
          <Target className="h-4 w-4 text-indigo-600 animate-spin" />
          <span>Aracı Takip Et</span>
        </button>
      )}

      {/* Stop Arrival Action HUD card */}
      {isNavigating && arrivedStop && (
        <div className="absolute top-24 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-[1002] bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-400 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-full bg-emerald-500/30 flex items-center justify-center border border-emerald-300/40 text-emerald-300 shrink-0">
                <MapPin className="h-6 w-6 text-emerald-300 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Hedefe Ulaşıldı!</span>
                <h4 className="font-extrabold text-sm text-white line-clamp-1">{arrivedStop.label || 'Durak'}</h4>
                <p className="text-[11px] text-emerald-200 line-clamp-1">{arrivedStop.address}</p>
              </div>
            </div>
            <button
              onClick={() => setArrivedStop(null)}
              className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-emerald-800/80 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const matchedSaved = savedAddresses.find(a => 
                  (a.label === arrivedStop.label && a.address === arrivedStop.address) ||
                  (Math.abs(a.lat - arrivedStop.lat) < 0.0001 && Math.abs(a.lng - arrivedStop.lng) < 0.0001)
                );
                const todayStr = new Date().toISOString().split('T')[0];
                if (matchedSaved && onUpdateAddress) {
                  const { id, ...rest } = matchedSaved;
                  await onUpdateAddress(id, {
                    ...rest,
                    visited: true,
                    lastVisitedDate: todayStr
                  });
                }
                speakInstruction("Ziyaret kaydedildi. Sonraki durağa yönlendiriliyorsunuz.");
                showNavToast(`${arrivedStop.label} ziyaret edildi olarak kaydedildi ✓`, "success");
                setArrivedStop(null);
                setCurrentStopIndex(prev => prev + 1);
              }}
              className="flex-1 py-2.5 px-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              Ziyaret Edildi Olarak Kaydet ✓
            </button>
            <button
              type="button"
              onClick={() => {
                setArrivedStop(null);
                setCurrentStopIndex(prev => prev + 1);
              }}
              className="py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Sonraki Durak
            </button>
          </div>
        </div>
      )}

      {/* Top Banner Navigation Guidance HUD */}
      {isNavigating && routeSummary && routeSummary.steps[currentStepIdx] && (
        <div id="navigation-top-banner" className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-xl bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl border border-slate-800 z-[1001] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-350">
          {/* Maneuver Icon */}
          <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center shrink-0 border border-white/10">
            {getManeuverIcon(routeSummary.steps[currentStepIdx].instruction)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-indigo-400 tracking-wider uppercase">
                {routeSummary.steps[currentStepIdx].distance} Sonra
              </span>
              {validStops[currentStopIndex] && (
                <span className="text-[10px] font-bold text-slate-400 truncate">
                  • Sıradaki: {validStops[currentStopIndex].label || 'Durak'}
                </span>
              )}
            </div>
            <h3 
              className="text-white text-sm sm:text-base font-bold leading-relaxed mt-0.5"
              dangerouslySetInnerHTML={{ __html: routeSummary.steps[currentStepIdx].instruction }}
            />
          </div>

          <button
            id="exit-nav-top-btn"
            onClick={exitNavigation}
            className="p-1.5 text-white/40 hover:text-white/85 bg-white/5 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
            title="Navigasyondan Çık"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Bottom HUD Player Guidance controls */}
      {isNavigating && routeSummary && (
        <div id="navigation-bottom-panel" className="absolute bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-xl bg-white/95 backdrop-blur-md text-slate-800 p-4 rounded-2xl shadow-xl border border-slate-200 z-[1001] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-350">
          
          {/* Mode Switcher Tab Bar */}
          <div className="flex border border-slate-150 rounded-xl p-0.5 bg-slate-50">
            <button
              id="toggle-navmode-gps-btn"
              type="button"
              onClick={() => {
                startNavigation('GPS');
              }}
              className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                navMode === 'GPS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Navigation className="h-3 w-3 rotate-45 text-current fill-current" />
              Canlı GPS Modu
            </button>
            <button
              id="toggle-navmode-sim-btn"
              type="button"
              onClick={() => {
                startNavigation('SIMULATION');
              }}
              className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer text-center ${
                navMode === 'SIMULATION'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Simülasyon Önizleme
            </button>
          </div>

          {/* Summary Row */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kalan Rota Özeti</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-extrabold text-slate-950">{routeSummary.duration}</span>
                <span className="text-sm font-semibold text-slate-500">({routeSummary.distance})</span>
              </div>
            </div>

            <button
              id="voice-toggle-nav-btn"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                voiceEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}
              title={voiceEnabled ? "Sesli Yol Tarifi Açık" : "Sesli Yol Tarifi Kapalı"}
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className="h-4 w-4 shrink-0" />
                  <span>Ses Açık</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4 shrink-0" />
                  <span>Sessiz</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1">
              <button
                id="prev-step-nav-btn"
                onClick={handlePrevStep}
                disabled={currentStepIdx <= 0}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Önceki Adım"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150 whitespace-nowrap">
                Adım {currentStepIdx + 1} / {routeSummary.steps.length}
              </span>

              <button
                id="next-step-nav-btn"
                onClick={handleNextStep}
                disabled={currentStepIdx >= routeSummary.steps.length - 1}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Sonraki Adım"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {navMode === 'GPS' ? (
              <div className="flex items-center gap-2">
                {isGpsLoading ? (
                  <span className="text-xs text-amber-600 font-semibold animate-pulse flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    GPS Aranıyor...
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                    GPS Sinyali Aktif
                  </span>
                )}
                
                <button
                  id="recenter-gps-btn"
                  type="button"
                  onClick={() => {
                    setIsCameraLocked(true);
                    if (simulatedCoords && mapInstanceRef.current) {
                      mapInstanceRef.current.setView(simulatedCoords, 17, { animate: true });
                    }
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-[11px] font-extrabold text-slate-700 transition-all cursor-pointer flex items-center gap-1"
                  title="Haritayı konumunuza ortalayın"
                >
                  <Compass className="h-3.5 w-3.5 text-indigo-500" />
                  Ortala
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  id="speed-toggle-nav-btn"
                  onClick={() => {
                    const speeds = [1, 3, 8, 15];
                    const currentIdx = speeds.indexOf(simSpeed);
                    const nextIdx = (currentIdx + 1) % speeds.length;
                    setSimSpeed(speeds[nextIdx]);
                  }}
                  className="px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-[11px] font-extrabold text-slate-700 transition-all cursor-pointer min-w-[55px] text-center"
                  title="Simülasyon Hızı"
                >
                  {simSpeed}x Hız
                </button>

                <button
                  id="play-pause-nav-btn"
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl shadow-xs transition-all border cursor-pointer ${
                    isSimulating
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <Pause className="h-4 w-4 shrink-0 fill-current" />
                      <span>Durdur</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 shrink-0 fill-current" />
                      <span>Oynat</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Clear Visited Modal */}
      {confirmClearVisited && (
        <div className="absolute inset-0 z-[1050] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm">Ziyaret İşaretlerini Temizle</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Haritadaki tüm 'Gidildi ✓' işaretleri sıfırlanacak. (Son ziyaret tarihleri silinmez). Devam etmek istiyor musunuz?
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearVisited(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmClearVisited(false);
                  if (onClearAllVisited) await onClearAllVisited();
                  showNavToast("Tüm ziyaret işaretleri temizlendi ✓", "success");
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Evet, Temizle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Map Click Context Menu overlay */}
      {clickedCoords && (() => {
        const matchedSavedAddress = savedAddresses.find(a => 
          (clickedSavedAddressId && a.id === clickedSavedAddressId) ||
          (clickedLabel && a.label === clickedLabel) ||
          (Math.abs(a.lat - clickedCoords.lat) < 0.0001 && Math.abs(a.lng - clickedCoords.lng) < 0.0001)
        );

        return (
          <div 
            id="map-click-overlay-card"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-2xl shadow-xl border border-slate-200 p-4 w-[92%] max-w-sm mx-auto flex flex-col gap-3 transition-all duration-200 animate-in slide-in-from-bottom-5"
          >
            {/* Geocoding Info */}
            <div className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 text-indigo-600 mt-0.5">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {clickedLabel ? `Kayıtlı Adres: ${clickedLabel}` : 'Haritadan Seçilen Nokta'}
                  </span>
                  {matchedSavedAddress && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${matchedSavedAddress.visited ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {matchedSavedAddress.visited ? 'Gidildi ✓' : 'Gidilmedi ⏱'}
                    </span>
                  )}
                </div>
                <p className="text-slate-800 text-xs font-semibold leading-relaxed line-clamp-2 mt-0.5" title={clickedAddress}>
                  {clickedAddress}
                </p>
                {matchedSavedAddress?.phone && (
                  <p className="text-xs text-indigo-700 font-semibold mt-1">
                    <b>Tel:</b> <a href={`tel:${matchedSavedAddress.phone}`} className="hover:underline">{matchedSavedAddress.phone}</a>
                    {matchedSavedAddress.contactPerson && <span className="ml-2 text-slate-600 font-normal">({matchedSavedAddress.contactPerson})</span>}
                  </p>
                )}
                {isReverseGeocoding && (
                  <span className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                    <Loader2 className="h-3 w-3 animate-spin inline" /> Adres sorgulanıyor...
                  </span>
                )}
              </div>
            </div>

            {/* If a saved address is selected, show Visited toggle & Deficiencies editor */}
            {matchedSavedAddress && onUpdateAddress && (
              <div className="space-y-2 border-t border-slate-100 pt-2.5">
                {/* Visited Status Toggle */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Ziyaret Durumu:</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const { id, ...rest } = matchedSavedAddress;
                      const nextVisited = !matchedSavedAddress.visited;
                      const todayStr = new Date().toISOString().split('T')[0];
                      await onUpdateAddress(id, {
                        ...rest,
                        visited: nextVisited,
                        lastVisitedDate: nextVisited ? todayStr : matchedSavedAddress.lastVisitedDate
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                      matchedSavedAddress.visited
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                    }`}
                  >
                    {matchedSavedAddress.visited ? '✓ Gidildi (Değiştir: Gidilmedi yap)' : '⏱ Gidildi Olarak İşaretle'}
                  </button>
                </div>

                {/* Deficiencies quick editor */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-600">Eksiklik / İhtiyaç:</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={mapDeficiencyInput}
                      onChange={(e) => setMapDeficiencyInput(e.target.value)}
                      placeholder="Eksiklik veya ihtiyaç yazın..."
                      className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const { id, ...rest } = matchedSavedAddress;
                        await onUpdateAddress(id, {
                          ...rest,
                          deficiencies: mapDeficiencyInput.trim()
                        });
                        showNavToast("Eksiklik başarıyla kaydedildi!", "success");
                      }}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>
            )}
 
            {/* Quick Add To Route Button */}
            {(() => {
              const isAlreadyInRoute = routeStops.some(s => 
                s.lat !== 0 && Math.abs(s.lat - clickedCoords.lat) < 0.0001 && Math.abs(s.lng - clickedCoords.lng) < 0.0001
              );
              
              if (isAlreadyInRoute) {
                return (
                  <button
                    id="click-action-quick-remove"
                    onClick={() => {
                      const updated = routeStops.map(s => {
                        if (Math.abs(s.lat - clickedCoords.lat) < 0.0001 && Math.abs(s.lng - clickedCoords.lng) < 0.0001) {
                           if (s.id === 'origin' || s.id === 'destination') {
                             return { ...s, address: '', label: '', lat: 0, lng: 0 };
                           }
                           return null;
                        }
                        return s;
                      }).filter(Boolean) as RouteStop[];
                      setRouteStops(updated);
                      setClickedCoords(null);
                      setClickedLabel('');
                    }}
                    disabled={isReverseGeocoding}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-600 bg-rose-50 text-rose-700 font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer hover:shadow-lg hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Bookmark className="h-4 w-4 shrink-0 fill-rose-700" />
                    Planlayıcıya Eklendi ✓ (Çıkar)
                  </button>
                );
              }
              
              return (
                <button
                  id="click-action-quick-add"
                  onClick={handleQuickAddToRoute}
                  disabled={isReverseGeocoding}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer hover:shadow-lg disabled:opacity-50"
                >
                  <Navigation className="h-4 w-4 shrink-0 rotate-45 fill-white" />
                  Rota Planlayıcıya Ekle
                </button>
              );
            })()}

            {/* Custom Route Color Picker for Saved Addresses */}
            {matchedSavedAddress && onUpdateAddress && (
              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Özel Rota Grubuna Ata</span>
                <div className="flex gap-2 items-center justify-between">
                  {[
                    { label: 'Sarı Rota', value: '#eab308' },
                    { label: 'Mavi Rota', value: '#3b82f6' }
                  ].map(c => (
                    <button
                      key={c.value}
                      onClick={async () => {
                        const { id, ...rest } = matchedSavedAddress;
                        await onUpdateAddress(id, { ...rest, customRouteColor: matchedSavedAddress.customRouteColor === c.value ? '' : c.value });
                        // Update local state if needed or rely on parent rerender
                        setClickedCoords(null);
                        setClickedLabel('');
                      }}
                      className={`w-6 h-6 rounded-full shadow-sm hover:scale-110 transition-transform ${matchedSavedAddress.customRouteColor === c.value ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                  {matchedSavedAddress.customRouteColor && (
                    <button 
                      onClick={async () => {
                        const { id, ...rest } = matchedSavedAddress;
                        await onUpdateAddress(id, { ...rest, customRouteColor: '' });
                        setClickedCoords(null);
                        setClickedLabel('');
                      }}
                      className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg"
                    >
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Location Actions Menu Grid */}
            <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Gelişmiş Durak Seçenekleri</span>
              <div className={`grid ${clickedLabel ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                <button
                  id="click-action-start"
                  onClick={handleSetAsOrigin}
                  disabled={isReverseGeocoding}
                  className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] sm:text-xs transition-colors cursor-pointer"
                  title="Yolculuk başlangıç noktası olarak ayarla"
                >
                  <Navigation className="h-3 w-3 shrink-0" />
                  Başlangıç
                </button>
                <button
                  id="click-action-dest"
                  onClick={handleSetAsDestination}
                  disabled={isReverseGeocoding}
                  className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] sm:text-xs transition-colors cursor-pointer"
                  title="Yolculuk bitiş noktası olarak ayarla"
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  Varış Yap
                </button>
                <button
                  id="click-action-waypoint"
                  onClick={handleAddAsWaypoint}
                  disabled={isReverseGeocoding}
                  className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] sm:text-xs transition-colors cursor-pointer"
                  title="Ara durak olarak ekle"
                >
                  <Plus className="h-3 w-3 shrink-0" />
                  Durak Ekle
                </button>
                {!clickedLabel && (
                  <button
                    id="click-action-save"
                    onClick={handleSaveToAddressBook}
                    disabled={isReverseGeocoding}
                    className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] sm:text-xs transition-colors cursor-pointer"
                  >
                    <Bookmark className="h-3 w-3 shrink-0" />
                    Kaydet
                  </button>
                )}
              </div>
            </div>
   
            {/* Close Action Overlay trigger */}
            <button
              id="click-action-close"
              onClick={() => {
                setClickedCoords(null);
                setClickedLabel('');
                setClickedSavedAddressId(null);
              }}
              className="text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors pt-1"
            >
              Vazgeç / Kapat
            </button>
          </div>
        );
      })()}

      {/* Mini user notification guide overlay */}
      {!isNavigating && (
        <div className="absolute bottom-4 left-4 z-[900] bg-slate-950/85 backdrop-blur text-white py-1.5 px-3 rounded-full text-[10px] font-semibold tracking-wide flex items-center gap-1.5 border border-slate-850 shadow-lg select-none">
          <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
          <span>Harita üzerinde herhangi bir yere tıklayarak adres kaydedebilir veya rota çizebilirsiniz.</span>
        </div>
      )}
    </div>
  );
}
