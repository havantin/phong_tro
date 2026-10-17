import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Star,
  Trash2,
  MoveLeft,
  MoveRight,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Eye,
  Building,
  MapPin,
  RefreshCw,
  Phone,
  DollarSign,
  Maximize2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { Room, RoomImage } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { RoomLocationPicker } from './RoomLocationPicker';

interface RoomEditModalProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedRoom: Room) => void;
}

const MAX_IMAGES = 15;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const THAI_NGUYEN_LOCATIONS = [
  { name: 'ĐH CNTT & Truyền Thông (ICTU)', lat: 21.5855, lng: 105.8066, ward: 'Xã Quyết Thắng' },
  { name: 'ĐH Sư Phạm Thái Nguyên', lat: 21.5954, lng: 105.8291, ward: 'P. Quang Trung' },
  { name: 'ĐH Y Dược Thái Nguyên', lat: 21.5898, lng: 105.8345, ward: 'P. Phan Đình Phùng' },
  { name: 'ĐH Kỹ Thuật Công Nghiệp (TNUT)', lat: 21.5627, lng: 105.8454, ward: 'P. Tích Lương' },
  { name: 'ĐH Nông Lâm Thái Nguyên', lat: 21.6062, lng: 105.8041, ward: 'Xã Quyết Thắng' },
  { name: 'ĐH Kinh Tế & QTKD Thái Nguyên', lat: 21.5882, lng: 105.8115, ward: 'Xã Quyết Thắng' },
  { name: 'KCN Samsung Phổ Yên', lat: 21.4312, lng: 105.8765, ward: 'P. Đồng Tiến' },
  { name: 'KCN Điềm Thụy Phú Bình', lat: 21.4925, lng: 105.9213, ward: 'Xã Điềm Thụy' },
];

const AMENITY_OPTIONS = [
  { code: 'air_conditioner', name: 'Điều hòa' },
  { code: 'wifi', name: 'Wifi internet' },
  { code: 'parking', name: 'Chỗ để xe máy' },
  { code: 'water_heater', name: 'Bình nóng lạnh' },
  { code: 'private_bathroom', name: 'WC Khép kín' },
  { code: 'washing_machine', name: 'Máy giặt' },
  { code: 'refrigerator', name: 'Tủ lạnh' },
  { code: 'kitchen', name: 'Khu vực bếp nấu' },
  { code: 'balcony', name: 'Ban công thoáng mát' },
  { code: 'pet_allowed', name: 'Cho nuôi thú cưng' },
  { code: 'free_hours', name: 'Giờ giấc tự do 24/7' },
  { code: 'security_camera', name: 'Camera an ninh' },
];

