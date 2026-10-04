import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

export type UserRole = 'USER' | 'OWNER' | 'ADMIN';
export type UserStatus = 'active' | 'locked';
export type RoomStatus = 'available' | 'rented' | 'pending' | 'rejected' | 'hidden';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  password_hash: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface LocationItem {
  id: string;
  name: string;
  short_name: string;
  type: 'university' | 'college' | 'hospital' | 'industrial_zone' | 'landmark' | 'other';
  address: string;
  latitude: number;
  longitude: number;
}

export interface Amenity {
  id: string;
  name: string;
  code: string;
  icon: string;
}

export interface Room {
  id: string;
  owner_id: string;
  owner_name?: string;
  owner_phone?: string;
  owner_zalo?: string;
  title: string;
  description: string;
  price: number;
  area: number;
  floor?: number;
  roommate_needed?: boolean;
  room_type: 'ktx' | 'tro_khep_kin' | 'chung_cu_mini' | 'nha_nguyen_can' | 'homestay';
  province: string;
  district: string;
  ward: string;
  street: string;
  address: string;
  latitude: number;
  longitude: number;
  max_people: number;
  gender_requirement: 'all' | 'male_only' | 'female_only';
  deposit: number;
  electricity_price: number;
  water_price: number;
  internet_price: number;
  service_fee: number;
  status: RoomStatus;
  view_count: number;
  contact_count: number;
  amenities: string[];
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  room_id: string;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  room_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  user_name: string;
  room_id: string;
  room_title: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id?: string;
  context: {
    near_location?: string;
    max_distance_km?: number;
    min_price?: number;
    max_price?: number;
    min_area?: number;
    max_area?: number;
    room_type?: string;
    amenities?: string[];
    province?: string;
  };
  messages: Array<{
    id: string;
    sender: 'user' | 'bot';
    text: string;
    structured_query?: any;
    matched_rooms?: any[];
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ContactInquiry {
  id: string;
  room_id: string;
  user_id?: string;
  name: string;
  phone: string;
  note: string;
  created_at: string;
}

export const db = {
  users: [] as User[],
  locations: [] as LocationItem[],
  amenities: [] as Amenity[],
  rooms: [] as Room[],
  favorites: [] as Favorite[],
  reviews: [] as Review[],
  reports: [] as Report[],
  chatSessions: [] as ChatSession[],
  contacts: [] as ContactInquiry[],
};

const connString = process.env.DATABASE_URL;
if (!connString) {
  throw new Error('DATABASE_URL is missing. Please set DATABASE_URL in the .env file before starting the server.');
}

export const pool = new pg.Pool({
  connectionString: connString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: connString.includes('localhost') || connString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

export async function ensureDatabaseConnection(): Promise<void> {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    console.log('✅ PostgreSQL connected successfully:', result.rows[0].now);
    await refreshStaticData();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed. Check DATABASE_URL and database availability.');
    console.error(error);
    throw error;
  }
}

export async function refreshStaticData(): Promise<void> {
  const [locationsRes, amenitiesRes] = await Promise.all([
    pool.query('SELECT * FROM locations ORDER BY name ASC'),
    pool.query('SELECT * FROM amenities ORDER BY name ASC'),
  ]);
  db.locations = locationsRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    type: row.type,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
  db.amenities = amenitiesRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    icon: row.icon || '',
  }));
}

