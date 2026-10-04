"""
Seed Data Script for PhongTro Thai Nguyen (Python SQLAlchemy / PostgreSQL on Supabase)
Seeds:
- 3 Users (1 Admin, 1 Owner, 1 User)
- 12 Amenities
- 13 Locations in Thai Nguyen (Universities, Industrial Zones, Hospitals)
- 20 Realistic Demo Rooms across Thai Nguyen with coordinates, amenities, and images
- Sample Reviews, Favorites, Room Views, and Contacts
"""
import os
import sys
import re
import urllib.parse
from datetime import datetime
import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.models import (
    Base,
    User,
    Location,
    Amenity,
    Room,
    RoomImage,
    Review,
    Favorite,
    Report,
    RoomView,
    Contact,
    ChatSession,
    ChatMessage,
)

def get_normalized_database_url() -> str:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        raise ValueError("DATABASE_URL is not set in environment variables.")
    
    match = re.match(r"(?:postgresql|postgres)(?:\+psycopg2)?://([^:]+):(.*)@([^@/:]+)(?::(\d+))?/(.+)", db_url)
    if match:
        user = match.group(1)
        raw_pwd = match.group(2)
        host = match.group(3)
        port = match.group(4) or "5432"
        dbname = match.group(5)

        if raw_pwd.startswith("[") and raw_pwd.endswith("]"):
            raw_pwd = raw_pwd[1:-1]
        
        encoded_pwd = urllib.parse.quote_plus(raw_pwd)
        encoded_user = urllib.parse.quote_plus(user)
        db_url = f"postgresql+psycopg2://{encoded_user}:{encoded_pwd}@{host}:{port}/{dbname}"
    else:
        if db_url.startswith("postgresql://"):
            db_url = "postgresql+psycopg2://" + db_url[len("postgresql://"):]
        elif db_url.startswith("postgres://"):
            db_url = "postgresql+psycopg2://" + db_url[len("postgres://"):]

    return db_url

