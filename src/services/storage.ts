/**
 * Local Storage & Offline-First State Manager
 * Ensures 100% permanent offline persistence on mobile & web.
 */

import { SavedAddress, RouteStop, SavedRoute } from '../types';

const STORAGE_KEYS = {
  ADDRESSES: 'ROTA_APP_SAVED_ADDRESSES_V2',
  SAVED_ROUTES: 'ROTA_APP_SAVED_ROUTES_V2',
  ACTIVE_STOPS: 'ROTA_APP_ACTIVE_STOPS_V2',
  DEFAULT_ORIGIN: 'ROTA_APP_DEFAULT_ORIGIN_V2',
};

// Seed addresses imported from the user\'s KML file (77 Bursa firms)
export const INITIAL_KML_ADDRESSES: SavedAddress[] = [
  {
    "id": "kml-addr-1",
    "label": "ZEYNEP KILIÇ DELİBAŞ (ANAOKULU)",
    "address": "Şible Caddesi, Yeşil, Yeşil Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16360, Türkiye",
    "lat": 40.182553,
    "lng": 29.075564,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-2",
    "label": "HÜŞYAR TEKSTİL PAZARLAMA İTHALAT İHRACAT SANAYİ TİCARET LİMİTED ŞİRKETİ",
    "address": "Nalıncılar Hamamı, 1. Hamam Sokak, Hanlar Bölgesi, Alacamescit, Alacamascit Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16010, Türkiye",
    "lat": 40.184594,
    "lng": 29.066825,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-3",
    "label": "dora kuyumculuk",
    "address": "Fidan Han, İnciliselvi Sokak, Hanlar Bölgesi, Nalbantoğlu, Nalbantoğlu Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16010, Türkiye",
    "lat": 40.185143,
    "lng": 29.064456,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-4",
    "label": "AKIN DEMİRÖZ",
    "address": "Koza Kafe, Belediye Cadde, Hanlar Bölgesi, Orhanbey, Orhanbey Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16010, Türkiye",
    "lat": 40.183492,
    "lng": 29.064035,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-5",
    "label": "ASTORYA TANITIM ORG.HİZM.TURİZM OTOM.TİC.SAN.LTD.ŞTİ.",
    "address": "3. Gönül Sokak, Demirtaşpaşa, Demirtaşpaşa Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16030, Türkiye",
    "lat": 40.190982,
    "lng": 29.071038,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-6",
    "label": "YALDEM SİGORTA ACENTELİĞİ LTD.ŞTİ.",
    "address": "Ulubatlı Hasan Bulvarı, Hacı İlyas, Sakarya Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16040, Türkiye",
    "lat": 40.194836,
    "lng": 29.069001,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-7",
    "label": "MEHMET NAC İ SUYABAKAN",
    "address": "Alminox Film &amp; Kaplama, 80A, İstanbul Caddesi, Yeşilova, Kemerçeşme Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16240, Türkiye",
    "lat": 40.200692,
    "lng": 29.061526,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-8",
    "label": "SELMA ARSLAN",
    "address": "Dr. Rüştü Burlu Caddesi, Gaziakdemir, Gaziakdemir Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16104, Türkiye",
    "lat": 40.199133,
    "lng": 29.041804,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-9",
    "label": "KOYUNCUOĞLU BEYSEL APT.YÖNETİCİLİĞİ",
    "address": "Mövenpick Hotel &amp; Thermal Spa Bursa, 81, Çekirge Caddesi, Çekirge, Çekirge Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16104, Türkiye",
    "lat": 40.197197,
    "lng": 29.037721,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-10",
    "label": "İSMAİL YAMAN",
    "address": "Hacı Bayram Caddesi, Alemdar, Alemdar Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16190, Türkiye",
    "lat": 40.210925,
    "lng": 29.033782,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-11",
    "label": "İRFAN KARADAĞ",
    "address": "9. Demir Sokak, Yenikaraman, Yenikaraman Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16265, Türkiye",
    "lat": 40.21844,
    "lng": 29.001593,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-12",
    "label": "MELAHAT ŞEN",
    "address": "Polat Caddesi, Yenikaraman, Yenikaraman Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16160, Türkiye",
    "lat": 40.221395,
    "lng": 28.998405,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-13",
    "label": "MUNDO OFİS",
    "address": "4. Kantar Sokağı, Yenikaraman, Yenikaraman Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16160, Türkiye",
    "lat": 40.224529,
    "lng": 28.9933,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-14",
    "label": "HOREKA TURİZM GIDA TİCARET SANAYİ LİMİTED ŞİRKETİ",
    "address": "Avcı Sokağı, İhsaniye, İhsaniye Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16220, Türkiye",
    "lat": 40.222795,
    "lng": 28.979257,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-15",
    "label": "TOROS ÇİZAKÇA ÖZALAN",
    "address": "Tunç Sokağı, Cumhuriyet, Cumhuriyet Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16140, Türkiye",
    "lat": 40.223783,
    "lng": 28.971209,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-16",
    "label": "FAV MOLA",
    "address": "Nilüfer Hatun Caddesi, Cumhuriyet, Ataevler Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16140, Türkiye",
    "lat": 40.226399,
    "lng": 28.967283,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-17",
    "label": "M.B.M. İNŞAAT TAAHHÜT TURİZM NAKLİYAT TİCARET VE SANAYİ LİMİTED ŞİRKETİ",
    "address": "Yenipazar Sokak, Fethiye, Fethiye Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16140, Türkiye",
    "lat": 40.230539,
    "lng": 28.966425,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-18",
    "label": "BASIN İLAN KURUMU GENEL MÜDÜRLÜĞÜ",
    "address": "Opus Evke, Sanayi Caddesi, Bağlarbaşı, Bağlarbaşı Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16220, Türkiye",
    "lat": 40.234267,
    "lng": 28.980001,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-19",
    "label": "MARMARA GELİŞİM KARİYER VE EĞİTİM HİZMETLERİ DANIŞMANLIK LİMİTED ŞİRKETİ",
    "address": "Huzur Caddesi, Bağlarbaşı, Bağlarbaşı Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16220, Türkiye",
    "lat": 40.2328,
    "lng": 28.982258,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-20",
    "label": "MİSALPARK SİTE YÖNETİCİLİĞİ",
    "address": "17. Aydın Sokak, Akpınar Mahallesi, Bursa, Osmangazi, Bursa, Marmara Bölgesi, 16220, Türkiye",
    "lat": 40.24134,
    "lng": 28.976893,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-21",
    "label": "NİO DIŞ KORUPARK",
    "address": "Korupark, 27. Okul Caddesi, Emek Adnan Menderes, Emek Adnan Menderes Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16225, Türkiye",
    "lat": 40.250514,
    "lng": 28.958255,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-22",
    "label": "MUHAMMED ÇELİK",
    "address": "Osmanağa Caddesi, Emek Adnan Menderes, Emek Adnan Menderes Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16000, Türkiye",
    "lat": 40.254137,
    "lng": 28.960928,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-23",
    "label": "DAMLA PALA DOĞAN",
    "address": "Sanayi Caddesi, Emek Fatih Sultan Mehmet, Geçit Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16085, Türkiye",
    "lat": 40.262286,
    "lng": 28.950807,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-24",
    "label": "CONCEPT BALAT SİTE YÖNETİMİ",
    "address": "Pamuklu Sokak, Balat Mahallesi, Doğan, Nilüfer, Bursa, Marmara Bölgesi, 16085, Türkiye",
    "lat": 40.266596,
    "lng": 28.936331,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-25",
    "label": "FARAH RESTORAN İŞLETMECİLİĞİ GIDA TURİZM DANIŞMANLIK SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    "address": "Bozkır Sokak, Dikencik Country 1, Balat Mahallesi, Doğan, Nilüfer, Bursa, Marmara Bölgesi, 16085, Türkiye",
    "lat": 40.265387,
    "lng": 28.930961,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-26",
    "label": "RULMAK MAKİNA SAN.VE TİC.LTD.ŞTİ.",
    "address": "Selvi Caddesi, Nilüfer Organize Sanayi Bölgesi, Minareliçavuş Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16130, Türkiye",
    "lat": 40.232362,
    "lng": 28.937539,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-27",
    "label": "PARİS HAFRİYAT TAŞIMACILIK İNŞAAT EMLAK SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "2, Arıtma Caddesi, Işıktepe, Işıktepe Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16215, Türkiye",
    "lat": 40.222794,
    "lng": 28.948173,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-28",
    "label": "MERİÇ MOTORLU ARAÇLAR EMLAK İNŞ.SAN.TİC.LTD.ŞTİ.",
    "address": "23 Nisan, 23 Nisan Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16130, Türkiye",
    "lat": 40.218847,
    "lng": 28.951913,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-29",
    "label": "KAL DIŞ TİCARET VE DANIŞMANLIK HİZMETLERİ ANONİM ŞİRKETİ",
    "address": "Sevgi Sokak, Beşevler, Beşevler Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16022, Türkiye",
    "lat": 40.207071,
    "lng": 28.963326,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-30",
    "label": "OFİS",
    "address": "Özkan Sokak, Üçevler Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16110, Türkiye",
    "lat": 40.201795,
    "lng": 28.95256,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-31",
    "label": "ALFA BURSA EMLAK HİZMETLERİ GAYRİMENKUL OTOMOTİV ORGANİZASYON İNŞAAT ANONİM ŞİRKETİ",
    "address": "59. Sokak, Üçevler Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16159, Türkiye",
    "lat": 40.211168,
    "lng": 28.934539,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-32",
    "label": "VESTA KAPI MUTFAK BANYO İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Alaaddinbey Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16120, Türkiye",
    "lat": 40.212007,
    "lng": 28.929575,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-33",
    "label": "halim yardım",
    "address": "Alaaddinbey Köy Yolu Caddesi, Alaaddinbey Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16120, Türkiye",
    "lat": 40.200056,
    "lng": 28.917455,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-34",
    "label": "MÜBERRAH TUNGER",
    "address": "Muammer Aksoy Caddesi, Altınşehir, Altınşehir Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16120, Türkiye",
    "lat": 40.225342,
    "lng": 28.917484,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-35",
    "label": "NATURAL SİTE",
    "address": "Özge Sokak, Özlüce, Özlüce Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16235, Türkiye",
    "lat": 40.234614,
    "lng": 28.908991,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-36",
    "label": "ASREM MAKİNA TEKSTİL İNŞAAT TURİZM TAŞIMACILIK EMLAK GIDA SANAYİ TİCARET ANONİM ŞİRKETİ",
    "address": "Özlüce, Özlüce Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16235, Türkiye",
    "lat": 40.235368,
    "lng": 28.908977,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-37",
    "label": "KENT TEL ÇİT SİSTEMLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Ürünlü Caddesi, Ürünlü Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16065, Türkiye",
    "lat": 40.21231,
    "lng": 28.886472,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-38",
    "label": "FOTEL GIDA TURİZM VE TEKSTİL SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Uludağ Üniversitesi, Görükle Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16065, Türkiye",
    "lat": 40.221498,
    "lng": 28.867296,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-39",
    "label": "CANER ALTUN",
    "address": "41, Üçoluk Caddesi, Görükle Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.226515,
    "lng": 28.848272,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-40",
    "label": "ALİCAN ÖZALPAY",
    "address": "Üçoluk Caddesi, Görükle Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.227161,
    "lng": 28.848284,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-41",
    "label": "LEVENT SEZEN",
    "address": "Taşpınar Sokağı, Görükle Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.22964,
    "lng": 28.841926,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-42",
    "label": "İLAYDA BEYTUZUN",
    "address": "Tüter Caddesi, Görükle Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.228753,
    "lng": 28.836426,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-43",
    "label": "gökalp teknik",
    "address": "Pamukkale Caddesi, Dumlupınar, Dumlupınar Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.225322,
    "lng": 28.83915,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-44",
    "label": "YENİ YAŞAM GÖRÜKLE SİTESİ YÖNETİCİLİĞİ",
    "address": "Görükle Mesleki ve Teknik Anadolu Lisesi, Kumru Sokak, Dumlupınar, Dumlupınar Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.224111,
    "lng": 28.831613,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-45",
    "label": "AVLU GÖRÜKLE 2 SİTESİ",
    "address": "Dumlupınar, Dumlupınar Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16285, Türkiye",
    "lat": 40.226526,
    "lng": 28.826499,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-46",
    "label": "AYKUT GEYİK",
    "address": "30 Ağustos Zafer Mahallesi, Tahtalı Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16280, Türkiye",
    "lat": 40.204812,
    "lng": 28.857464,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-47",
    "label": "PANAROMA HASANAĞA SİTESİ YÖNETİCİLİĞİ",
    "address": "Çiçekçi Sokak, Kızılcıklı, Nilüfer, Bursa, Marmara Bölgesi, 16315, Türkiye",
    "lat": 40.194356,
    "lng": 28.807664,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-48",
    "label": "SESLER ELEKTRİK ELEKTRONİK İNŞAAT TAAHHÜT GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Hasanağa, Nilüfer, Bursa, Marmara Bölgesi, 16315, Türkiye",
    "lat": 40.174301,
    "lng": 28.814027,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-49",
    "label": "SARSEL ELEKTRİK TAAHHÜT MÜHENDİSLİK SANAYİ VE TİCARET LİMİTE",
    "address": "Yayalacık Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16275, Türkiye",
    "lat": 40.177083,
    "lng": 28.900808,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-50",
    "label": "KAVAKDERESİTESİ YÖNETİCİLİĞİ",
    "address": "Çağla Sokak, Çamlıca, Çamlıca Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16022, Türkiye",
    "lat": 40.199024,
    "lng": 28.975858,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-51",
    "label": "CUNDA TEKSTİL 62 NO",
    "address": "Dr. Nurullah Doster, 26, 1. Badem Sokak, Konak, Konak Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16110, Türkiye",
    "lat": 40.210875,
    "lng": 28.986602,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-52",
    "label": "CEVAT KARADEMİR",
    "address": "Merkez Sokak, Konak, Konak Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16265, Türkiye",
    "lat": 40.210474,
    "lng": 28.990805,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-53",
    "label": "NİO DIŞ SUR YAPI",
    "address": "Sur Yapı Marka AVM, Mihraplı Caddesi, Odunluk, Odunluk Mahallesi, Nilüfer, Bursa, Marmara Bölgesi, 16265, Türkiye",
    "lat": 40.206274,
    "lng": 28.995956,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-54",
    "label": "EMİRE SAY",
    "address": "2. Meşe Caddesi, Güneşepe, Güneştepe Mahallasi, Osmangazi, Bursa, Marmara Bölgesi, 16100, Türkiye",
    "lat": 40.252225,
    "lng": 29.002452,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-55",
    "label": "BİAREN E__TİCARET OTOMOTİV TEKSTİL MOBİLYA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Yunuseli Bulvarı, Yunuseli, Yunuseli Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16100, Türkiye",
    "lat": 40.252105,
    "lng": 29.016936,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-56",
    "label": "ARTEMİS TEKSTİL KONFEKSİYON SAN.VE TİC.LTD.ŞTİ.",
    "address": "Fuar Caddesi, Altınova, Altınova Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16245, Türkiye",
    "lat": 40.236133,
    "lng": 29.066329,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-57",
    "label": "KUBİLAY YILDIZ",
    "address": "Fuar Caddesi, Altınova, Altınova Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16245, Türkiye",
    "lat": 40.236099,
    "lng": 29.066384,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-58",
    "label": "TUĞÇE EREN",
    "address": "7. Cadde, Demirtaş Cumhuriyet Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16245, Türkiye",
    "lat": 40.244212,
    "lng": 29.079868,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-59",
    "label": "BEYMAK KALIP OTOMOTİV YEDEK PARÇA PAZARLAMA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "1. Kalkan Sokak, Altınova, Altınova Mahallesi, Osmangazi, Bursa, Marmara Bölgesi, 16250, Türkiye",
    "lat": 40.216243,
    "lng": 29.067135,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-60",
    "label": "MEHMET TURGUT",
    "address": "Şüheda Caddesi, Millet Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16370, Türkiye",
    "lat": 40.209861,
    "lng": 29.098193,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-61",
    "label": "BİLAL BASİT",
    "address": "7. Kader Sokak, Kazım Karabekir, Kazım Karabekir Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16370, Türkiye",
    "lat": 40.202554,
    "lng": 29.09747,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-62",
    "label": "öz cesur",
    "address": "Kamiloğlu Sokak, Yunus Emre, Yunus Emre Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16370, Türkiye",
    "lat": 40.201977,
    "lng": 29.105946,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-63",
    "label": "MAZ MEDİKAL",
    "address": "Sekseninciyıl Caddesi, Yunus Emre, Yunus Emre Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16370, Türkiye",
    "lat": 40.197963,
    "lng": 29.110372,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-64",
    "label": "UMUT EFENDİ CAĞ DÖNER",
    "address": "Barış Caddesi, Yavuzselim, Yavuzselim Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16330, Türkiye",
    "lat": 40.192194,
    "lng": 29.111402,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-65",
    "label": "MURAT TAYFUN BUDAKLI",
    "address": "2. Duvarcı Sokak, Mimar Sinan, Mimar Sinan Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16310, Türkiye",
    "lat": 40.182891,
    "lng": 29.124072,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-66",
    "label": "DEĞİRMENÖNÜ OTOMOTİV SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Ankara Yolu Caddesi, Şirinevler, Şirinevler Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16330, Türkiye",
    "lat": 40.196056,
    "lng": 29.161737,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-67",
    "label": "GÜLSEVEN YEMEK GIDA SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "C4. Sokak, Otosansit, Yiğitler, Yiğitler Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16300, Türkiye",
    "lat": 40.194296,
    "lng": 29.166489,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-68",
    "label": "YEKTA ABİ",
    "address": "Atatürk Caddesi, Uludağ Organize Sanayi Bölgesi, Yenidoğan, Yenidoğan Mahallesi, Gürsu, Bursa, Marmara Bölgesi, 16580, Türkiye",
    "lat": 40.203754,
    "lng": 29.188653,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-69",
    "label": "KARACEYLAN OTOMOTİV TAŞIMACILIK SANAYİ VE TİCARET LİMİTED ŞİRKETİ",
    "address": "Koca Ali Caddesi, Samanlı, Samanlı Mahallesi, Yıldırım, Bursa, Marmara Bölgesi, 16370, Türkiye",
    "lat": 40.227144,
    "lng": 29.122393,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-70",
    "label": "ÖZLEM TOPCU",
    "address": "İstiklal Caddesi, Hamidiye, Hamidiye Mahallesi, Gemlik, Bursa, Marmara Bölgesi, 16600, Türkiye",
    "lat": 40.431135,
    "lng": 29.155433,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-71",
    "label": "ALİ TEKKEŞ",
    "address": "İstiklal Caddesi, Hamidiye, Hamidiye Mahallesi, Gemlik, Bursa, Marmara Bölgesi, 16600, Türkiye",
    "lat": 40.431191,
    "lng": 29.155418,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-72",
    "label": "ŞAHİN ÇAKMAK",
    "address": "Şehit Ömer Halis Demir Caddesi, Eşref Dinçer Mahallesi, Gemlik, Bursa, Marmara Bölgesi, 16600, Türkiye",
    "lat": 40.431455,
    "lng": 29.170556,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-73",
    "label": "HANİFE DARCAN",
    "address": "3, Halitpaşa Caddesi, Hasanbey, Işıklı, Mudanya, Bursa, Marmara Bölgesi, 16940, Türkiye",
    "lat": 40.377072,
    "lng": 28.884793,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-74",
    "label": "GÖÇ KARDEŞLER MAHRUKAT NAKLİYECİLİK GIDA TİC.SAN.LTD.ŞTİ.",
    "address": "Göç Yapı Hırdavat, Atatürk Caddesi, Armutlu, İskele, Bayır, Armutlu, Yalova, Marmara Bölgesi, Türkiye",
    "lat": 40.511118,
    "lng": 28.835868,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-75",
    "label": "AHMET GÖÇ",
    "address": "Göç Yapı Hırdavat, Atatürk Caddesi, Armutlu, İskele, Bayır, Armutlu, Yalova, Marmara Bölgesi, Türkiye",
    "lat": 40.511126,
    "lng": 28.83584,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-76",
    "label": "SİMTEN ŞEBNEM GÜNER SADİ",
    "address": "Atatürk Caddesi, Armutlu, Bayır, Armutlu, Yalova, Marmara Bölgesi, Türkiye",
    "lat": 40.518595,
    "lng": 28.829425,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  },
  {
    "id": "kml-addr-77",
    "label": "AKHAYAT SİTESİ",
    "address": "Armutlu, Yalova, Marmara Bölgesi, Türkiye",
    "lat": 40.515041,
    "lng": 28.805445,
    "category": "KML Durakları",
    "note": "",
    "visited": false,
    "phone": ""
  }
];