export const RoomEditModal: React.FC<RoomEditModalProps> = ({
  room,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();

  // Form states
  const [formData, setFormData] = useState({
    title: room.title || '',
    description: room.description || '',
    price: room.price || 0,
    area: room.area || 0,
    deposit: room.deposit || 0,
    room_type: room.room_type || 'tro_khep_kin',
    province: 'Thái Nguyên',
    district: room.district || 'TP. Thái Nguyên',
    ward: room.ward || '',
    street: room.street || '',
    address: room.address || '',
    latitude: room.latitude || 0,
    longitude: room.longitude || 0,
    max_people: room.max_people || 2,
    gender_requirement: room.gender_requirement || 'all',
    electricity_price: room.electricity_price || 3500,
    water_price: room.water_price || 25000,
    internet_price: room.internet_price || 80000,
    service_fee: room.service_fee || 0,
    status: room.status || 'available',
    owner_phone: room.owner_phone || '',
    owner_name: room.owner_name || '',
    amenities: [...(room.amenities || [])],
  });

  // Images state
  const [imagesList, setImagesList] = useState<RoomImage[]>(room.image_items || []);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // General states
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);

  // Drag-and-drop reorder states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync initial data when room changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: room.title || '',
        description: room.description || '',
        price: room.price || 0,
        area: room.area || 0,
        deposit: room.deposit || 0,
        room_type: room.room_type || 'tro_khep_kin',
        province: 'Thái Nguyên',
        district: room.district || 'TP. Thái Nguyên',
        ward: room.ward || '',
        street: room.street || '',
        address: room.address || '',
        latitude: room.latitude || 0,
        longitude: room.longitude || 0,
        max_people: room.max_people || 2,
        gender_requirement: room.gender_requirement || 'all',
        electricity_price: room.electricity_price || 3500,
        water_price: room.water_price || 25000,
        internet_price: room.internet_price || 80000,
        service_fee: room.service_fee || 0,
        status: room.status || 'available',
        owner_phone: room.owner_phone || '',
        owner_name: room.owner_name || '',
        amenities: [...(room.amenities || [])],
      });
      loadFreshImages();
      setFormError('');
      setUploadError('');
    }
  }, [isOpen, room]);

  const loadFreshImages = async () => {
    try {
      setLoadingImages(true);
      const detail = await api.getRoomDetail(room.id);
      if (detail.image_items && detail.image_items.length > 0) {
        setImagesList(detail.image_items);
      } else if (detail.images && detail.images.length > 0) {
        setImagesList(
          detail.images.map((url, idx) => ({
            id: `temp-${idx}`,
            room_id: room.id,
            image_url: url,
            url,
            is_cover: idx === 0,
            sort_order: idx,
            created_at: new Date().toISOString(),
          }))
        );
      } else {
        setImagesList([]);
      }
    } catch (err) {
      console.error('Error fetching room detail images:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  if (!isOpen) return null;

  // Toggle amenity
  const handleToggleAmenity = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(code)
        ? prev.amenities.filter((c) => c !== code)
        : [...prev.amenities, code],
    }));
  };

  // Quick fill location
  const handleSelectPresetLocation = (preset: typeof THAI_NGUYEN_LOCATIONS[0]) => {
    setFormData((prev) => ({
      ...prev,
      latitude: preset.lat,
      longitude: preset.lng,
      ward: preset.ward,
      address: prev.address ? prev.address : `Gần ${preset.name}, ${preset.ward}, TP. Thái Nguyên`,
    }));
    showToast(`Đã chọn tọa độ gần ${preset.name}`, 'info');
  };

  // Handle files upload
  const handleFilesSelected = async (filesList: FileList | File[]) => {
    const files = Array.from(filesList);
    if (!files.length) return;

    setUploadError('');

    // Check count limit
    if (imagesList.length + files.length > MAX_IMAGES) {
      setUploadError(
        `Giới hạn tối đa ${MAX_IMAGES} ảnh/phòng. Bạn hiện có ${imagesList.length} ảnh, chỉ có thể tải thêm tối đa ${
          MAX_IMAGES - imagesList.length
        } ảnh.`
      );
      return;
    }

    // Validate files
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type.toLowerCase())) {
        setUploadError(`File "${f.name}" không hợp lệ. Chỉ chấp nhận định dạng JPG, JPEG, PNG, WebP.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        const sizeMb = (f.size / (1024 * 1024)).toFixed(2);
        setUploadError(`File "${f.name}" dung lượng ${sizeMb} MB vượt quá giới hạn 5 MB.`);
        return;
      }
    }

    try {
      setUploadProgress(20);
      const timer = setInterval(() => {
        setUploadProgress((p) => (p && p < 85 ? p + 15 : p));
      }, 300);

      const res = await api.uploadRoomImages(room.id, files);

      clearInterval(timer);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 600);

      setImagesList(res.images);
      showToast(`Đã tải thành công ${files.length} ảnh lên thư viện!`, 'success');
    } catch (err: any) {
      setUploadProgress(null);
      setUploadError(err.message || 'Lỗi khi tải ảnh lên máy chủ');
      showToast(err.message || 'Lỗi tải ảnh lên', 'error');
    }
  };

  // Replace an existing image
  const handleTriggerReplace = (imageId: string) => {
    setReplacingImageId(imageId);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleExecuteReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingImageId) return;

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      showToast('File không đúng định dạng JPG, JPEG, PNG, WebP', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Dung lượng ảnh vượt quá 5MB', 'error');
      return;
    }

    try {
      setLoadingImages(true);
      // Upload new image
      const uploadRes = await api.uploadRoomImages(room.id, [file]);
      // Delete old image
      await api.deleteRoomImage(room.id, replacingImageId);
      // Reload fresh list
      await loadFreshImages();
      showToast('Đã thay thế ảnh thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi thay thế ảnh', 'error');
    } finally {
      setLoadingImages(false);
      setReplacingImageId(null);
    }
  };

  // Set as Cover
  const handleSetCover = async (imageId: string) => {
    try {
      setLoadingImages(true);
      const res = await api.setRoomCoverImage(room.id, imageId);
      setImagesList(res.images);
      showToast('Đã đặt làm ảnh đại diện của phòng!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi đặt ảnh đại diện', 'error');
    } finally {
      setLoadingImages(false);
    }
  };

  // Delete an image
  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ảnh này khỏi bài đăng?')) return;
    try {
      setLoadingImages(true);
      const res = await api.deleteRoomImage(room.id, imageId);
      setImagesList(res.images);
      showToast('Đã xóa ảnh thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa ảnh', 'error');
    } finally {
      setLoadingImages(false);
    }
  };

  // Move image (Left / Right / Up / Down)
  const handleMoveImage = async (index: number, direction: 'prev' | 'next') => {
    const targetIndex = direction === 'prev' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= imagesList.length) return;

    const newArr = [...imagesList];
    const [moved] = newArr.splice(index, 1);
    newArr.splice(targetIndex, 0, moved);
    setImagesList(newArr);

    try {
      const ids = newArr.map((img) => img.id);
      await api.reorderRoomImages(room.id, ids);
    } catch (err: any) {
      showToast('Không thể cập nhật thứ tự ảnh trên server', 'error');
      loadFreshImages();
    }
  };

  // Drag and drop image reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newArr = [...imagesList];
    const [moved] = newArr.splice(draggedIndex, 1);
    newArr.splice(targetIndex, 0, moved);
    setImagesList(newArr);
    setDraggedIndex(null);

    try {
      const ids = newArr.map((img) => img.id);
      await api.reorderRoomImages(room.id, ids);
      showToast('Đã sắp xếp lại thứ tự ảnh', 'success');
    } catch (err) {
      loadFreshImages();
    }
  };

  // Save room changes
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formData.province !== 'Thái Nguyên') {
      setFormError('Lỗi: Hệ thống chỉ quản lý bài đăng phòng trọ tại Tỉnh Thái Nguyên!');
      return;
    }

    if (!formData.title.trim() || !formData.address.trim()) {
      setFormError('Vui lòng điền tiêu đề và địa chỉ phòng trọ!');
      return;
    }

    if (formData.price <= 0 || formData.area <= 0) {
      setFormError('Giá thuê và diện tích phải lớn hơn 0!');
      return;
    }

    setSubmitting(true);
    try {
      const hasValidCoords = Boolean(
        formData.latitude &&
        formData.longitude &&
        Number(formData.latitude) !== 0 &&
        Number(formData.longitude) !== 0 &&
        !isNaN(Number(formData.latitude)) &&
        !isNaN(Number(formData.longitude))
      );

      const updated = await api.patchRoom(room.id, {
        ...formData,
        price: Number(formData.price),
        area: Number(formData.area),
        deposit: Number(formData.deposit),
        electricity_price: Number(formData.electricity_price),
        water_price: Number(formData.water_price),
        internet_price: Number(formData.internet_price),
        service_fee: Number(formData.service_fee),
        latitude: hasValidCoords ? Number(formData.latitude) : (null as any),
        longitude: hasValidCoords ? Number(formData.longitude) : (null as any),
        location_verified: hasValidCoords,
      });

      showToast('Đã lưu tất cả thay đổi bài đăng thành công!', 'success');
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi lưu thông tin bài đăng');
      showToast(err.message || 'Lỗi lưu bài đăng', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Preview in new tab
  const handlePreview = () => {
    window.open(`/rooms/${room.id}`, '_blank');
  };

  const coverImage = imagesList.find((img) => img.is_cover) || imagesList[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      {/* Hidden file input for Replace */}
      <input
        type="file"
        ref={replaceInputRef}
        onChange={handleExecuteReplace}
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
      />

      <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Chỉnh sửa thông tin bài đăng</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                  #{room.id}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Cập nhật thông tin chi tiết, tải ảnh thực tế và quản lý thư viện ảnh phòng trọ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              type="button"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition"
              title="Xem bài đăng thực tế trên website"
            >
              <Eye className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Xem trước bài đăng</span>
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* 2-COLUMN MAIN BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: ROOM DETAILS FORM (Col span 7)              */}
          {/* ========================================================= */}
          <form
            id="room-edit-form"
            onSubmit={handleSaveForm}
            className="lg:col-span-7 space-y-5 bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Thông tin phòng trọ</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-500">Mục có dấu * là bắt buộc</span>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề bài đăng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ví dụ: Chung cư mini 2 phòng ngủ cho gia đình trẻ cổng trường ICTU"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Price & Area & Deposit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giá thuê (đ/tháng) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={100000}
                  step={50000}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Diện tích (m²) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiền đặt cọc (đ)</label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Room Type & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại phòng</label>
                <select
                  value={formData.room_type}
                  onChange={(e) => setFormData({ ...formData, room_type: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="tro_khep_kin">Phòng trọ khép kín</option>
                  <option value="chung_cu_mini">Chung cư mini</option>
                  <option value="nha_nguyen_can">Nhà nguyên căn</option>
                  <option value="ktx">Ký túc xá</option>
                  <option value="homestay">Homestay sinh viên</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái bài đăng</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="available">🟢 Còn phòng (Hiển thị tìm kiếm)</option>
                  <option value="rented">🔴 Đã cho thuê (Hết phòng)</option>
                  <option value="hidden">⚪ Tạm ẩn bài đăng</option>
                </select>
              </div>
            </div>

            {/* Address & District & Ward */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Địa điểm tại Thái Nguyên
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Tỉnh Thái Nguyên
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Quận / Huyện</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="TP. Thái Nguyên">TP. Thái Nguyên</option>
                    <option value="TP. Sông Công">TP. Sông Công</option>
                    <option value="TP. Phổ Yên">TP. Phổ Yên</option>
                    <option value="Huyện Phú Bình">Huyện Phú Bình</option>
                    <option value="Huyện Đại Từ">Huyện Đại Từ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Phường / Xã</label>
                  <input
                    type="text"
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    placeholder="Xã Quyết Thắng, P. Quang Trung..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Địa chỉ chi tiết <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Số nhà, ngõ/ngách, tên đường, Phường/Xã..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                />
              </div>

              {/* Bản đồ định vị GPS */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Vị trí phòng trọ trên bản đồ GPS
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Kéo thả ghim hoặc click trực tiếp
                  </span>
                </div>
                <RoomLocationPicker
                  initialLatitude={formData.latitude}
                  initialLongitude={formData.longitude}
                  addressHint={formData.address || formData.ward || 'Thái Nguyên'}
                  onChange={({ latitude, longitude }) => {
                    setFormData((prev) => ({
                      ...prev,
                      latitude: latitude ?? 0,
                      longitude: longitude ?? 0,
                    }));
                  }}
                  height="260px"
                />
              </div>

              {/* Quick Preset Location Pills */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">Chọn nhanh địa điểm trọng điểm:</span>
                <div className="flex flex-wrap gap-1.5">
                  {THAI_NGUYEN_LOCATIONS.map((loc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectPresetLocation(loc)}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 rounded-lg transition"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Utility Prices */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-800 block mb-2">Chi phí dịch vụ (VND)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Tiền điện (đ/kWh)</label>
                  <input
                    type="number"
                    value={formData.electricity_price}
                    onChange={(e) => setFormData({ ...formData, electricity_price: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Tiền nước (đ/người)</label>
                  <input
                    type="number"
                    value={formData.water_price}
                    onChange={(e) => setFormData({ ...formData, water_price: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Internet (đ/tháng)</label>
                  <input
                    type="number"
                    value={formData.internet_price}
                    onChange={(e) => setFormData({ ...formData, internet_price: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Phí dịch vụ chung</label>
                  <input
                    type="number"
                    value={formData.service_fee}
                    onChange={(e) => setFormData({ ...formData, service_fee: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Contact Phone & Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> Số điện thoại liên hệ
                </label>
                <input
                  type="text"
                  value={formData.owner_phone}
                  onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                  placeholder="0912 345 678"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số người ở tối đa</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.max_people}
                  onChange={(e) => setFormData({ ...formData, max_people: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            {/* Amenities Checkboxes */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">Tiện nghi có sẵn của phòng</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AMENITY_OPTIONS.map((am) => (
                  <label
                    key={am.code}
                    className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2 rounded-xl border border-slate-200/80 cursor-pointer hover:border-emerald-300 transition"
                  >
                    <input
                      type="checkbox"
                      checked={formData.amenities.includes(am.code)}
                      onChange={() => handleToggleAmenity(am.code)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span className="text-[11px] font-medium">{am.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">Mô tả chi tiết phòng trọ</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả cụ thể về đồ đạc, cửa sổ, an ninh, camera, bãi đỗ xe, quy định giờ giấc..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </form>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: REAL IMAGE GALLERY MANAGER (Col span 5)    */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Quản lý ảnh phòng ({imagesList.length}/{MAX_IMAGES})</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Tối đa 5MB/ảnh
                </span>
              </div>

              {/* COVER IMAGE PREVIEW BANNER */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Ảnh đại diện hiển thị ngoài trang chủ:
                </span>
                <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-slate-200 border-2 border-emerald-500 shadow-sm group">
                  {coverImage ? (
                    <img
                      src={coverImage.image_url || coverImage.url}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span className="text-xs">Chưa có ảnh nào. Hãy tải ảnh lên bên dưới.</span>
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-md flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    <span>ẢNH ĐẠI DIỆN</span>
                  </div>
                </div>
              </div>

              {/* DRAG & DROP UPLOAD ZONE */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                    : 'border-slate-300 hover:border-emerald-400 bg-white'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelected(e.target.files);
                  }}
                  className="hidden"
                />

                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer"
                    >
                      + Thêm ảnh từ máy tính
                    </button>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      hoặc kéo thả nhiều ảnh trực tiếp vào khu vực này
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Hỗ trợ JPG, JPEG, PNG, WebP • Tối đa 5MB/ảnh • Tối đa 15 ảnh
                  </p>
                </div>

                {/* Upload Progress bar */}
                {uploadProgress !== null && (
                  <div className="mt-3 space-y-1">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold">
                      Đang xử lý và tải ảnh lên... {uploadProgress}%
                    </span>
                  </div>
                )}
              </div>

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* GALLERY THUMBNAIL LIST WITH REORDER & DELETE & SET COVER */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Danh sách ảnh đã tải lên:</span>
                  <span className="text-[10px] text-slate-400">Kéo thả để đổi thứ tự</span>
                </div>

                {loadingImages && (
                  <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Đang cập nhật danh sách ảnh...</span>
                  </div>
                )}

                {!loadingImages && imagesList.length === 0 && (
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs space-y-1">
                    <p>Phòng này chưa có ảnh thực tế.</p>
                    <p className="text-[11px] text-slate-400">Hãy nhấn "Thêm ảnh từ máy tính" ở trên.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {imagesList.map((img, index) => (
                    <div
                      key={img.id || index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      className={`group relative bg-white rounded-2xl p-2 border-2 transition-all ${
                        img.is_cover ? 'border-emerald-500 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 mb-2">
                        <img
                          src={img.image_url || img.url}
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                        />
                        {img.is_cover && (
                          <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-white" />
                            Bìa
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono px-1 rounded">
                          #{index + 1}
                        </div>
                      </div>

                      {/* Image Actions Bar */}
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        {/* Set Cover button */}
                        {!img.is_cover ? (
                          <button
                            type="button"
                            onClick={() => handleSetCover(img.id)}
                            className="px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                            title="Đặt làm ảnh đại diện chính"
                          >
                            Đặt làm bìa
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 px-1.5 py-1">Ảnh bìa</span>
                        )}

                        <div className="flex items-center gap-0.5">
                          {/* Reorder Up / Down */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveImage(index, 'prev')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                            title="Di chuyển lên trước"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={index === imagesList.length - 1}
                            onClick={() => handleMoveImage(index, 'next')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded"
                            title="Di chuyển về sau"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Replace button */}
                          <button
                            type="button"
                            onClick={() => handleTriggerReplace(img.id)}
                            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="Thay thế bằng ảnh khác từ máy tính"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            title="Xóa ảnh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-slate-300 text-slate-700 hover:bg-white text-xs sm:text-sm font-bold transition"
          >
            Hủy chỉnh sửa
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Xem trước bài đăng</span>
            </button>

            <button
              type="submit"
              form="room-edit-form"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang lưu thay đổi...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Lưu thay đổi bài đăng</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

