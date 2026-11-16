/**
 * KML Parser Utility
 * Parses .kml and .kmz files and extracts Placemarks (locations, addresses, coordinates)
 */

import { SavedAddress, RouteStop, SavedRoute } from '../types';

export interface ParsedKMLResult {
  addresses: SavedAddress[];
  route: SavedRoute | null;
}

export function parseKMLText(kmlText: string, routeTitle?: string): ParsedKMLResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

  const placemarks = xmlDoc.getElementsByTagName('Placemark');
  const addresses: SavedAddress[] = [];
  const stops: RouteStop[] = [];

  const cleanTitle = routeTitle || xmlDoc.getElementsByTagName('Document')[0]?.getElementsByTagName('name')[0]?.textContent || 'KML İçe Aktarılan Rota';

  for (let i = 0; i < placemarks.length; i++) {
    const p = placemarks[i];
    
    // Extract name
    const nameEl = p.getElementsByTagName('name')[0];
    const rawName = nameEl?.textContent?.trim() || `Firma ${i + 1}`;

    // Extract description / address
    const descEl = p.getElementsByTagName('description')[0];
    let addressStr = '';
    if (descEl?.textContent) {
      // Strip HTML tags and extract address
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = descEl.textContent;
      let text = tempDiv.textContent || tempDiv.innerText || '';
      text = text.replace(/Adres:\s*/i, '').trim();
      text = text.replace(/Sıra:\s*\d+/gi, '').trim();
      text = text.replace(/\s+/g, ' ');
      addressStr = text;
    }

    // Extract coordinates (lng, lat, alt)
    const coordEl = p.getElementsByTagName('coordinates')[0];
    let lat = 0;
    let lng = 0;
    if (coordEl?.textContent) {
      const parts = coordEl.textContent.trim().split(',');
      if (parts.length >= 2) {
        lng = parseFloat(parts[0]) || 0;
        lat = parseFloat(parts[1]) || 0;
      }
    }

    const addrId = `kml-${Date.now()}-${i + 1}`;
    const cleanAddress = addressStr || `${rawName}, Bursa`;

    const savedAddr: SavedAddress = {
      id: addrId,
      label: rawName,
      address: cleanAddress,
      lat,
      lng,
      category: 'KML Durakları',
      note: '',
      visited: false,
      phone: ''
    };
    addresses.push(savedAddr);

    stops.push({
      id: addrId,
      label: rawName,
      address: cleanAddress,
      lat,
      lng,
      visited: false,
      note: ''
    });
  }

  let route: SavedRoute | null = null;
  if (stops.length > 0) {
    route = {
      id: `route-kml-${Date.now()}`,
      title: `${cleanTitle} (${stops.length} Durak)`,
      description: `KML dosyasından aktarılan ${stops.length} sıralı firma rotası`,
      category: 'Saha Rotaları',
      color: '#10b981',
      stops,
      createdAt: new Date().toISOString(),
      travelMode: 'DRIVING'
    };
  }

  return { addresses, route };
}