export const INITIAL_KML_ROUTE: SavedRoute = {
  id: 'route-bursa-kml-77',
  title: 'Bursa Saha Rotası (77 Firma)',
  description: 'KML dosyasından aktarılan sıralı Bursa işletme ve firma rotası',
  category: 'Saha Rotaları',
  color: '#10b981',
  createdAt: '2026-11-16T12:00:00.000Z',
  travelMode: 'DRIVING',
  stops: INITIAL_KML_ADDRESSES.map((a, i) => ({
    id: a.id,
    label: a.label,
    address: a.address,
    lat: a.lat,
    lng: a.lng,
    phone: a.phone || '',
    note: a.note || '',
    visited: false
  }))
};

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
  saveStoredAddresses(INITIAL_KML_ADDRESSES);
  return INITIAL_KML_ADDRESSES;
}

export function saveStoredAddresses(addresses: SavedAddress[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses));
  } catch (e) {
    console.error('Failed to save addresses to localStorage:', e);
  }
}

export function getStoredSavedRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_ROUTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse saved routes:', e);
  }
  const initial = [INITIAL_KML_ROUTE];
  saveStoredSavedRoutes(initial);
  return initial;
}

export function saveStoredSavedRoutes(routes: SavedRoute[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(routes));
  } catch (e) {
    console.error('Failed to save saved routes to localStorage:', e);
  }
}

export function getStoredActiveStops(): RouteStop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_STOPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse active stops:', e);
  }
  const initial = INITIAL_KML_ROUTE.stops;
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
