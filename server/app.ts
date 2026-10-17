import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import multer from 'multer';
import {
  ensureDatabaseConnection,
  listLocations,
  listAmenities,
  getUserByEmail,
  getUserById,
  getAllUsers,
  createUser,
  updateUser,
  updateUserStatus,
  listAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomImagesByRoom,
  addRoomImage,
  deleteRoomImage,
  reorderRoomImages,
  setRoomCoverImage,
  RoomImage,
  listFavoritesForUser,
  createFavorite,
  removeFavorite,
  createReview,
  createReport,
  createContact,
  incrementRoomView,
  incrementRoomContact,
  getOwnerDashboard,
  getAdminDashboard,
  getAllReports,
  updateReportStatus,
  getReviewByRoom,
  getChatSession,
  saveChatSession,
  appendChatMessage,
  getChatMessages,
  clearChatSession,
  calculateHaversineDistance,
  calculateHaversineKm,
  isValidCoordinate,
  updateRoomLocation,
} from './db.js';
import { executeAiRoomSearch, executeChatResponse } from './aiService.js';
import {
  uploadRoomImage,
  deleteRoomImageFromStorage,
  validateImageFile,
  MAX_IMAGES_PER_ROOM,
  MAX_FILE_SIZE,
} from './storage.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'thai-nguyen-phongtro-secret-key-2025';
const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_IMAGES_PER_ROOM,
  },
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// CORS configuration
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Normalize request URL for Vercel Serverless Function rewrites
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Lazy DB initialization ensuring PostgreSQL is connected before handling requests
let dbInitPromise: Promise<void> | null = null;
async function ensureDbReady() {
  if (!dbInitPromise) {
    dbInitPromise = ensureDatabaseConnection().catch((err) => {
      console.error('[DB] ensureDatabaseConnection failed:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.DATABASE_URL && req.url.startsWith('/api') && req.url !== '/api/health') {
    try {
      await ensureDbReady();
    } catch (err: any) {
      console.error('[DB] Connection error during request handling:', err?.message);
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const isDbConfigured = Boolean(process.env.DATABASE_URL);
    let dbConnected = false;
    if (isDbConfigured) {
      try {
        await ensureDbReady();
        dbConnected = true;
      } catch (e) {
        dbConnected = false;
      }
    }
    const isStorageConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
    const isAiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);

    return res.json({
      status: dbConnected ? 'healthy' : (isDbConfigured ? 'connecting' : 'no_database_url'),
      app: 'PhongTro Thai Nguyen API',
      scope: 'Tỉnh Thái Nguyên',
      database: 'PostgreSQL (Supabase)',
      db_connected: dbConnected,
      storage_configured: isStorageConfigured,
      ai_configured: isAiConfigured,
      environment: process.env.NODE_ENV || 'production',
      vercel: Boolean(process.env.VERCEL),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', error: error?.message });
  }
});

// Serve local uploaded images statically (fallback for local development)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'USER' | 'OWNER' | 'ADMIN';
  };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (!err && decoded) {
      req.user = decoded;
    }
    next();
  });
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục' });
  }
  next();
}

function requireRole(roles: Array<'USER' | 'OWNER' | 'ADMIN'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này' });
    }
    next();
  };
}

