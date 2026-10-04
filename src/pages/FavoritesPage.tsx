import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { Room } from '../types';
import { useAuth } from '../context/AuthContext';
import { RoomCard } from '../components/RoomCard';

export const FavoritesPage: React.FC = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const handleFavoriteChange = (roomId: string, isFav: boolean) => {
    if (!isFav) {
      setFavorites((prev) => prev.filter((r) => r.id !== roomId));
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
          <Heart className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Vui lòng đăng nhập</h2>
        <p className="text-xs text-slate-500">
          Đăng nhập để xem và quản lý các phòng trọ bạn đã lưu trên thiết bị này.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Phòng trọ yêu thích của bạn ({favorites.length})
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Dữ liệu được đồng bộ hóa và lưu trữ an toàn trong tài khoản của bạn.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-3xl h-80 animate-pulse border border-slate-100 p-4" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto">
          <Heart className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-800">
            Bạn chưa lưu phòng trọ nào
          </h3>
          <p className="text-xs text-slate-500">
            Hãy khám phá danh sách phòng trọ tại Thái Nguyên và bấm vào biểu tượng trái tim để lưu lại nhé!
          </p>
          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition"
          >
            <Search className="w-4 h-4" /> Khám phá phòng trọ ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isInitialFavorite={true}
              onFavoriteChange={handleFavoriteChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};
