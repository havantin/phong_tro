import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  Sparkles,
  Heart,
  Scale,
  PlusCircle,
  Shield,
  Building,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompare } from '../context/CompareContext';
import { AuthModal } from './AuthModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { compareRooms } = useCompare();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                    PhongTro<span className="text-emerald-600">ThaiNguyen</span>
                  </span>
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Tìm trọ thông minh tại Thái Nguyên</p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1 font-medium text-sm text-slate-600">
              <Link
                to="/"
                className={`px-3 py-2 rounded-lg transition ${
                  isActive('/') ? 'text-emerald-600 bg-emerald-50 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Trang chủ
              </Link>
              <Link
                to="/rooms"
                className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                  isActive('/rooms') ? 'text-emerald-600 bg-emerald-50 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Search className="w-4 h-4" />
                Tìm phòng
              </Link>
              <Link
                to="/ai-search"
                className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 relative ${
                  isActive('/ai-search')
                    ? 'text-purple-700 bg-purple-50 font-semibold border border-purple-200'
                    : 'text-purple-600 hover:bg-purple-50 font-semibold'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                <span>Tìm bằng AI</span>
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
              </Link>

              {compareRooms.length > 0 && (
                <Link
                  to="/compare"
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                    isActive('/compare') ? 'text-emerald-600 bg-emerald-50 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  So sánh
                  <span className="bg-emerald-600 text-white text-xs px-1.5 py-0.2 rounded-full">
                    {compareRooms.length}
                  </span>
                </Link>
              )}

              <Link
                to="/favorites"
                className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                  isActive('/favorites') ? 'text-emerald-600 bg-emerald-50 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Heart className="w-4 h-4 text-rose-500" />
                Yêu thích
              </Link>

              {user?.role === 'OWNER' && (
                <Link
                  to="/owner"
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                    isActive('/owner') ? 'text-emerald-600 bg-emerald-50 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  Quản lý phòng
                </Link>
              )}

              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                    isActive('/admin') ? 'text-rose-600 bg-rose-50 font-semibold' : 'hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Shield className="w-4 h-4 text-rose-600" />
                  Quản trị Admin
                </Link>
              )}
            </div>

            {/* Right Action Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                to={user ? (user.role === 'OWNER' || user.role === 'ADMIN' ? '/owner' : '/rooms') : '/rooms'}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3.5 py-2 rounded-xl transition shadow-xs shadow-emerald-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                Đăng tin cho thuê
              </Link>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1 pl-2 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition"
                  >
                    <img
                      src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={user.full_name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="text-left pr-1">
                      <div className="text-xs font-bold text-slate-800 leading-tight max-w-[120px] truncate">
                        {user.full_name}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold">{user.role}</div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 mr-1" />
                  </button>

                  {userDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900">{user.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>

                      {user.role === 'OWNER' && (
                        <Link
                          to="/owner"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Building className="w-4 h-4 text-emerald-600" />
                          Kênh chủ phòng trọ
                        </Link>
                      )}

                      {user.role === 'ADMIN' && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Shield className="w-4 h-4 text-rose-600" />
                          Trang Quản trị Hệ thống
                        </Link>
                      )}

                      <Link
                        to="/favorites"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Heart className="w-4 h-4 text-rose-500" />
                        Phòng đã lưu
                      </Link>

                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 text-left border-t border-slate-100"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthModalOpen(true);
                    }}
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl transition hover:bg-slate-100"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setAuthModalOpen(true);
                    }}
                    className="text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl transition"
                  >
                    Đăng ký
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-slate-100"
            >
              <Home className="w-5 h-5 text-slate-500" />
              Trang chủ
            </Link>
            <Link
              to="/rooms"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-slate-100"
            >
              <Search className="w-5 h-5 text-slate-500" />
              Tìm phòng Thái Nguyên
            </Link>
            <Link
              to="/ai-search"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-purple-700 font-semibold bg-purple-50"
            >
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Tìm phòng thông minh
            </Link>
            <Link
              to="/favorites"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-slate-100"
            >
              <Heart className="w-5 h-5 text-rose-500" />
              Phòng đã lưu
            </Link>
            {compareRooms.length > 0 && (
              <Link
                to="/compare"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-slate-100"
              >
                <Scale className="w-5 h-5 text-emerald-600" />
                So sánh ({compareRooms.length})
              </Link>
            )}

            {user?.role === 'OWNER' && (
              <Link
                to="/owner"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-emerald-700 font-medium bg-emerald-50"
              >
                <Building className="w-5 h-5 text-emerald-600" />
                Kênh chủ phòng trọ
              </Link>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-rose-700 font-medium bg-rose-50"
              >
                <Shield className="w-5 h-5 text-rose-600" />
                Quản trị Admin
              </Link>
            )}

            <div className="pt-4 border-t border-slate-100">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
                    <img src={user.avatar} alt={user.full_name} className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p className="font-bold text-sm text-slate-900">{user.full_name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-rose-600 font-semibold bg-rose-50 rounded-xl text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="py-2.5 border border-slate-300 font-semibold rounded-xl text-slate-800 text-sm"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm"
                  >
                    Đăng ký
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
};
