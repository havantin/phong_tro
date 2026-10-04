import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Building,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  Unlock,
  Trash2,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';
import { Room, User, Report } from '../types';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'rooms' | 'users' | 'reports'>('overview');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [dash, rList, uList, repList] = await Promise.all([
        api.getAdminDashboard(),
        api.getAdminRooms(),
        api.getAdminUsers(),
        api.getAdminReports(),
      ]);
      setStats(dash.stats);
      setRooms(rList);
      setUsersList(uList);
      setReports(repList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [user]);

  const handleUpdateRoomStatus = async (roomId: string, status: string) => {
    try {
      await api.updateRoomStatus(roomId, status);
      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserLock = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'locked' : 'active';
    try {
      await api.toggleUserStatus(userId, nextStatus);
      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateReport = async (reportId: string, status: string) => {
    try {
      await api.updateReportStatus(reportId, status);
      fetchAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 mb-1">
            <Shield className="w-3.5 h-3.5" /> Bảng điều khiển Quản trị viên Tối cao
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Quản trị Hệ thống Thái Nguyên
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Duyệt tin đăng phòng trọ, quản lý tài khoản người dùng và xử lý báo cáo vi phạm
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'overview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tổng quan
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'rooms' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Phòng trọ ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'users' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Người dùng ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'reports' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Báo cáo ({reports.length})
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Tổng sinh viên/User</span>
              <p className="text-2xl font-black text-blue-600 mt-1">{stats.total_users}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Tổng Chủ nhà trọ</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{stats.total_owners}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Tổng số phòng</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{stats.total_rooms}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Phòng đang hoạt động</span>
              <p className="text-2xl font-black text-teal-600 mt-1">{stats.active_rooms}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-amber-600 font-semibold">Chờ kiểm duyệt</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{stats.pending_rooms}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-rose-600 font-semibold">Báo cáo vi phạm</span>
              <p className="text-2xl font-black text-rose-600 mt-1">{stats.pending_reports}</p>
            </div>
          </div>

          {/* Quick summary tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900">Báo cáo gần đây cần xử lý</h3>
              <div className="space-y-3">
                {reports.slice(0, 4).map((rep) => (
                  <div key={rep.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{rep.reason}</span>
                      <p className="text-slate-500 text-[11px] truncate max-w-xs">{rep.room_title}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      rep.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {rep.status === 'resolved' ? 'Đã xử lý' : 'Chưa xử lý'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900">Phòng mới đăng tại Thái Nguyên</h3>
              <div className="space-y-3">
                {rooms.slice(0, 4).map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img src={r.images[0]} alt={r.title} className="w-8 h-8 rounded-lg object-cover" />
                      <div className="max-w-[200px]">
                        <h4 className="font-bold text-slate-900 truncate">{r.title}</h4>
                        <p className="text-[11px] text-slate-500">{r.ward}</p>
                      </div>
                    </div>
                    <span className="font-extrabold text-emerald-600">{(r.price / 1000000).toFixed(1)} tr</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROOMS MANAGEMENT TAB */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-x-auto space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Quản lý duyệt bài phòng trọ Thái Nguyên</h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase">
                <th className="p-3">Phòng</th>
                <th className="p-3">Chủ trọ</th>
                <th className="p-3">Giá</th>
                <th className="p-3">Khu vực</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Hành động duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-50/60">
                  <td className="p-3 font-bold text-slate-900 max-w-xs truncate">{room.title}</td>
                  <td className="p-3">{room.owner_name}</td>
                  <td className="p-3 font-extrabold text-emerald-600">{(room.price / 1000000).toFixed(1)} tr</td>
                  <td className="p-3">{room.ward}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      room.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleUpdateRoomStatus(room.id, 'available')}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[11px]"
                      >
                        Duyệt
                      </button>
                      <button
                        onClick={() => handleUpdateRoomStatus(room.id, 'hidden')}
                        className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[11px]"
                      >
                        Ẩn
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* USERS MANAGEMENT TAB */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-x-auto space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Danh sách người dùng và chủ nhà trọ</h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase">
                <th className="p-3">Người dùng</th>
                <th className="p-3">Email</th>
                <th className="p-3">Số điện thoại</th>
                <th className="p-3">Vai trò</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Khóa / Mở khóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                    <img src={u.avatar} alt={u.full_name} className="w-7 h-7 rounded-full object-cover" />
                    <span>{u.full_name}</span>
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.phone || 'Chưa cập nhật'}</td>
                  <td className="p-3">
                    <span className="font-bold text-slate-800">{u.role}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleToggleUserLock(u.id, u.status)}
                        className={`p-1.5 rounded-lg transition ${
                          u.status === 'active'
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                      >
                        {u.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-x-auto space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Báo cáo vi phạm từ người thuê trọ</h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase">
                <th className="p-3">Người báo cáo</th>
                <th className="p-3">Phòng trọ</th>
                <th className="p-3">Lý do</th>
                <th className="p-3">Chi tiết</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {reports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/60">
                  <td className="p-3 font-semibold">{rep.user_name}</td>
                  <td className="p-3 font-bold max-w-xs truncate">{rep.room_title}</td>
                  <td className="p-3 text-rose-700 font-bold">{rep.reason}</td>
                  <td className="p-3 text-slate-500 max-w-xs truncate">{rep.details}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      rep.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {rep.status === 'resolved' ? 'Đã xử lý' : 'Đang chờ'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleUpdateReport(rep.id, 'resolved')}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[11px]"
                    >
                      Đánh dấu xử lý
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