export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function calculateMatchScore(
  room: Room,
  query: {
    near_location?: string;
    max_distance_km?: number;
    min_price?: number;
    max_price?: number;
    min_area?: number;
    max_area?: number;
    room_type?: string;
    amenities?: string[];
  },
  locationObj?: LocationItem
): { score: number; distance?: number; breakdown: Record<string, number> } {
  let distanceScore = 30;
  let priceScore = 25;
  let amenitiesScore = 20;
  let areaScore = 10;
  let roomTypeScore = 10;
  let otherScore = 5;
  let dist: number | undefined = undefined;

  if (locationObj) {
    dist = calculateHaversineDistance(locationObj.latitude, locationObj.longitude, room.latitude, room.longitude);
    const maxDist = query.max_distance_km || 3;
    if (dist <= maxDist * 0.5) {
      distanceScore = 30;
    } else if (dist <= maxDist) {
      distanceScore = Math.max(15, 30 - ((dist - maxDist * 0.5) / (maxDist * 0.5)) * 15);
    } else if (dist <= maxDist * 1.5) {
      distanceScore = Math.max(5, 15 - ((dist - maxDist) / (maxDist * 0.5)) * 10);
    } else {
      distanceScore = 2;
    }
  }

  if (query.max_price) {
    if (room.price <= query.max_price) {
      priceScore = 25;
    } else if (room.price <= query.max_price * 1.15) {
      priceScore = 15;
    } else {
      priceScore = 5;
    }
  }
  if (query.min_price && room.price < query.min_price) {
    priceScore = Math.max(10, priceScore - 10);
  }

  if (query.amenities && query.amenities.length > 0) {
    const matched = query.amenities.filter((a) => room.amenities.some((ra) => ra.toLowerCase() === a.toLowerCase()));
    const ratio = matched.length / query.amenities.length;
    amenitiesScore = Math.round(ratio * 20);
  }

  if (query.min_area) {
    if (room.area >= query.min_area) {
      areaScore = 10;
    } else {
      areaScore = Math.max(3, Math.round((room.area / query.min_area) * 10));
    }
  }

  if (query.room_type) {
    if (room.room_type === query.room_type) {
      roomTypeScore = 10;
    } else {
      roomTypeScore = 3;
    }
  }

  const totalScore = Math.min(
    100,
    Math.round(distanceScore + priceScore + amenitiesScore + areaScore + roomTypeScore + otherScore)
  );

  return {
    score: totalScore,
    distance: dist,
    breakdown: {
      distance: Math.round(distanceScore),
      price: Math.round(priceScore),
      amenities: Math.round(amenitiesScore),
      area: Math.round(areaScore),
      roomType: Math.round(roomTypeScore),
    },
  };
}

