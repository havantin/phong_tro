import React, { useState, useEffect } from 'react';
import {
  Building,
  PlusCircle,
  Eye,
  MessageSquare,
  CheckCircle,
  Trash2,
  Edit,
  EyeOff,
  MapPin,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Room } from '../types';
import { useAuth } from '../context/AuthContext';

export const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 2000000,
    area: 25,
    room_type: 'tro_khep_kin',
    province: 'Thái Nguyên', // Strict validation
    district: 'TP. Thái Nguyên',
    ward: 'Xã Quyết Thắng',
    street: 'Đường Z115',
    address: '',
    latitude: 21.5855,
    longitude: 105.8066,
    max_people: 2,
    gender_requirement: 'all',
    deposit: 2000000,
    electricity_price: 3500,
    water_price: 25000,
    internet_price: 80000,
    service_fee: 0,
    amenities: ['wifi', 'parking', 'water_heater', 'private_bathroom'],
    images: [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
    ],
  });

  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getOwnerDashboard();
      setStats(res.stats);
      setRooms(res.rooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  const handleOpenAddModal = () => {
    setEditingRoom(null);
    setFormData({
      title: '',
      description: '',
      price: 2000000,
      area: 25,
      room_type: 'tro_khep_kin',
      province: 'Thái Nguyên',
      district: 'TP. Thái Nguyên',
      ward: 'Xã Quyết Thắng',
      street: 'Đường Z115',
      address: '',
      latitude: 21.5855,
      longitude: 105.8066,
      max_people: 2,
      gender_requirement: 'all',
      deposit: 2000000,
      electricity_price: 3500,
      water_price: 25000,
      internet_price: 80000,
      service_fee: 0,
      amenities: ['wifi', 'parking', 'water_heater', 'private_bathroom'],
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800'],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      title: room.title,
      description: room.description,
      price: room.price,
      area: room.area,
      room_type: room.room_type,
      province: room.province,
      district: room.district,
      ward: room.ward,
      street: room.street,
      address: room.address,
      latitude: room.latitude,
      longitude: room.longitude,
      max_people: room.max_people,
      gender_requirement: room.gender_requirement,
      deposit: room.deposit,
      electricity_price: room.electricity_price,
      water_price: room.water_price,
      internet_price: room.internet_price,
      service_fee: room.service_fee,
      amenities: room.amenities,
      images: room.images,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Strict validation: province must be Thái Nguyên
    if (formData.province !== 'Thái Nguyên') {
      setFormError('Lỗi: Hệ thống chỉ chấp nhận đăng phòng trọ tại Tỉnh Thái Nguyên!');
      return;
    }

    if (!formData.title || !formData.address || !formData.price || !formData.area) {
      setFormError('Vui lòng điền đầy đủ tiêu đề, địa chỉ, giá và diện tích phòng!');
      return;
    }

    setFormLoading(true);
    try {
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, formData as Partial<Room>);
      } else {
        await api.createRoom(formData as Partial<Room>);
      }
      setIsModalOpen(false);
      fetchDashboard();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi lưu thông tin phòng');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (room: Room) => {
    const nextStatus = room.status === 'available' ? 'rented' : 'available';
    try {
      await api.updateRoom(room.id, { status: nextStatus });
      fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài đăng phòng trọ này không?')) return;
    try {
      await api.deleteRoom(roomId);
      fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  const allAmenitiesOptions = [
    { code: 'air_conditioner', name: 'Điều hòa' },
    { code: 'wifi', name: 'Wifi cáp quang' },
    { code: 'parking', name: 'Chỗ để xe' },
    { code: 'water_heater', name: 'Nóng lạnh' },
    { code: 'private_bathroom', name: 'WC Khép kín' },
    { code: 'washing_machine', name: 'Máy giặt' },
    { code: 'refrigerator', name: 'Tủ lạnh' },
    { code: 'kitchen', name: 'Khu vực bếp' },
    { code: 'balcony', name: 'Ban công' },
    { code: 'pet_allowed', name: 'Cho nuôi thú cưng' },
    { code: 'free_hours', name: 'Giờ giấc tự do' },
  ];

  const toggleAmenity = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(code)
        ? prev.amenities.filter((c) => c !== code)
        : [...prev.amenities, code],
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-1">
            <Building className="w-3.5 h-3.5" /> Kênh dành cho Chủ nhà trọ Thái Nguyên
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Quản lý phòng trọ cho thuê
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Đăng tin, chỉnh sửa, cập nhật trạng thái phòng trống / đã thuê
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-emerald-600/30 flex items-center gap-2 transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Đăng phòng mới</span>
        </button>
      </div>

      {/* OVERVIEW STAT TILES */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">Tổng số phòng</span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total_rooms}</p>
            <span className="text-[11px] text-slate-400">Đang quản lý trên hệ thống</span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-xs text-emerald-600 font-semibold">Phòng còn trống</span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.available_rooms}</p>
            <span className="text-[11px] text-slate-400">Đang hiển thị cho khách thuê</span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-xs text-blue-600 font-semibold">Tổng lượt xem tin</span>
            <p className="text-2xl sm:text-3xl font-black text-blue-600">{stats.total_views}</p>
            <span className="text-[11px] text-slate-400">Lượt khách đã bấm xem chi tiết</span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
            <span className="text-xs text-purple-600 font-semibold">Tổng liên hệ tư vấn</span>
            <p className="text-2xl sm:text-3xl font-black text-purple-600">{stats.total_contacts}</p>
            <span className="text-[11px] text-slate-400">Khách đã để lại thông tin gọi điện</span>
          </div>
        </div>
      )}

      {/* MY ROOMS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <h3 className="font-extrabold text-lg text-slate-900">Danh sách phòng của tôi</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase">
                <th className="p-3">Phòng trọ</th>
                <th className="p-3">Giá thuê</th>
                <th className="p-3">Diện tích</th>
                <th className="p-3">Khu vực</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Lượt xem</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={room.images[0]}
                        alt={room.title}
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <div className="max-w-xs">
                        <h4 className="font-bold text-slate-900 line-clamp-1">{room.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{room.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-extrabold text-emerald-600">
                    {(room.price / 1000000).toFixed(1)} tr/th
                  </td>
                  <td className="p-3 font-semibold">{room.area} m²</td>
                  <td className="p-3">{room.ward}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleStatus(room)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                        room.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                      title="Bấm để chuyển trạng thái Còn phòng / Đã thuê"
                    >
                      {room.status === 'available' ? 'Còn trống' : 'Đã thuê'}
                    </button>
                  </td>
                  <td className="p-3 font-semibold text-slate-500">
                    {room.view_count} xem • {room.contact_count} liên hệ
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(room)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Chỉnh sửa"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Xóa phòng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT ROOM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingRoom ? 'Chỉnh sửa phòng trọ' : 'Đăng tin phòng trọ mới tại Thái Nguyên'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Province check notice */}
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Phạm vi quy định: Tỉnh Thái Nguyên (Backend sẽ từ chối nếu sai tỉnh)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề bài đăng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ví dụ: Phòng khép kín full đồ ngay cổng trường ICTU Thái Nguyên"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Giá thuê (VND/tháng) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Diện tích (m²) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại phòng</label>
                  <select
                    value={formData.room_type}
                    onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="tro_khep_kin">Phòng trọ khép kín</option>
                    <option value="chung_cu_mini">Chung cư mini</option>
                    <option value="ktx">Ký túc xá</option>
                    <option value="nha_nguyen_can">Nhà nguyên căn</option>
                    <option value="homestay">Homestay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quận / Huyện</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="TP. Thái Nguyên">TP. Thái Nguyên</option>
                    <option value="TP. Sông Công">TP. Sông Công</option>
                    <option value="TP. Phổ Yên">TP. Phổ Yên (KCN Samsung)</option>
                    <option value="Huyện Phú Bình">Huyện Phú Bình (Điềm Thụy)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phường / Xã</label>
                  <input
                    type="text"
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    placeholder="Xã Quyết Thắng, P. Quang Trung..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đường / Phố</label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="Đường Z115, Lương Ngọc Quyến..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa chỉ chi tiết <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Số 42 Ngõ 12 Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Utility Pricing */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tiền điện (đ/kWh)</label>
                  <input
                    type="number"
                    value={formData.electricity_price}
                    onChange={(e) => setFormData({ ...formData, electricity_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tiền nước (đ/tháng)</label>
                  <input
                    type="number"
                    value={formData.water_price}
                    onChange={(e) => setFormData({ ...formData, water_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Internet (đ/tháng)</label>
                  <input
                    type="number"
                    value={formData.internet_price}
                    onChange={(e) => setFormData({ ...formData, internet_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Tiện nghi có sẵn</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allAmenitiesOptions.map((am) => (
                    <label key={am.code} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(am.code)}
                        onChange={() => toggleAmenity(am.code)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span>{am.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả phòng trọ</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả cụ thể về phòng, an ninh, giờ giấc, trang thiết bị..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
                >
                  {formLoading ? 'Đang lưu thông tin...' : editingRoom ? 'Lưu thay đổi' : 'Đăng tin phòng trọ ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
