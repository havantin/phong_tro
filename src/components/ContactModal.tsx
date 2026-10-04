import React, { useState } from 'react';
import { X, Phone, User, MessageSquare, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { Room } from '../types';

interface ContactModalProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ room, isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('Em quan tâm đến phòng trọ này, anh/chị cho em xin lịch qua xem phòng với ạ!');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.sendContact(room.id, name, phone, note);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2500);
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
          <div>
            <h3 className="text-lg font-bold text-slate-900">Liên hệ xem phòng trọ</h3>
            <p className="text-xs text-slate-500">{room.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-slate-900">Đã gửi liên hệ thành công!</h4>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Chủ trọ (<span className="font-semibold text-slate-800">{room.owner_name}</span> - {room.owner_phone}) sẽ liên hệ lại với bạn qua số điện thoại sớm nhất.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Số điện thoại chủ phòng:</p>
                <p className="text-base font-extrabold text-emerald-600">{room.owner_phone || '0912345678'}</p>
              </div>
              <a
                href={`tel:${room.owner_phone || '0912345678'}`}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
              >
                Gọi ngay
              </a>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Họ và tên của bạn <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Nam"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số điện thoại liên hệ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0988xxxxxx"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lời nhắn</label>
              <div className="relative">
                <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'Gửi yêu cầu liên hệ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
