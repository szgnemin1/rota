import React, { useState } from 'react';
import { SavedAddress, RouteStop } from '../types';
import PlaceSearchBox from './PlaceSearchBox';
import { Bookmark, Trash2, Home, Briefcase, MapPin, Plus, CheckCircle, Navigation, FileSpreadsheet, Upload, AlertCircle, Loader2, Info, X, Edit, Crosshair, Search, Star } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SavedAddressesProps {
  savedAddresses: SavedAddress[];
  onAddAddress: (address: SavedAddress) => void;
  onAddAddressesBulk: (addresses: SavedAddress[]) => void;
  onUpdateAddress: (id: string, address: Omit<SavedAddress, 'id'>) => Promise<void>;
  onDeleteAddress: (id: string) => void;
  onSelectOnMap: (address: SavedAddress) => void;
  prefilledAddress?: { address: string; lat: number; lng: number } | null;
  onClearPrefilledAddress?: () => void;
  routeStops: RouteStop[];
  setRouteStops: (stops: RouteStop[]) => void;
  setActiveTab: (tab: 'route' | 'saved') => void;
  setMobileTab: (tab: 'route' | 'saved' | 'map') => void;
  showGroupCreationModal?: boolean;
  setShowGroupCreationModal?: (show: boolean) => void;
  defaultOrigin?: RouteStop | null;
  onSetDefaultOrigin?: (stop: RouteStop | null) => void;
}