function toIsoDate(value: Date | string | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function buildRoomFromRow(row: any, amenityCodes: string[] = [], images: string[] = []): Room {
  return {
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    owner_phone: row.owner_phone,
    owner_zalo: row.owner_zalo,
    title: row.title,
    description: row.description || '',
    price: Number(row.price),
    area: Number(row.area),
    floor: row.floor,
    roommate_needed: row.roommate_needed,
    room_type: row.room_type,
    province: row.province,
    district: row.district,
    ward: row.ward,
    street: row.street || '',
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    max_people: Number(row.max_people || 2),
    gender_requirement: row.gender_requirement || 'all',
    deposit: Number(row.deposit || 0),
    electricity_price: Number(row.electricity_price || 3500),
    water_price: Number(row.water_price || 25000),
    internet_price: Number(row.internet_price || 80000),
    service_fee: Number(row.service_fee || 0),
    status: row.status,
    view_count: Number(row.view_count || 0),
    contact_count: Number(row.contact_count || 0),
    amenities: Array.isArray(amenityCodes) ? amenityCodes : [],
    images: Array.isArray(images) ? images : [],
    created_at: toIsoDate(row.created_at),
    updated_at: toIsoDate(row.updated_at),
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
  return rows[0] ? rows[0] : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? rows[0] : null;
}

export async function getAllUsers(): Promise<User[]> {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return rows;
}

export async function createUser(input: Partial<User> & { password_hash: string; full_name: string; email: string; role?: UserRole; status?: UserStatus }): Promise<User> {
  const id = input.id || crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO users (id, full_name, email, phone, password_hash, avatar, role, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      id,
      input.full_name,
      input.email,
      input.phone || '',
      input.password_hash,
      input.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.full_name)}`,
      input.role || 'USER',
      input.status || 'active',
    ]
  );
  return rows[0];
}

export async function updateUser(input: { id: string; full_name?: string; phone?: string; avatar?: string; new_password?: string; status?: UserStatus }): Promise<User | null> {
  const current = await getUserById(input.id);
  if (!current) return null;

  const nextName = input.full_name ?? current.full_name;
  const nextPhone = input.phone ?? current.phone;
  const nextAvatar = input.avatar ?? current.avatar;
  const nextStatus = input.status ?? current.status;
  const nextPasswordHash = input.new_password ? input.new_password : current.password_hash;

  const { rows } = await pool.query(
    `UPDATE users
     SET full_name = $2,
         phone = $3,
         avatar = $4,
         password_hash = $5,
         status = $6,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.id, nextName, nextPhone, nextAvatar, nextPasswordHash, nextStatus]
  );
  return rows[0] || null;
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<User | null> {
  const { rows } = await pool.query(
    `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, status]
  );
  return rows[0] || null;
}

export async function listLocations(): Promise<LocationItem[]> {
  const { rows } = await pool.query('SELECT * FROM locations ORDER BY name ASC');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    type: row.type,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
}

export async function findLocationByShortName(shortName: string): Promise<LocationItem | null> {
  const { rows } = await pool.query(
    'SELECT * FROM locations WHERE LOWER(short_name) = LOWER($1) OR LOWER(id) = LOWER($1) LIMIT 1',
    [shortName]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    type: row.type,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

export async function listAmenities(): Promise<Amenity[]> {
  const { rows } = await pool.query('SELECT * FROM amenities ORDER BY name ASC');
  return rows.map((row) => ({ id: row.id, name: row.name, code: row.code, icon: row.icon || '' }));
}

async function getRoomAmenityCodes(roomIds: string[]): Promise<Map<string, string[]>> {
  if (!roomIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT ra.room_id, a.code
     FROM room_amenities ra
     JOIN amenities a ON a.id = ra.amenity_id
     WHERE ra.room_id = ANY($1)`,
    [roomIds]
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!map.has(row.room_id)) map.set(row.room_id, []);
    map.get(row.room_id)!.push(row.code);
  }
  return map;
}

async function getRoomImages(roomIds: string[]): Promise<Map<string, string[]>> {
  if (!roomIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT room_id, url FROM room_images WHERE room_id = ANY($1) ORDER BY created_at ASC`,
    [roomIds]
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!map.has(row.room_id)) map.set(row.room_id, []);
    map.get(row.room_id)!.push(row.url);
  }
  return map;
}

export async function listRoomsForSearch(): Promise<Room[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS owner_name, u.phone AS owner_phone, u.avatar AS owner_avatar
     FROM rooms r
     LEFT JOIN users u ON u.id = r.owner_id
     WHERE r.province = 'Thái Nguyên' AND (r.status = 'available' OR r.status = 'pending')
     ORDER BY r.created_at DESC`
  );
  const roomIds = rows.map((row) => row.id);

  const [amenityMap, imageMap] = await Promise.all([
    getRoomAmenityCodes(roomIds),
    getRoomImages(roomIds),
  ]);

  return rows.map((row) => buildRoomFromRow(row, amenityMap.get(row.id) || [], imageMap.get(row.id) || []));
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS owner_name, u.phone AS owner_phone, u.avatar AS owner_avatar
     FROM rooms r
     LEFT JOIN users u ON u.id = r.owner_id
     WHERE r.id = $1 LIMIT 1`,
    [roomId]
  );
  if (!rows[0]) return null;
  const roomIds = [rows[0].id];
  const [amenityMap, imageMap] = await Promise.all([
    getRoomAmenityCodes(roomIds),
    getRoomImages(roomIds),
  ]);
  return buildRoomFromRow(rows[0], amenityMap.get(rows[0].id) || [], imageMap.get(rows[0].id) || []);
}

export async function listRoomsByOwner(ownerId: string): Promise<Room[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS owner_name, u.phone AS owner_phone, u.avatar AS owner_avatar
     FROM rooms r
     LEFT JOIN users u ON u.id = r.owner_id
     WHERE r.owner_id = $1
     ORDER BY r.created_at DESC`,
    [ownerId]
  );
  const roomIds = rows.map((row) => row.id);
  const [amenityMap, imageMap] = await Promise.all([
    getRoomAmenityCodes(roomIds),
    getRoomImages(roomIds),
  ]);
  return rows.map((row) => buildRoomFromRow(row, amenityMap.get(row.id) || [], imageMap.get(row.id) || []));
}

