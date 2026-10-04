import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Maximize2,
  Users,
  ShieldCheck,
  Heart,
  Scale,
  Share2,
  AlertTriangle,
  Phone,
  MessageSquare,
  Sparkles,
  Star,
  Check,
  ArrowLeft,
  Calendar,
  Building,
  Calculator,
  Footprints,
  Bike,
  Navigation,
} from 'lucide-react';
import { api } from '../services/api';
import { Room, Review } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCompare } from '../context/CompareContext';
import { useToast } from '../context/ToastContext';
import { LeafletMap } from '../components/LeafletMap';
import { ContactModal } from '../components/ContactModal';
import { ReportModal } from '../components/ReportModal';
import { RoomCard } from '../components/RoomCard';
import { estimateTravelTime } from '../utils/travelEstimates';

export const RoomDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isInCompare, addToCompare, removeFromCompare } = useCompare();

  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Cost calculator states
  const [calcElectricityKwh, setCalcElectricityKwh] = useState(80);
  const [calcWaterPeople, setCalcWaterPeople] = useState(2);
  const [calcSplitPeople, setCalcSplitPeople] = useState(2);

  // Review form states
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    async function loadRoom() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await api.getRoomDetail(id);
        setRoom(data);
        if (data.images && data.images.length > 0) {
          setSelectedImage(data.images[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRoom();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm font-semibold">Đang tải thông tin phòng trọ...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">Không tìm thấy phòng trọ</h2>
        <p className="text-slate-500 text-sm">Phòng trọ này có thể đã được gỡ hoặc không tồn tại.</p>
        <Link to="/rooms" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold inline-block">
          Quay lại danh sách phòng
        </Link>
      </div>
    );
  }

  const inCompare = isInCompare(room.id);

  const handleToggleFavorite = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để lưu phòng trọ yêu thích!', 'info');
      return;
    }
    try {
      await api.toggleFavorite(room.id, isFavorite);
      const next = !isFavorite;
      setIsFavorite(next);
      showToast(next ? 'Đã thêm phòng vào danh sách yêu thích' : 'Đã bỏ lưu phòng', 'success');
    } catch (err) {
      showToast('Không thể cập nhật danh sách yêu thích', 'error');
    }
  };

  const handleToggleCompare = () => {
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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Đã sao chép liên kết phòng trọ vào bộ nhớ tạm!', 'success');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Vui lòng đăng nhập để gửi đánh giá phòng!', 'info');
      return;
    }
    if (!comment.trim()) return;

    setSubmittingReview(true);
    try {
      const newRev = await api.submitReview(room.id, rating, comment);
      setRoom((prev: any) => ({
        ...prev,
        reviews: [newRev, ...(prev.reviews || [])],
      }));
      setComment('');
      showToast('Cảm ơn bạn đã gửi đánh giá phòng trọ!', 'success');
    } catch (err) {
      showToast('Lỗi khi gửi đánh giá', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatPrice = (p: number) => {
    if (p >= 1000000) {
      return `${(p / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu/tháng`;
    }
    return `${p.toLocaleString('vi-VN')} đ/tháng`;
  };

  // Calculator computations
  const totalElec = calcElectricityKwh * (room.electricity_price || 3500);
  const totalWater = calcWaterPeople * (room.water_price || 25000);
  const totalInternet = room.internet_price || 80000;
  const totalService = room.service_fee || 0;
  const totalMonthlyCost = room.price + totalElec + totalWater + totalInternet + totalService;
  const costPerPerson = Math.round(totalMonthlyCost / calcSplitPeople);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/rooms"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách phòng Thái Nguyên
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" /> Chia sẻ
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Media & Specs & Calculator */}
        <div className="lg:col-span-2 space-y-8">
          {/* PHOTO GALLERY */}
          <div className="space-y-3">
            <div className="aspect-16/9 rounded-3xl overflow-hidden bg-slate-900 shadow-md relative">
              <img
                src={selectedImage || room.images[0]}
                alt={room.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-xl">
                {room.district}, Thái Nguyên
              </div>
            </div>
            {room.images && room.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {room.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-24 h-18 rounded-2xl overflow-hidden shrink-0 border-2 transition ${
                      selectedImage === img ? 'border-emerald-600 scale-95 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* BASIC ROOM OVERVIEW */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {room.room_type === 'tro_khep_kin' ? 'Phòng trọ khép kín' : 'Chung cư mini'}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600 font-medium">Mã tin: #{room.id}</span>
                <span className="text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Xác thực chủ nhà Thái Nguyên
                </span>
              </div>

              <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                {room.title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{room.address}</span>
              </p>
            </div>

            {/* Main Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Giá thuê hàng tháng</span>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-600">
                  {formatPrice(room.price)}
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Diện tích sử dụng</span>
                <p className="text-lg sm:text-xl font-extrabold text-slate-800">{room.area} m²</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Số người ở</span>
                <p className="text-lg sm:text-xl font-extrabold text-slate-800">Tối đa {room.max_people} người</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">Tiền đặt cọc</span>
                <p className="text-lg sm:text-xl font-extrabold text-slate-800">
                  {room.deposit ? `${(room.deposit / 1000000).toFixed(1)} triệu` : 'Không cọc'}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Mô tả chi tiết từ chủ phòng:</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {room.description}
              </p>
            </div>

            {/* Amenities Grid */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Tiện nghi phòng trọ:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
                {room.amenities.map((am: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="capitalize">{am.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* INTERACTIVE MONTHLY STUDENT COST ESTIMATOR */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 border border-emerald-800/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Bảng tính chi phí hàng tháng cho sinh viên
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dự toán tổng tiền phòng + điện nước + internet và chia theo số người ở
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Electricity Slider */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Số điện dùng:</span>
                  <span className="text-emerald-400 font-bold">{calcElectricityKwh} kWh</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="250"
                  step="10"
                  value={calcElectricityKwh}
                  onChange={(e) => setCalcElectricityKwh(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  {room.electricity_price?.toLocaleString('vi-VN')} đ/kWh ={' '}
                  <strong className="text-white">{totalElec.toLocaleString('vi-VN')} đ</strong>
                </p>
              </div>

              {/* Water Slider */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Tiền nước:</span>
                  <span className="text-emerald-400 font-bold">{calcWaterPeople} người</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={calcWaterPeople}
                  onChange={(e) => setCalcWaterPeople(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  {room.water_price?.toLocaleString('vi-VN')} đ/người ={' '}
                  <strong className="text-white">{totalWater.toLocaleString('vi-VN')} đ</strong>
                </p>
              </div>

              {/* Split between roommates */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Số người chia tiền:</span>
                  <span className="text-cyan-400 font-bold">{calcSplitPeople} người</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.max(2, room.max_people)}
                  value={calcSplitPeople}
                  onChange={(e) => setCalcSplitPeople(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <p className="text-[11px] text-slate-400">
                  Internet: {totalInternet.toLocaleString('vi-VN')} đ/phòng
                </p>
              </div>
            </div>

            {/* Total Display */}
            <div className="p-4 bg-emerald-900/40 rounded-2xl border border-emerald-600/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-300">Tổng chi phí ước tính cả phòng:</span>
                <p className="text-xl font-extrabold text-white">
                  {totalMonthlyCost.toLocaleString('vi-VN')} đ/tháng
                </p>
              </div>
              <div className="text-center sm:text-right">
                <span className="text-xs text-emerald-300 font-bold">Mỗi bạn chỉ cần đóng:</span>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {costPerPerson.toLocaleString('vi-VN')} đ/người
                </p>
              </div>
            </div>
          </div>

          {/* DISTANCE & TRAVEL TIME TO THAI NGUYEN UNIVERSITIES */}
          {room.distances && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-600" />
                    Khoảng cách & Thời gian di chuyển đến các trường ĐH
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ước tính theo tốc độ đi bộ 4.5km/h và xe máy 25km/h tại Thái Nguyên
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {room.distances.slice(0, 6).map((dist: any) => {
                  const est = estimateTravelTime(dist.distance_km);
                  return (
                    <div
                      key={dist.location_id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">{dist.short_name}</span>
                        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                          {dist.distance_km} km
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{dist.location_name}</p>
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Footprints className="w-3 h-3 text-emerald-600" />
                          {est.walkingMinutes} phút đi bộ
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Bike className="w-3 h-3 text-blue-600" />
                          {est.motorbikeMinutes} phút xe máy
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MAP */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Vị trí thực tế trên bản đồ</h3>
            <LeafletMap rooms={[room]} center={[room.latitude, room.longitude]} zoom={15} height="360px" />
          </div>

          {/* REVIEWS SECTION */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Đánh giá từ khách thuê</h3>
                <p className="text-xs text-slate-500">
                  Điểm trung bình: <strong className="text-amber-500">{room.average_rating || 5.0} ★</strong> ({room.reviews?.length || 0} lượt đánh giá)
                </p>
              </div>
            </div>

            {/* Write review */}
            <form onSubmit={handleReviewSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800">Gửi đánh giá của bạn:</span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition"
                  >
                    <Star className={`w-5 h-5 ${star <= rating ? 'fill-current' : 'text-slate-300'}`} />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-600">{rating} sao</span>
              </div>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn về căn phòng này..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={submittingReview || !comment.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50"
              >
                {submittingReview ? 'Đang gửi...' : 'Đăng đánh giá'}
              </button>
            </form>

            {/* Reviews List */}
            <div className="space-y-3">
              {room.reviews && room.reviews.length > 0 ? (
                room.reviews.map((rev: Review) => (
                  <div key={rev.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={rev.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={rev.user_name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <span className="text-xs font-bold text-slate-800">{rev.user_name}</span>
                      </div>
                      <div className="flex items-center text-amber-400 text-xs font-bold">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có đánh giá nào cho phòng này.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Landlord card & Actions */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-lg">
                🏠
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Chủ nhà trọ</p>
                <h4 className="font-extrabold text-base text-slate-900">{room.owner_name}</h4>
                <p className="text-[11px] text-emerald-600 font-semibold">Chủ trọ uy tín Thái Nguyên</p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/80 text-center space-y-1">
              <span className="text-xs text-emerald-800">Số điện thoại liên hệ:</span>
              <p className="text-xl font-extrabold text-emerald-700 tracking-wider">
                {room.owner_phone || '0912345678'}
              </p>
            </div>

            <div className="space-y-2">
              <a
                href={`tel:${room.owner_phone || '0912345678'}`}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition"
              >
                <Phone className="w-4 h-4" />
                Gọi trực tiếp cho chủ trọ
              </a>

              <a
                href={`https://zalo.me/${room.owner_phone || '0912345678'}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition"
              >
                <MessageSquare className="w-4 h-4" />
                Chat qua Zalo với chủ phòng
              </a>

              <button
                onClick={() => setContactModalOpen(true)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition"
              >
                <Calendar className="w-4 h-4" />
                Hẹn lịch xem phòng trực tiếp
              </button>
            </div>

            {/* Quick Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={handleToggleFavorite}
                className={`py-2 px-1 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                  isFavorite ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                <span>{isFavorite ? 'Đã lưu' : 'Lưu tin'}</span>
              </button>

              <button
                onClick={handleToggleCompare}
                className={`py-2 px-1 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                  inCompare ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>{inCompare ? 'Đang so sánh' : 'So sánh'}</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => setReportModalOpen(true)}
                className="text-xs text-slate-400 hover:text-rose-600 transition flex items-center justify-center gap-1 mx-auto"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Báo cáo bài đăng sai thông tin
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SIMILAR ROOMS */}
      {room.similar_rooms && room.similar_rooms.length > 0 && (
        <div className="pt-8 space-y-6 border-t border-slate-200">
          <h3 className="text-xl font-extrabold text-slate-900">Phòng trọ tương tự tại Thái Nguyên</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {room.similar_rooms.map((simRoom: Room) => (
              <RoomCard key={simRoom.id} room={simRoom} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ContactModal room={room} isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
      <ReportModal room={room} isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
    </div>
  );
};
