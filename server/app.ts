/**
 * Express Server for PhongTro Thai Nguyen
 * Implements REST APIs, Authentication, AI Chatbot with memory context,
 * Haversine formula distance calculations, and mounts Vite in dev mode.
 */
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
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
  calculateHaversineDistance,
} from './db.js';
import { executeAiRoomSearch } from './aiService.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'thai-nguyen-phongtro-secret-key-2025';
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5;
    const locations = await listLocations();
    let targetLoc: any = null;

    if (nearLocId) {
      targetLoc = locations.find(
        (l) => l.id === nearLocId || l.short_name.toLowerCase() === nearLocId.toLowerCase()
      );
    }

    let enriched = result.map((room) => {
      let dist: number | undefined = undefined;
      if (targetLoc) {
        dist = calculateHaversineDistance(targetLoc.latitude, targetLoc.longitude, room.latitude, room.longitude);
      }
      return { ...room, distance_to_target: dist };
    });

    if (targetLoc && req.query.strict_radius === 'true') {
      enriched = enriched.filter((r) => r.distance_to_target !== undefined && r.distance_to_target <= radius);
    }

    const sort = req.query.sort as string;
    if (sort === 'price_asc') {
      enriched.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      enriched.sort((a, b) => b.price - a.price);
    } else if (sort === 'nearest' && targetLoc) {
      enriched.sort((a, b) => (a.distance_to_target || 999) - (b.distance_to_target || 999));
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
    const distances = locations.map((loc) => ({
      location_id: loc.id,
      location_name: loc.name,
      short_name: loc.short_name,
      type: loc.type,
      distance_km: calculateHaversineDistance(loc.latitude, loc.longitude, room.latitude, room.longitude),
    })).sort((a, b) => a.distance_km - b.distance_km);

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
      latitude: latitude ? Number(latitude) : 21.5855 + (Math.random() - 0.5) * 0.02,
      longitude: longitude ? Number(longitude) : 105.8066 + (Math.random() - 0.5) * 0.02,
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

app.put('/api/rooms/:id', requireAuth, requireRole(['OWNER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const room = await getRoomById(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng trọ' });
  }

  if (req.user?.role !== 'ADMIN' && room.owner_id !== req.user?.id) {
    return res.status(403).json({ error: 'Bạn không có quyền sửa phòng này' });
  }

  const updates = req.body;
  if (updates.province && updates.province !== 'Thái Nguyên') {
    return res.status(400).json({ error: 'Chỉ chấp nhận phòng tại Tỉnh Thái Nguyên' });
  }

  const updated = await updateRoom(req.params.id, { ...updates, updated_at: new Date().toISOString() } as any);
  return res.json(updated);
});

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
    session.messages.push({
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      text: message,
      created_at: new Date().toISOString(),
    });

    await appendChatMessage(session.id, {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      text: message,
      created_at: new Date().toISOString(),
    });

    const searchResult = await executeAiRoomSearch(message, session.context);

    session.context = {
      ...session.context,
      ...searchResult.structured_query,
    };
    session.updated_at = new Date().toISOString();
    await saveChatSession(session);

    const botMsg = {
      id: `msg-${Date.now()}-b`,
      sender: 'bot' as const,
      text: searchResult.reply_text,
      structured_query: searchResult.structured_query,
      matched_rooms: searchResult.rooms,
      created_at: new Date().toISOString(),
    };
    await appendChatMessage(session.id, botMsg);

    return res.json({
      session_id: session.id,
      reply_text: searchResult.reply_text,
      structured_query: searchResult.structured_query,
      rooms: searchResult.rooms,
      total_matched: searchResult.total_matched,
      location_info: searchResult.location_info,
      context: session.context,
    });
  } catch (error) {
    console.error('Error in AI Chat endpoint:', error);
    return res.status(500).json({ error: 'Lỗi xử lý AI Chatbot' });
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