export async function listAllRooms(): Promise<Room[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS owner_name, u.phone AS owner_phone, u.avatar AS owner_avatar
     FROM rooms r
     LEFT JOIN users u ON u.id = r.owner_id
     ORDER BY r.created_at DESC`
  );
  const roomIds = rows.map((row) => row.id);
  const [amenityMap, imageMap] = await Promise.all([
    getRoomAmenityCodes(roomIds),
    getRoomImages(roomIds),
  ]);
  return rows.map((row) => buildRoomFromRow(row, amenityMap.get(row.id) || [], imageMap.get(row.id) || []));
}

export async function createRoom(input: Partial<Room> & { owner_id: string; title: string; price: number; area: number; address: string; province?: string; amenities?: string[]; images?: string[] }): Promise<Room> {
  const id = input.id || `room-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const { rows } = await pool.query(
    `INSERT INTO rooms (
      id, owner_id, title, description, price, area, room_type, province, district, ward, street, address,
      latitude, longitude, max_people, gender_requirement, deposit, electricity_price, water_price,
      internet_price, service_fee, status, view_count, contact_count, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW()
    ) RETURNING *`,
    [
      id,
      input.owner_id,
      input.title,
      input.description || '',
      Number(input.price),
      Number(input.area),
      input.room_type || 'tro_khep_kin',
      input.province || 'Thái Nguyên',
      input.district || 'TP. Thái Nguyên',
      input.ward || 'Xã Quyết Thắng',
      input.street || '',
      input.address,
      Number(input.latitude ?? 21.5855),
      Number(input.longitude ?? 105.8066),
      Number(input.max_people ?? 2),
      input.gender_requirement || 'all',
      Number(input.deposit ?? 0),
      Number(input.electricity_price ?? 3500),
      Number(input.water_price ?? 25000),
      Number(input.internet_price ?? 80000),
      Number(input.service_fee ?? 0),
      input.status || 'available',
      0,
      0,
    ]
  );

  const room = rows[0];
  const amenities = Array.isArray(input.amenities) ? input.amenities : [];
  if (amenities.length) {
    const { rows: amenityRows } = await pool.query(
      'SELECT id, code FROM amenities WHERE code = ANY($1)',
      [amenities.map((amenity) => amenity.toLowerCase())]
    );
    if (amenityRows.length) {
      const values = amenityRows.map((row) => `('${id}', '${row.id}')`).join(', ');
      await pool.query(`INSERT INTO room_amenities (room_id, amenity_id) VALUES ${values}`);
    }
  }

  const images = Array.isArray(input.images) && input.images.length > 0 ? input.images : ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800'];
  if (images.length) {
    const imageValues = images.map((image) => `('${id}-${crypto.randomUUID()}', '${id}', '${image.replace(/'/g, "''")}', ${image === images[0] ? true : false}, NOW())`).join(', ');
    await pool.query(`INSERT INTO room_images (id, room_id, url, is_primary, created_at) VALUES ${imageValues}`);
  }

  return (await getRoomById(id)) as Room;
}

