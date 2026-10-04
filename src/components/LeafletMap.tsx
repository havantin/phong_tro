import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Room, LocationItem } from '../types';

interface LeafletMapProps {
  rooms: Room[];
  selectedLocation?: LocationItem | null;
  radiusKm?: number;
  highlightedRoomId?: string;
  onRoomSelect?: (room: Room) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  rooms,
  selectedLocation,
  radiusKm,
  highlightedRoomId,
  onRoomSelect,
  center = [21.5855, 105.8166], // Thai Nguyen default
  zoom = 13,
  height = '500px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup if container is unmounted
    };
  }, []);

  // Update markers, circles, and bounds when rooms or selectedLocation change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Draw target location marker & radius circle if available
    if (selectedLocation) {
      const locLatLng: [number, number] = [selectedLocation.latitude, selectedLocation.longitude];
      bounds.extend(locLatLng);

      const schoolIcon = L.divIcon({
        className: 'custom-school-marker',
        html: `
          <div style="background-color: #7c3aed; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4); border: 2px solid white; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>🏫</span> ${selectedLocation.short_name}
          </div>
        `,
        iconSize: [80, 30],
        iconAnchor: [40, 15],
      });

      const schoolMarker = L.marker(locLatLng, { icon: schoolIcon }).addTo(markersLayer);
      schoolMarker.bindPopup(`
        <div style="font-family: inherit; padding: 4px;">
          <h4 style="font-weight: 800; color: #5b21b6; margin: 0 0 4px 0;">${selectedLocation.short_name}</h4>
          <p style="font-size: 12px; margin: 0 0 4px 0; color: #4b5563;">${selectedLocation.name}</p>
          <p style="font-size: 11px; margin: 0; color: #6b7280;">${selectedLocation.address}</p>
        </div>
      `);

      if (radiusKm && radiusKm > 0) {
        circleRef.current = L.circle(locLatLng, {
          radius: radiusKm * 1000,
          color: '#8b5cf6',
          fillColor: '#8b5cf6',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '5, 8',
        }).addTo(map);
      }
    }

    // 2. Draw Room markers
    rooms.forEach((room) => {
      if (!room.latitude || !room.longitude) return;

      const latLng: [number, number] = [room.latitude, room.longitude];
      bounds.extend(latLng);

      const isHighlighted = room.id === highlightedRoomId;
      const priceText =
        room.price >= 1000000
          ? `${(room.price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`
          : `${room.price / 1000}k`;

      const roomIcon = L.divIcon({
        className: 'custom-room-marker',
        html: `
          <div style="background-color: ${
            isHighlighted ? '#ef4444' : '#059669'
          }; color: white; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); border: 2px solid white; display: flex; align-items: center; gap: 3px; cursor: pointer; white-space: nowrap;">
            <span>🏠</span> ${priceText}
          </div>
        `,
        iconSize: [70, 28],
        iconAnchor: [35, 14],
      });

      const marker = L.marker(latLng, { icon: roomIcon }).addTo(markersLayer);

      const popupHtml = `
        <div style="font-family: inherit; max-width: 200px;">
          <img src="${room.images[0]}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;" />
          <h4 style="font-size: 12px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0; line-height: 1.3;">${room.title}</h4>
          <p style="font-size: 13px; font-weight: 800; color: #059669; margin: 0 0 4px 0;">${(room.price / 1000000).toFixed(1)} tr/tháng • ${room.area}m²</p>
          <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">${room.ward}, Thái Nguyên</p>
          <a href="/rooms/${room.id}" style="display: block; text-align: center; background: #059669; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none;">Xem chi tiết</a>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        if (onRoomSelect) onRoomSelect(room);
      });
    });

    // Fit bounds if we have points
    if (bounds.isValid() && rooms.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [rooms, selectedLocation, radiusKm, highlightedRoomId]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm z-0">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-slate-700 shadow-xs border border-slate-200 z-1000 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Phòng trọ
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span> Trường / Địa điểm
        </span>
      </div>
    </div>
  );
};
