import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Search, MapPin, Navigation, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface RoomLocationPickerProps {
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  addressHint?: string;
  onChange: (coords: { latitude: number | null; longitude: number | null }) => void;
  height?: string;
  readOnly?: boolean;
}

interface SearchResult {
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
  type?: string;
  source?: 'preset' | 'osm';
}

const THAI_NGUYEN_CENTER: [number, number] = [21.5855, 105.8166];

export const RoomLocationPicker: React.FC<RoomLocationPickerProps> = ({
  initialLatitude,
  initialLongitude,
  addressHint = '',
  onChange,
  height = '360px',
  readOnly = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [currentCoords, setCurrentCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: initialLatitude && !isNaN(Number(initialLatitude)) && Number(initialLatitude) !== 0 ? Number(initialLatitude) : null,
    longitude: initialLongitude && !isNaN(Number(initialLongitude)) && Number(initialLongitude) !== 0 ? Number(initialLongitude) : null,
  });

  const [searchQuery, setSearchQuery] = useState(addressHint);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper create custom pin marker icon
  const createPinIcon = (isDraggable = true) => {
    return L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: ${isDraggable ? 'grab' : 'default'};">
          <div style="background-color: #ef4444; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
            <span style="transform: rotate(45deg); font-size: 15px; font-weight: bold; line-height: 1;">📍</span>
          </div>
          <div style="width: 10px; height: 4px; background: rgba(0,0,0,0.25); border-radius: 50%; margin-top: 2px;"></div>
        </div>
      `,
      iconSize: [36, 42],
      iconAnchor: [18, 40],
    });
  };

  const handleSetCoordinates = useCallback(
    (lat: number | null, lng: number | null) => {
      setCurrentCoords({ latitude: lat, longitude: lng });
      onChange({ latitude: lat, longitude: lng });

      const map = mapInstanceRef.current;
      if (!map) return;

      if (lat !== null && lng !== null) {
        if (!markerRef.current) {
          const marker = L.marker([lat, lng], {
            icon: createPinIcon(!readOnly),
            draggable: !readOnly,
          }).addTo(map);

          if (!readOnly) {
            marker.on('dragend', () => {
              const position = marker.getLatLng();
              handleSetCoordinates(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
            });
          }

          markerRef.current = marker;
        } else {
          markerRef.current.setLatLng([lat, lng]);
          if (!readOnly) {
            markerRef.current.dragging?.enable();
          }
        }
      } else {
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
      }
    },
    [onChange, readOnly]
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialPos: [number, number] =
        currentCoords.latitude && currentCoords.longitude
          ? [currentCoords.latitude, currentCoords.longitude]
          : THAI_NGUYEN_CENTER;

      const map = L.map(mapContainerRef.current, {
        center: initialPos,
        zoom: currentCoords.latitude && currentCoords.longitude ? 16 : 13,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (!readOnly) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          handleSetCoordinates(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
          setErrorMessage(null);
        });
      }

      mapInstanceRef.current = map;

      // Draw initial marker if coordinates are set
      if (currentCoords.latitude && currentCoords.longitude) {
        const marker = L.marker([currentCoords.latitude, currentCoords.longitude], {
          icon: createPinIcon(!readOnly),
          draggable: !readOnly,
        }).addTo(map);

        if (!readOnly) {
          marker.on('dragend', () => {
            const position = marker.getLatLng();
            handleSetCoordinates(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
          });
        }
        markerRef.current = marker;
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker position if props change externally
  useEffect(() => {
    if (
      initialLatitude !== undefined &&
      initialLongitude !== undefined &&
      (initialLatitude !== currentCoords.latitude || initialLongitude !== currentCoords.longitude)
    ) {
      const lat = initialLatitude ? Number(initialLatitude) : null;
      const lng = initialLongitude ? Number(initialLongitude) : null;
      handleSetCoordinates(lat, lng);
      if (lat && lng && mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 16);
      }
    }
  }, [initialLatitude, initialLongitude]);

  // Debounced search for address
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchGeoAddress(searchQuery.trim());
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        console.error('Geo search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Select search result
  const handleSelectLocation = (result: SearchResult) => {
    const lat = Number(result.latitude.toFixed(6));
    const lng = Number(result.longitude.toFixed(6));
    handleSetCoordinates(lat, lng);
    setShowDropdown(false);
    setSearchQuery(result.name);
    setErrorMessage(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1 });
    }
  };

  // Get current GPS
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        // Check if reasonably near Thai Nguyen (Lat ~21.2-22.0, Lng ~105.4-106.3)
        if (lat < 21.0 || lat > 22.2 || lng < 105.2 || lng > 106.5) {
          setErrorMessage('Vị trí hiện tại của thiết bị không thuộc tỉnh Thái Nguyên. Bạn có thể kéo thả ghim trên bản đồ đến đúng địa chỉ phòng trọ.');
        }

        handleSetCoordinates(lat, lng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Bạn đã từ chối quyền truy cập vị trí. Hãy bật GPS trên trình duyệt hoặc click trực tiếp vào bản đồ.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Tín hiệu GPS không khả dụng.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Quá thời gian lấy vị trí GPS.';
        }
        setErrorMessage(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Clear GPS coordinates
  const handleClearLocation = () => {
    handleSetCoordinates(null, null);
    setErrorMessage(null);
  };

  const hasLocation = currentCoords.latitude !== null && currentCoords.longitude !== null;

  return (
    <div className="space-y-3">
      {/* Search & Action bar */}
      {!readOnly && (
        <div className="flex flex-col md:flex-row gap-2">
          {/* Address search box */}
          <div className="relative flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm địa chỉ (VD: Đường Z115, Cổng ICTU, Chợ Quyết Thắng...)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                className="w-full pl-9 pr-9 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin absolute right-3 top-2.5" />
              )}
            </div>

            {/* Dropdown search results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-1000 divide-y divide-slate-100">
                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.latitude}-${item.longitude}-${idx}`}
                    type="button"
                    onClick={() => handleSelectLocation(item)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{item.display_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              title="Lấy tọa độ vị trí thực tế của bạn bằng GPS"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>GPS của tôi</span>
            </button>

            {hasLocation && (
              <button
                type="button"
                onClick={handleClearLocation}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium transition-colors"
                title="Bỏ ghim vị trí này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Gỡ ghim</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error / Alert Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Map display */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-inner z-0">
        <div ref={mapContainerRef} style={{ height, width: '100%' }} />

        {/* Instructions overlay */}
        {!readOnly && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] text-slate-700 shadow-xs border border-slate-200 pointer-events-none z-1000">
            {hasLocation ? '💡 Kéo thả ghim hoặc click để chỉnh vị trí' : '💡 Click vào bản đồ để ghim vị trí'}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        {hasLocation ? (
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đã ghim: <strong>{currentCoords.latitude}</strong>, <strong>{currentCoords.longitude}</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Chưa chọn vị trí chính xác trên bản đồ. Vui lòng click bản đồ hoặc bấm &quot;GPS của tôi&quot;.</span>
          </div>
        )}

        {hasLocation && (
          <a
            href={`https://www.google.com/maps?q=${currentCoords.latitude},${currentCoords.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-[11px] font-medium"
          >
            Kiểm tra trên Google Maps ↗
          </a>
        )}
      </div>
    </div>
  );
};

