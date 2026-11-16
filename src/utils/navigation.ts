/**
 * Google Maps Direct Navigation & URL Utilities
 * Specifically engineered for mobile phone field navigation.
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface LatLngPoint {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
}

/**
 * Triggers light haptic feedback on touch
 */
export async function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    const s = style === 'heavy' ? ImpactStyle.Heavy : (style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light);
    await Haptics.impact({ style: s });
  } catch (e) {
    if ('vibrate' in navigator) {
      navigator.vibrate(style === 'heavy' ? 40 : 15);
    }
  }
}

/**
 * Directly launches Google Maps Turn-by-Turn GPS Navigation for a single stop.
 * On Android, uses native intent "google.navigation:q=lat,lng&mode=d" to immediately
 * start driving directions with voice guidance!
 */
export function startGoogleMapsNavigation(lat: number, lng: number, label?: string, address?: string) {
  triggerHaptic('heavy');

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    if (address || label) {
      const q = encodeURIComponent((label ? `${label}, ` : '') + (address || ''));
      const universalUrl = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
      window.open(universalUrl, '_system');
      return;
    }
    alert('Geçerli bir koordinat veya adres bulunamadı.');
    return;
  }

  const isAndroid = /android/i.test(navigator.userAgent);

  if (isAndroid) {
    // Android Native Turn-by-Turn Navigation Intent:
    // google.navigation:q=latitude,longitude&mode=d (d = driving, w = walking, b = bicycling)
    const nativeIntentUri = `google.navigation:q=${lat},${lng}&mode=d`;
    
    // Try native intent directly
    try {
      window.location.href = nativeIntentUri;
    } catch (e) {
      // Fallback
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(fallbackUrl, '_system');
    }

    // Safety fallback: if app does not switch within 750ms, open universal web intent
    setTimeout(() => {
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(fallbackUrl, '_system');
    }, 750);
  } else {
    // iOS (Apple Devices) or Mobile Web:
    // Opens Google Maps app if installed, or web directions
    const universalUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(universalUrl, '_system');
  }
}

/**
 * Builds a multi-stop route link for Google Maps.
 * Google Maps allows up to 10 stops (origin + destination + 8 waypoints).
 */
export function getGoogleMapsRouteUrl(
  stops: LatLngPoint[],
  origin?: LatLngPoint | null,
  travelMode: 'driving' | 'walking' | 'bicycling' = 'driving'
): string {
  const validStops = stops.filter(s => s.lat !== 0 && s.lng !== 0 && !isNaN(s.lat) && !isNaN(s.lng));
  if (validStops.length === 0) return '';

  if (validStops.length === 1 && !origin) {
    return `https://www.google.com/maps/dir/?api=1&destination=${validStops[0].lat},${validStops[0].lng}&travelmode=${travelMode}`;
  }

  // Destination is the final stop
  const destination = validStops[validStops.length - 1];
  
  // Waypoints are intermediate stops
  const intermediateStops = validStops.slice(0, validStops.length - 1);
  const waypoints = intermediateStops.map(s => `${s.lat},${s.lng}`).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=${travelMode}`;

  if (origin && origin.lat && origin.lng) {
    url += `&origin=${origin.lat},${origin.lng}`;
  }

  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }

  return url;
}

/**
 * Launches the full multi-stop route directly in Google Maps.
 */
export function startGoogleMapsMultiRoute(
  stops: LatLngPoint[],
  origin?: LatLngPoint | null,
  travelMode: 'driving' | 'walking' | 'bicycling' = 'driving'
) {
  triggerHaptic('heavy');
  const url = getGoogleMapsRouteUrl(stops, origin, travelMode);
  if (!url) {
    alert('Rotada geçerli durak bulunamadı.');
    return;
  }
  window.open(url, '_system');
}

/**
 * Directly dials customer phone number
 */
export function callPhoneNumber(phone: string) {
  triggerHaptic('light');
  if (!phone) return;
  const clean = phone.replace(/[^0-9+]/g, '');
  window.location.href = `tel:${clean}`;
}

/**
 * Directly opens WhatsApp chat with custom greeting
 */
export function openWhatsAppChat(phone: string, stopName?: string) {
  triggerHaptic('light');
  if (!phone) return;
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '90' + clean.slice(1);
  } else if (!clean.startsWith('90') && clean.length === 10) {
    clean = '90' + clean;
  }
  
  const greeting = stopName
    ? `Merhaba ${stopName}, rota ziyaretimiz kapsamında iletişime geçiyorum.`
    : 'Merhaba, rota ziyareti için iletişime geçiyorum.';
    
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(greeting)}`;
  window.open(url, '_blank');
}

/**
 * Parses raw text or coordinates to detect latitude & longitude.
 * Matches:
 * - "40.1826, 29.0660"
 * - "40.1826 29.0660"
 * - Google maps URLs with "@40.1826,29.0660"
 * - "q=40.1826,29.0660"
 */
export function extractCoordinates(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: Direct coordinates like "40.1826, 29.0660" or "40.1826,29.0660"
  const directMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Pattern 2: Google Maps @lat,lng
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    return { lat, lng };
  }

  // Pattern 3: query=lat,lng or q=lat,lng or destination=lat,lng
  const queryMatch = trimmed.match(/[?&](?:q|query|destination)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    return { lat, lng };
  }

  return null;
}
