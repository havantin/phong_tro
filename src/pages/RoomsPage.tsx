import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  MapPin,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  Grid,
  List,
  Map,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Room, LocationItem, Amenity } from '../types';
import { api } from '../services/api';
import { RoomCard } from '../components/RoomCard';
import { LeafletMap } from '../components/LeafletMap';

export const RoomsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [amenitiesList, setAmenitiesList] = useState<Amenity[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');

  // Filter states
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [nearLocation, setNearLocation] = useState(searchParams.get('near_location') || '');
  const [radius, setRadius] = useState<number>(
    searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : 3
  );
  const [roomType, setRoomType] = useState(searchParams.get('room_type') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [minArea, setMinArea] = useState(searchParams.get('min_area') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [page, setPage] = useState(1);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    searchParams.get('amenities') ? searchParams.get('amenities')!.split(',') : []
  );

  const [targetLocationObj, setTargetLocationObj] = useState<LocationItem | null>(null);

  // Load locations and amenities metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const [locs, ams] = await Promise.all([api.getLocations(), api.getAmenities()]);
        setLocations(locs);
        setAmenitiesList(ams);
      } catch (err) {
        console.error(err);
      }
    }
    loadMeta();
  }, []);

  // Fetch rooms based on filters
  useEffect(() => {
    async function fetchRooms() {
      setLoading(true);
      try {
        const params: Record<string, any> = {
          page,
          limit: viewMode === 'map' ? 30 : 9,
          sort,
        };

        if (keyword.trim()) params.keyword = keyword.trim();
        if (nearLocation) params.near_location = nearLocation;
        if (radius) params.radius = radius;
        if (roomType) params.room_type = roomType;
        if (minPrice) params.min_price = minPrice;
        if (maxPrice) params.max_price = maxPrice;
        if (minArea) params.min_area = minArea;
        if (selectedAmenities.length > 0) params.amenities = selectedAmenities.join(',');

        const res = await api.getRooms(params);
        setRooms(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
        setTargetLocationObj(res.target_location || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, [keyword, nearLocation, radius, roomType, minPrice, maxPrice, minArea, selectedAmenities, sort, page, viewMode]);

  const toggleAmenity = (code: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleResetFilters = () => {
    setKeyword('');
    setNearLocation('');
    setRadius(3);
    setRoomType('');
    setMinPrice('');
    setMaxPrice('');
    setMinArea('');
    setSelectedAmenities([]);
    setSort('newest');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-1">
            <MapPin className="w-3.5 h-3.5" /> Chỉ thuộc phạm vi Tỉnh Thái Nguyên
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Tìm phòng trọ tại Thái Nguyên
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tìm thấy <strong className="text-emerald-700 font-bold">{total}</strong> phòng trọ phù hợp tiêu chí
          </p>
        </div>

        {/* View Mode Toggle & Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sorting */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Sắp xếp:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá thấp → cao</option>
              <option value="price_desc">Giá cao → thấp</option>
              {nearLocation && <option value="nearest">Khoảng cách gần nhất</option>}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'grid' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
              }`}
              title="Xem dạng lưới"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
              }`}
              title="Xem danh sách"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'map' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
              }`}
              title="Xem trên bản đồ"
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Bản đồ</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* SIDEBAR FILTERS */}
        <aside className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              Bộ lọc tìm kiếm
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Đặt lại
            </button>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Từ khóa tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="Tên đường, phường, phòng..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Near Location (Universities, Hospitals, KCN) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Gần trường / Địa điểm</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Thái Nguyên</span>
            </label>
            <select
              value={nearLocation}
              onChange={(e) => {
                setNearLocation(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tất cả địa điểm</option>
              <optgroup label="Trường Đại học / Cao đẳng">
                {locations
                  .filter((l) => l.type === 'university' || l.type === 'college')
                  .map((loc) => (
                    <option key={loc.id} value={loc.short_name}>
                      {loc.short_name} - {loc.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Khu công nghiệp (KCN)">
                {locations
                  .filter((l) => l.type === 'industrial_zone')
                  .map((loc) => (
                    <option key={loc.id} value={loc.short_name}>
                      {loc.short_name} - {loc.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Bệnh viện / Khác">
                {locations
                  .filter((l) => l.type === 'hospital' || l.type === 'landmark')
                  .map((loc) => (
                    <option key={loc.id} value={loc.short_name}>
                      {loc.short_name} - {loc.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Radius selector if location selected */}
          {nearLocation && (
            <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                <span>Bán kính tìm kiếm:</span>
                <span className="text-purple-700 font-extrabold">{radius} km</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={radius}
                onChange={(e) => {
                  setRadius(parseFloat(e.target.value));
                  setPage(1);
                }}
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-[10px] text-purple-600">
                <span>500m</span>
                <span>1km</span>
                <span>2km</span>
                <span>3km</span>
                <span>5km</span>
              </div>
            </div>
          )}

          {/* Price Range */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Khoảng giá (VND/tháng)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Từ (ví dụ: 1000000)"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                placeholder="Đến (ví dụ: 3000000)"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Room Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại phòng</label>
            <select
              value={roomType}
              onChange={(e) => {
                setRoomType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tất cả loại phòng</option>
              <option value="tro_khep_kin">Phòng trọ khép kín</option>
              <option value="chung_cu_mini">Chung cư mini</option>
              <option value="ktx">Ký túc xá</option>
              <option value="nha_nguyen_can">Nhà nguyên căn</option>
              <option value="homestay">Homestay</option>
            </select>
          </div>

          {/* Amenities Checklist */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Tiện nghi cần có</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {amenitiesList.map((am) => {
                const checked = selectedAmenities.includes(am.code);
                return (
                  <label
                    key={am.id}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAmenity(am.code)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span>{am.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ROOMS CONTENT AREA */}
        <div className="lg:col-span-3 space-y-6">
          {/* Target location active alert */}
          {targetLocationObj && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  📍
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-purple-950">
                    Đang tính khoảng cách đến: {targetLocationObj.short_name} ({targetLocationObj.name})
                  </h4>
                  <p className="text-[11px] text-purple-700">{targetLocationObj.address}</p>
                </div>
              </div>
              <button
                onClick={() => setNearLocation('')}
                className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-3 py-1 rounded-lg transition"
              >
                Xóa lọc địa điểm
              </button>
            </div>
          )}

          {/* MAP VIEW */}
          {viewMode === 'map' && (
            <div className="space-y-4">
              <LeafletMap
                rooms={rooms}
                selectedLocation={targetLocationObj}
                radiusKm={radius}
                height="560px"
              />
              <p className="text-xs text-slate-500 text-center">
                * Nhấn vào marker để xem thông tin phòng hoặc liên kết trực tiếp tới trang chi tiết.
              </p>
            </div>
          )}

          {/* GRID OR LIST VIEW */}
          {viewMode !== 'map' && (
            <>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="bg-white rounded-3xl h-80 animate-pulse border border-slate-100 p-4"
                    >
                      <div className="h-44 bg-slate-200 rounded-2xl mb-4" />
                      <div className="h-4 bg-slate-200 rounded-md w-3/4 mb-2" />
                      <div className="h-3 bg-slate-200 rounded-md w-1/2" />
                    </div>
                  ))}
                </div>
              ) : rooms.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-xl">
                    🔍
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Không tìm thấy phòng trọ phù hợp tại Thái Nguyên
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Bạn có thể thử nới rộng khoảng giá, thay đổi bán kính hoặc thử tính năng tìm kiếm bằng AI Chatbot!
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                      : 'space-y-4'
                  }
                >
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      targetLocationName={targetLocationObj?.short_name}
                    />
                  ))}
                </div>
              )}

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 border border-slate-200 rounded-xl bg-white disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                      <button
                        key={num}
                        onClick={() => setPage(num)}
                        className={`w-8 h-8 rounded-xl transition ${
                          page === num
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 border border-slate-200 rounded-xl bg-white disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
