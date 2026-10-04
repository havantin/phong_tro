import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Sparkles, MapPin, Phone, Mail, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12 border-b border-slate-800">
          {/* Brand info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
                <Home className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                PhongTro<span className="text-emerald-400">ThaiNguyen</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Nền tảng tìm kiếm phòng trọ thông minh tại <strong className="text-emerald-400">Tỉnh Thái Nguyên</strong>. Ứng dụng AI Chatbot tự động phân tích ngôn ngữ tự nhiên, tính khoảng cách đến các trường đại học, khu công nghiệp và gợi ý phòng trọ tối ưu.
            </p>
            <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Dữ liệu phòng trọ xác thực, an toàn cho tân sinh viên</span>
            </div>
          </div>

          {/* Universities in Thai Nguyen */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Gần các trường ĐH
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/rooms?near_location=ICTU" className="hover:text-emerald-400 transition">
                  ĐH CNTT & Truyền thông (ICTU)
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=TNUT" className="hover:text-emerald-400 transition">
                  ĐH Kỹ thuật Công nghiệp (TNUT)
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=TUMP" className="hover:text-emerald-400 transition">
                  Đại học Y - Dược Thái Nguyên
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=TNUE" className="hover:text-emerald-400 transition">
                  Đại học Sư phạm Thái Nguyên
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=TUEBA" className="hover:text-emerald-400 transition">
                  ĐH Kinh tế & QTKD Thái Nguyên
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=TUAF" className="hover:text-emerald-400 transition">
                  Đại học Nông Lâm Thái Nguyên
                </Link>
              </li>
            </ul>
          </div>

          {/* Industrial Zones */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Khu công nghiệp
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/rooms?near_location=SAMSUNG" className="hover:text-emerald-400 transition">
                  Samsung SEVT Yên Bình (Phổ Yên)
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=KCN_SONGCONG" className="hover:text-emerald-400 transition">
                  KCN Sông Công 1 & Sông Công 2
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=KCN_DIEMTHUY" className="hover:text-emerald-400 transition">
                  KCN Điềm Thụy (Phú Bình)
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=BVTW_TN" className="hover:text-emerald-400 transition">
                  BV Đa khoa Trung ương Thái Nguyên
                </Link>
              </li>
              <li>
                <Link to="/rooms?near_location=BVA_TN" className="hover:text-emerald-400 transition">
                  Bệnh viện A Thái Nguyên (Thịnh Đán)
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick links & support */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Khám phá & Hỗ trợ
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/ai-search" className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Tìm phòng bằng AI
                </Link>
              </li>
              <li>
                <Link to="/rooms" className="hover:text-emerald-400 transition">
                  Tất cả phòng trọ Thái Nguyên
                </Link>
              </li>
              <li>
                <Link to="/compare" className="hover:text-emerald-400 transition">
                  So sánh phòng trọ
                </Link>
              </li>
              <li>
                <Link to="/favorites" className="hover:text-emerald-400 transition">
                  Phòng trọ yêu thích
                </Link>
              </li>
              <li>
                <Link to="/owner" className="hover:text-emerald-400 transition">
                  Dành cho chủ trọ đăng tin
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2025 PhongTroThaiNguyen.vn - Đồ án tốt nghiệp / Nghiên cứu ứng dụng AI trong tìm kiếm phòng trọ Thái Nguyên.</p>
          <p className="flex items-center gap-1 text-slate-400">
            Xây dựng với <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" /> dành cho sinh viên & người lao động Thái Nguyên
          </p>
        </div>
      </div>
    </footer>
  );
};
