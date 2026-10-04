import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  MapPin,
  Flame,
  ArrowRight,
  GraduationCap,
  Building,
  CheckCircle2,
  ChevronRight,
  Calculator,
  Compass,
  Zap,
} from 'lucide-react';
import { Room, LocationItem } from '../types';
import { api } from '../services/api';
import { RoomCard } from '../components/RoomCard';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [selectedNearLocation, setSelectedNearLocation] = useState('');
  const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
  const [budgetRooms, setBudgetRooms] = useState<Room[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // University filter tab on home page
  const [activeUniTab, setActiveUniTab] = useState('ICTU');
  const [uniRooms, setUniRooms] = useState<Room[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [locs, allRooms, cheapRooms] = await Promise.all([
          api.getLocations(),
          api.getRooms({ limit: 6, sort: 'newest' }),
          api.getRooms({ max_price: 2000000, limit: 6 }),
        ]);

        setLocations(locs);
        setFeaturedRooms(allRooms.data);
        setBudgetRooms(cheapRooms.data);

        // Load rooms near ICTU by default
        const ictuRes = await api.getRooms({ near_location: 'ICTU', limit: 4 });
        setUniRooms(ictuRes.data);
      } catch (err) {
        console.error('Failed to load home page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleUniTabChange = async (shortName: string) => {
    setActiveUniTab(shortName);
    try {
      const res = await api.getRooms({ near_location: shortName, limit: 4 });
      setUniRooms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.append('keyword', keyword.trim());
    if (selectedNearLocation) params.append('near_location', selectedNearLocation);
    navigate(`/rooms?${params.toString()}`);
  };

  const handleAiSearch = () => {
    if (keyword.trim()) {
      navigate(`/ai-search?q=${encodeURIComponent(keyword.trim())}`);
    } else {
      navigate('/ai-search');
    }
  };

  const quickFilterLinks = [
    { label: 'Dưới 2 triệu', params: 'max_price=2000000' },
    { label: '2–3 triệu', params: 'min_price=2000000&max_price=3000000' },
    { label: 'Gần trường ĐH', params: 'near_location=ICTU' },
    { label: 'Có điều hòa', params: 'amenities=air_conditioner' },
    { label: 'Khép kín', params: 'room_type=tro_khep_kin' },
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wide">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Độc quyền phục vụ sinh viên & người lao động Tỉnh Thái Nguyên
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none">
            Tìm phòng trọ phù hợp tại{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
              Thái Nguyên
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
            Tìm phòng nhanh chóng hoặc để <strong className="text-white font-semibold">AI giúp bạn lựa chọn căn phòng phù hợp nhất</strong> theo trường học, ngân sách và tiện nghi.
          </p>

          {/* DUAL SEARCH BAR */}
          <div className="max-w-3xl mx-auto pt-4">
            <form
              onSubmit={handleSearch}
              className="bg-white p-2.5 rounded-3xl shadow-2xl border border-white/20 flex flex-col sm:flex-row items-center gap-2 text-slate-800"
            >
              <div className="flex-1 flex items-center gap-2.5 px-3 w-full">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Bạn muốn tìm phòng ở đâu tại Thái Nguyên? (Ví dụ: gần ICTU, Sông Công...)"
                  className="w-full py-2.5 bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-hidden"
                />
              </div>

              {/* Near Landmark Select */}
              <div className="w-full sm:w-52 border-t sm:border-t-0 sm:border-l border-slate-200 px-3 py-1">
                <select
                  value={selectedNearLocation}
                  onChange={(e) => setSelectedNearLocation(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm text-slate-700 py-2 focus:outline-hidden font-medium cursor-pointer"
                >
                  <option value="">-- Gần trường/KCN --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.short_name}>
                      {loc.short_name} ({loc.name.length > 25 ? loc.name.slice(0, 25) + '...' : loc.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>Tìm phòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleAiSearch}
                  className="flex-1 sm:flex-none px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Tìm bằng AI</span>
                </button>
              </div>
            </form>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4 text-xs">
              <span className="text-slate-400 font-medium">Tìm nhanh:</span>
              {quickFilterLinks.map((f, i) => (
                <Link
                  key={i}
                  to={`/rooms?${f.params}`}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-full transition backdrop-blur-xs border border-white/10"
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SPECIAL ICTU STUDENT PRESET CARD */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 rounded-3xl border border-indigo-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 bg-cyan-950/70 px-2.5 py-0.5 rounded-full border border-cyan-800">
              <GraduationCap className="w-3.5 h-3.5 text-cyan-400" /> Dành riêng cho sinh viên ICTU Thái Nguyên
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Tìm phòng trọ gần Đại học Công nghệ Thông tin & Truyền thông (ICTU)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Khu vực đường Z115, Tân Lập, Quyết Thắng, Đồi Chè: Phòng có mạng FPT/Viettel tốc độ cao làm đồ án, giờ giấc tự do khóa vân tay, đi bộ tới trường chỉ từ 3-8 phút.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              to="/ai-search?q=Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu, cách trường dưới 2km, có điều hòa, wifi và chỗ để xe."
              className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Chạy kịch bản AI ICTU</span>
            </Link>
            <Link
              to="/rooms?near_location=ICTU"
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs sm:text-sm border border-white/20 transition"
            >
              Xem phòng quanh ICTU
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 1: PHÒNG NỔI BẬT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">
              <Flame className="w-4 h-4 text-emerald-600" />
              Được xem nhiều nhất
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Phòng trọ nổi bật tại Thái Nguyên
            </h2>
          </div>
          <Link
            to="/rooms"
            className="inline-flex items-center gap-1 font-bold text-sm text-emerald-600 hover:text-emerald-700"
          >
            Xem tất cả ({featuredRooms.length}+) <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>

      {/* SECTION 2: GẦN CÁC TRƯỜNG ĐẠI HỌC THÁI NGUYÊN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-100/80 p-6 sm:p-8 rounded-3xl border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                Lọc nhanh theo trường đại học
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Tìm phòng gần các trường Đại học Thái Nguyên
              </h2>
            </div>

            {/* University tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'ĐH CNTT (ICTU)', code: 'ICTU' },
                { name: 'ĐH Kỹ thuật CN (TNUT)', code: 'TNUT' },
                { name: 'ĐH Y - Dược (TUMP)', code: 'TUMP' },
                { name: 'ĐH Sư phạm (TNUE)', code: 'TNUE' },
                { name: 'ĐH Kinh tế (TUEBA)', code: 'TUEBA' },
              ].map((tab) => (
                <button
                  key={tab.code}
                  onClick={() => handleUniTabChange(tab.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeUniTab === tab.code
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-white text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {uniRooms.map((room) => (
              <RoomCard key={room.id} room={room} targetLocationName={activeUniTab} />
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              to={`/rooms?near_location=${activeUniTab}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition"
            >
              <span>Xem toàn bộ phòng gần trường {activeUniTab}</span>
              <ChevronRight className="w-4 h-4 text-purple-600" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 3: PHÒNG GIÁ TỐT SINH VIÊN (DƯỚI 2 TRIỆU) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Tiết kiệm chi phí
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Phòng trọ giá tốt cho sinh viên (Dưới 2 triệu)
            </h2>
          </div>
          <Link
            to="/rooms?max_price=2000000"
            className="inline-flex items-center gap-1 font-bold text-sm text-emerald-600 hover:text-emerald-700"
          >
            Xem thêm phòng giá rẻ <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgetRooms.slice(0, 3).map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>

      {/* SECTION 4: KHU VỰC PHỔ BIẾN TẠI THÁI NGUYÊN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">
            Khu vực phổ biến tại Thái Nguyên
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Lựa chọn theo phường/xã tập trung nhiều dãy trọ sinh viên và người lao động
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            {
              name: 'Quyết Thắng',
              desc: 'Gần ICTU, Nông Lâm',
              count: '45+ phòng',
              img: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400',
              query: 'ward=Xã Quyết Thắng',
            },
            {
              name: 'Quang Trung',
              desc: 'Gần ĐH Sư Phạm, Y Dược',
              count: '38+ phòng',
              img: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
              query: 'ward=P. Quang Trung',
            },
            {
              name: 'Tân Thịnh',
              desc: 'Gần ĐH Kinh tế, TNUS',
              count: '30+ phòng',
              img: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
              query: 'ward=P. Tân Thịnh',
            },
            {
              name: 'Tích Lương',
              desc: 'Gần ĐH Kỹ thuật CN TNUT',
              count: '25+ phòng',
              img: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=400',
              query: 'ward=P. Tích Lương',
            },
            {
              name: 'Samsung Phổ Yên',
              desc: 'KCN Yên Bình SEVT',
              count: '50+ phòng',
              img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400',
              query: 'district=TP. Phổ Yên',
            },
          ].map((area, i) => (
            <Link
              key={i}
              to={`/rooms?${area.query}`}
              className="group relative rounded-2xl overflow-hidden aspect-3/4 border border-slate-200 shadow-2xs hover:shadow-md transition"
            >
              <img
                src={area.img}
                alt={area.name}
                className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h4 className="font-extrabold text-sm group-hover:text-emerald-400 transition">{area.name}</h4>
                <p className="text-[11px] text-slate-300">{area.desc}</p>
                <span className="text-[10px] text-emerald-400 font-semibold">{area.count}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 5: CTA DÀNH CHO CHỦ TRỌ THÁI NGUYÊN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider">
              Dành riêng cho chủ nhà trọ tại Thái Nguyên
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold leading-tight">
              Bạn có phòng trọ còn trống tại Thái Nguyên muốn cho thuê nhanh?
            </h2>
            <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
              Đăng tin miễn phí tiếp cận hàng chục nghìn sinh viên Đại học Thái Nguyên và người lao động tại các KCN Samsung, Điềm Thụy, Sông Công. Quản lý phòng trọ chuyên nghiệp ngay trên website!
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/owner"
                className="px-6 py-3 bg-white text-emerald-900 hover:bg-emerald-50 font-extrabold rounded-2xl text-sm transition shadow-lg shadow-black/20 flex items-center gap-2"
              >
                <Building className="w-4 h-4 text-emerald-600" />
                Đăng tin cho thuê ngay
              </Link>
              <Link
                to="/rooms"
                className="px-5 py-3 bg-emerald-950/60 hover:bg-emerald-950 text-white font-bold rounded-2xl text-sm transition border border-emerald-700/50"
              >
                Xem quy trình duyệt tin
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