app.use(authenticateToken);

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email này đã được sử dụng' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const newUser = await createUser({
      full_name,
      email,
      phone: phone || '',
      password_hash: passwordHash,
      role: 'USER',
      status: 'active',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(full_name)}`,
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash: _, ...safeUser } = newUser;
    return res.status(201).json({ token, user: safeUser });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký tài khoản' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    if (user.status === 'locked') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash: _, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập' });
  }
});

app.get('/api/auth/me', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  const user = await getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  const { password_hash: _, ...safeUser } = user;
  return res.json({ user: safeUser });
});

app.put('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  const { full_name, phone, avatar, new_password } = req.body;
  const updated = await updateUser({
    id: user.id,
    full_name,
    phone,
    avatar,
    new_password: new_password ? bcrypt.hashSync(new_password, 10) : undefined,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  const { password_hash: _, ...safeUser } = updated;
  return res.json({ user: safeUser });
});

app.get('/api/locations', async (req: Request, res: Response) => {
  const locations = await listLocations();
  return res.json(locations);
});

app.get('/api/amenities', async (req: Request, res: Response) => {
  const amenities = await listAmenities();
  return res.json(amenities);
});

app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    let result = (await listAllRooms()).filter((r) => r.province === 'Thái Nguyên');

    const keyword = (req.query.keyword as string)?.toLowerCase()?.trim();
    if (keyword) {
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(keyword) ||
          r.description.toLowerCase().includes(keyword) ||
          r.address.toLowerCase().includes(keyword) ||
          r.street.toLowerCase().includes(keyword) ||
          r.ward.toLowerCase().includes(keyword)
      );
    }

    const status = req.query.status as string;
    if (status) {
      result = result.filter((r) => r.status === status);
    } else {
      result = result.filter((r) => r.status === 'available');
    }

    const district = req.query.district as string;
    if (district) {
      result = result.filter((r) => r.district.toLowerCase() === district.toLowerCase());
    }

    const ward = req.query.ward as string;
    if (ward) {
      result = result.filter((r) => r.ward.toLowerCase().includes(ward.toLowerCase()));
    }

    const roomType = req.query.room_type as string;
    if (roomType) {
      result = result.filter((r) => r.room_type === roomType);
    }

    const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : 0;
    const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : Infinity;
    result = result.filter((r) => r.price >= minPrice && r.price <= maxPrice);

    const minArea = req.query.min_area ? parseFloat(req.query.min_area as string) : 0;
    const maxArea = req.query.max_area ? parseFloat(req.query.max_area as string) : Infinity;
    result = result.filter((r) => r.area >= minArea && r.area <= maxArea);

    const amenities = req.query.amenities as string;
    if (amenities) {
      const list = amenities.split(',').map((a) => a.trim().toLowerCase());
      result = result.filter((r) => list.every((needed) => r.amenities.some((a) => a.toLowerCase() === needed)));
    }

    const nearLocId = req.query.near_location as string;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 3;
    const locations = await listLocations();
    let targetLoc: any = null;

    if (nearLocId) {
      targetLoc = locations.find(
        (l) => l.id === nearLocId || l.short_name.toLowerCase() === nearLocId.toLowerCase()
      );
    }

    let enriched = result.map((room) => {
      let dist: number | undefined = undefined;
      if (
        targetLoc &&
        isValidCoordinate(targetLoc.latitude, targetLoc.longitude) &&
        isValidCoordinate(room.latitude, room.longitude)
      ) {
        dist = calculateHaversineKm(targetLoc.latitude, targetLoc.longitude, room.latitude, room.longitude);
      }
      return { ...room, distance_to_target: dist };
    });

    // STRICT RADIUS FILTERING:
    // If a target location is specified, filter strictly: distanceKm <= radius
    // Rooms without valid GPS coordinates are strictly excluded from the radius filter.
    if (targetLoc) {
      enriched = enriched.filter((r) => r.distance_to_target !== undefined && r.distance_to_target <= radius);
    }

    const sort = req.query.sort as string;
    if (sort === 'price_asc') {
      enriched.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      enriched.sort((a, b) => b.price - a.price);
    } else if (sort === 'nearest' && targetLoc) {
      enriched.sort((a, b) => (a.distance_to_target ?? 999) - (b.distance_to_target ?? 999));
    } else {
      enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 12;
    const total = enriched.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = enriched.slice((page - 1) * limit, page * limit);

    return res.json({
      data: paginated,
      meta: { total, page, limit, totalPages },
      target_location: targetLoc,
    });
  } catch (error) {
    console.error('Room list error:', error);
    return res.status(500).json({ error: 'Lỗi tải danh sách phòng trọ' });
  }
});

app.get('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy phòng trọ này' });
    }

    await incrementRoomView(room.id);

    const locations = await listLocations();
    const hasValidCoords = isValidCoordinate(room.latitude, room.longitude);
    const distances = hasValidCoords
      ? locations
          .filter((loc) => isValidCoordinate(loc.latitude, loc.longitude))
          .map((loc) => ({
            location_id: loc.id,
            location_name: loc.name,
            short_name: loc.short_name,
            type: loc.type,
            distance_km: calculateHaversineKm(loc.latitude, loc.longitude, room.latitude, room.longitude),
          }))
          .sort((a, b) => a.distance_km - b.distance_km)
      : [];

    const reviews = await getReviewByRoom(room.id);
    const avgRating = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
      : 5.0;

    const similarRooms = (await listAllRooms()).filter(
      (r) => r.id !== room.id && r.status === 'available' && (r.district === room.district || Math.abs(r.price - room.price) < 500000)
    ).slice(0, 4);

    return res.json({ ...room, distances, reviews, average_rating: avgRating, similar_rooms: similarRooms });
  } catch (error) {
    console.error('Room detail error:', error);
    return res.status(500).json({ error: 'Lỗi tải chi tiết phòng trọ' });
  }
});

app.post('/api/rooms', requireAuth, requireRole(['OWNER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      price,
      area,
      room_type = 'tro_khep_kin',
      province = 'Thái Nguyên',
      district = 'TP. Thái Nguyên',
      ward,
      street,
      address,
      latitude,
      longitude,
      max_people = 2,
      gender_requirement = 'all',
      deposit,
      electricity_price = 3500,
      water_price = 25000,
      internet_price = 80000,
      service_fee = 0,
      amenities = [],
      images = [],
    } = req.body;

    if (province !== 'Thái Nguyên') {
      return res.status(400).json({ error: 'Hệ thống chỉ hỗ trợ đăng và quản lý phòng trọ tại Tỉnh Thái Nguyên.' });
    }

    if (!title || !price || !area || !address) {
      return res.status(400).json({ error: 'Vui lòng cung cấp tiêu đề, giá phòng, diện tích và địa chỉ.' });
    }

    const user = await getUserById(req.user!.id);

    const newRoom = await createRoom({
      owner_id: req.user!.id,
      title,
      description: description || '',
      price: Number(price),
      area: Number(area),
      room_type,
      province: 'Thái Nguyên',
      district,
      ward: ward || 'Xã Quyết Thắng',
      street: street || '',
      address,
      latitude: isValidCoordinate(latitude, longitude) ? Number(latitude) : undefined,
      longitude: isValidCoordinate(latitude, longitude) ? Number(longitude) : undefined,
      max_people: Number(max_people),
      gender_requirement,
      deposit: deposit ? Number(deposit) : Number(price),
      electricity_price: Number(electricity_price),
      water_price: Number(water_price),
      internet_price: Number(internet_price),
      service_fee: Number(service_fee),
      status: 'available',
      amenities: Array.isArray(amenities) ? amenities : [],
      images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800'],
      owner_name: user?.full_name || 'Chủ trọ',
      owner_phone: user?.phone || '0912345678',
    } as any);

    return res.status(201).json(newRoom);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng phòng trọ' });
  }
});

// Update room endpoint - supports PATCH and PUT
const handleUpdateRoom = async (req: AuthRequest, res: Response) => {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy phòng trọ' });
    }

    if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa phòng này' });
    }

    const updates = req.body;
    if (updates.province && updates.province !== 'Thái Nguyên') {
      return res.status(400).json({ error: 'Chỉ chấp nhận bài đăng tại Tỉnh Thái Nguyên' });
    }

    const updated = await updateRoom(req.params.id, updates);
    return res.json(updated);
  } catch (error) {
    console.error('Update room error:', error);
    return res.status(500).json({ error: 'Lỗi cập nhật thông tin phòng trọ' });
  }
};

app.patch('/api/rooms/:id', requireAuth, handleUpdateRoom);
app.put('/api/rooms/:id', requireAuth, handleUpdateRoom);

// Dedicated Room Location PATCH API (for owner or admin)
app.patch('/api/rooms/:id/location', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const roomId = req.params.id;
    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy bài đăng phòng trọ' });
    }

    if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật vị trí cho phòng này' });
    }

    const { latitude, longitude } = req.body;

    // Reset location case
    if (latitude === null && longitude === null) {
      const updated = await updateRoomLocation(roomId, null, null, false);
      return res.json({ success: true, message: 'Đã xóa vị trí GPS của bài đăng', room: updated });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: 'Tọa độ latitude và longitude phải là số thực hợp lệ' });
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Tọa độ nằm ngoài phạm vi chuẩn WGS84' });
    }

    const isThaiNguyenBounds = latNum >= 21.2 && latNum <= 22.0 && lngNum >= 105.5 && lngNum <= 106.3;

    const updated = await updateRoomLocation(roomId, latNum, lngNum, true);
    return res.json({
      success: true,
      message: 'Cập nhật vị trí GPS thành công',
      room: updated,
      warning: !isThaiNguyenBounds
        ? 'Tọa độ vừa chọn có vẻ nằm ngoài ranh giới Tỉnh Thái Nguyên (vĩ độ 21.2-22.0, kinh độ 105.5-106.3). Bạn hãy kiểm tra lại nếu cần.'
        : undefined,
    });
  } catch (error) {
    console.error('Update room location error:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật vị trí phòng' });
  }
});

// Geocoding Proxy & Local Cache Endpoint (OpenStreetMap Nominatim compliant)
const geoSearchCache = new Map<string, { timestamp: number; results: any[] }>();

app.get('/api/geo/search', async (req: Request, res: Response) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ results: [] });
    }

    const cacheKey = rawQuery.toLowerCase();
    const cached = geoSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return res.json({ results: cached.results });
    }

    const thaiNguyenPresets = [
      { name: 'Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên', lat: 21.5855, lon: 105.8066, type: 'street' },
      { name: 'Đại học Công nghệ Thông tin & Truyền thông (ICTU), Đường Z115', lat: 21.5855, lon: 105.8066, type: 'university' },
      { name: 'Đại học Kỹ thuật Công nghiệp Thái Nguyên (TNUT), Số 666 Đường 3/2', lat: 21.5542, lon: 105.8458, type: 'university' },
      { name: 'Đại học Y - Dược Thái Nguyên (TUMP), Số 284 Lương Ngọc Quyến', lat: 21.5960, lon: 105.8320, type: 'university' },
      { name: 'Đại học Sư phạm Thái Nguyên (TNUE), Số 20 Lương Ngọc Quyến', lat: 21.5975, lon: 105.8272, type: 'university' },
      { name: 'Đại học Khoa học Thái Nguyên (TNUS), Phường Tân Thịnh', lat: 21.5820, lon: 105.8190, type: 'university' },
      { name: 'Đại học Nông Lâm Thái Nguyên (TUAF), Xã Quyết Thắng', lat: 21.5880, lon: 105.8240, type: 'university' },
      { name: 'Đại học Kinh tế & QTKD (TUEBA), Phường Thịnh Đán', lat: 21.5790, lon: 105.8125, type: 'university' },
      { name: 'Đường Quang Trung, Phường Thịnh Đán, TP. Thái Nguyên', lat: 21.5780, lon: 105.8080, type: 'street' },
      { name: 'Đường Lương Ngọc Quyến, TP. Thái Nguyên', lat: 21.5940, lon: 105.8330, type: 'street' },
      { name: 'Đường Hoàng Văn Thụ, TP. Thái Nguyên', lat: 21.5965, lon: 105.8400, type: 'street' },
      { name: 'Bến xe khách Trung tâm Thái Nguyên', lat: 21.5830, lon: 105.8420, type: 'transport' },
      { name: 'Bệnh viện A Thái Nguyên, Đường Quang Trung', lat: 21.5780, lon: 105.8080, type: 'hospital' },
      { name: 'Bệnh viện Trung ương Thái Nguyên, Số 479 Lương Ngọc Quyến', lat: 21.5920, lon: 105.8360, type: 'hospital' },
      { name: 'Khu công nghiệp Điềm Thụy, Huyện Phú Bình, Thái Nguyên', lat: 21.4650, lon: 105.9320, type: 'industrial' },
      { name: 'Khu công nghiệp Sông Công I & II, TP. Sông Công', lat: 21.4880, lon: 105.8450, type: 'industrial' },
      { name: 'KCN Yên Bình (Tổ hợp Samsung Electronics SEVT), TP. Phổ Yên', lat: 21.4420, lon: 105.8890, type: 'industrial' },
    ];

    const matchedPresets = thaiNguyenPresets.filter(p =>
      p.name.toLowerCase().includes(rawQuery.toLowerCase())
    );

    let remoteResults: any[] = [];
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${rawQuery}, Thái Nguyên, Việt Nam`)}&limit=5&addressdetails=1&countrycodes=vn`;
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'PhongTroThaiNguyen/2.0 (contact: admin@phongtrothainguyen.vn)',
          'Accept-Language': 'vi,en;q=0.9',
        },
      });
      if (response.ok) {
        const data = await response.json();
        remoteResults = data.map((item: any) => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type || 'place',
        }));
      }
    } catch (err: any) {
      console.warn('[Geocoding] Nominatim request note:', err?.message);
    }

    const merged = [...matchedPresets, ...remoteResults].filter(
      (item, idx, self) =>
        idx === self.findIndex(t => Math.abs(t.lat - item.lat) < 0.001 && Math.abs(t.lon - item.lon) < 0.001)
    );

    geoSearchCache.set(cacheKey, { timestamp: Date.now(), results: merged });
    return res.json({ results: merged });
  } catch (err) {
    console.error('Geocoding search error:', err);
    return res.status(500).json({ error: 'Lỗi tra cứu địa chỉ trên bản đồ' });
  }
});

// ==========================================
// ROOM IMAGES MANAGEMENT APIS
// ==========================================

// Upload images to a room (Supabase Storage / local fallback)
app.post(
  '/api/rooms/:id/images',
  requireAuth,
  upload.array('images', MAX_IMAGES_PER_ROOM),
  async (req: AuthRequest, res: Response) => {
    try {
      const room = await getRoomById(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Không tìm thấy bài đăng phòng trọ' });
      }

      if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
        return res.status(403).json({ error: 'Bạn không có quyền tải ảnh cho bài đăng này' });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        return res.status(400).json({ error: 'Vui lòng chọn ít nhất một file ảnh để tải lên' });
      }

      const existingImages = await getRoomImagesByRoom(room.id);
      if (existingImages.length + files.length > MAX_IMAGES_PER_ROOM) {
        return res.status(400).json({
          error: `Mỗi phòng trọ chỉ được tối đa ${MAX_IMAGES_PER_ROOM} ảnh. Phòng hiện có ${existingImages.length} ảnh, không thể tải thêm ${files.length} ảnh.`,
        });
      }

      // Pre-validate all files
      for (const file of files) {
        const check = validateImageFile(file);
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
      }

      const uploadedRecords: RoomImage[] = [];
      const uploadedStoragePaths: string[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const { storagePath, publicUrl } = await uploadRoomImage(room.owner_id, room.id, file);
          uploadedStoragePaths.push(storagePath);

          // If room had no images, the very first uploaded image becomes the cover
          const isCover = existingImages.length === 0 && i === 0;
          const record = await addRoomImage({
            room_id: room.id,
            image_url: publicUrl,
            storage_path: storagePath,
            is_cover: isCover,
            sort_order: existingImages.length + i,
          });
          uploadedRecords.push(record);
        }
      } catch (uploadError) {
        // Rollback uploaded files from storage if DB or upload failed halfway
        for (const p of uploadedStoragePaths) {
          await deleteRoomImageFromStorage(p);
        }
        throw uploadError;
      }

      const allImages = await getRoomImagesByRoom(room.id);
      return res.status(201).json({
        success: true,
        uploaded: uploadedRecords,
        images: allImages,
      });
    } catch (error: any) {
      console.error('Upload room images error:', error);
      return res.status(500).json({ error: error.message || 'Lỗi tải ảnh lên bài đăng' });
    }
  }
);

// Delete a room image
app.delete('/api/rooms/:id/images/:imageId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy phòng trọ' });
    }

    if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa ảnh của phòng này' });
    }

    // Delete from DB first
    const result = await deleteRoomImage(req.params.imageId, room.id);
    if (!result.success) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh cần xóa' });
    }

    // Only after DB confirms deletion, remove file from storage
    if (result.storage_path) {
      await deleteRoomImageFromStorage(result.storage_path);
    }

    const remainingImages = await getRoomImagesByRoom(room.id);
    return res.json({ success: true, images: remainingImages });
  } catch (error) {
    console.error('Delete room image error:', error);
    return res.status(500).json({ error: 'Lỗi khi xóa ảnh phòng trọ' });
  }
});

// Reorder room images
app.patch('/api/rooms/:id/images/reorder', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy bài đăng phòng trọ' });
    }

    if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
      return res.status(403).json({ error: 'Bạn không có quyền sắp xếp ảnh của phòng này' });
    }

    const { image_ids } = req.body;
    if (!Array.isArray(image_ids)) {
      return res.status(400).json({ error: 'Danh sách image_ids không hợp lệ' });
    }

    const updatedImages = await reorderRoomImages(room.id, image_ids);
    return res.json({ success: true, images: updatedImages });
  } catch (error) {
    console.error('Reorder images error:', error);
    return res.status(500).json({ error: 'Lỗi sắp xếp thứ tự ảnh phòng trọ' });
  }
});

// Set cover / primary image (supports both /:imageId/cover and /cover)
const handleSetCover = async (req: AuthRequest, res: Response) => {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy bài đăng phòng trọ' });
    }

    if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
      return res.status(403).json({ error: 'Bạn không có quyền đổi ảnh đại diện bài đăng' });
    }

    const imageId = req.params.imageId || req.body.image_id;
    if (!imageId) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã ảnh muốn đặt làm ảnh đại diện' });
    }

    const updatedImages = await setRoomCoverImage(room.id, imageId);
    return res.json({ success: true, images: updatedImages });
  } catch (error) {
    console.error('Set cover image error:', error);
    return res.status(500).json({ error: 'Lỗi khi đặt ảnh đại diện' });
  }
};

app.patch('/api/rooms/:id/images/:imageId/cover', requireAuth, handleSetCover);
app.patch('/api/rooms/:id/images/cover', requireAuth, handleSetCover);

app.delete('/api/rooms/:id', requireAuth, requireRole(['OWNER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const room = await getRoomById(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }

  if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
    return res.status(403).json({ error: 'Bạn không có quyền xóa phòng này' });
  }

  const deleted = await deleteRoom(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }
  return res.json({ success: true, message: 'Đã xóa phòng trọ thành công' });
});

app.post('/api/ai/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { session_id, message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Vui lòng cung cấp nội dung tin nhắn' });
    }

    let session = await getChatSession(session_id || '');
    if (!session) {
      session = {
        id: session_id || `sess-${Date.now()}`,
        user_id: req.user?.id,
        context: { province: 'Thái Nguyên', amenities: [] },
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveChatSession(session);
    }

    const existingMessages = await getChatMessages(session.id);
    session.messages = existingMessages;

    // Convert past messages to multi-turn conversation history for LLM
    const conversationHistory = existingMessages.slice(-10).map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    }));

    // Record user message
    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: 'user' as const,
      text: message,
      created_at: new Date().toISOString(),
    };
    session.messages.push(userMsg);
    await appendChatMessage(session.id, userMsg);

    // Execute chat response with intent classification & conversational intelligence
    const chatResult = await executeChatResponse(message, session.context, conversationHistory);

    // Preserve search context and last found rooms across turns
    session.context = {
      ...session.context,
      structured_query: chatResult.structured_query,
      last_rooms: chatResult.last_rooms || session.context?.last_rooms || [],
    };
    session.updated_at = new Date().toISOString();
    await saveChatSession(session);

    // Record bot response message
    const botMsg = {
      id: `msg-${Date.now()}-b`,
      sender: 'bot' as const,
      text: chatResult.reply_text,
      structured_query: chatResult.structured_query,
      matched_rooms: chatResult.rooms,
      created_at: new Date().toISOString(),
    };
    await appendChatMessage(session.id, botMsg);

    return res.json({
      session_id: session.id,
      reply_text: chatResult.reply_text,
      structured_query: chatResult.structured_query,
      rooms: chatResult.rooms,
      total_matched: chatResult.total_matched,
      suggest_rooms: (chatResult as any).suggest_rooms || [],
      location_info: chatResult.location_info,
      context: session.context,
      intent: chatResult.intent,
    });
  } catch (error) {
    console.error('Error in AI Chat endpoint:', error);
    return res.status(500).json({ error: 'Lỗi xử lý AI Chatbot' });
  }
});

app.delete('/api/ai/chat/:session_id', async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    if (session_id) {
      await clearChatSession(session_id);
    }
    return res.json({ success: true, message: 'Đã làm mới phiên hội thoại AI' });
  } catch (error) {
    console.error('Error clearing chat session:', error);
    return res.status(500).json({ error: 'Không thể xóa phiên hội thoại' });
  }
});

app.post('/api/ai/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Vui lòng nhập yêu cầu tìm kiếm' });
    }

    const result = await executeAiRoomSearch(query, {});
    return res.json(result);
  } catch (error) {
    console.error('AI search error:', error);
    return res.status(500).json({ error: 'Lỗi phân tích tìm kiếm thông minh' });
  }
});

app.get('/api/favorites', requireAuth, async (req: AuthRequest, res: Response) => {
  const rooms = await listFavoritesForUser(req.user!.id);
  return res.json(rooms);
});

app.post('/api/favorites/:room_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const roomId = req.params.room_id;
  await createFavorite(req.user!.id, roomId);
  return res.json({ success: true, is_favorite: true });
});

app.delete('/api/favorites/:room_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const roomId = req.params.room_id;
  await removeFavorite(req.user!.id, roomId);
  return res.json({ success: true, is_favorite: false });
});

app.post('/api/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  const { room_id, rating, comment } = req.body;
  if (!room_id || !rating || !comment) {
    return res.status(400).json({ error: 'Vui lòng nhập số sao và bình luận đánh giá' });
  }

  const user = await getUserById(req.user!.id);
  const review = await createReview({
    user_id: req.user!.id,
    room_id,
    rating: Number(rating),
    comment,
    user_name: user?.full_name || 'Khách thuê',
    user_avatar: user?.avatar,
  });

  return res.status(201).json(review);
});

app.post('/api/reports', requireAuth, async (req: AuthRequest, res: Response) => {
  const { room_id, reason, details } = req.body;
  const room = await getRoomById(room_id);
  const user = await getUserById(req.user!.id);

  const report = await createReport({
    user_id: req.user!.id,
    room_id,
    reason,
    details,
    user_name: user?.full_name || 'Người dùng',
    room_title: room?.title || 'Phòng trọ',
  });

  return res.status(201).json({ success: true, message: 'Đã gửi báo cáo thành công', report });
});

app.post('/api/contact', async (req: AuthRequest, res: Response) => {
  const { room_id, name, phone, note } = req.body;
  const room = await getRoomById(room_id);
  if (room) {
    await incrementRoomContact(room_id);
  }

  const inquiry = await createContact({
    room_id,
    user_id: req.user?.id,
    name: name || 'Khách liên hệ',
    phone: phone || '',
    note: note || '',
  });

  return res.json({ success: true, message: 'Đã gửi yêu cầu liên hệ tới chủ trọ', contact: inquiry });
});

app.get('/api/owner/dashboard', requireAuth, requireRole(['OWNER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'ADMIN') {
    const allRooms = await listAllRooms();
    const stats = {
      total_rooms: allRooms.length,
      available_rooms: allRooms.filter((r) => r.status === 'available').length,
      rented_rooms: allRooms.filter((r) => r.status === 'rented').length,
      total_views: allRooms.reduce((acc, r) => acc + r.view_count, 0),
      total_contacts: allRooms.reduce((acc, r) => acc + r.contact_count, 0),
    };
    return res.json({ stats, rooms: allRooms });
  }

  const dashboard = await getOwnerDashboard(req.user!.id);
  return res.json(dashboard);
});

app.get('/api/admin/dashboard', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const dashboard = await getAdminDashboard();
  return res.json(dashboard);
});

app.get('/api/admin/users', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const users = await getAllUsers();
  const safeUsers = users.map(({ password_hash, ...u }) => u);
  return res.json(safeUsers);
});

app.put('/api/admin/users/:id/status', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  }

  const updated = await updateUserStatus(user.id, req.body.status === 'locked' ? 'locked' : 'active');
  return res.json({ success: true, status: updated?.status || user.status });
});

app.get('/api/admin/rooms', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  return res.json(await listAllRooms());
});

app.put('/api/admin/rooms/:id/status', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const room = await getRoomById(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }

  const updated = await updateRoom(room.id, { status: req.body.status, updated_at: new Date().toISOString() } as any);
  return res.json(updated);
});

app.get('/api/admin/reports', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  return res.json(await getAllReports());
});

app.put('/api/admin/reports/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  const report = await updateReportStatus(req.params.id, req.body.status || 'resolved');
  if (!report) {
    return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  }
  return res.json(report);
});

export default app;
