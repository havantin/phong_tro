import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  Scale,
  MapPin,
  Maximize2,
  Users,
  Sparkles,
  Wifi,
  AirVent,
  Car,
  Flame,
  Bath,
  ArrowRight,
  ShieldCheck,
  Footprints,
} from 'lucide-react';
import { Room } from '../types';
import { useCompare } from '../context/CompareContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { estimateTravelTime } from '../utils/travelEstimates';

interface RoomCardProps {
  room: Room;
  targetLocationName?: string;
  onFavoriteChange?: (roomId: string, isFav: boolean) => void;
  isInitialFavorite?: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  targetLocationName,
  onFavoriteChange,
  isInitialFavorite = false,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isInCompare, addToCompare, removeFromCompare } = useCompare();
  const [isFavorite, setIsFavorite] = useState(isInitialFavorite);
  const [favLoading, setFavLoading] = useState(false);

  const inCompare = isInCompare(room.id);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      showToast('Vui lòng đăng nhập để lưu phòng vào danh sách yêu thích!', 'info');
      return;
    }
    setFavLoading(true);
    try {
      await api.toggleFavorite(room.id, isFavorite);
      const nextState = !isFavorite;
      setIsFavorite(nextState);
      showToast(nextState ? 'Đã thêm phòng vào danh sách yêu thích' : 'Đã bỏ lưu phòng', 'success');
      if (onFavoriteChange) {
        onFavoriteChange(room.id, nextState);
      }
    } catch (err) {
      showToast('Không thể cập nhật danh sách yêu thích', 'error');
    } finally {
      setFavLoading(false);
    }
  };

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(room.id);
      showToast('Đã xóa khỏi danh sách so sánh', 'info');
    } else {
      const added = addToCompare(room);
      if (added) {
        showToast('Đã thêm vào danh sách so sánh', 'success');
      }
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      const millions = price / 1000000;
      return `${millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu/tháng`;
    }
    return `${price.toLocaleString('vi-VN')} đ/tháng`;
  };

  const getRoomTypeName = (type: string) => {
    switch (type) {
      case 'tro_khep_kin':
        return 'Phòng khép kín';
      case 'chung_cu_mini':
        return 'Chung cư mini';
      case 'ktx':
        return 'Ký túc xá';
      case 'nha_nguyen_can':
        return 'Nhà nguyên căn';
      case 'homestay':
        return 'Homestay sinh viên';
      default:
        return 'Phòng trọ';
    }
  };

  const distVal = room.distance_to_target ?? room.distance_km;
  const travelEst = distVal !== undefined ? estimateTravelTime(distVal) : null;

  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Image & Overlay Controls */}
        <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
          <img
            src={room.images[0] || 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800'}
            alt={room.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />

          {/* Top meta tags */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-xl">
              {getRoomTypeName(room.room_type)}
            </span>

            {room.match_score !== undefined && (
              <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-yellow-300" />
                {room.match_score}% phù hợp
              </span>
            )}
          </div>

          {/* Top right actions */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <button
              onClick={handleToggleCompare}
              title={inCompare ? 'Bỏ so sánh' : 'Thêm vào so sánh'}
              className={`p-2 rounded-xl backdrop-blur-md transition ${
                inCompare
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/80 hover:bg-white text-slate-700'
              }`}
            >
              <Scale className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleFavorite}
              disabled={favLoading}
              title={isFavorite ? 'Bỏ lưu' : 'Lưu tin'}
              className={`p-2 rounded-xl backdrop-blur-md transition ${
                isFavorite
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/80 hover:bg-white text-slate-700'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Price & specs overlay on image bottom */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
            <div>
              <p className="text-xl font-extrabold tracking-tight drop-shadow-sm text-emerald-300">
                {formatPrice(room.price)}
              </p>
            </div>
            <div className="text-[11px] font-medium text-slate-200 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg flex items-center gap-1.5">
              <span>{room.area} m²</span>
              <span>·</span>
              <span>{room.max_people} người</span>
              {room.floor && (
                <>
                  <span>·</span>
                  <span>Tầng {room.floor}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {/* Walking / travel distance kicker */}
          {travelEst && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-200/80 w-fit">
              <Footprints className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {travelEst.walkingMinutes <= 15 ? (
                  <span>
                    Khoảng <strong>{travelEst.walkingMinutes} phút đi bộ</strong> đến {targetLocationName || 'trường'} ({travelEst.distanceKm.toFixed(1)} km)
                  </span>
                ) : (
                  <span>
                    Khoảng <strong>{travelEst.motorbikeMinutes} phút xe máy</strong> đến {targetLocationName || 'trường'} ({travelEst.distanceKm.toFixed(1)} km)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Title */}
          <Link to={`/rooms/${room.id}`} className="block group-hover:text-emerald-700 transition">
            <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
              {room.title}
            </h3>
          </Link>

          {/* Address unboxed metadata */}
          <p className="text-xs text-slate-500 flex items-center gap-1 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {room.street ? `${room.street}, ` : ''}
              {room.ward}, {room.district}, Thái Nguyên
            </span>
          </p>

          {/* Amenities icons quiet row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {room.amenities.includes('air_conditioner') && (
              <span className="flex items-center gap-1">
                <AirVent className="w-3.5 h-3.5 text-blue-500" /> Điều hòa
              </span>
            )}
            {room.amenities.includes('wifi') && (
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Wifi
              </span>
            )}
            {room.amenities.includes('water_heater') && (
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" /> Nóng lạnh
              </span>
            )}
            {room.amenities.includes('private_bathroom') && (
              <span className="flex items-center gap-1">
                <Bath className="w-3.5 h-3.5 text-teal-600" /> Khép kín
              </span>
            )}
            {room.amenities.includes('parking') && (
              <span className="flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-slate-500" /> Chỗ xe
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 sm:px-5 pb-4 pt-1 flex items-center justify-between border-t border-slate-100 text-xs text-slate-500">
        <span className="font-medium text-slate-400">
          Chủ trọ: <span className="text-slate-700 font-semibold">{room.owner_name?.split(' ')[0] || 'Bác chủ'}</span>
        </span>
        <Link
          to={`/rooms/${room.id}`}
          className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700 transition group/btn"
        >
          Xem phòng
          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition" />
        </Link>
      </div>
    </div>
  );
};
