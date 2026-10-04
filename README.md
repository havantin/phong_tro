# HỆ THỐNG TÌM KIẾM PHÒNG TRỌ THÔNG MINH TẠI THÁI NGUYÊN ỨNG DỤNG AI CHATBOT

Nền tảng tìm kiếm và quản lý phòng trọ trực tuyến thông minh, tối ưu hóa cho đối tượng sinh viên các trường Đại học/Cao đẳng và người lao động tại các Khu công nghiệp thuộc **Tỉnh Thái Nguyên**.

---

## 1. PHẠM VI ỨNG DỤNG (SCOPE)

- **Địa bàn phục vụ**: **ĐỘC QUYỀN TỈNH THÁI NGUYÊN** (TP. Thái Nguyên, TP. Sông Công, TP. Phổ Yên, Huyện Phú Bình...).
- **Hệ thống tự động từ chối** bài đăng hoặc câu hỏi tìm kiếm ngoài tỉnh Thái Nguyên (như Hà Nội, TP.HCM, Đà Nẵng...) và phản hồi lịch sự hướng dẫn người dùng tìm phòng tại Thái Nguyên.
- **Tập trung kết nối vị trí tới các địa điểm trọng điểm**:
  - **Đại học CNTT & Truyền thông (ICTU)** - Đường Z115, Xã Quyết Thắng.
  - **Đại học Kỹ thuật Công nghiệp (TNUT)** - Đường 3/2, P. Tích Lương.
  - **Đại học Y - Dược Thái Nguyên (TUMP)** - Lương Ngọc Quyến, P. Quang Trung.
  - **Đại học Sư phạm Thái Nguyên (TNUE)** - Lương Ngọc Quyến.
  - **Đại học Kinh tế & QTKD (TUEBA)** - P. Tân Thịnh.
  - **Đại học Nông Lâm (TUAF)** - Xã Quyết Thắng.
  - **KCN Yên Bình (Tổ hợp Samsung Electronics Thái Nguyên - SEVT Phổ Yên)**.
  - **KCN Sông Công 1 & Sông Công 2**.
  - **KCN Điềm Thụy (Phú Bình)**.
  - **Bệnh viện Đa khoa Trung ương Thái Nguyên & Bệnh viện A Thái Nguyên**.

---

## 2. KIẾN TRÚC & CÔNG NGHỆ

### Frontend
- **React 19** + **Vite 8**
- **Tailwind CSS v4** (Modern clean design, Plus Jakarta Sans)
- **React Router DOM v7**
- **OpenStreetMap** + **Leaflet** (Bản đồ tương tác thời gian thực, hiển thị marker phòng và bán kính tìm kiếm)
- **Lucide React**

### Backend & Database
- **Full-stack Node.js + Express (server.ts)** tích hợp Vite Middleware phục vụ đồ án trực tiếp trên cổng 3000.
- **Python FastAPI + SQLAlchemy + Alembic** (thư mục `/backend`) phục vụ nộp đồ án và triển khai backend Python chuyên biệt.
- **Database Schema**: Hỗ trợ PostgreSQL / SQLite với đầy đủ quan hệ Khóa chính, Khóa ngoại, Indexes.
- **Bảo mật**: JWT Authentication, Mã hóa mật khẩu bcrypt, Phân quyền 3 Role (USER, OWNER, ADMIN).

### AI & Natural Language Processing (NLP)
- **Gemini 3.8 Flash SDK** (`@google/genai` với telemetry `aistudio-build`).
- **Vietnamese Rule-based Regex Fallback Parser**: Tự động hoạt động 100% khi chưa có API key hoặc mất kết nối, nhận diện chính xác các câu tiếng Việt như *"dưới 2,5 triệu"*, *"cách trường dưới 2km"*, *"gần ICTU"*, *"có điều hòa, wifi, chỗ để xe"*.
- **Smart Matching Engine (0 - 100%)**:
  - Khoảng cách địa lý (Haversine Formula): **30%**
  - Mức giá so với ngân sách: **25%**
  - Tiện nghi đáp ứng: **20%**
  - Diện tích phòng: **10%**
  - Loại phòng & yêu cầu khác: **15%**

---

## 3. CÁC VAI TRÒ (ROLES) & TÀI KHOẢN DEMO