export default function SavedAddresses({
  savedAddresses,
  onAddAddress,
  onAddAddressesBulk,
  onUpdateAddress,
  onDeleteAddress,
  onSelectOnMap,
  prefilledAddress,
  onClearPrefilledAddress,
  routeStops,
  setRouteStops,
  setActiveTab,
  setMobileTab,
  showGroupCreationModal,
  setShowGroupCreationModal,
  defaultOrigin,
  onSetDefaultOrigin
}: SavedAddressesProps) {
  const [label, setLabel] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<{
    label: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  
  const [successMessage, setSuccessMessage] = useState('');
  
  // States for multi route selection
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [autoSortByDistance, setAutoSortByDistance] = useState(true);

  // Excel Import States
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [matchedColumns, setMatchedColumns] = useState<{ labelCol: string; addrCol: string } | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'resolving' | 'completed' | 'failed'>('idle');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, successCount: 0, failCount: 0 });
  const [importLog, setImportLog] = useState<string>('');
  const [resolvedAddresses, setResolvedAddresses] = useState<SavedAddress[]>([]);

  // Edit Address States
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAddressStr, setEditAddressStr] = useState('');
  const [editLat, setEditLat] = useState<number>(0);
  const [editLng, setEditLng] = useState<number>(0);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocodingText, setIsGeocodingText] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [editError, setEditError] = useState('');

  // Category Grouping States
  const [categoryInput, setCategoryInput] = useState('Genel');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [editCategory, setEditCategory] = useState('Genel');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const [localShowGroupModal, setLocalShowGroupModal] = useState(false);
  const isGroupModalOpen = showGroupCreationModal !== undefined ? showGroupCreationModal : localShowGroupModal;
  const setIsGroupModalOpen = setShowGroupCreationModal !== undefined ? setShowGroupCreationModal : setLocalShowGroupModal;

  // Group Creation Modal States
  const [groupName, setGroupName] = useState('');
  const [searchExistingQuery, setSearchExistingQuery] = useState('');
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const [newGroupAddresses, setNewGroupAddresses] = useState<Array<{ label: string; address: string; lat: number; lng: number }>>([]);
  const [currentSearchPlace, setCurrentSearchPlace] = useState<{ label: string; address: string; lat: number; lng: number } | null>(null);
  const [currentSearchLabel, setCurrentSearchLabel] = useState('');
  const [groupModalError, setGroupModalError] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const filteredSavedAddressesForGroup = savedAddresses.filter(addr => {
    const q = searchExistingQuery.toLowerCase().trim();
    if (!q) return true;
    return (addr.label || '').toLowerCase().includes(q) || (addr.address || '').toLowerCase().includes(q);
  });

  const handleSaveGroup = async () => {
    const targetGroupName = groupName.trim();
    if (!targetGroupName) {
      setGroupModalError("Lütfen bir grup adı girin.");
      return;
    }
    if (selectedExistingIds.length === 0 && newGroupAddresses.length === 0) {
      setGroupModalError("Gruba eklemek için en az bir kayıtlı adres seçmeli veya arayıp eklemelisiniz.");
      return;
    }

    // 1. Check max custom groups (total 10)
    const customCategories = existingCategories.filter(c => c !== 'Genel');
    if (customCategories.length >= 10 && !existingCategories.includes(targetGroupName)) {
      setGroupModalError("En fazla 10 farklı grup oluşturabilirsiniz! Lütfen yeni bir grup ismi girmek yerine mevcut grupları kullanın.");
      return;
    }

    // 2. Check max items in the target group (total 10)
    const alreadyInGroup = savedAddresses.filter(a => (a.category || 'Genel') === targetGroupName && !selectedExistingIds.includes(a.id));
    const totalExpectedInGroup = alreadyInGroup.length + selectedExistingIds.length + newGroupAddresses.length;
    if (totalExpectedInGroup > 10) {
      setGroupModalError(`Bir grupta en fazla 10 adres bulunabilir! Bu grupta toplam ${totalExpectedInGroup} adet adres bulunmaya çalışılıyor. Lütfen sınırı aşmayın.`);
      return;
    }

    setIsSavingGroup(true);
    setGroupModalError('');

    try {
      // 1. Prepare existing selected addresses to update
      const existingToUpdate = savedAddresses.filter(a => selectedExistingIds.includes(a.id)).map(addr => ({
        ...addr,
        category: targetGroupName
      }));

      // 2. Add new addresses bulk
      const newAddressesToCreate = newGroupAddresses.map(addr => ({
        id: `new-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        label: addr.label.trim(),
        address: addr.address.trim(),
        lat: addr.lat,
        lng: addr.lng,
        category: targetGroupName
      }));

      const allAddressesToSave = [...existingToUpdate, ...newAddressesToCreate];

      if (allAddressesToSave.length > 0) {
        await onAddAddressesBulk(allAddressesToSave);
      }

      // Reset states
      setGroupName('');
      setSearchExistingQuery('');
      setSelectedExistingIds([]);
      setNewGroupAddresses([]);
      setCurrentSearchPlace(null);
      setCurrentSearchLabel('');
      setIsGroupModalOpen(false);

      setSuccessMessage('Grup ve adresler başarıyla kaydedildi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error("Grup kaydedilirken hata:", err);
      setGroupModalError("Grup kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const existingCategories = Array.from(new Set(savedAddresses.map(a => a.category || 'Genel')));

  // Search query state for saved addresses
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAddresses = savedAddresses.filter(addr => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (addr.label || '').toLowerCase().includes(q) || (addr.address || '').toLowerCase().includes(q);
  });

  const handleEditClick = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setEditLabel(addr.label);
    setEditAddressStr(addr.address);
    setEditLat(addr.lat);
    setEditLng(addr.lng);
    setEditCategory(addr.category || 'Genel');
    setEditCustomCategory('');
    setEditError('');
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress) return;
    if (!editLabel.trim() || !editAddressStr.trim()) {
      setEditError("Lütfen unvan ve adres alanlarını doldurun.");
      return;
    }
    if (isNaN(editLat) || isNaN(editLng) || editLat === 0 || editLng === 0) {
      setEditError("Geçerli bir koordinat değeri gereklidir.");
      return;
    }

    const finalCat = editCategory === 'custom' ? (editCustomCategory.trim() || 'Genel') : editCategory;

    onUpdateAddress(editingAddress.id, {
      label: editLabel.trim(),
      address: editAddressStr.trim(),
      lat: editLat,
      lng: editLng,
      category: finalCat
    });

    setEditingAddress(null);
    setSuccessMessage("Adres başarıyla güncellendi!");
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setEditError("Tarayıcınız konum tespitini desteklemiyor.");
      return;
    }
    setIsLocating(true);
    setEditError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setEditLat(lat);
        setEditLng(lng);
        setEditAddressStr(`Tespit Edilen Konum (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=tr`, {
            headers: { 'User-Agent': 'RotaPlan-AddressEdit/1.0' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setEditAddressStr(data.display_name);
            }
          }
        } catch (err) {
          // Ignore reverse geocode error
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Konum tespiti hatası:", error);
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setEditError("Konum izni reddedildi. Lütfen tarayıcı izinlerini kontrol edin.");
        } else {
          setEditError(`Konum tespiti başarısız oldu: ${error.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleGeocodeText = async () => {
    if (!editAddressStr.trim()) return;
    setIsGeocodingText(true);
    setEditError('');
    try {
      const searchQ = editAddressStr.toLowerCase().includes('bursa') ? editAddressStr : `${editAddressStr}, bursa`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=1&accept-language=tr`, {
        headers: { 'User-Agent': 'RotaPlan-AddressEdit/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          setEditLat(parseFloat(item.lat));
          setEditLng(parseFloat(item.lon));
          setEditAddressStr(item.display_name);
        } else {
          setEditError("Girdiğiniz adres metnine ait bir konum bulunamadı.");
        }
      } else {
        setEditError("Arama servisi şu an yanıt vermiyor.");
      }
    } catch (err: any) {
      setEditError(`Bağlantı hatası: ${err.message}`);
    } finally {
      setIsGeocodingText(false);
    }
  };

  const handleReverseGeocode = async () => {
    if (editLat === 0 && editLng === 0) return;
    setIsReverseGeocoding(true);
    setEditError('');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${editLat}&lon=${editLng}&addressdetails=1&accept-language=tr`, {
        headers: { 'User-Agent': 'RotaPlan-AddressEdit/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setEditAddressStr(data.display_name);
        } else {
          setEditError("Bu koordinatlara ait bir adres tarifi bulunamadı.");
        }
      } else {
        setEditError("Adres çözümleme servisi şu an yanıt vermiyor.");
      }
    } catch (err: any) {
      setEditError(`Bağlantı hatası: ${err.message}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const processExcelFile = (file: File) => {
    setExcelFile(file);
    setImportStatus('parsing');
    setImportLog('');
    setExcelRows([]);
    setMatchedColumns(null);
    setResolvedAddresses([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          setImportStatus('failed');
          setImportLog('Dosya boş veya okunamadı.');
          return;
        }

        // Find columns matching "İşyeri Unvanı" and "ADRES"
        const firstRowKeys = Object.keys(jsonData[0]);
        let foundLabelCol = "";
        let foundAddrCol = "";

        // First, check for exact/strong matches to avoid any overlap or incorrect overwriting
        for (const key of firstRowKeys) {
          const lowerKey = key.toLowerCase().trim();
          
          // Address column matches (strongest first)
          if (
            lowerKey === 'adres' || 
            lowerKey === 'address' || 
            lowerKey === 'link' || 
            lowerKey === 'konum' || 
            lowerKey === 'url' || 
            lowerKey === 'harita' || 
            lowerKey === 'koordinat'
          ) {
            foundAddrCol = key;
          }
          // Label column matches (strongest first)
          else if (
            lowerKey === 'işyeri unvanı' || 
            lowerKey === 'isyeri unvani' || 
            lowerKey === 'unvan' || 
            lowerKey === 'unvanı' || 
            lowerKey === 'unvani' || 
            lowerKey === 'firma' || 
            lowerKey === 'firma adı' || 
            lowerKey === 'firma adi' || 
            lowerKey === 'başlık' || 
            lowerKey === 'baslik' || 
            lowerKey === 'label' || 
            lowerKey === 'title' || 
            lowerKey === 'isim' || 
            lowerKey === 'ad' || 
            lowerKey === 'adı' || 
            lowerKey === 'adi'
          ) {
            foundLabelCol = key;
          }
        }

        // Fallback to fuzzy substring matches only if they weren't found by exact match
        if (!foundLabelCol || !foundAddrCol) {
          for (const key of firstRowKeys) {
            const lowerKey = key.toLowerCase().trim();
            
            // Skip columns already assigned
            if (key === foundLabelCol || key === foundAddrCol) continue;

            if (!foundAddrCol) {
              if (
                lowerKey.includes('adres') || 
                lowerKey.includes('link') || 
                lowerKey.includes('konum') || 
                lowerKey.includes('url') || 
                lowerKey.includes('koordinat') || 
                lowerKey.includes('address')
              ) {
                foundAddrCol = key;
                continue;
              }
            }

            if (!foundLabelCol) {
              if (
                lowerKey.includes('unvan') || 
                lowerKey.includes('isim') || 
                lowerKey.includes('başlık') || 
                lowerKey.includes('baslik') || 
                lowerKey.includes('label') || 
                lowerKey.includes('title') ||
                lowerKey.includes('firma') ||
                lowerKey.includes('işyeri') ||
                lowerKey.includes('isyeri') ||
                lowerKey === 'ad' ||
                lowerKey === 'adı' ||
                lowerKey === 'adi'
              ) {
                foundLabelCol = key;
              }
            }
          }
        }

        // Ultimate fallback
        if (!foundLabelCol && firstRowKeys.length > 0) {
          const nonAddrKey = firstRowKeys.find(k => k !== foundAddrCol);
          foundLabelCol = nonAddrKey || firstRowKeys[0];
        }
        if (!foundAddrCol && firstRowKeys.length > 0) {
          const nonLabelKey = firstRowKeys.find(k => k !== foundLabelCol);
          foundAddrCol = nonLabelKey || (firstRowKeys[1] || firstRowKeys[0]);
        }

        if (!foundLabelCol || !foundAddrCol) {
          setImportStatus('failed');
          setImportLog('Gerekli sütunlar (İşyeri Unvanı ve ADRES) bulunamadı.');
          return;
        }

        setMatchedColumns({ labelCol: foundLabelCol, addrCol: foundAddrCol });

        const mappedRows = jsonData.map((row, index) => {
          const labelVal = String(row[foundLabelCol] || '').trim();
          const addrVal = String(row[foundAddrCol] || '').trim();

          return {
            index,
            label: labelVal || `İsimsiz Adres ${index + 1}`,
            addressInput: addrVal,
            status: 'pending' as 'pending' | 'resolving' | 'success' | 'failed',
            error: '',
            resolved: null as SavedAddress | null
          };
        }).filter(r => r.addressInput);

        setExcelRows(mappedRows);
        setImportStatus('idle');
        setImportProgress({ current: 0, total: mappedRows.length, successCount: 0, failCount: 0 });
        setImportLog(`Başarıyla okundu. ${mappedRows.length} adet adres kaydı tespit edildi.\nEşleşen Sütunlar:\n- Başlık/Unvan: [${foundLabelCol}]\n- Adres/Link: [${foundAddrCol}]`);
      } catch (err: any) {
        setImportStatus('failed');
        setImportLog(`Dosya ayrıştırma hatası: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const startAddressResolution = async () => {
    if (excelRows.length === 0) return;

    setImportStatus('resolving');
    setImportLog(prev => prev + `\n\n[▶] Adres çözümleme işlemi başlatılıyor...`);

    const updatedRows = [...excelRows];
    const successes: SavedAddress[] = [];
    const token = localStorage.getItem('rotaplan_auth_token') || '';

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      updatedRows[i] = { ...row, status: 'resolving' };
      setExcelRows([...updatedRows]);
      setImportProgress(prev => ({ ...prev, current: i + 1 }));

      const query = row.addressInput;
      let lat = 0;
      let lng = 0;
      let addressString = "";
      let resolveSuccess = false;
      let errorMsg = "";

      if (query.startsWith('http://') || query.startsWith('https://')) {
        try {
          const res = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(query)}`, {
            headers: { 'X-App-Token': token }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              lat = data.lat;
              lng = data.lng;
              addressString = data.address;
              resolveSuccess = true;
            } else {
              errorMsg = "Harita linki çözümlenemedi.";
            }
          } else {
            errorMsg = "Sunucu harita linkini çözümleyemedi.";
          }
        } catch (err: any) {
          errorMsg = `Bağlantı hatası: ${err.message}`;
        }
      } else {
        const coordRegex = /^\s*(-?\d+(\.\d+)?)\s*[\s,;:\/]\s*(-?\d+(\.\d+)?)\s*$/;
        const coordMatch = query.match(coordRegex);

        if (coordMatch) {
          const parsedLat = parseFloat(coordMatch[1]);
          const parsedLng = parseFloat(coordMatch[3]);
          if (parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
            lat = parsedLat;
            lng = parsedLng;
            addressString = `Koordinat Noktası (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
            
            try {
              const rRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=tr`, {
                headers: { 'User-Agent': 'RotaPlan-ExcelImport/1.0' }
              });
              if (rRes.ok) {
                const rData = await rRes.json();
                if (rData && rData.display_name) {
                  addressString = rData.display_name;
                }
              }
            } catch (geoErr) {
              // Ignore
            }
            resolveSuccess = true;
          } else {
            errorMsg = "Geçersiz koordinat değerleri.";
          }
        } else {
          try {
            const searchQ = query.toLowerCase().includes('bursa') ? query : `${query}, bursa`;
            const sRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=1&accept-language=tr`, {
              headers: { 'User-Agent': 'RotaPlan-ExcelImport/1.0' }
            });
            if (sRes.ok) {
              const sData = await sRes.json();
              if (sData && sData.length > 0) {
                const item = sData[0];
                lat = parseFloat(item.lat);
                lng = parseFloat(item.lon);
                addressString = item.display_name;
                resolveSuccess = true;
              } else {
                errorMsg = "Konum bulunamadı.";
              }
            } else {
              errorMsg = "Arama servisi yanıt vermedi.";
            }
          } catch (err: any) {
            errorMsg = `Bağlantı hatası: ${err.message}`;
          }
        }
      }

      if (resolveSuccess) {
        successCount++;
        const newAddr: SavedAddress = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          label: row.label,
          address: addressString,
          lat,
          lng
        };
        successes.push(newAddr);
        updatedRows[i] = {
          ...row,
          status: 'success',
          resolved: newAddr
        };
        setImportLog(prev => prev + `\n[✔️] Başarılı: "${row.label}" -> ${addressString.slice(0, 45)}...`);
      } else {
        failCount++;
        updatedRows[i] = {
          ...row,
          status: 'failed',
          error: errorMsg
        };
        setImportLog(prev => prev + `\n[❌] Hata: "${row.label}" (${query.slice(0, 30)}...) -> ${errorMsg}`);
      }

      setExcelRows([...updatedRows]);
      setImportProgress(prev => ({
        ...prev,
        successCount,
        failCount
      }));

      await delay(600);
    }

    setResolvedAddresses(successes);
    setImportStatus('completed');
    setImportLog(prev => prev + `\n\n[🏁] İşlem Tamamlandı!\nToplam: ${updatedRows.length} | Başarılı: ${successCount} | Başarısız: ${failCount}`);
  };

  const saveImportedAddresses = () => {
    if (resolvedAddresses.length === 0) return;
    onAddAddressesBulk(resolvedAddresses);
    setShowExcelModal(false);
    
    setExcelFile(null);
    setExcelRows([]);
    setMatchedColumns(null);
    setImportStatus('idle');
    setResolvedAddresses([]);

    setSuccessMessage(`${resolvedAddresses.length} adet adres başarıyla toplu olarak kaydedildi!`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Handle auto-populating from map clicks
  React.useEffect(() => {
    if (prefilledAddress) {
      setSelectedPlace({
        label: 'Haritadan Seçilen Konum',
        address: prefilledAddress.address,
        lat: prefilledAddress.lat,
        lng: prefilledAddress.lng
      });
      setLabel(''); // Clear label to allow custom user typing
    }
  }, [prefilledAddress]);

  const handlePlaceSelect = (place: { label: string; address: string; lat: number; lng: number }) => {
    setSelectedPlace(place);
    if (!label) {
      setLabel(place.label); // Auto prepopulate label if empty
    }
  };

  const handleSetAsOrigin = (addr: SavedAddress) => {
    const updated = [...routeStops];
    updated[0] = {
      id: 'origin',
      label: addr.label,
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      isSaved: true
    };
    setRouteStops(updated);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleToggleDefaultOrigin = (addr: SavedAddress) => {
    if (!onSetDefaultOrigin) return;
    const isCurrentDefault = defaultOrigin && defaultOrigin.lat === addr.lat && defaultOrigin.lng === addr.lng;
    if (isCurrentDefault) {
      onSetDefaultOrigin(null);
    } else {
      const stop: RouteStop = {
        id: 'origin',
        label: addr.label,
        address: addr.address,
        lat: addr.lat,
        lng: addr.lng,
        isSaved: true
      };
      onSetDefaultOrigin(stop);
    }
  };

  const handleSetAsDestination = (addr: SavedAddress) => {
    const updated = [...routeStops];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      id: 'destination',
      label: addr.label,
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      isSaved: true
    };
    setRouteStops(updated);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleAddAsWaypoint = (addr: SavedAddress) => {
    if (routeStops.length >= 10) {
      alert("Google Haritalar en fazla 10 durağı (başlangıç, varış ve 8 ara durak) desteklemektedir.");
      return;
    }
    const newId = `waypoint-${Date.now()}`;
    const newWaypoint: RouteStop = {
      id: newId,
      label: addr.label,
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng,
      isSaved: true
    };
    const updated = [...routeStops];
    // Insert waypoint right before destination
    updated.splice(routeStops.length - 1, 0, newWaypoint);
    setRouteStops(updated);
    setActiveTab('route');
    setMobileTab('route');
  };

  const handleCardClick = (addr: SavedAddress) => {
    if (isMultiSelectMode) {
      if (selectedIds.includes(addr.id)) {
        setSelectedIds(selectedIds.filter(id => id !== addr.id));
      } else {
        if (selectedIds.length >= 10) {
          alert("Google Haritalar en fazla 10 durağı (başlangıç, varış ve 8 ara durak) desteklemektedir.");
          return;
        }
        setSelectedIds([...selectedIds, addr.id]);
      }
    } else {
      onSelectOnMap(addr);
    }
  };

  const buildRouteFromSelected = () => {
    if (selectedIds.length === 0) return;

    let selectedAddresses = selectedIds
      .map(id => savedAddresses.find(a => a.id === id))
      .filter(Boolean) as SavedAddress[];

    if (selectedAddresses.length === 0) return;

    // Helper to calculate distance
    const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    if (autoSortByDistance && selectedAddresses.length > 2) {
      const first = selectedAddresses[0];
      const others = selectedAddresses.slice(1);
      
      // Sort others by distance to first
      others.sort((a, b) => {
        const distA = getDistance(first.lat, first.lng, a.lat, a.lng);
        const distB = getDistance(first.lat, first.lng, b.lat, b.lng);
        return distA - distB;
      });

      selectedAddresses = [first, ...others];
    }

    const newStops: RouteStop[] = [];

    if (selectedAddresses.length === 1) {
      const single = selectedAddresses[0];
      newStops.push({
        id: 'origin',
        label: single.label,
        address: single.address,
        lat: single.lat,
        lng: single.lng,
        isSaved: true
      });
      newStops.push({ id: 'destination', label: '', address: '', lat: 0, lng: 0 });
    } else {
      // First is origin
      const first = selectedAddresses[0];
      newStops.push({
        id: 'origin',
        label: first.label,
        address: first.address,
        lat: first.lat,
        lng: first.lng,
        isSaved: true
      });

      // Middle ones are waypoints
      for (let i = 1; i < selectedAddresses.length - 1; i++) {
        const wp = selectedAddresses[i];
        newStops.push({
          id: `waypoint-${Date.now()}-${i}`,
          label: wp.label,
          address: wp.address,
          lat: wp.lat,
          lng: wp.lng,
          isSaved: true
        });
      }

      // Last is destination
      const last = selectedAddresses[selectedAddresses.length - 1];
      newStops.push({
        id: 'destination',
        label: last.label,
        address: last.address,
        lat: last.lat,
        lng: last.lng,
        isSaved: true
      });
    }

    setRouteStops(newStops);
    setActiveTab('route');
    setMobileTab('route');
    setIsMultiSelectMode(false);
    setSelectedIds([]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace || !label.trim()) return;

    const finalCategory = categoryInput === 'custom' ? (customCategoryInput.trim() || 'Genel') : categoryInput;

    const newAddress: SavedAddress = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      label: label.trim(),
      address: selectedPlace.address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      category: finalCategory
    };

    onAddAddress(newAddress);
    
    // Clear form
    setLabel('');
    setSelectedPlace(null);
    setCategoryInput('Genel');
    setCustomCategoryInput('');
    if (onClearPrefilledAddress) {
      onClearPrefilledAddress();
    }
    setSuccessMessage('Adres başarıyla kaydedildi!');
    
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  // Helper to determine icon based on tag
  const getIcon = (addrLabel: string) => {
    const lLower = addrLabel.toLowerCase();
    if (lLower.includes('ev') || lLower.includes('home')) {
      return <Home className="h-4 w-4 text-emerald-600" />;
    } else if (lLower.includes('iş') || lLower.includes('ofis') || lLower.includes('work') || lLower.includes('depo')) {
      return <Briefcase className="h-4 w-4 text-amber-600" />;
    }
    return <Bookmark className="h-4 w-4 text-blue-600" />;
  };

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  return (
    <div id="saved-addresses-panel" className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-indigo-500 fill-indigo-100" />
          Kayıtlı Adreslerim
        </h2>
        <div className="flex items-center gap-2">
          <button
            id="header-create-group-btn"
            type="button"
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1.5 rounded-lg border border-indigo-200/50 transition-colors cursor-pointer shadow-sm"
            title="Yeni Grup Oluştur"
          >
            <Plus className="h-3 w-3 shrink-0" />
            Grup Oluştur
          </button>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
            {savedAddresses.length} Adres
          </span>
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Save Address Form */}
        <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Yeni Adres Ekle</h3>
            <button
              id="trigger-excel-modal-btn"
              type="button"
              onClick={() => {
                setShowExcelModal(true);
                setExcelFile(null);
                setExcelRows([]);
                setMatchedColumns(null);
                setImportStatus('idle');
                setResolvedAddresses([]);
                setImportLog('');
              }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/50 transition-colors cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              Excel'den Yükle
            </button>
          </div>
          
          <form onSubmit={handleSave} className="space-y-3 pt-1">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">Adres Ara</label>
              <PlaceSearchBox
                id="new-address-search"
                placeholder="Haritada arayıp seçin..."
                onPlaceSelected={handlePlaceSelect}
                initialValue={selectedPlace ? selectedPlace.address : ""}
              />
            </div>

            {selectedPlace && (
              <div className="space-y-3 pt-1">
                <div className="text-xs text-slate-500 bg-white border border-slate-100 p-2.5 rounded-lg">
                  <span className="font-semibold text-slate-700">Bulunan Adres: </span>
                  {selectedPlace.address}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Adres İsmi / Etiketi</label>
                  <input
                    id="new-address-label"
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="örn. Ev, Merkez Depo, İzmir Ofis"
                    className="block w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Kategori / Grup</label>
                  <div className="space-y-1.5">
                    <select
                      id="new-address-category-select"
                      value={categoryInput}
                      onChange={(e) => {
                        setCategoryInput(e.target.value);
                        if (e.target.value !== 'custom') {
                          setCustomCategoryInput('');
                        }
                      }}
                      className="block w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 cursor-pointer"
                    >
                      <option value="Genel">Genel</option>
                      <option value="Müşteriler">Müşteriler</option>
                      <option value="Depolar">Depolar</option>
                      <option value="Ev/İş">Ev/İş</option>
                      {existingCategories.filter(c => !['Genel', 'Müşteriler', 'Depolar', 'Ev/İş'].includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="custom">✍ Yeni Grup/Kategori Ekle...</option>
                    </select>
                    {categoryInput === 'custom' && (
                      <input
                        id="new-address-custom-category"
                        type="text"
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        placeholder="Grup ismi girin..."
                        className="block w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                        required
                      />
                    )}
                  </div>
                </div>

                <button
                  id="save-address-submit"
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all duration-150"
                >
                  <Plus className="h-4 w-4" />
                  Adres Defterine Kaydet
                </button>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-150 p-2 rounded-lg animate-pulse">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            )}
          </form>
        </div>

        {/* Multi Route Selection Tool Deck */}
        {savedAddresses.length > 0 && (
          <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Çoklu Rota Sihirbazı</span>
                <span className="text-[10px] text-slate-500">Adresleri sırayla seçip tek tıkla rotaya dökün</span>
              </div>
              <button
                id="toggle-multi-route-mode"
                type="button"
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  setSelectedIds([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer ${
                  isMultiSelectMode
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50/60'
                }`}
              >
                {isMultiSelectMode ? 'Seçimi Kapat' : 'Çoklu Seçim Başlat'}
              </button>
            </div>

            {isMultiSelectMode && (
              <div className="bg-white border border-indigo-100 rounded-lg p-2.5 space-y-2.5 transition-all">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    Seçilen Duraklar: <strong className="text-indigo-600">{selectedIds.length} / 10</strong>
                  </span>
                  {selectedIds.length > 0 && (
                    <button
                      id="clear-multi-selections"
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-slate-400 hover:text-rose-500 font-medium transition-colors"
                    >
                      Seçimleri Temizle
                    </button>
                  )}
                </div>

                {selectedIds.length > 0 ? (
                  <div className="space-y-2">
                    {/* Tiny representation of the current custom route path */}
                    <div className="flex items-center gap-1.5 flex-wrap overflow-hidden p-1.5 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-600">
                      {selectedIds.map((id, index) => {
                        const addr = savedAddresses.find(a => a.id === id);
                        if (!addr) return null;
                        return (
                          <React.Fragment key={id}>
                            {index > 0 && <span className="text-slate-300 font-mono">→</span>}
                            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium text-slate-700 max-w-[80px] truncate" title={addr.label}>
                              {index + 1}. {addr.label}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 px-1 text-xs text-slate-600 font-medium select-none">
                      <input
                        id="auto-sort-by-distance-checkbox"
                        type="checkbox"
                        checked={autoSortByDistance}
                        onChange={(e) => setAutoSortByDistance(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                      />
                      <label htmlFor="auto-sort-by-distance-checkbox" className="cursor-pointer">
                        Başlangıca göre mesafeyle otomatik sırala (Yakından Uzağa)
                      </label>
                    </div>

                    <button
                      id="generate-route-from-selected-btn"
                      type="button"
                      onClick={buildRouteFromSelected}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                      Seçilen {selectedIds.length} Adresle Rota Oluştur
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 py-1 text-center">
                    Aşağıdaki listeden rotaya dahil etmek istediğiniz adresleri <strong className="text-slate-500">sırasıyla</strong> seçin.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Saved Addresses List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Adres Listesi</h3>
            {isMultiSelectMode && (
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 animate-pulse">
                Çoklu Seçim Aktif
              </span>
            )}
          </div>

          {savedAddresses.length > 0 && (
            <div className="relative">
              <input
                id="address-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kayıtlı adreslerde unvan veya adres ara..."
                className="w-full text-xs pl-8.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 font-semibold placeholder-slate-400 transition-all shadow-inner"
              />
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </div>
              {searchQuery && (
                <button
                  id="clear-address-search-btn"
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Aramayı Temizle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {savedAddresses.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-150 text-slate-400">
              <Bookmark className="h-8 w-8 mx-auto text-slate-300 stroke-1 mb-2" />
              <p className="text-sm font-medium">Henüz kayıtlı adres yok</p>
              <p className="text-xs mt-1 text-slate-400/80">Yukarıdaki arama çubuğunu kullanarak ilk adresinizi kaydedebilirsiniz.</p>
            </div>
          ) : filteredAddresses.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-150 text-slate-400 animate-fade-in">
              <AlertCircle className="h-7 w-7 mx-auto text-indigo-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Aramanızla eşleşen kayıtlı adres bulunamadı.</p>
              <button
                id="reset-search-no-results-btn"
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer bg-indigo-50/50 hover:bg-indigo-100/60 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all"
              >
                Aramayı Temizle
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                filteredAddresses.reduce((groups, addr) => {
                  const cat = addr.category || 'Genel';
                  if (!groups[cat]) {
                    groups[cat] = [];
                  }
                  groups[cat].push(addr);
                  return groups;
                }, {} as Record<string, SavedAddress[]>)
              ).map(([catName, addresses]) => {
                const isCollapsed = !!collapsedCategories[catName];
                return (
                  <div key={catName} className="space-y-2.5 border border-slate-100/70 rounded-2xl p-3 bg-slate-50/15">
                    {/* Category Header */}
                    <div className="w-full flex items-center justify-between py-1 px-1 text-xs font-bold border-b border-slate-100 pb-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {isMultiSelectMode ? (
                          <input
                            type="checkbox"
                            checked={addresses.every(addr => selectedIds.includes(addr.id))}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const addressIds = addresses.map(a => a.id);
                              if (checked) {
                                setSelectedIds(prev => {
                                  const filteredPrev = prev.filter(id => !addressIds.includes(id));
                                  return [...filteredPrev, ...addressIds];
                                });
                              } else {
                                setSelectedIds(prev => prev.filter(id => !addressIds.includes(id)));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mr-1 accent-indigo-600"
                            title="Grubun tüm adreslerini seç veya kaldır"
                          />
                        ) : (
                          <Bookmark className="h-3.5 w-3.5 fill-indigo-100/40 text-indigo-700 shrink-0" />
                        )}
                        <span className="text-indigo-800 font-extrabold text-xs">{catName}</span>
                        <span className="bg-indigo-50 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-100">
                          {addresses.length} Adres
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!isMultiSelectMode && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMultiSelectMode(true);
                              setSelectedIds(addresses.map(a => a.id));
                            }}
                            className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded border border-indigo-200 cursor-pointer transition-all"
                            title="Bu grubun tüm adreslerini rotaya eklemek için seç"
                          >
                            Grubu Seç
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleCategoryCollapse(catName)}
                          className="text-slate-400 hover:text-slate-600 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          {isCollapsed ? 'Göster ▼' : 'Gizle ▲'}
                        </button>
                      </div>
                    </div>

                    {/* Category Contents */}
                    {!isCollapsed && (
                      <div className="space-y-2 pt-1 transition-all">
                        {addresses.map((addr) => {
                          const isSelected = selectedIds.includes(addr.id);
                          const selectIndex = selectedIds.indexOf(addr.id);

                          return (
                            <div
                              id={`saved-addr-card-${addr.id}`}
                              key={addr.id}
                              onClick={() => handleCardClick(addr)}
                              className={`group relative flex flex-col p-3 border rounded-xl transition-all duration-150 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-300 shadow-sm'
                                  : isMultiSelectMode
                                  ? 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/10'
                                  : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50/40'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2.5 min-w-0 pr-8">
                                  {/* Circle Checkbox / Order Indicator or default Icon */}
                                  {isMultiSelectMode ? (
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border font-bold transition-all ${
                                      isSelected
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300'
                                    }`}>
                                      {isSelected ? (
                                        <span className="text-xs">{selectIndex + 1}</span>
                                      ) : (
                                        <Plus className="h-3.5 w-3.5" />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                      {getIcon(addr.label)}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <h4 className="font-semibold text-slate-800 text-sm truncate">{addr.label}</h4>
                                    <p className="text-slate-500 text-xs truncate mt-0.5" title={addr.address}>
                                      {addr.address}
                                    </p>
                                    <div className="flex gap-2.5 mt-1 text-[10px] text-slate-400 font-mono">
                                      <span>Enl: {addr.lat.toFixed(4)}</span>
                                      <span>Boy: {addr.lng.toFixed(4)}</span>
                                    </div>

                                    {/* Inline Group / Category Selector */}
                                    <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[10px] font-bold text-slate-400">Grup:</span>
                                      <select
                                        value={addr.category || 'Genel'}
                                        onChange={async (e) => {
                                          const newCat = e.target.value;
                                          if (newCat === '__new__') {
                                            const name = window.prompt("Yeni grup adı girin (Maksimum 10 eleman olabilir):");
                                            if (name && name.trim()) {
                                              const trimmed = name.trim();
                                              // Check custom groups limit
                                              const currentCustomCats = existingCategories.filter(c => c !== 'Genel');
                                              if (currentCustomCats.length >= 10 && !existingCategories.includes(trimmed)) {
                                                alert("En fazla 10 farklı grup oluşturabilirsiniz!");
                                                return;
                                              }
                                              // Check target group size limit
                                              const itemsInTarget = savedAddresses.filter(a => (a.category || 'Genel') === trimmed).length;
                                              if (itemsInTarget >= 10) {
                                                alert(`"${trimmed}" grubu zaten maksimum 10 adres sınırına ulaştı!`);
                                                return;
                                              }
                                              await onUpdateAddress(addr.id, {
                                                ...addr,
                                                category: trimmed
                                              });
                                            }
                                          } else {
                                            // Check target group size limit
                                            const itemsInTarget = savedAddresses.filter(a => (a.category || 'Genel') === newCat).length;
                                            if (newCat !== 'Genel' && itemsInTarget >= 10 && addr.category !== newCat) {
                                              alert(`"${newCat}" grubu zaten maksimum 10 adres sınırına ulaştı!`);
                                              return;
                                            }
                                            await onUpdateAddress(addr.id, {
                                              ...addr,
                                              category: newCat
                                            });
                                          }
                                        }}
                                        className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all max-w-[150px] truncate"
                                      >
                                        {existingCategories.map(cat => {
                                          const count = savedAddresses.filter(a => (a.category || 'Genel') === cat).length;
                                          return (
                                            <option key={cat} value={cat}>
                                              {cat} ({count}/10)
                                            </option>
                                          );
                                        })}
                                        <option value="__new__">+ Yeni Grup...</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                  {/* Visited Status Toggle Button */}
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await onUpdateAddress(addr.id, {
                                        ...addr,
                                        visited: !addr.visited
                                      });
                                    }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                      addr.visited
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                                    }`}
                                    title={addr.visited ? "Gidilmedi olarak işaretle" : "Gidildi olarak işaretle"}
                                  >
                                    <CheckCircle className={`h-3 w-3 ${addr.visited ? 'text-emerald-500 fill-emerald-100' : 'text-slate-300'}`} />
                                    <span>{addr.visited ? 'Gidildi' : 'Gidilmedi'}</span>
                                  </button>

                                  <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 transition-all">
                                    <button
                                      id={`edit-addr-${addr.id}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent card click
                                        handleEditClick(addr);
                                      }}
                                      className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
                                      title="Adresi Düzenle"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      id={`delete-addr-${addr.id}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent card click
                                        onDeleteAddress(addr.id);
                                      }}
                                      className="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Adresi Sil"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Quick routing selectors from this address (Only visible if not in multi select mode) */}
                              {!isMultiSelectMode && (
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                                  <button
                                    id={`set-origin-btn-${addr.id}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetAsOrigin(addr);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-all cursor-pointer"
                                  >
                                    <Navigation className="h-3 w-3 shrink-0" />
                                    Başlangıç
                                  </button>
                                  {onSetDefaultOrigin && (
                                    <button
                                      id={`set-default-origin-btn-${addr.id}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleDefaultOrigin(addr);
                                      }}
                                      className={`flex items-center gap-1 px-2 py-1 rounded font-bold text-[10px] border transition-all cursor-pointer ${
                                        defaultOrigin && defaultOrigin.lat === addr.lat && defaultOrigin.lng === addr.lng
                                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                      }`}
                                      title={defaultOrigin && defaultOrigin.lat === addr.lat && defaultOrigin.lng === addr.lng ? "Sabit Başlangıç Konumunu Kaldır" : "Bu adresi Rota Planlayıcı için kalıcı sabit başlangıç yap"}
                                    >
                                      <Star className={`h-3 w-3 shrink-0 ${defaultOrigin && defaultOrigin.lat === addr.lat && defaultOrigin.lng === addr.lng ? 'fill-amber-500 text-amber-600' : 'text-slate-400'}`} />
                                      {defaultOrigin && defaultOrigin.lat === addr.lat && defaultOrigin.lng === addr.lng ? 'Sabit Başlangıç ✓' : 'Sabit Başlangıç Yap'}
                                    </button>
                                  )}
                                  <button
                                    id={`add-waypoint-btn-${addr.id}`}
                                    type="button"
                                    disabled={routeStops.length >= 10}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddAsWaypoint(addr);
                                    }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded font-bold text-[10px] border transition-all ${
                                      routeStops.length >= 10
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 cursor-pointer'
                                    }`}
                                  >
                                    <Plus className="h-3 w-3 shrink-0" />
                                    Durak Ekle
                                  </button>
                                  <button
                                    id={`set-dest-btn-${addr.id}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetAsDestination(addr);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-200 transition-all cursor-pointer"
                                  >
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    Varış
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* EXCEL IMPORT MODAL */}
      {showExcelModal && (
        <div id="excel-import-modal" className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[580px] border border-slate-100 animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Excel / CSV ile Toplu Adres Yükle</h3>
                  <p className="text-xs text-slate-500">Adreslerinizi tek tek yazmak yerine Excel tablonuzdan anında içeri aktarın</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (importStatus === 'resolving') {
                    if (!confirm("Adres çözümleme işlemi devam ediyor. Çıkmak istediğinizden emin misiniz?")) return;
                  }
                  setShowExcelModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Instructions and Mockup */}
              {importStatus === 'idle' && excelRows.length === 0 && (
                <div className="space-y-4">
                  <div className="flex gap-3 p-4 bg-indigo-50/60 border border-indigo-100 text-indigo-900 text-xs rounded-2xl">
                    <Info className="h-5 w-5 shrink-0 text-indigo-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-[13px]">Nasıl Çalışır?</p>
                      <p className="leading-relaxed">
                        Excel dosyanızda <strong className="font-bold text-indigo-700">İşyeri Unvanı</strong> ve <strong className="font-bold text-indigo-700">ADRES</strong> isimli iki sütun bulunmalıdır. ADRES sütununda Google Haritalar paylaşım linkleri (goo.gl, maps.app.goo.gl vb.), koordinat değerleri (örn. <code className="bg-white px-1 py-0.5 rounded border">40.182, 29.066</code>) veya açık adresler yer alabilir. Uygulama hepsini otomatik olarak çözerek harita üzerine yerleştirir.
                      </p>
                    </div>
                  </div>

                  {/* Visual Example Table mockup */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                    <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Örnek Excel Şablonu</span>
                      <span className="text-emerald-600 font-semibold lowercase">(.xlsx veya .csv)</span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-white border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="p-3 border-r border-slate-200">İşyeri Unvanı</th>
                          <th className="p-3">ADRES</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-500 font-mono">
                        <tr className="border-b border-slate-150">
                          <td className="p-3 bg-white border-r border-slate-200 text-slate-800 font-sans font-medium">Bursa Merkez Depo</td>
                          <td className="p-3 bg-white text-blue-600 truncate max-w-[280px]">https://maps.app.goo.gl/abcdefg</td>
                        </tr>
                        <tr className="border-b border-slate-150">
                          <td className="p-3 bg-white border-r border-slate-200 text-slate-800 font-sans font-medium">Nilüfer Bölge Bayii</td>
                          <td className="p-3 bg-white text-slate-600">40.1983, 28.9812</td>
                        </tr>
                        <tr className="bg-slate-50/50">
                          <td className="p-3 bg-white border-r border-slate-200 text-slate-800 font-sans font-medium">Osmangazi Mağazası</td>
                          <td className="p-3 bg-white text-slate-600 font-sans">Bursa Kent Meydanı AVM önü</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Upload Drag Drop Area */}
              {importStatus !== 'resolving' && importStatus !== 'completed' && (
                <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-8 text-center transition-all cursor-pointer relative bg-slate-50/50 hover:bg-emerald-50/5 group">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl w-fit mx-auto mb-3 text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-150">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {excelFile ? `Seçilen Dosya: ${excelFile.name}` : "Excel veya CSV Dosyası Sürükleyin veya Tıklayın"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">Maksimum 5MB boyutunda .xlsx, .xls, .csv dosyaları desteklenir</p>
                </div>
              )}

              {/* Error State parsing failure */}
              {importStatus === 'failed' && (
                <div className="flex gap-3 p-4 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl items-start">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                  <div>
                    <h4 className="font-bold text-rose-900 text-[13px] mb-0.5">Yükleme Başarısız</h4>
                    <p>{importLog}</p>
                  </div>
                </div>
              )}

              {/* Parsed Rows Preview / Progress List */}
              {excelRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                    <span>Yüklenen Adresler ({excelRows.length} Adet)</span>
                    {importStatus === 'resolving' && (
                      <span className="text-indigo-600 flex items-center gap-1.5 font-bold">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Çözümleniyor... {importProgress.current} / {importProgress.total}
                      </span>
                    )}
                    {importStatus === 'completed' && (
                      <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                        Çözümleme Tamamlandı!
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {importStatus === 'resolving' && (
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-200"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Small Live Counts Row */}
                  {(importStatus === 'resolving' || importStatus === 'completed') && (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Toplam</span>
                        <strong className="text-slate-700 text-sm">{importProgress.total}</strong>
                      </div>
                      <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/60">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Başarılı</span>
                        <strong className="text-emerald-600 text-sm">{importProgress.successCount}</strong>
                      </div>
                      <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100/60">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Hatalı</span>
                        <strong className="text-rose-500 text-sm">{importProgress.failCount}</strong>
                      </div>
                    </div>
                  )}

                  {/* Scrollable Table View */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[220px] overflow-y-auto bg-slate-50/30">
                    <table className="w-full text-left border-collapse text-xs select-none">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-semibold">
                          <th className="p-3 w-[150px]">İşyeri Unvanı</th>
                          <th className="p-3">Adres / Girdi</th>
                          <th className="p-3 text-right w-[110px]">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {excelRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-semibold text-slate-800 max-w-[150px] truncate" title={row.label}>{row.label}</td>
                            <td className="p-3 text-slate-500 truncate max-w-[220px]" title={row.addressInput}>{row.addressInput}</td>
                            <td className="p-3 text-right">
                              {row.status === 'pending' && <span className="text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full font-medium text-[10px]">Bekliyor</span>}
                              {row.status === 'resolving' && (
                                <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 justify-end">
                                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                  Aranıyor
                                </span>
                              )}
                              {row.status === 'success' && <span className="text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full font-bold text-[10px]">✓ Başarılı</span>}
                              {row.status === 'failed' && <span className="text-rose-700 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-full font-bold text-[10px]" title={row.error}>⚠ Hatalı</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Terminal Style Live Logs Container */}
                  {importLog && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Çözümleyici Log Çıktısı</span>
                      <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[110px] overflow-y-auto whitespace-pre-wrap border border-slate-800 shadow-inner">
                        {importLog}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button
                id="close-excel-modal-btn"
                type="button"
                disabled={importStatus === 'resolving'}
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vazgeç
              </button>

              {excelRows.length > 0 && importStatus === 'idle' && (
                <button
                  id="start-excel-resolution-btn"
                  type="button"
                  onClick={startAddressResolution}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                >
                  <Navigation className="h-4 w-4 shrink-0" />
                  Adresleri Çözümlemeye Başla
                </button>
              )}

              {importStatus === 'completed' && resolvedAddresses.length > 0 && (
                <button
                  id="save-excel-resolved-btn"
                  type="button"
                  onClick={saveImportedAddresses}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Kayıtlı {resolvedAddresses.length} Adresi Deftere Ekle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT ADDRESS MODAL */}
      {editingAddress && (
        <div id="edit-address-modal" className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Adresi Düzenle</h3>
                  <p className="text-xs text-slate-500">Unvan, adres metni veya koordinat değerlerini güncelleyin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateSubmit} className="flex-1 flex flex-col">
              <div className="p-6 space-y-4">
                
                {/* Error Alert */}
                {editError && (
                  <div className="flex gap-2.5 p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl items-start">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <p>{editError}</p>
                  </div>
                )}

                {/* Label Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">İşyeri Unvanı / Firma İsmi</label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="örn. Bursa Merkez Ofis, Osmangazi Depo"
                    className="block w-full text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium shadow-sm"
                    required
                  />
                </div>

                {/* Category Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Grup / Kategori</label>
                  <div className="space-y-1.5">
                    <select
                      value={editCategory}
                      onChange={(e) => {
                        setEditCategory(e.target.value);
                        if (e.target.value !== 'custom') {
                          setEditCustomCategory('');
                        }
                      }}
                      className="block w-full text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium shadow-sm cursor-pointer"
                    >
                      <option value="Genel">Genel</option>
                      <option value="Müşteriler">Müşteriler</option>
                      <option value="Depolar">Depolar</option>
                      <option value="Ev/İş">Ev/İş</option>
                      {existingCategories.filter(c => !['Genel', 'Müşteriler', 'Depolar', 'Ev/İş'].includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="custom">✍ Yeni Grup/Kategori Ekle...</option>
                    </select>
                    {editCategory === 'custom' && (
                      <input
                        type="text"
                        value={editCustomCategory}
                        onChange={(e) => setEditCustomCategory(e.target.value)}
                        placeholder="Grup ismi girin..."
                        className="block w-full text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium shadow-sm"
                        required
                      />
                    )}
                  </div>
                </div>

                {/* Place Search Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-600">Haritada Yeni Yer Arayın (Otomatik)</label>
                    <span className="text-[10px] text-slate-400">Tercihen</span>
                  </div>
                  <PlaceSearchBox
                    id="edit-modal-search"
                    placeholder="Haritada yeni bir yer arayıp seçin..."
                    onPlaceSelected={(place) => {
                      setEditAddressStr(place.address);
                      setEditLat(place.lat);
                      setEditLng(place.lng);
                      setEditError('');
                    }}
                    initialValue=""
                  />
                </div>

                {/* Address Text Field with Geocoding option */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Adres Tarifi / Metni</label>
                  <div className="relative">
                    <textarea
                      value={editAddressStr}
                      onChange={(e) => setEditAddressStr(e.target.value)}
                      placeholder="Açık adres yazın..."
                      rows={2}
                      className="block w-full text-sm pl-3.5 pr-24 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium shadow-sm resize-none"
                      required
                    />
                    <button
                      type="button"
                      disabled={isGeocodingText || !editAddressStr.trim()}
                      onClick={handleGeocodeText}
                      className="absolute right-2 bottom-2 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:bg-slate-50 text-indigo-600 text-[11px] font-bold rounded-lg border border-indigo-200/50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {isGeocodingText ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Navigation className="h-3 w-3" />
                      )}
                      Haritada Bul
                    </button>
                  </div>
                </div>

                {/* Coordinates Field with Locating Options */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Coğrafi Koordinatlar</span>
                    <button
                      type="button"
                      disabled={isLocating}
                      onClick={handleDetectCurrentLocation}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/50 transition-all cursor-pointer"
                    >
                      {isLocating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Crosshair className="h-3.5 w-3.5" />
                      )}
                      Mevcut Konumumu Algıla
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Enlem (Lat)</label>
                      <input
                        type="number"
                        step="any"
                        value={editLat || ''}
                        onChange={(e) => setEditLat(parseFloat(e.target.value))}
                        placeholder="örn. 40.18"
                        className="block w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Boylam (Lng)</label>
                      <input
                        type="number"
                        step="any"
                        value={editLng || ''}
                        onChange={(e) => setEditLng(parseFloat(e.target.value))}
                        placeholder="örn. 29.06"
                        className="block w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  {editLat !== 0 && editLng !== 0 && (
                    <button
                      type="button"
                      disabled={isReverseGeocoding}
                      onClick={handleReverseGeocode}
                      className="mt-2.5 w-full flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      {isReverseGeocoding ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MapPin className="h-3 w-3 shrink-0" />
                      )}
                      Bu Koordinatlardan Adresi Çözümle (Ters Geocode)
                    </button>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAddress(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Creation Modal */}
      {isGroupModalOpen && (
        <div id="group-creation-modal-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100/80 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/40 to-white">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <Bookmark className="h-5 w-5 text-indigo-600 fill-indigo-100/30" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Yeni Grup / Kategori Oluştur</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Yeni ve kayıtlı adresleri tek bir grupta toplayın</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {groupModalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200/50 text-rose-600 text-xs font-semibold rounded-2xl flex items-center gap-2 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{groupModalError}</span>
                </div>
              )}

              {/* Group Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Grup / Kategori Adı</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    setGroupModalError('');
                  }}
                  placeholder="örn. Bursa Kuzey Bölgesi, Önemli Depolar"
                  className="block w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-semibold shadow-2xs"
                  required
                />
              </div>

              {/* Section 1: Place Search (New Location) */}
              <div className="border border-slate-100 bg-slate-50/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Search className="h-3.5 w-3.5 text-indigo-500" />
                    Haritadan Arama ile Yeni Adres Ekle
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-150 px-2 py-0.5 rounded-full font-bold">
                    Yeni Konum Arama
                  </span>
                </div>

                <div className="space-y-2.5">
                  <PlaceSearchBox
                    id="modal-group-place-search"
                    placeholder="Haritada arayıp gruba yeni yer bulun..."
                    onPlaceSelected={(place) => {
                      setCurrentSearchPlace(place);
                      setCurrentSearchLabel(place.label || '');
                    }}
                  />

                  {currentSearchPlace && (
                    <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-3 animate-in slide-in-from-top-3 duration-150">
                      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                        <span className="font-semibold text-slate-700">Bulunan Yer: </span>
                        {currentSearchPlace.address}
                      </div>

                      <div className="flex gap-2.5 items-end">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Adres Etiketi / Unvanı</label>
                          <input
                            type="text"
                            value={currentSearchLabel}
                            onChange={(e) => setCurrentSearchLabel(e.target.value)}
                            placeholder="örn. Nilüfer Mağazası, Depo C"
                            className="block w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!currentSearchLabel.trim()) {
                              alert("Lütfen bir adres etiketi girin.");
                              return;
                            }
                            setNewGroupAddresses(prev => [
                              ...prev,
                              {
                                label: currentSearchLabel,
                                address: currentSearchPlace.address,
                                lat: currentSearchPlace.lat,
                                lng: currentSearchPlace.lng
                              }
                            ]);
                            setCurrentSearchPlace(null);
                            setCurrentSearchLabel('');
                          }}
                          className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Listeye Ekle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Address Book Selector */}
              <div className="border border-slate-100 bg-slate-50/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Bookmark className="h-3.5 w-3.5 text-indigo-500" />
                    Kayıtlı Adres Defterinden Seç
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredSavedAddressesForGroup.map(a => a.id);
                      const allSelected = allIds.every(id => selectedExistingIds.includes(id));
                      if (allSelected) {
                        setSelectedExistingIds(prev => prev.filter(id => !allIds.includes(id)));
                      } else {
                        setSelectedExistingIds(prev => Array.from(new Set([...prev, ...allIds])));
                      }
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer"
                  >
                    {filteredSavedAddressesForGroup.map(a => a.id).every(id => selectedExistingIds.includes(id)) ? 'Seçimi Temizle' : 'Tümünü Seç'}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchExistingQuery}
                      onChange={(e) => setSearchExistingQuery(e.target.value)}
                      placeholder="Kayıtlı adreslerde ara..."
                      className="w-full text-xs pl-8.5 pr-8 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-semibold"
                    />
                    <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-3 w-3" />
                    </div>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto border border-slate-100 rounded-xl bg-white p-1.5 space-y-1">
                    {filteredSavedAddressesForGroup.length === 0 ? (
                      <div className="text-center py-4 text-[11px] text-slate-400 font-medium">
                        Aranan kriterlere uygun kayıtlı adres bulunamadı.
                      </div>
                    ) : (
                      filteredSavedAddressesForGroup.map((addr) => {
                        const isSelected = selectedExistingIds.includes(addr.id);
                        return (
                          <div 
                            key={addr.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedExistingIds(prev => prev.filter(id => id !== addr.id));
                              } else {
                                setSelectedExistingIds(prev => [...prev, addr.id]);
                              }
                            }}
                            className="flex items-center gap-2.5 py-1.5 px-2.5 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-700 truncate">{addr.label}</p>
                              <p className="text-[10px] text-slate-400 truncate leading-tight">{addr.address}</p>
                            </div>
                            {addr.category && (
                              <span className="text-[8px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider border border-indigo-100">
                                {addr.category}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Merged Included List */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Gruba Eklenecek Adresler ({selectedExistingIds.length + newGroupAddresses.length})
                </span>

                <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-[160px] overflow-y-auto bg-slate-50/50 p-2 space-y-1.5">
                  {selectedExistingIds.length === 0 && newGroupAddresses.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      Henüz gruba dahil edilmiş bir adres yok. Yukarıdan seçin veya arayıp ekleyin.
                    </div>
                  ) : (
                    <>
                      {/* Existing ones in list */}
                      {savedAddresses.filter(a => selectedExistingIds.includes(a.id)).map(addr => (
                        <div key={addr.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-slate-150 shadow-2xs">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                              <Bookmark className="h-3 w-3 shrink-0 text-indigo-500" />
                              {addr.label}
                            </span>
                            <span className="block text-[10px] text-slate-500 truncate mt-0.5">{addr.address}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedExistingIds(prev => prev.filter(id => id !== addr.id))}
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 animate-fade-in"
                            title="Gruptan Çıkar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* New ones in list */}
                      {newGroupAddresses.map((addr, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-emerald-150 shadow-2xs">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                              <Plus className="h-3 w-3 shrink-0 text-emerald-500" />
                              {addr.label} <span className="text-[9px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 rounded-md border border-emerald-100">Yeni</span>
                            </span>
                            <span className="block text-[10px] text-slate-500 truncate mt-0.5">{addr.address}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewGroupAddresses(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Gruptan Çıkar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setGroupName('');
                  setSearchExistingQuery('');
                  setSelectedExistingIds([]);
                  setNewGroupAddresses([]);
                  setCurrentSearchPlace(null);
                  setCurrentSearchLabel('');
                  setIsGroupModalOpen(false);
                }}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={isSavingGroup}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSavingGroup ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Grup Kaydediliyor...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    Grubu ve Adresleri Kaydet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