export async function updateRoom(roomId: string, updates: Partial<Room> & { amenities?: string[]; images?: string[] }): Promise<Room | null> {
  const current = await getRoomById(roomId);
  if (!current) return null;

  const next = { ...current, ...updates };
  const { rows } = await pool.query(
    `UPDATE rooms SET
      title = $2,
      description = $3,
      price = $4,
      area = $5,
      room_type = $6,
      province = $7,
      district = $8,
      ward = $9,
      street = $10,
      address = $11,
      latitude = $12,
      longitude = $13,
      max_people = $14,
      gender_requirement = $15,
      deposit = $16,
      electricity_price = $17,
      water_price = $18,
      internet_price = $19,
      service_fee = $20,
      status = $21,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      roomId,
      next.title,
      next.description || '',
      Number(next.price),
      Number(next.area),
      next.room_type,
      next.province,
      next.district,
      next.ward,
      next.street || '',
      next.address,
      Number(next.latitude),
      Number(next.longitude),
      Number(next.max_people || 2),
      next.gender_requirement || 'all',
      Number(next.deposit || 0),
      Number(next.electricity_price || 3500),
      Number(next.water_price || 25000),
      Number(next.internet_price || 80000),
      Number(next.service_fee || 0),
      next.status || 'available',
    ]
  );

  if (updates.amenities) {
    await pool.query('DELETE FROM room_amenities WHERE room_id = $1', [roomId]);
    const amenityRows = await pool.query(
      'SELECT id, code FROM amenities WHERE code = ANY($1)',
      [updates.amenities.map((item) => item.toLowerCase())]
    );
    if (amenityRows.rows.length) {
      const values = amenityRows.rows.map((row) => `('${roomId}', '${row.id}')`).join(', ');
      await pool.query(`INSERT INTO room_amenities (room_id, amenity_id) VALUES ${values}`);
    }
  }

  if (updates.images) {
    const images = updates.images ?? [];
    await pool.query('DELETE FROM room_images WHERE room_id = $1', [roomId]);
    const imageValues = images.map((image) => `('${roomId}-${crypto.randomUUID()}', '${roomId}', '${image.replace(/'/g, "''")}', ${image === images[0] ? true : false}, NOW())`).join(', ');
    if (imageValues) {
      await pool.query(`INSERT INTO room_images (id, room_id, url, is_primary, created_at) VALUES ${imageValues}`);
    }
  }

  return (await getRoomById(roomId)) as Room;
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
  return (rowCount ?? 0) > 0;
}