Hệ thống tích hợp sẵn nút **"Chuyển vai trò thử nghiệm"** trên thanh thông báo đầu trang để hội đồng chấm đồ án thử nghiệm nhanh chỉ với 1 click:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn chính |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@example.com` | `Admin@123` | Quản trị toàn hệ thống, duyệt/ẩn/xóa bài đăng, khóa/mở tài khoản, xử lý báo cáo vi phạm |
| **OWNER** | `owner@example.com` | `Owner@123` | Kênh chủ nhà trọ: Đăng tin phòng mới tại Thái Nguyên, cập nhật giá, sửa/xóa/ẩn phòng, xem thống kê lượt xem & liên hệ |
| **USER** | `user@example.com` | `User@123` | Sinh viên / Người thuê: Tìm phòng bằng AI, trò chuyện Chatbot có ghi nhớ ngữ cảnh, lưu yêu thích, so sánh 3 phòng, gửi đánh giá 1-5 sao, liên hệ chủ trọ |

---

## 4. KỊCH BẢN DEMO BẢO VỆ ĐỒ ÁN TRỌNG TÂM

1. Người dùng mở trang web, chọn **"Tìm bằng AI"** (hoặc mở cửa sổ Floating AI Chatbot ở góc phải màn hình).
2. Nhập câu ngôn ngữ tự nhiên:
   > *"Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu, cách trường dưới 2km, có điều hòa, wifi và chỗ để xe."*
3. **AI Chatbot / Fallback Parser** tự động trích xuất thành Structured JSON:
   ```json
   {
     "province": "Thái Nguyên",
     "near_location": "ICTU",
     "max_distance_km": 2,
     "max_price": 2500000,
     "amenities": [
       "air_conditioner",
       "wifi",
       "parking"
     ]
   }
   ```
4. Backend truy vấn cơ sở dữ liệu thực tế tại Thái Nguyên, tính khoảng cách GPS bằng công thức Haversine tới Đại học ICTU.
5. Tính **Smart Matching Score** (ví dụ: *96% phù hợp* cho phòng số 42 Đường Z115 cách cổng sau ICTU 400m).
6. Hiển thị danh sách thẻ phòng trực quan với % phù hợp, số km đến trường, bản đồ Leaflet OpenStreetMap.
7. Người dùng nhắn tiếp: *"Dưới 2 triệu rưỡi thôi"* -> Chatbot cập nhật giá nhưng vẫn lưu ngữ cảnh `near_location = ICTU`.
8. Người dùng nhấn xem chi tiết phòng, kiểm tra khoảng cách đến các trường khác, bấm **"Lưu yêu thích"**, **"So sánh phòng"**, hoặc **"Gửi yêu cầu hẹn xem phòng"**.

---

## 5. HƯỚNG DẪN CÀI ĐẶT & CHẠY ỨNG DỤNG

### Chạy trực tiếp Full-stack (React + Express + AI)
```bash
# 1. Cài đặt thư viện
npm install

# 2. Chạy môi trường Development (cổng 3000)
npm run dev

# 3. Build ứng dụng sản xuất
npm run build
```

### Chạy Backend Python FastAPI (Nếu dùng riêng)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Hoặc venv\Scripts\activate trên Windows
pip install -r requirements.txt

# Cấu hình biến môi trường PostgreSQL trong file .env
# Chạy migration và seed dữ liệu
python seed.py

# Khởi chạy server FastAPI
uvicorn app.main:app --reload --port 8000
```

---

## 6. DANH SÁCH REST API CHÍNH

- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập cấp JWT
- `GET /api/auth/me` - Lấy thông tin tài khoản hiện tại
- `GET /api/rooms` - Tìm kiếm phòng trọ (Bộ lọc từ khóa, trường học, bán kính, giá, tiện nghi)
- `GET /api/rooms/:id` - Chi tiết phòng trọ kèm khoảng cách tới toàn bộ trường học Thái Nguyên
- `POST /api/rooms` - Đăng phòng mới (Owner/Admin, bắt buộc tỉnh Thái Nguyên)
- `PUT /api/rooms/:id` - Cập nhật thông tin phòng
- `DELETE /api/rooms/:id` - Xóa phòng trọ
- `POST /api/ai/chat` - Trò chuyện với AI Chatbot (có nhớ ngữ cảnh hội thoại)
- `POST /api/ai/search` - Tìm kiếm phòng một chạm bằng ngôn ngữ tự nhiên
- `GET /api/favorites` - Danh sách phòng đã lưu của user
- `POST /api/favorites/:id` - Thêm vào yêu thích
- `POST /api/reviews` - Gửi đánh giá 1-5 sao
- `POST /api/reports` - Báo cáo tin đăng sai lệch
- `POST /api/contact` - Gửi yêu cầu xem phòng cho chủ trọ
- `GET /api/owner/dashboard` - Thống kê phòng, lượt xem, liên hệ của chủ trọ
- `GET /api/admin/dashboard` - Bảng điều khiển quản trị viên
- `PUT /api/admin/users/:id/status` - Khóa / Mở khóa tài khoản
