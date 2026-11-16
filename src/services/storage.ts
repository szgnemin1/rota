/**
 * Local Storage & Offline-First State Manager
 * Ensures 100% offline persistence on mobile devices.
 */

import { SavedAddress, RouteStop, SavedRoute } from '../types';

const STORAGE_KEYS = {
  ADDRESSES: 'ROTA_APP_SAVED_ADDRESSES_V1',
  ACTIVE_STOPS: 'ROTA_APP_ACTIVE_STOPS_V1',
  SAVED_ROUTES: 'ROTA_APP_SAVED_ROUTES_V1',
  DEFAULT_ORIGIN: 'ROTA_APP_DEFAULT_ORIGIN_V1',
  ACTIVE_TAB: 'ROTA_APP_ACTIVE_TAB_V1',
};

// Default seed addresses in Bursa for first-time onboarding
const INITIAL_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr-1',
    label: 'Demirtaş Organize Sanayi (DOSAB)',
    address: 'Demirtaş Dumlupınar OSB Mah. Nilüfer Sk. No: 12, Osmangazi/Bursa',
    lat: 40.2642,
    lng: 29.0715,
    category: 'Müşteriler',
    phone: '02242610000',
    contactPerson: 'Mehmet Bey',
    note: 'Haftalık sevkiyat kontrolü',
    visited: false
  },
  {
    id: 'addr-2',
    label: 'Nilüfer Organize Sanayi (NOSAB)',
    address: 'Minareliçavuş OSB Mah. Dökümcüler Sitesi, Nilüfer/Bursa',
    lat: 40.2310,
    lng: 28.9280,
    category: 'Fabrikalar',
    phone: '02244111222',
    contactPerson: 'Ali Usta',
    note: 'Yedek parça teslimatı',
    visited: false
  },
  {
    id: 'addr-3',
    label: 'Bursa Toptancılar Sitesi (BUTTİM)',
    address: 'Altınova Mah. Fuar Cad. BUTTİM İş Merkezi, Osmangazi/Bursa',
    lat: 40.2285,
    lng: 29.0578,
    category: 'Toptancılar',
    phone: '05321112233',
    contactPerson: 'Ahmet Karaca',
    note: 'Katalog ve numune bırakılacak',
    visited: false
  },
  {
    id: 'addr-4',
    label: 'Otosansit Sanayi Sitesi',
    address: 'Yiğitler Mah. Otosansit Sanayi Sitesi 14. Blok, Yıldırım/Bursa',
    lat: 40.1872,
    lng: 29.1365,
    category: 'Atölyeler',
    phone: '05423334455',
    contactPerson: 'Hasan Usta',
    note: 'Motor revizyon servisi',
    visited: false
  }
];

export function getStoredAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADDRESSES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse stored addresses:', e);
  }
  // Fallback to initial seeds
  saveStoredAddresses(INITIAL_ADDRESSES);
  return INITIAL_ADDRESSES;
}

export function saveStoredAddresses(addresses: SavedAddress[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
  } catch (e) {
    console.error('Failed to save addresses to localStorage:', e);
  }
}

export function getStoredActiveStops(): RouteStop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_STOPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse active stops:', e);
  }
  // Default to first two seed addresses if available
  const initial = getStoredAddresses().slice(0, 3).map((a, i) => ({
    id: a.id,
    label: a.label,
    address: a.address,
    lat: a.lat,
    lng: a.lng,
    phone: a.phone,
    contactPerson: a.contactPerson,
    note: a.note,
    visited: false
  }));
  saveStoredActiveStops(initial);
  return initial;
}

export function saveStoredActiveStops(stops: RouteStop[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_STOPS, JSON.stringify(stops));
  } catch (e) {
    console.error('Failed to save active stops to localStorage:', e);
  }
}

export function getStoredDefaultOrigin(): RouteStop | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEFAULT_ORIGIN);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveStoredDefaultOrigin(origin: RouteStop | null) {
  try {
    if (origin) {
      localStorage.setItem(STORAGE_KEYS.DEFAULT_ORIGIN, JSON.stringify(origin));
    } else {
      localStorage.removeItem(STORAGE_KEYS.DEFAULT_ORIGIN);
    }
  } catch (e) {
    console.error('Failed to save default origin:', e);
  }
}

export function getStoredSavedRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_ROUTES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredSavedRoutes(routes: SavedRoute[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(routes));
  } catch (e) {
    console.error('Failed to save routes to localStorage:', e);
  }
}