export async function createFavorite(userId: string, roomId: string): Promise<boolean> {
  const existing = await pool.query(
    'SELECT id FROM favorites WHERE user_id = $1 AND room_id = $2 LIMIT 1',
    [userId, roomId]
  );
  if (existing.rows[0]) return true;
  await pool.query(
    'INSERT INTO favorites (id, user_id, room_id, created_at) VALUES ($1, $2, $3, NOW())',
    [`fav-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, userId, roomId]
  );
  return true;
}

export async function removeFavorite(userId: string, roomId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM favorites WHERE user_id = $1 AND room_id = $2',
    [userId, roomId]
  );
  return (rowCount ?? 0) > 0;
}

export async function listFavoritesForUser(userId: string): Promise<Room[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS owner_name, u.phone AS owner_phone, u.avatar AS owner_avatar
     FROM favorites f
     JOIN rooms r ON r.id = f.room_id
     LEFT JOIN users u ON u.id = r.owner_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );
  const roomIds = rows.map((row) => row.id);
  const [amenityMap, imageMap] = await Promise.all([
    getRoomAmenityCodes(roomIds),
    getRoomImages(roomIds),
  ]);
  return rows.map((row) => buildRoomFromRow(row, amenityMap.get(row.id) || [], imageMap.get(row.id) || []));
}

export async function createReview(input: { user_id: string; room_id: string; rating: number; comment: string; user_name?: string; user_avatar?: string }): Promise<Review> {
  const { rows } = await pool.query(
    `INSERT INTO reviews (id, user_id, room_id, rating, comment, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [`rev-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, input.user_id, input.room_id, Number(input.rating), input.comment]
  );
  const review = rows[0];
  return {
    id: review.id,
    user_id: review.user_id,
    user_name: input.user_name || 'Khách thuê',
    user_avatar: input.user_avatar,
    room_id: review.room_id,
    rating: Number(review.rating),
    comment: review.comment,
    created_at: new Date(review.created_at).toISOString(),
  };
}

export async function createReport(input: { user_id: string; room_id: string; reason: string; details?: string; user_name?: string; room_title?: string }): Promise<Report> {
  const room = await getRoomById(input.room_id);
  const { rows } = await pool.query(
    `INSERT INTO reports (id, user_id, room_id, reason, details, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING *`,
    [`rep-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, input.user_id, input.room_id, input.reason, input.details || '']
  );
  return {
    id: rows[0].id,
    user_id: rows[0].user_id,
    user_name: input.user_name || 'Người dùng',
    room_id: rows[0].room_id,
    room_title: input.room_title || room?.title || 'Phòng trọ',
    reason: rows[0].reason,
    details: rows[0].details || '',
    status: rows[0].status,
    created_at: new Date(rows[0].created_at).toISOString(),
  };
}

export async function createContact(input: { room_id: string; user_id?: string; name: string; phone: string; note: string }): Promise<ContactInquiry> {
  const { rows } = await pool.query(
    `INSERT INTO contacts (id, room_id, user_id, sender_name, sender_phone, sender_email, message, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', NOW()) RETURNING *`,
    [`ct-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, input.room_id, input.user_id || null, input.name || 'Khách liên hệ', input.phone || '', null, input.note || '']
  );
  return {
    id: rows[0].id,
    room_id: rows[0].room_id,
    user_id: rows[0].user_id || undefined,
    name: rows[0].sender_name,
    phone: rows[0].sender_phone,
    note: rows[0].message,
    created_at: new Date(rows[0].created_at).toISOString(),
  };
}

export async function incrementRoomView(roomId: string): Promise<void> {
  await pool.query('UPDATE rooms SET view_count = COALESCE(view_count, 0) + 1, updated_at = NOW() WHERE id = $1', [roomId]);
}

export async function incrementRoomContact(roomId: string): Promise<void> {
  await pool.query('UPDATE rooms SET contact_count = COALESCE(contact_count, 0) + 1, updated_at = NOW() WHERE id = $1', [roomId]);
}

export async function getOwnerDashboard(ownerId: string): Promise<{ stats: Record<string, number>; rooms: Room[] }> {
  const { rows } = await pool.query(
    `SELECT * FROM rooms WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  const roomIds = rows.map((row) => row.id);
  const [amenityMap, imageMap] = await Promise.all([
    getRoomAmenityCodes(roomIds),
    getRoomImages(roomIds),
  ]);
  const rooms = rows.map((row) => buildRoomFromRow(row, amenityMap.get(row.id) || [], imageMap.get(row.id) || []));
  const stats = {
    total_rooms: rows.length,
    available_rooms: rows.filter((row) => row.status === 'available').length,
    rented_rooms: rows.filter((row) => row.status === 'rented').length,
    total_views: rows.reduce((sum, row) => sum + Number(row.view_count || 0), 0),
    total_contacts: rows.reduce((sum, row) => sum + Number(row.contact_count || 0), 0),
  };
  return { stats, rooms };
}

export async function getAdminDashboard(): Promise<{ stats: Record<string, number>; recent_reports: Report[]; recent_rooms: Room[] }> {
  const [usersRes, roomsRes, reportsRes] = await Promise.all([
    pool.query('SELECT * FROM users'),
    pool.query('SELECT * FROM rooms ORDER BY created_at DESC LIMIT 5'),
    pool.query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 5'),
  ]);

  const rooms = await listAllRooms();
  const recentRooms = rooms.slice(0, 5);
  const recentReports = reportsRes.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: 'Người dùng',
    room_id: row.room_id,
    room_title: 'Phòng trọ',
    reason: row.reason,
    details: row.details || '',
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
  }));

  const stats = {
    total_users: usersRes.rows.filter((row) => row.role === 'USER').length,
    total_owners: usersRes.rows.filter((row) => row.role === 'OWNER').length,
    total_rooms: rooms.length,
    active_rooms: rooms.filter((row) => row.status === 'available').length,
    pending_rooms: rooms.filter((row) => row.status === 'pending').length,
    pending_reports: reportsRes.rows.filter((row) => row.status === 'pending').length,
  };

  return { stats, recent_reports: recentReports, recent_rooms: recentRooms };
}

export async function getAllReports(): Promise<Report[]> {
  const { rows } = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: 'Người dùng',
    room_id: row.room_id,
    room_title: 'Phòng trọ',
    reason: row.reason,
    details: row.details || '',
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
  }));
}