db_url = get_normalized_database_url()
engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_seed():
    db = SessionLocal()

    try:
        print("Connected to PostgreSQL successfully.")
        
        # 1. Clean existing records to ensure fresh, clean 20 rooms seed
        print("Cleaning old records...")
        db.query(ChatMessage).delete()
        db.query(ChatSession).delete()
        db.query(Contact).delete()
        db.query(RoomView).delete()
        db.query(Report).delete()
        db.query(Review).delete()
        db.query(Favorite).delete()
        db.query(RoomImage).delete()
        
        # Clear room amenities relationship
        from sqlalchemy import text
        db.execute(text("DELETE FROM room_amenities"))
        db.query(Room).delete()
        db.query(Location).delete()
        db.query(Amenity).delete()
        db.query(User).delete()
        db.commit()

        # 2. Seed Users
        print("Seeding Users (Admin, Owner, User)...")
        admin = User(
            id="u-admin-1",
            full_name="Quản trị viên Hệ thống Thái Nguyên",
            email="admin@example.com",
            phone="0988111222",
            password_hash=hash_password("Admin@123"),
            avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
            role="ADMIN",
            status="active",
        )
        owner = User(
            id="u-owner-1",
            full_name="Bác Nguyễn Văn Thành (Chủ trọ)",
            email="owner@example.com",
            phone="0912345678",
            password_hash=hash_password("Owner@123"),
            avatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
            role="OWNER",
            status="active",
        )
        user = User(
            id="u-user-1",
            full_name="Trần Thị Mai Phương (Sinh viên)",
            email="user@example.com",
            phone="0977889900",
            password_hash=hash_password("User@123"),
            avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
            role="USER",
            status="active",
        )
        db.add_all([admin, owner, user])
        db.commit()

        # 3. Seed Amenities
        print("Seeding Amenities...")
        amenities_data = [
            ("am-1", "Wifi cáp quang tốc độ cao", "wifi", "Wifi"),
            ("am-2", "Điều hòa 2 chiều Inverter", "air_conditioner", "AirVent"),
            ("am-3", "Bình nóng lạnh", "water_heater", "Flame"),
            ("am-4", "Chỗ để xe máy an toàn", "parking", "Car"),
            ("am-5", "Vệ sinh khép kín riêng biệt", "private_bathroom", "Bath"),
            ("am-6", "Máy giặt dùng chung/riêng", "washing_machine", "Shirt"),
            ("am-7", "Tủ lạnh 2 cánh", "refrigerator", "Refrigerator"),
            ("am-8", "Khu bếp nấu ăn riêng", "kitchen", "Utensils"),
            ("am-9", "Ban công thoáng mát đón nắng", "balcony", "Sun"),
            ("am-10", "Thang máy tốc độ cao", "elevator", "ArrowUpDown"),
            ("am-11", "Cho phép nuôi thú cưng (chó/mèo)", "pet_allowed", "Dog"),
            ("am-12", "Giờ giấc tự do (Khóa vân tay 24/7)", "free_hours", "Key"),
        ]
        amenity_objs = {}
        for a_id, a_name, a_code, a_icon in amenities_data:
            am = Amenity(id=a_id, name=a_name, code=a_code, icon=a_icon)
            db.add(am)
            amenity_objs[a_code] = am
        db.commit()

        # 4. Seed Locations in Thai Nguyen
        print("Seeding Locations in Thai Nguyen...")
        locations_data = [
            ("loc-1", "Đại học Công nghệ Thông tin & Truyền thông Thái Nguyên", "ICTU", "university", "Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên", 21.5855, 105.8066),
            ("loc-2", "Đại học Kỹ thuật Công nghiệp Thái Nguyên", "TNUT", "university", "Số 666 Đường 3/2, P. Tích Lương, TP. Thái Nguyên", 21.5542, 105.8458),
            ("loc-3", "Đại học Y - Dược Thái Nguyên", "TUMP", "university", "Số 284 Lương Ngọc Quyến, P. Quang Trung, TP. Thái Nguyên", 21.5960, 105.8320),
            ("loc-4", "Đại học Sư phạm Thái Nguyên", "TNUE", "university", "Số 20 Lương Ngọc Quyến, P. Quang Trung, TP. Thái Nguyên", 21.5975, 105.8272),
            ("loc-5", "Đại học Kinh tế & Quản trị Kinh doanh Thái Nguyên", "TUEBA", "university", "Phường Thịnh Đán, TP. Thái Nguyên", 21.5790, 105.8125),
            ("loc-6", "Đại học Nông Lâm Thái Nguyên", "TUAF", "university", "Phường Quyết Thắng, TP. Thái Nguyên", 21.5880, 105.8240),
            ("loc-7", "Đại học Khoa học Thái Nguyên", "TNUS", "university", "Phường Tân Thịnh, TP. Thái Nguyên", 21.5820, 105.8190),
            ("loc-8", "KCN Yên Bình (Tổ hợp Samsung Thái Nguyên SEVT)", "SAMSUNG", "industrial_zone", "P. Đồng Tiến, TP. Phổ Yên, Thái Nguyên", 21.4420, 105.8890),
            ("loc-9", "Khu công nghiệp Sông Công I & II", "KCN_SONGCONG", "industrial_zone", "TP. Sông Công, Tỉnh Thái Nguyên", 21.4880, 105.8450),
            ("loc-10", "Khu công nghiệp Điềm Thụy", "KCN_DIEMTHUY", "industrial_zone", "Huyện Phú Bình, Tỉnh Thái Nguyên", 21.4650, 105.9320),
            ("loc-11", "Bệnh viện Trung ương Thái Nguyên", "BVTW_TN", "hospital", "Số 479 Lương Ngọc Quyến, TP. Thái Nguyên", 21.5920, 105.8360),
            ("loc-12", "Bệnh viện A Thái Nguyên", "BVA_TN", "hospital", "Đường Quang Trung, P. Thịnh Đán, TP. Thái Nguyên", 21.5780, 105.8080),
            ("loc-13", "Trung tâm Thành phố Thái Nguyên (Quảng trường Võ Nguyên Giáp)", "TT_TPTN", "landmark", "P. Trưng Vương, TP. Thái Nguyên", 21.5950, 105.8440),
        ]
        for l_id, l_name, l_short, l_type, l_addr, l_lat, l_lng in locations_data:
            loc = Location(
                id=l_id,
                name=l_name,
                short_name=l_short,
                type=l_type,
                address=l_addr,
                latitude=l_lat,
                longitude=l_lng,
            )
            db.add(loc)
        db.commit()

        # 5. Seed 20 Demo Rooms across Thai Nguyen
        print("Seeding 20 Demo Rooms in Thai Nguyen...")
        rooms_specs = [
            (
                "room-1",
                "Phòng trọ cao cấp full đồ ngay sau cổng trường ICTU",
                "Phòng trọ mới xây 100%, cách cổng sau ICTU 400m, ngõ rộng ô tô vào tận cửa. Trang bị điều hòa Daikin mới, nóng lạnh Rossi, wifi tốc độ cao riêng từng phòng, khóa cửa vân tay bảo mật 24/7. Rất phù hợp cho sinh viên ICTU chuyên ngành CNTT học tập làm đồ án.",
                2200000, 25, "tro_khep_kin", "TP. Thái Nguyên", "Xã Quyết Thắng", "Đường Z115",
                "Số 42 Ngõ 12 Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên",
                21.5872, 105.8085, 2, "all", 2200000, 3500, 25000, 80000, 50000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800",
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
                ],
            ),
            (
                "room-2",
                "Phòng trọ khép kín sạch sẽ gần Đại học CNTT (ICTU) 1.5km",
                "Phòng trọ giá sinh viên, an ninh tốt, gần chợ sinh viên Quyết Thắng, có gác xép để đồ rộng rãi, sân phơi quần áo có mái che.",
                1600000, 20, "tro_khep_kin", "TP. Thái Nguyên", "Xã Quyết Thắng", "Đường Z115",
                "Số 88 Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên",
                21.5830, 105.8040, 2, "all", 1000000, 3500, 25000, 70000, 30000, "available",
                ["wifi", "water_heater", "parking", "private_bathroom", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800",
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
                ],
            ),
            (
                "room-3",
                "Chung cư mini view đẹp gần trường Đại học Sư phạm & Y Dược",
                "Căn hộ mini ban công thoáng mát, view ngắm trọn thành phố, thang máy thẻ từ, máy giặt riêng, tủ lạnh, bếp từ âm hiện đại.",
                3200000, 32, "chung_cu_mini", "TP. Thái Nguyên", "Phường Quang Trung", "Đường Lương Ngọc Quyến",
                "Số 15 Ngõ 198 Lương Ngọc Quyến, P. Quang Trung, TP. Thái Nguyên",
                21.5980, 105.8290, 3, "all", 3200000, 3800, 28000, 100000, 100000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "washing_machine", "refrigerator", "kitchen", "balcony", "elevator", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
                    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
                ],
            ),
            (
                "room-4",
                "Phòng trọ sinh viên giá rẻ gần ĐH Kỹ thuật Công nghiệp (TNUT)",
                "Phòng trọ bình dân chỉ 500m đến cổng trường Kỹ thuật Công nghiệp, điện nước giá nhà nước, chủ trọ hiền lành, an ninh tuyệt đối.",
                1300000, 18, "tro_khep_kin", "TP. Thái Nguyên", "Phường Tích Lương", "Đường 3/2",
                "Ngõ 45 Đường 3/2, P. Tích Lương, TP. Thái Nguyên",
                21.5520, 105.8430, 2, "all", 1300000, 3200, 20000, 50000, 20000, "available",
                ["wifi", "parking", "private_bathroom", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
                ],
            ),
            (
                "room-5",
                "Ký túc xá cao cấp Homestay giường tầng gần ĐH Kinh Tế (TUEBA)",
                "Mô hình SleepBox KTX cao cấp điều hòa mở 24/24, có rèm che riêng tư, tủ đồ cá nhân khóa số, máy giặt máy sấy tự động.",
                900000, 45, "ktx", "TP. Thái Nguyên", "Phường Thịnh Đán", "Đường Quang Trung",
                "Số 20 Đường Thịnh Đán, P. Thịnh Đán, TP. Thái Nguyên",
                21.5775, 105.8110, 1, "all", 900000, 0, 0, 0, 0, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "washing_machine", "refrigerator", "kitchen", "elevator", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800",
                    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800",
                ],
            ),
            (
                "room-6",
                "Phòng trọ gia đình - công nhân gần KCN Yên Bình Samsung Thái Nguyên",
                "Cụm phòng trọ liền kề mới khang trang gần cổng KCN Samsung Yên Bình, sạch sẽ, xe đưa đón công nhân đón tận cửa.",
                1800000, 28, "tro_khep_kin", "TP. Phổ Yên", "Phường Đồng Tiến", "Đường Lý Nam Đế",
                "Khu dân cư Samsung Phổ Yên, P. Đồng Tiến, TP. Phổ Yên, Thái Nguyên",
                21.4440, 105.8870, 3, "all", 1800000, 3000, 22000, 60000, 30000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "kitchen", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
                ],
            ),
            (
                "room-7",
                "Căn hộ mini 1 phòng ngủ cao cấp gần Bệnh viện A Thái Nguyên",
                "Căn hộ thiết kế hiện đại theo phong cách Scandinavian, sàn gỗ, tủ bếp trên dưới hút mùi, sofa bàn trà nhỏ, smart TV.",
                2800000, 35, "chung_cu_mini", "TP. Thái Nguyên", "Phường Thịnh Đán", "Đường Quang Trung",
                "Số 68 Đường Quang Trung, P. Thịnh Đán, TP. Thái Nguyên",
                21.5760, 105.8070, 2, "all", 2800000, 3500, 25000, 80000, 80000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "washing_machine", "refrigerator", "kitchen", "balcony", "free_hours", "pet_allowed"],
                [
                    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
                ],
            ),
            (
                "room-8",
                "Phòng trọ giá sinh viên 1 triệu gần ĐH Nông Lâm Thái Nguyên",
                "Phòng trọ yên tĩnh, khuôn viên nhiều cây xanh bóng mát, gần thư viện trường Nông Lâm, chi phí sinh hoạt cực kỳ rẻ.",
                1000000, 16, "tro_khep_kin", "TP. Thái Nguyên", "Xã Quyết Thắng", "Đường Mỏ Bạch",
                "Tổ 5 Xã Quyết Thắng, TP. Thái Nguyên",
                21.5890, 105.8220, 2, "all", 1000000, 3000, 15000, 40000, 20000, "available",
                ["wifi", "parking", "private_bathroom"],
                [
                    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800",
                ],
            ),
            (
                "room-9",
                "Phòng trọ khép kín mới xây gần ĐH Y Khoa Thái Nguyên 500m",
                "Phòng trọ thoáng mát, trần thạch cao, cửa sổ rộng, có bình nóng lạnh và điều hòa mới, thích hợp cho sinh viên Y Dược học trực đêm.",
                2400000, 24, "tro_khep_kin", "TP. Thái Nguyên", "Phường Quang Trung", "Đường Lương Ngọc Quyến",
                "Số 35 Ngõ 300 Lương Ngọc Quyến, P. Quang Trung, TP. Thái Nguyên",
                21.5945, 105.8305, 2, "all", 2400000, 3500, 25000, 80000, 40000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "balcony", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800",
                ],
            ),
            (
                "room-10",
                "Phòng khép kín giá rẻ cho sinh viên ICTU - TUEBA",
                "Phòng cách ICTU 1.2km, giá tốt, có gác xép, giờ giấc tự do, chủ trọ không ở chung, xe để trong nhà có camera giám sát.",
                1500000, 22, "tro_khep_kin", "TP. Thái Nguyên", "Xã Quyết Thắng", "Khu Đồi Chè",
                "Khu Đồi Chè, Xã Quyết Thắng, TP. Thái Nguyên",
                21.5810, 105.8115, 2, "all", 1000000, 3500, 25000, 60000, 20000, "available",
                ["wifi", "water_heater", "parking", "private_bathroom", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800",
                ],
            ),
            (
                "room-11",
                "Nhà nguyên căn 2 tầng cho nhóm sinh viên thuê chung gần TNUT",
                "Nhà 2 tầng 3 phòng ngủ riêng biệt, phòng khách, phòng bếp rộng, sân để xe 10 chiếc, cổng khóa riêng biệt, thích hợp nhóm 4-6 bạn.",
                4500000, 85, "nha_nguyen_can", "TP. Thái Nguyên", "Phường Tích Lương", "Đường 3/2",
                "Số 12 Ngõ 500 Đường 3/2, P. Tích Lương, TP. Thái Nguyên",
                21.5560, 105.8470, 6, "all", 4500000, 3000, 20000, 100000, 0, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "washing_machine", "refrigerator", "kitchen", "balcony", "free_hours", "pet_allowed"],
                [
                    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
                ],
            ),
            (
                "room-12",
                "Phòng trọ cao cấp có gác lửng đúc bê tông gần ĐH Khoa Học",
                "Phòng thiết kế hiện đại kiểu Studio gác lửng cao không đụng đầu, cầu thang tay vịn gỗ, kệ bếp đá hoa cương, tủ quần áo âm tường.",
                2300000, 26, "tro_khep_kin", "TP. Thái Nguyên", "Phường Tân Thịnh", "Đường Z115",
                "Số 99 Đường Tân Thịnh, P. Tân Thịnh, TP. Thái Nguyên",
                21.5835, 105.8165, 2, "all", 2000000, 3500, 25000, 70000, 50000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "kitchen", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
                ],
            ),
            (
                "room-13",
                "Phòng trọ giá rẻ gần KCN Sông Công 1 & 2",
                "Phòng trọ công nhân gần KCN Sông Công, đường bê tông rộng rãi, an ninh tốt, gần chợ và trường mầm non.",
                1400000, 22, "tro_khep_kin", "TP. Sông Công", "Phường Bách Quang", "Đường Cách Mạng Tháng 8",
                "Tổ dân phố Làng Sắn, P. Bách Quang, TP. Sông Công, Thái Nguyên",
                21.4850, 105.8420, 2, "all", 1000000, 3200, 20000, 50000, 20000, "available",
                ["wifi", "water_heater", "parking", "private_bathroom"],
                [
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
                ],
            ),
            (
                "room-14",
                "Studio cao cấp trung tâm TP Thái Nguyên gần Vincom & Quảng Trường",
                "Căn hộ Studio tầng 5 thang máy, view quảng trường Võ Nguyên Giáp, full nội thất cao cấp chuẩn khách sạn 3 sao.",
                3500000, 38, "chung_cu_mini", "TP. Thái Nguyên", "Phường Trưng Vương", "Đường Hoàng Văn Thụ",
                "Số 28 Đường Hoàng Văn Thụ, P. Trưng Vương, TP. Thái Nguyên",
                21.5930, 105.8410, 2, "all", 3500000, 4000, 30000, 100000, 120000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "washing_machine", "refrigerator", "kitchen", "balcony", "elevator", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
                ],
            ),
            (
                "room-15",
                "Phòng trọ khép kín sạch sẽ gần Bệnh viện Đa khoa Trung ương Thái Nguyên",
                "Phòng tiện nghi sạch sẽ, gần viện trung ương và các trường đại học, khu vực dân trí cao, an ninh nghiêm ngặt.",
                2000000, 24, "tro_khep_kin", "TP. Thái Nguyên", "Phường Phan Đình Phùng", "Đường Lương Ngọc Quyến",
                "Ngõ 112 Lương Ngọc Quyến, P. Phan Đình Phùng, TP. Thái Nguyên",
                21.5910, 105.8380, 2, "all", 2000000, 3500, 25000, 70000, 40000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800",
                ],
            ),
            (
                "room-16",
                "Phòng trọ cho phép nuôi mèo cún gần trường Đại học Sư phạm",
                "Chủ trọ trẻ trung thân thiện, cho phép nuôi thú cưng nhỏ, có sân thượng rộng trồng cây cảnh ngắm hoàng hôn.",
                2100000, 25, "tro_khep_kin", "TP. Thái Nguyên", "Phường Quang Trung", "Đường Quang Trung",
                "Số 45 Ngõ 12 Đường Quang Trung, P. Quang Trung, TP. Thái Nguyên",
                21.5985, 105.8250, 2, "all", 2100000, 3500, 25000, 80000, 50000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "balcony", "pet_allowed", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
                ],
            ),
            (
                "room-17",
                "Phòng trọ khép kín an ninh tốt gần KCN Điềm Thụy Phú Bình",
                "Phòng trọ xây kiên cố, nền lát gạch men sạch bong, cửa nhôm kính cách âm, giá điện nước bình dân phục vụ công nhân viên.",
                1500000, 25, "tro_khep_kin", "Huyện Phú Bình", "Xã Điềm Thụy", "Đường Tỉnh lộ 266",
                "Cổng chào KCN Điềm Thụy, Xã Điềm Thụy, Huyện Phú Bình, Thái Nguyên",
                21.4670, 105.9300, 2, "all", 1000000, 3000, 20000, 60000, 20000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
                ],
            ),
            (
                "room-18",
                "Phòng trọ giá rẻ 1.2 triệu gần trường CĐ Y tế Thái Nguyên",
                "Phòng phù hợp 1-2 bạn sinh viên, gần bến xe Thái Nguyên và siêu thị Go!, đi lại thuận tiện nhiều tuyến xe bus.",
                1200000, 18, "tro_khep_kin", "TP. Thái Nguyên", "Phường Đồng Quang", "Đường Ga Thái Nguyên",
                "Số 8 Ngõ 19 Ga Thái Nguyên, P. Đồng Quang, TP. Thái Nguyên",
                21.5870, 105.8350, 2, "all", 1000000, 3200, 20000, 50000, 20000, "available",
                ["wifi", "water_heater", "parking", "private_bathroom"],
                [
                    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
                ],
            ),
            (
                "room-19",
                "Chung cư mini 2 phòng ngủ cho gia đình trẻ tại P. Phan Đình Phùng",
                "Căn hộ thiết kế gồm 2 phòng ngủ, 1 phòng khách, bếp ăn rộng, ban công phơi đồ view sông Cầu, khóa vân tay và camera 24/7.",
                4000000, 48, "chung_cu_mini", "TP. Thái Nguyên", "Phường Phan Đình Phùng", "Đường Cách Mạng Tháng 8",
                "Số 55 Đường Cách Mạng Tháng 8, P. Phan Đình Phùng, TP. Thái Nguyên",
                21.5900, 105.8420, 4, "all", 4000000, 3800, 26000, 100000, 80000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "washing_machine", "refrigerator", "kitchen", "balcony", "elevator", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
                ],
            ),
            (
                "room-20",
                "Phòng trọ khép kín mới 100% đường Z115 sát cổng KTX trường ICTU",
                "Vị trí đắc địa cách cổng ký túc xá Đại học CNTT & Truyền thông đúng 200 mét. Đầy đủ điều hòa Inverter, nóng lạnh, wifi cáp quang riêng từng phòng, khóa vân tay, camera an ninh, không chung chủ.",
                2300000, 26, "tro_khep_kin", "TP. Thái Nguyên", "Xã Quyết Thắng", "Đường Z115",
                "Số 16 Ngõ 8 Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên",
                21.5862, 105.8078, 2, "all", 2300000, 3500, 25000, 80000, 50000, "available",
                ["wifi", "air_conditioner", "water_heater", "parking", "private_bathroom", "washing_machine", "balcony", "free_hours"],
                [
                    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800",
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
                ],
            ),
        ]

        for (
            r_id, r_title, r_desc, r_price, r_area, r_type, r_dist, r_ward, r_street,
            r_addr, r_lat, r_lng, r_max, r_gender, r_deposit, r_elec, r_water, r_net, r_serv, r_status,
            r_amenities, r_images
        ) in rooms_specs:
            room = Room(
                id=r_id,
                owner_id="u-owner-1",
                title=r_title,
                description=r_desc,
                price=r_price,
                area=r_area,
                room_type=r_type,
                province="Thái Nguyên",
                district=r_dist,
                ward=r_ward,
                street=r_street,
                address=r_addr,
                latitude=r_lat,
                longitude=r_lng,
                max_people=r_max,
                gender_requirement=r_gender,
                deposit=r_deposit,
                electricity_price=r_elec,
                water_price=r_water,
                internet_price=r_net,
                service_fee=r_serv,
                status=r_status,
                view_count=120,
                contact_count=15,
            )
            # Add amenity associations
            for code in r_amenities:
                if code in amenity_objs:
                    room.amenities.append(amenity_objs[code])
            
            # Add images
            for idx, img_url in enumerate(r_images):
                room.images.append(
                    RoomImage(
                        id=f"img-{r_id}-{idx}",
                        url=img_url,
                        is_primary=(idx == 0)
                    )
                )

            db.add(room)

        db.commit()

        # 6. Seed Sample Reviews, Favorites, Views, and Contacts
        print("Seeding Reviews, Favorites, RoomViews, Contacts...")
        rev1 = Review(
            id="rev-1",
            user_id="u-user-1",
            room_id="room-1",
            rating=5,
            comment="Phòng rất sạch đẹp, điều hòa mát rượi, bác chủ trọ dễ tính hỗ trợ sinh viên nhiệt tình!",
        )
        rev2 = Review(
            id="rev-2",
            user_id="u-user-1",
            room_id="room-20",
            rating=5,
            comment="Gần trường ICTU đi bộ vài bước chân là đến giảng đường, wifi cáp quang làm đồ án rất mượt.",
        )
        fav1 = Favorite(
            id="fav-1",
            user_id="u-user-1",
            room_id="room-1",
        )
        view1 = RoomView(
            id="vw-1",
            room_id="room-1",
            user_id="u-user-1",
            ip_address="127.0.0.1",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        )
        contact1 = Contact(
            id="ct-1",
            room_id="room-1",
            user_id="u-user-1",
            sender_name="Trần Thị Mai Phương",
            sender_phone="0977889900",
            sender_email="user@example.com",
            message="Em là sinh viên K21 ICTU, em muốn hẹn xem phòng vào chiều mai lúc 15h được không ạ?",
            status="new",
        )
        chat_sess = ChatSession(
            id="cs-demo-1",
            user_id="u-user-1",
            context_json='{"province": "Thái Nguyên", "near_location": "ICTU", "max_price": 2500000}',
        )
        chat_msg1 = ChatMessage(
            id="cm-1",
            session_id="cs-demo-1",
            sender="user",
            text="Tôi là sinh viên ICTU, muốn tìm phòng dưới 2,5 triệu gần trường",
        )
        chat_msg2 = ChatMessage(
            id="cm-2",
            session_id="cs-demo-1",
            sender="bot",
            text="Chào bạn! Mình đã tìm thấy các phòng trọ phù hợp nhất gần trường ICTU tại xã Quyết Thắng.",
        )

        db.add_all([rev1, rev2, fav1, view1, contact1, chat_sess, chat_msg1, chat_msg2])
        db.commit()

        print("SEEDING COMPLETED SUCCESSFULLY!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
