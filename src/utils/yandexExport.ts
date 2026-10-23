export interface ExportLocationItem {
  id?: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  contactPerson?: string;
  category?: string;
  deficiencies?: string;
  visited?: boolean;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Downloads a text or binary file to the user's computer/device
 */
export function triggerFileDownload(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates standard KML 2.2 format supported natively by Yandex Map Constructor (Harita Oluşturucu)
 */
export function generateKML(items: ExportLocationItem[], title: string = 'RotaPlan - Yandex Konumlarım'): string {
  const validItems = items.filter(i => !isNaN(i.lat) && !isNaN(i.lng) && i.lat !== 0 && i.lng !== 0);

  const placemarks = validItems.map((item, index) => {
    const details = [
      item.address ? `<b>Adres:</b> ${escapeXml(item.address)}` : '',
      item.phone ? `<b>Telefon:</b> ${escapeXml(item.phone)}` : '',
      item.contactPerson ? `<b>Yetkili:</b> ${escapeXml(item.contactPerson)}` : '',
      item.category ? `<b>Grup:</b> ${escapeXml(item.category)}` : '',
      item.deficiencies ? `<b>Notlar/Eksiklikler:</b> ${escapeXml(item.deficiencies)}` : '',
      `<b>Sıra:</b> ${index + 1}`
    ].filter(Boolean).join('<br/>\n      ');

    return `    <Placemark>
      <name><![CDATA[${item.label || `Konum ${index + 1}`}]]></name>
      <description><![CDATA[${details}]]></description>
      <styleUrl>#yandexRedPin</styleUrl>
      <Point>
        <coordinates>${item.lng.toFixed(6)},${item.lat.toFixed(6)},0</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name><![CDATA[${title}]]></name>
    <description><![CDATA[RotaPlan sisteminden aktarılan ${validItems.length} adet konum. Yandex Harita Oluşturucu (Map Constructor) ile uyumludur.]]></description>
    <Style id="yandexRedPin">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
      <BalloonStyle>
        <text><![CDATA[<h3>$[name]</h3><p>$[description]</p>]]></text>
      </BalloonStyle>
    </Style>
${placemarks}
  </Document>
</kml>`;
}

/**
 * Generates GPX 1.1 format with waypoints, supported by Yandex and GPS tools
 */
export function generateGPX(items: ExportLocationItem[], title: string = 'RotaPlan - Yandex Konumlar'): string {
  const validItems = items.filter(i => !isNaN(i.lat) && !isNaN(i.lng) && i.lat !== 0 && i.lng !== 0);

  const waypoints = validItems.map((item, index) => {
    const descParts = [
      item.address,
      item.phone ? `Tel: ${item.phone}` : '',
      item.contactPerson ? `Yetkili: ${item.contactPerson}` : '',
      item.category ? `Grup: ${item.category}` : ''
    ].filter(Boolean).join(' | ');

    return `  <wpt lat="${item.lat.toFixed(6)}" lon="${item.lng.toFixed(6)}">
    <name>${escapeXml(item.label || `Nokta ${index + 1}`)}</name>
    <desc>${escapeXml(descParts)}</desc>
    <type>${escapeXml(item.category || 'Müşteri')}</type>
  </wpt>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RotaPlan" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(title)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypoints}
</gpx>`;
}

/**
 * Generates CSV with UTF-8 BOM, accepted by Yandex Map Constructor and Excel
 */
export function generateCSV(items: ExportLocationItem[]): string {
  const validItems = items.filter(i => !isNaN(i.lat) && !isNaN(i.lng) && i.lat !== 0 && i.lng !== 0);

  const headers = ['Unvan', 'Adres', 'Enlem (Lat)', 'Boylam (Lon)', 'Telefon', 'Yetkili', 'Grup', 'Notlar'];
  
  const rows = validItems.map(i => {
    const escapeCsv = (val?: string) => `"${(val || '').replace(/"/g, '""')}"`;
    return [
      escapeCsv(i.label),
      escapeCsv(i.address),
      i.lat.toFixed(6),
      i.lng.toFixed(6),
      escapeCsv(i.phone),
      escapeCsv(i.contactPerson),
      escapeCsv(i.category),
      escapeCsv(i.deficiencies)
    ].join(';');
  });

  // \uFEFF BOM for correct Turkish characters in Excel/Yandex
  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Generates GeoJSON format, also supported by Yandex Map Constructor
 */
export function generateGeoJSON(items: ExportLocationItem[]): string {
  const validItems = items.filter(i => !isNaN(i.lat) && !isNaN(i.lng) && i.lat !== 0 && i.lng !== 0);

  const geoJson = {
    type: "FeatureCollection",
    features: validItems.map(item => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [item.lng, item.lat]
      },
      properties: {
        title: item.label,
        description: [
          item.address,
          item.phone ? `Tel: ${item.phone}` : null,
          item.contactPerson ? `Yetkili: ${item.contactPerson}` : null,
          item.deficiencies ? `Notlar: ${item.deficiencies}` : null
        ].filter(Boolean).join('\n'),
        category: item.category || 'Genel'
      }
    }))
  };

  return JSON.stringify(geoJson, null, 2);
}

/**
 * Generates standard vCard 3.0 (.vcf) format for mobile contacts (Rehber)
 * When imported to Android or iPhone, all companies appear in phone contacts with exact address & coordinates.
 * Yandex Navigasyon automatically finds contacts by name!
 */
export function generateVCF(items: ExportLocationItem[]): string {
  const validItems = items.filter(i => !isNaN(i.lat) && !isNaN(i.lng) && i.lat !== 0 && i.lng !== 0);

  const vcards = validItems.map(item => {
    const cleanLabel = (item.label || 'Firma').replace(/[;\n\r]/g, ' ');
    const cleanAddr = (item.address || '').replace(/[;\n\r]/g, ' ');
    const cleanPhone = (item.phone || '').trim();
    const cleanContact = (item.contactPerson || '').replace(/[;\n\r]/g, ' ');
    const note = [
      item.category ? `Grup: ${item.category}` : '',
      cleanContact ? `Yetkili: ${cleanContact}` : '',
      item.deficiencies ? `Not: ${item.deficiencies}` : ''
    ].filter(Boolean).join(' - ');

    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${cleanLabel}`,
      `ORG:${cleanLabel}`,
      cleanPhone ? `TEL;TYPE=WORK,VOICE:${cleanPhone}` : '',
      `ADR;TYPE=WORK:;;${cleanAddr};Bursa;;;Türkiye`,
      `GEO:${item.lat.toFixed(6)};${item.lng.toFixed(6)}`,
      note ? `NOTE:${note}` : '',
      `URL:https://yandex.com.tr/maps/?rtext=~${item.lat.toFixed(6)},${item.lng.toFixed(6)}&rtt=auto`,
      'END:VCARD'
    ].filter(Boolean).join('\r\n');
  }).join('\r\n\r\n');

  return vcards;
}
