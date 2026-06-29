/**
 * Detects a category automatically from label or address text.
 */
export function detectSmartCategory(label: string, address: string): string {
  const text = `${label} ${address}`.toLowerCase();
  
  // Ev
  if (/\b(ev|evim|hane|konut|villa|daire|apartman|apt|site|sitesi|rezidans|residence)\b/i.test(text) ||
      text.includes('ev ') || text.includes(' hane') || text.includes('apartmanı') || text.includes('villa')) {
    return 'Ev';
  }
  
  // İş
  if (/\b(iş|is|ofis|office|depo|antrepo|fabrika|imalathane|atölye|atolye|dükkan|dukkan|mağaza|magaza|market|avm|plaza|holding|ticaret|sanayi|ltd|şti|as|şube|sube|merkez)\b/i.test(text) ||
      text.includes('işyeri') || text.includes('ofisi') || text.includes('deposu') || text.includes('fabrikası') || text.includes('plazası')) {
    return 'İş';
  }

  // Gıda / Kafe
  if (/\b(cafe|kafe|restoran|restaurant|lokanta|fırın|firin|pastane|büfe|bufe|yemek|gıda|gida|kahve|börek|borek|kebap|döner|doner)\b/i.test(text)) {
    return 'Gıda';
  }

  // Sağlık
  if (/\b(hastane|eczane|klinik|sağlık|saglik|doktor|tıp|tip|poliklinik|rehabilitasyon)\b/i.test(text)) {
    return 'Sağlık';
  }

  // Eğitim
  if (/\b(okul|kolej|üniversite|universite|lise|ilkokul|ortaokul|kampüs|kampus|kurs|dershane|dersane|fakülte|fakulte)\b/i.test(text)) {
    return 'Eğitim';
  }

  // Kurye / Teslimat / Kargo
  if (/\b(kargo|şube|sube|teslim|dağıtım|dagitim|kurye|posta|lojistik)\b/i.test(text)) {
    return 'Teslimat';
  }

  // Fallback
  const fallback = localStorage.getItem('auto_group_fallback_name') || 'Genel';
  return fallback;
}
