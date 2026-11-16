/**
 * Yandex & Google Navigation Utilities
 * Primary focus: 1-Tap Yandex Navigator & Yandex Maps integration.
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
 * Directly launches Yandex Navigator for a single stop.
 * On Android / iOS, uses native intent "yandexnavi://build_route_on_map?lat_to=...&lon_to=..."
 * with fallback to Yandex Maps universal web / app routing.
 */
export function startYandexNavigation(lat: number, lng: number, label?: string, address?: string) {
  triggerHaptic('heavy');

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    if (address || label) {
      const q = encodeURIComponent((label ? `${label}, ` : '') + (address || ''));
      const universalUrl = `https://yandex.com.tr/maps/?text=${q}&rtt=auto`;
      window.open(universalUrl, '_system');
      return;
    }
    alert('Geçerli bir koordinat veya adres bulunamadı.');
    return;
  }

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // 1. Primary: Yandex Navigator intent
  const yandexNaviIntent = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`;
  // 2. Secondary fallback: Yandex Maps web or app
  const yandexMapsWebUrl = `https://yandex.com.tr/maps/?rtext=~${lat},${lng}&rtt=auto`;

  if (isAndroid) {
    try {
      window.location.href = yandexNaviIntent;
    } catch (e) {
      window.open(yandexMapsWebUrl, '_system');
    }

    // Safety fallback timer if app switch doesn't take focus
    setTimeout(() => {
      window.open(yandexMapsWebUrl, '_system');
    }, 600);
  } else if (isIOS) {
    window.location.href = yandexNaviIntent;
    setTimeout(() => {
      window.open(yandexMapsWebUrl, '_system');
    }, 600);
  } else {
    // Desktop Web browser
    window.open(yandexMapsWebUrl, '_blank');
  }
}

/**
 * Builds and launches a multi-stop route in Yandex Maps.
 * Yandex natively supports unlimited stops separated by '~':
 * rtext=lat1,lng1~lat2,lng2~lat3,lng3...&rtt=auto
 */
export function startYandexMultiRoute(stops: LatLngPoint[], origin?: LatLngPoint | null) {
  triggerHaptic('medium');
  const validStops = stops.filter(s => s.lat !== 0 && s.lng !== 0 && !isNaN(s.lat) && !isNaN(s.lng));
  if (validStops.length === 0) {
    alert('Rotada geçerli koordinatı olan durak bulunamadı.');
    return;
  }

  const pointsList: string[] = [];
  if (origin && origin.lat && origin.lng) {
    pointsList.push(`${origin.lat},${origin.lng}`);
  }
  validStops.forEach(s => {
    pointsList.push(`${s.lat},${s.lng}`);
  });

  const points = pointsList.join('~');
  const yandexMapsWebUrl = `https://yandex.com.tr/maps/?rtext=${points}&rtt=auto`;
  const yandexMapsIntent = `yandexmaps://maps.yandex.ru/?rtext=${points}&rtt=auto`;

  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isMobile) {
    try {
      window.location.href = yandexMapsIntent;
    } catch (e) {
      window.open(yandexMapsWebUrl, '_system');
    }
    setTimeout(() => {
      window.open(yandexMapsWebUrl, '_system');
    }, 600);
  } else {
    window.open(yandexMapsWebUrl, '_blank');
  }
}

/**
 * Generates Yandex multi-stop route URL
 */
export function getYandexMapsRouteUrl(stops: LatLngPoint[], origin?: LatLngPoint | null): string {
  const validStops = stops.filter(s => s.lat !== 0 && s.lng !== 0 && !isNaN(s.lat) && !isNaN(s.lng));
  const pointsList: string[] = [];
  if (origin && origin.lat && origin.lng) {
    pointsList.push(`${origin.lat},${origin.lng}`);
  }
  validStops.forEach(s => {
    pointsList.push(`${s.lat},${s.lng}`);
  });
  return `https://yandex.com.tr/maps/?rtext=${pointsList.join('~')}&rtt=auto`;
}

/**
 * Google Maps Navigation as fallback option if needed
 */
export function getGoogleMapsRouteUrl(stops: LatLngPoint[], origin?: LatLngPoint | null, travelMode: string = 'driving'): string {
  return getYandexMapsRouteUrl(stops, origin);
}

export function startGoogleMapsNavigation(lat: number, lng: number, label?: string, address?: string) {
  startYandexNavigation(lat, lng, label, address);
}

export function startGoogleMapsMultiRoute(stops: LatLngPoint[], origin?: LatLngPoint | null) {
  startYandexMultiRoute(stops, origin);
}

/**
 * Direct phone dialer
 */
export function callPhoneNumber(phone: string) {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  window.open(`tel:${cleanPhone}`, '_system');
}

/**
 * Direct WhatsApp chat opener
 */
export function openWhatsAppChat(phone: string, stopName?: string) {
  if (!phone) return;
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '90' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('90') && cleanPhone.length === 10) {
    cleanPhone = '90' + cleanPhone;
  }

  const text = encodeURIComponent(
    `Merhaba ${stopName ? stopName + ' yetkilisi' : ''}, RotaPlan üzerinden ulaşıyorum.`
  );
  const waUrl = `https://wa.me/${cleanPhone}?text=${text}`;
  window.open(waUrl, '_system');
}

/**
 * Parses raw text or coordinates to detect latitude & longitude.
 * Matches:
 * - "40.1826, 29.0660"
 * - "40.1826 29.0660"
 * - Maps URLs with "@40.1826,29.0660"
 * - "q=40.1826,29.0660" or "ll=40.1826,29.0660"
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

  // Pattern 2: Maps @lat,lng
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    return { lat, lng };
  }

  // Pattern 3: query=lat,lng or q=lat,lng or destination=lat,lng or ll=lat,lng
  const queryMatch = trimmed.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    return { lat, lng };
  }

  return null;
}