export async function updateReportStatus(reportId: string, status: 'pending' | 'resolved' | 'dismissed'): Promise<Report | null> {
  const { rows } = await pool.query(
    'UPDATE reports SET status = $2 WHERE id = $1 RETURNING *',
    [reportId, status]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    user_id: rows[0].user_id,
    user_name: 'Người dùng',
    room_id: rows[0].room_id,
    room_title: 'Phòng trọ',
    reason: rows[0].reason,
    details: rows[0].details || '',
    status: rows[0].status,
    created_at: new Date(rows[0].created_at).toISOString(),
  };
}

export async function getReviewByRoom(roomId: string): Promise<Review[]> {
  const { rows } = await pool.query(
    `SELECT r.*, u.full_name AS user_name, u.avatar AS user_avatar
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.room_id = $1
     ORDER BY r.created_at DESC`,
    [roomId]
  );
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_avatar: row.user_avatar,
    room_id: row.room_id,
    rating: Number(row.rating),
    comment: row.comment,
    created_at: new Date(row.created_at).toISOString(),
  }));
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const { rows } = await pool.query('SELECT * FROM chat_sessions WHERE id = $1 LIMIT 1', [sessionId]);
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    user_id: rows[0].user_id || undefined,
    context: rows[0].context_json ? JSON.parse(rows[0].context_json || '{}') : {},
    messages: [],
    created_at: new Date(rows[0].created_at).toISOString(),
    updated_at: new Date(rows[0].updated_at).toISOString(),
  };
}

export async function saveChatSession(session: ChatSession): Promise<ChatSession> {
  const existing = await getChatSession(session.id);
  if (existing) {
    await pool.query(
      'UPDATE chat_sessions SET user_id = $2, context_json = $3, updated_at = NOW() WHERE id = $1',
      [session.id, session.user_id || null, JSON.stringify(session.context || {})]
    );
    return session;
  }

  await pool.query(
    'INSERT INTO chat_sessions (id, user_id, context_json, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
    [session.id, session.user_id || null, JSON.stringify(session.context || {})]
  );
  return session;
}

export async function appendChatMessage(sessionId: string, message: { id: string; sender: 'user' | 'bot'; text: string; structured_query?: any; matched_rooms?: any[]; created_at: string }): Promise<void> {
  await pool.query(
    `INSERT INTO chat_messages (id, session_id, sender, text, structured_query_json, matched_rooms_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      message.id,
      sessionId,
      message.sender,
      message.text,
      message.structured_query ? JSON.stringify(message.structured_query) : null,
      message.matched_rooms ? JSON.stringify(message.matched_rooms) : null,
    ]
  );
}

export async function getChatMessages(sessionId: string): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return rows.map((row) => ({
    id: row.id,
    sender: row.sender,
    text: row.text,
    structured_query: row.structured_query_json ? JSON.parse(row.structured_query_json) : undefined,
    matched_rooms: row.matched_rooms_json ? JSON.parse(row.matched_rooms_json) : undefined,
    created_at: new Date(row.created_at).toISOString(),
  }));
}

export async function hasDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { crypto };
