import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteStop, SavedAddress, TravelMode, RouteSummary } from '../types';
import { Compass, Loader2, MapPin, Navigation, Plus, Bookmark, HelpCircle } from 'lucide-react';

interface LeafletMapProps {
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  travelMode: TravelMode;
  routeSummary: RouteSummary | null;
  onSummaryCalculated: (summary: RouteSummary | null) => void;
  savedAddresses: SavedAddress[];
  selectedAddressForMap: SavedAddress | null;
  onSaveClickedAddress: (address: { address: string; lat: number; lng: number }) => void;
  setActiveTab: (tab: 'route' | 'saved') => void;
  setMobileTab: (tab: 'route' | 'saved' | 'map') => void;
  mobileTab: 'route' | 'saved' | 'map';
}

export default function LeafletMap({
  routeStops,
  setRouteStops,
  travelMode,
  routeSummary,
  onSummaryCalculated,
  savedAddresses,
  selectedAddressForMap,
  onSaveClickedAddress,
  setActiveTab,
  setMobileTab,
  mobileTab
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // States for interactive clicked point
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clickedAddress, setClickedAddress] = useState<string>('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Custom marker icon creator (pure HTML & CSS, avoids Vite bundle asset errors)
  const createCustomMarkerIcon = (color: string, label: string, isStar = false) => {
    const glyph = isStar ? '★' : label;
    return L.divIcon({
      html: `
        <div class="relative flex flex-col items-center group">
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

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center on Bursa, Turkey
    const map = L.map(mapContainerRef.current, {
      center: [40.1826, 29.0660],
      zoom: 12,
      zoomControl: false // Move zoom control to bottom-right or custom location
    });

    // Add CartoDB Voyager tiles (Modern, neutral, light-mode, 100% free)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Custom Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create a group layer for markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    mapInstanceRef.current = map;

    // Listen to Map click events
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat, lng });
      setClickedAddress('Adres aranıyor...');
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

    // 1. Draw Saved Address marker if selected from Address list
    if (selectedAddressForMap) {
      const savedIcon = createCustomMarkerIcon('#6366f1', '★', true);
      const marker = L.marker([selectedAddressForMap.lat, selectedAddressForMap.lng], { icon: savedIcon });
      
      marker.bindPopup(`
        <div class="p-1 font-sans text-slate-800">
          <p class="font-bold text-sm text-indigo-600 flex items-center gap-1">★ ${selectedAddressForMap.label}</p>
          <p class="text-xs text-slate-500 mt-1">${selectedAddressForMap.address}</p>
        </div>
      `);
      
      markersGroup.addLayer(marker);
      map.setView([selectedAddressForMap.lat, selectedAddressForMap.lng], 14, { animate: true });
    }

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
            onSummaryCalculated(null);
          }
        })
        .catch(err => {
          console.warn("OSRM calculation failed:", err);
          onSummaryCalculated(null);
        });
    } else {
      onSummaryCalculated(null);
      // Zoom to fit existing stops or markers if available
      if (validStops.length === 1) {
        map.setView([validStops[0].lat, validStops[0].lng], 13, { animate: true });
      }
    }
  }, [routeStops, travelMode, selectedAddressForMap]);

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
      label: 'Haritadan Seçilen Nokta',
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    };
    setRouteStops(updated);
    setClickedCoords(null);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleSetAsDestination = () => {
    if (!clickedCoords) return;
    const updated = [...routeStops];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      id: 'destination',
      label: 'Haritadan Seçilen Nokta',
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    };
    setRouteStops(updated);
    setClickedCoords(null);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleAddAsWaypoint = () => {
    if (!clickedCoords) return;
    const newId = `waypoint-${Date.now()}`;
    const newWaypoint: RouteStop = {
      id: newId,
      label: 'Haritadan Seçilen Durak',
      address: clickedAddress,
      lat: clickedCoords.lat,
      lng: clickedCoords.lng
    };
    const updated = [...routeStops];
    updated.splice(routeStops.length - 1, 0, newWaypoint); // insert before destination
    setRouteStops(updated);
    setClickedCoords(null);
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

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map HTML Canvas container */}
      <div id="leaflet-map-canvas" ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Action Panels overlayed on top of map */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
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

      {/* Interactive Map Click Context Menu overlay */}
      {clickedCoords && (
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Haritadan Seçilen Nokta</span>
              <p className="text-slate-800 text-xs font-semibold leading-relaxed line-clamp-2 mt-0.5" title={clickedAddress}>
                {clickedAddress}
              </p>
              {isReverseGeocoding && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                  <Loader2 className="h-3 w-3 animate-spin inline" /> Adres sorgulanıyor...
                </span>
              )}
            </div>
          </div>

          {/* Location Actions Menu Grid */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <button
              id="click-action-start"
              onClick={handleSetAsOrigin}
              disabled={isReverseGeocoding}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <Navigation className="h-3.5 w-3.5 shrink-0" />
              Başlangıç Yap
            </button>
            <button
              id="click-action-dest"
              onClick={handleSetAsDestination}
              disabled={isReverseGeocoding}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Varış Yap
            </button>
            <button
              id="click-action-waypoint"
              onClick={handleAddAsWaypoint}
              disabled={isReverseGeocoding}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Durak Ekle
            </button>
            <button
              id="click-action-save"
              onClick={handleSaveToAddressBook}
              disabled={isReverseGeocoding}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0" />
              Adresi Kaydet
            </button>
          </div>

          {/* Close Action Overlay trigger */}
          <button
            id="click-action-close"
            onClick={() => setClickedCoords(null)}
            className="text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors pt-1"
          >
            Vazgeç / Kapat
          </button>
        </div>
      )}

      {/* Mini user notification guide overlay */}
      <div className="absolute bottom-4 left-4 z-[900] bg-slate-950/85 backdrop-blur text-white py-1.5 px-3 rounded-full text-[10px] font-semibold tracking-wide flex items-center gap-1.5 border border-slate-850 shadow-lg select-none">
        <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
        <span>Harita üzerinde herhangi bir yere tıklayarak adres kaydedebilir veya rota çizebilirsiniz.</span>
      </div>
    </div>
  );
}
