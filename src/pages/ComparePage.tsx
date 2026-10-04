import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, Trash2, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCompare } from '../context/CompareContext';

export const ComparePage: React.FC = () => {
  const { compareRooms, removeFromCompare, clearCompare } = useCompare();

  const comparisonAttributes = [
    { label: 'Giá thuê / tháng', key: 'price', format: (v: number) => `${(v / 1000000).toFixed(1)} triệu` },
    { label: 'Diện tích', key: 'area', format: (v: number) => `${v} m²` },
    { label: 'Tiền cọc', key: 'deposit', format: (v: number) => (v ? `${(v / 1000000).toFixed(1)} triệu` : 'Không cọc') },
    { label: 'Số người ở tối đa', key: 'max_people', format: (v: number) => `${v} người` },
    { label: 'Giá điện', key: 'electricity_price', format: (v: number) => `${v.toLocaleString('vi-VN')} đ/kWh` },
    { label: 'Giá nước', key: 'water_price', format: (v: number) => `${v.toLocaleString('vi-VN')} đ/tháng` },
    { label: 'Internet / Wifi', key: 'internet_price', format: (v: number) => `${v.toLocaleString('vi-VN')} đ/tháng` },
    { label: 'Phí dịch vụ chung', key: 'service_fee', format: (v: number) => (v ? `${v.toLocaleString('vi-VN')} đ` : 'Miễn phí') },
    { label: 'Phường/Xã', key: 'ward', format: (v: string) => v },
    { label: 'Điều hòa', isAmenity: true, code: 'air_conditioner' },
    { label: 'Wifi', isAmenity: true, code: 'wifi' },
    { label: 'Nóng lạnh', isAmenity: true, code: 'water_heater' },
    { label: 'Vệ sinh khép kín', isAmenity: true, code: 'private_bathroom' },
    { label: 'Chỗ để xe', isAmenity: true, code: 'parking' },
    { label: 'Máy giặt', isAmenity: true, code: 'washing_machine' },
    { label: 'Tủ lạnh', isAmenity: true, code: 'refrigerator' },
    { label: 'Cho nuôi thú cưng', isAmenity: true, code: 'pet_allowed' },
    { label: 'Giờ giấc tự do', isAmenity: true, code: 'free_hours' },
  ];

  if (compareRooms.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-emerald-600">
          <Scale className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800">Chưa có phòng nào trong danh sách so sánh</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Bạn có thể bấm vào biểu tượng chiếc cân trên mỗi thẻ phòng trọ để thêm tối đa 3 phòng so sánh trực quan.
        </p>
        <Link
          to="/rooms"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-emerald-700 transition"
        >
          Khám phá phòng trọ Thái Nguyên
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <Link
            to="/rooms"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Tiếp tục xem phòng
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            So sánh chi tiết phòng trọ ({compareRooms.length}/3)
          </h1>
        </div>

        <button
          onClick={clearCompare}
          className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 px-3 py-2 bg-rose-50 rounded-xl"
        >
          <Trash2 className="w-4 h-4" /> Xóa tất cả so sánh
        </button>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="p-4 w-1/4 text-xs font-bold uppercase text-slate-500">Tiêu chí so sánh</th>
              {compareRooms.map((room) => (
                <th key={room.id} className="p-4 w-1/4 align-top">
                  <div className="space-y-3">
                    <div className="relative aspect-16/10 rounded-2xl overflow-hidden bg-slate-100">
                      <img src={room.images[0]} alt={room.title} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFromCompare(room.id)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-600 text-white rounded-xl backdrop-blur-md transition"
                        title="Bỏ so sánh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 line-clamp-2">{room.title}</h4>
                      <p className="text-xs font-extrabold text-emerald-600 mt-1">
                        {(room.price / 1000000).toFixed(1)} triệu/tháng
                      </p>
                    </div>
                    <Link
                      to={`/rooms/${room.id}`}
                      className="block text-center py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {comparisonAttributes.map((attr, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="p-4 font-bold text-slate-800">{attr.label}</td>
                {compareRooms.map((room) => {
                  if (attr.isAmenity && attr.code) {
                    const has = room.amenities.includes(attr.code);
                    return (
                      <td key={room.id} className="p-4">
                        {has ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                            <Check className="w-4 h-4 text-emerald-500" /> Có
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <X className="w-4 h-4 text-slate-300" /> Không
                          </span>
                        )}
                      </td>
                    );
                  }

                  const val = (room as any)[attr.key!];
                  return (
                    <td key={room.id} className="p-4 font-semibold text-slate-800">
                      {attr.format ? (attr.format as (v: any) => string)(val) : String(val ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
