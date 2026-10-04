import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { Room } from '../types';
import { useAuth } from '../context/AuthContext';

interface ReportModalProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ room, isOpen, onClose }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('Tin giả / Không có thật');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const reasonsList = [
    'Tin giả / Không có thật',
    'Sai giá phòng so với thực tế',
    'Phòng đã được cho thuê hết',
    'Sai địa chỉ / vị trí',
    'Nghi ngờ lừa đảo / yêu cầu cọc mờ ám',
    'Lý do khác',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Vui lòng đăng nhập để gửi báo cáo phản ánh chất lượng tin đăng!');
      return;
    }
    setLoading(true);
    try {
      await api.submitReport(room.id, reason, details);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Báo cáo vi phạm</h3>
              <p className="text-xs text-slate-500">Giúp cộng đồng phòng trọ Thái Nguyên minh bạch</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="text-base font-bold text-slate-900">Cảm ơn bạn đã phản ánh!</h4>
            <p className="text-xs text-slate-600">
              Đội ngũ Quản trị viên Thái Nguyên sẽ kiểm tra và xử lý bài đăng này trong vòng 24h.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do báo cáo
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                {reasonsList.map((r, i) => (
                  <option key={i} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chi tiết phản ánh cụ thể
              </label>
              <textarea
                rows={3}
                required
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Mô tả cụ thể thông tin bạn thấy không chính xác..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md shadow-rose-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'Gửi báo cáo tới Quản trị viên'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
