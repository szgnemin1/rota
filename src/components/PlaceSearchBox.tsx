import { useEffect, useState, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

interface PlaceSearchBoxProps {
  id: string;
  placeholder?: string;
  onPlaceSelected: (place: { label: string; address: string; lat: number; lng: number }) => void;
  className?: string;
  initialValue?: string;
}

interface UnifiedPrediction {
  id: string;
  source: 'osm';
  mainText: string;
  secondaryText: string;
  address: string;
  lat: number;
  lng: number;
}

export default function PlaceSearchBox({
  id,
  placeholder = "Adres, koordinat (Enl, Boy) veya Google Harita linki girin...",
  onPlaceSelected,
  className = "",
  initialValue = ""
}: PlaceSearchBoxProps) {
  const [input, setInput] = useState(initialValue);
  const [predictions, setPredictions] = useState<UnifiedPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(initialValue);
  }, [initialValue]);

  // Helper to parse coordinate string or Google Maps URL
  const parseCoordinatesOrGoogleMapsUrl = (text: string): { lat: number; lng: number } | null => {
    if (!text) return null;

    const trimmed = text.trim();

    // 1. Check for standard coordinate string: e.g. "40.1826, 29.0660" or "40.1826 29.0660" or "40.1826;29.0660"
    const coordRegex = /^\s*(-?\d+(\.\d+)?)\s*[\s,;:\/]\s*(-?\d+(\.\d+)?)\s*$/;
    const coordMatch = trimmed.match(coordRegex);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // 2. Check for Google Maps URL pattern containing "@lat,lng"
    const atPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const atMatch = trimmed.match(atPattern);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // 3. Check for Google Maps URL containing query parameter (q=lat,lng or query=lat,lng)
    const qPattern = /[?&](q|query|ll)=(-?\d+\.\d+)(,%2C|%2C|,)(-?\d+\.\d+)/i;
    const qMatch = trimmed.match(qPattern);
    if (qMatch) {
      return { lat: parseFloat(qMatch[2]), lng: parseFloat(qMatch[4]) };
    }

    // 4. Fallback search inside general URL path
    const pathPattern = /\/(-?\d+\.\d+),(-?\d+\.\d+)(?:\/|\?|$)/;
    const pathMatch = trimmed.match(pathPattern);
    if (pathMatch) {
      return { lat: parseFloat(pathMatch[1]), lng: parseFloat(pathMatch[2]) };
    }

    return null;
  };

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Osm Nominatim search suggestions bounded strictly to Bursa
  const fetchNominatimSuggestions = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // First try parsing coordinates or Google Maps link
    const parsedCoords = parseCoordinatesOrGoogleMapsUrl(query);
    if (parsedCoords) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parsedCoords.lat}&lon=${parsedCoords.lng}&addressdetails=1&accept-language=tr`;
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'tr-TR,tr;q=0.9'
          }
        });
        if (!response.ok) throw new Error('OSM Reverse lookup error');
        const item = await response.json();

        if (item && item.display_name) {
          const displayNameParts = item.display_name.split(',');
          const mainText = displayNameParts[0].trim();
          const secondaryText = displayNameParts.slice(1).slice(0, 3).join(',').trim();

          const result: UnifiedPrediction = {
            id: `coords-${parsedCoords.lat}-${parsedCoords.lng}`,
            source: 'osm',
            mainText: `📍 Bulunan Konum (${parsedCoords.lat.toFixed(5)}, ${parsedCoords.lng.toFixed(5)})`,
            secondaryText: item.display_name,
            address: item.display_name,
            lat: parsedCoords.lat,
            lng: parsedCoords.lng
          };
          setPredictions([result]);
          setIsOpen(true);
        } else {
          const result: UnifiedPrediction = {
            id: `coords-raw-${parsedCoords.lat}-${parsedCoords.lng}`,
            source: 'osm',
            mainText: `📍 Koordinat: ${parsedCoords.lat.toFixed(5)}, ${parsedCoords.lng.toFixed(5)}`,
            secondaryText: 'Çözümlenen koordinat noktası',
            address: `Enlem: ${parsedCoords.lat}, Boylam: ${parsedCoords.lng}`,
            lat: parsedCoords.lat,
            lng: parsedCoords.lng
          };
          setPredictions([result]);
          setIsOpen(true);
        }
      } catch (err) {
        console.warn("Coordinate geocoding failed:", err);
        const result: UnifiedPrediction = {
          id: `coords-raw-${parsedCoords.lat}-${parsedCoords.lng}`,
          source: 'osm',
          mainText: `📍 Koordinat: ${parsedCoords.lat.toFixed(5)}, ${parsedCoords.lng.toFixed(5)}`,
          secondaryText: 'Çözümlenen koordinat noktası',
          address: `Enlem: ${parsedCoords.lat}, Boylam: ${parsedCoords.lng}`,
          lat: parsedCoords.lat,
          lng: parsedCoords.lng
        };
        setPredictions([result]);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Handle Google Maps short / long link resolution via custom backend API (bypasses CORS)
    const isGoogleMapsLink = query.toLowerCase().includes('goo.gl') || query.toLowerCase().includes('google.com/maps') || query.toLowerCase().includes('maps.google');
    if (isGoogleMapsLink) {
      try {
        const url = `/api/resolve-maps-url?url=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API resolution error');
        const item = await response.json();

        if (item && item.success) {
          const result: UnifiedPrediction = {
            id: `coords-google-resolved-${item.lat}-${item.lng}`,
            source: 'osm',
            mainText: `📍 ${item.label || 'Google Harita Konumu'}`,
            secondaryText: item.address,
            address: item.address,
            lat: item.lat,
            lng: item.lng
          };
          setPredictions([result]);
          setIsOpen(true);
        } else {
          throw new Error('Unsuccessful response');
        }
      } catch (err) {
        console.warn("Google Maps URL resolution failed:", err);
        const errorResult: UnifiedPrediction = {
          id: 'error-google-resolve',
          source: 'osm',
          mainText: '❌ Google Harita Linki Çözümlenemedi',
          secondaryText: 'Bağlantı çözümlenemedi. Lütfen doğrudan arama kutusuna yazarak arama yapın.',
          address: 'Hata',
          lat: 40.1826,
          lng: 29.0660
        };
        setPredictions([errorResult]);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Append ", bursa" to the query if not present to ensure local relevance
      let refinedQuery = query;
      if (!query.toLowerCase().includes('bursa')) {
        refinedQuery = `${query}, bursa`;
      }

      // viewbox coordinates for Bursa: min_lon, min_lat, max_lon, max_lat
      const viewbox = "28.2,39.5,29.9,40.6";
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(refinedQuery)}&viewbox=${viewbox}&bounded=1&addressdetails=1&limit=8&accept-language=tr`;

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'tr-TR,tr;q=0.9'
        }
      });
      if (!response.ok) throw new Error('OSM Nominatim error');
      const data = await response.json();
      
      const results: UnifiedPrediction[] = data.map((item: any, idx: number) => {
        const displayNameParts = item.display_name.split(',');
        const mainText = displayNameParts[0].trim();
        const secondaryText = displayNameParts.slice(1).slice(0, 3).join(',').trim();

        return {
          id: `osm-${item.place_id}-${idx}`,
          source: 'osm',
          mainText: mainText,
          secondaryText: secondaryText || 'Bursa, Türkiye',
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        };
      });

      // If no results inside the bounding box, try querying general search with ", bursa" but without hard bounded=1 
      // so it still finds places even if slightly outside, keeping it friendly
      if (results.length === 0) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", bursa")}&addressdetails=1&limit=5&accept-language=tr`;
        const fbResponse = await fetch(fallbackUrl);
        const fbData = await fbResponse.json();
        const fbResults: UnifiedPrediction[] = fbData.map((item: any, idx: number) => {
          const displayNameParts = item.display_name.split(',');
          const mainText = displayNameParts[0].trim();
          const secondaryText = displayNameParts.slice(1).slice(0, 3).join(',').trim();

          return {
            id: `osm-fb-${item.place_id}-${idx}`,
            source: 'osm',
            mainText: mainText,
            secondaryText: secondaryText || 'Bursa, Türkiye',
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          };
        });
        setPredictions(fbResults);
        setIsOpen(fbResults.length > 0);
      } else {
        setPredictions(results);
        setIsOpen(results.length > 0);
      }
    } catch (err) {
      console.warn("OSM Nominatim search failed:", err);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle typing and fetch suggestions with debounce
  useEffect(() => {
    if (!input || input.trim().length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setIsLoading(true);
      fetchNominatimSuggestions(input);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [input]);

  const handleSelectPrediction = (prediction: UnifiedPrediction) => {
    setInput(prediction.mainText);
    setIsOpen(false);
    onPlaceSelected({
      label: prediction.mainText,
      address: prediction.address,
      lat: prediction.lat,
      lng: prediction.lng
    });
  };

  const clearInput = () => {
    setInput('');
    setPredictions([]);
    setIsOpen(false);
  };

  return (
    <div id={`${id}-container`} className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        
        <input
          id={`${id}-input`}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            if (predictions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="block w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 transition-colors"
        />

        {input && (
          <button
            id={`${id}-clear-btn`}
            type="button"
            onClick={clearInput}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 focus:outline-none cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <div
          id={`${id}-dropdown`}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
        >
          {predictions.map((pred, idx) => {
            return (
              <button
                id={`prediction-row-${pred.id}-${idx}`}
                key={pred.id + '-' + idx}
                type="button"
                onClick={() => handleSelectPrediction(pred)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2.5 transition-colors cursor-pointer"
              >
                <MapPin className="h-4 w-4 text-indigo-500 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-xs truncate">
                    {pred.mainText}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {pred.secondaryText}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
