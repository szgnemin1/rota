/**
 * Google Maps Link and Address Resolver
 * Resolves short links (maps.app.goo.gl, goo.gl/maps) and geocodes addresses.
 */

import { extractCoordinates } from './navigation';

export interface ResolvedLocation {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
}

export async function resolveGoogleMapsInput(input: string): Promise<ResolvedLocation | null> {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Check if it's already coordinates or contains @lat,lng
  const directCoords = extractCoordinates(trimmed);
  if (directCoords) {
    // Reverse geocode to get human address
    const reverseAddr = await reverseGeocode(directCoords.lat, directCoords.lng);
    return {
      lat: directCoords.lat,
      lng: directCoords.lng,
      address: reverseAddr || `${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)}`
    };
  }

  // 2. Check if it is a Google Maps URL (short link or long link)
  if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps') || trimmed.includes('google.com/maps')) {
    // Try via local backend resolver API if server is running
    try {
      const res = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.lat && json.lng) {
          return {
            lat: json.lat,
            lng: json.lng,
            label: json.name || json.label || '',
            address: json.address || ''
          };
        }
      }
    } catch (e) {
      console.warn('Backend resolver not available, using fallback:', e);
    }

    // Client-side regex fallback if URL has place name or coordinates in path
    const placeMatch = trimmed.match(/place\/([^/@]+)/);
    if (placeMatch) {
      const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      const geocoded = await forwardGeocode(placeName);
      if (geocoded) {
        return {
          ...geocoded,
          label: placeName
        };
      }
    }
  }

  // 3. Fallback: Treat as search query / address text
  const geocoded = await forwardGeocode(trimmed);
  if (geocoded) {
    return {
      lat: geocoded.lat,
      lng: geocoded.lng,
      label: trimmed,
      address: geocoded.address
    };
  }

  return null;
}

/**
 * Free OpenStreetMap / Nominatim forward geocoding
 */
export async function forwardGeocode(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name
        };
      }
    }
  } catch (e) {
    console.error('Forward geocode failed:', e);
  }
  return null;
}

/**
 * Free OpenStreetMap / Nominatim reverse geocoding
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data.display_name || '';
    }
  } catch (e) {
    console.error('Reverse geocode failed:', e);
  }
  return '';
}
