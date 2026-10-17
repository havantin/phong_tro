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

export interface RoomImage {
  id: string;
  room_id: string;
  storage_path?: string;
  image_url: string;
  url?: string;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
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
  image_items?: RoomImage[];
  created_at: string;
  updated_at: string;
  location_verified?: boolean;
  location_updated_at?: string;
  distances?: Array<{ location: LocationItem; distance_km: number }>;
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
    structured_query?: any;
    last_rooms?: any[];
    [key: string]: any;
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

const connString = (process.env.DATABASE_URL || '').trim();
const isLocalDb = !connString || connString.includes('localhost') || connString.includes('127.0.0.1');

export const pool = new pg.Pool({
  connectionString: connString || undefined,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : (process.env.VERCEL ? 3 : 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

export async function ensureDatabaseConnection(): Promise<void> {
  if (!connString && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Please set DATABASE_URL in Vercel Environment Variables or your .env file.');
  }

  try {
    const result = await pool.query('SELECT NOW() AS now');
    console.log('✅ PostgreSQL connected successfully:', result.rows[0].now);

    // Auto-migrate room_images columns if needed
    try {
      await pool.query(`
        ALTER TABLE room_images ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
        ALTER TABLE room_images ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
        ALTER TABLE room_images ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT false;
        ALTER TABLE room_images ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        UPDATE room_images SET image_url = url WHERE image_url IS NULL AND url IS NOT NULL;
        UPDATE room_images SET is_cover = is_primary WHERE is_cover IS NULL AND is_primary IS NOT NULL;
        UPDATE room_images SET url = image_url WHERE url IS NULL AND image_url IS NOT NULL;
        UPDATE room_images SET is_primary = is_cover WHERE is_primary IS NULL AND is_cover IS NOT NULL;
        ALTER TABLE rooms ALTER COLUMN latitude DROP NOT NULL;
        ALTER TABLE rooms ALTER COLUMN longitude DROP NOT NULL;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT false;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
      `);
    } catch (migErr) {
      console.warn('⚠️ Non-fatal migration notice for schema upgrade:', migErr);
    }

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

export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return false;
  }
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng)) {
    return false;
  }
  // Lat cannot be 0, Lng cannot be 0 (0,0 is Null Island in Gulf of Guinea)
  if (nLat === 0 && nLng === 0) {
    return false;
  }
  // Standard WGS84 range
  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
    return false;
  }
  // Vietnam & Thai Nguyen bounds check (lat: 8..24, lng: 102..112)
  // Rejects inverted lat/lng
  if (nLat < 8 || nLat > 25 || nLng < 100 || nLng > 112) {
    return false;
  }
  return true;
}

/**
 * Pure Haversine formula calculation:
 * a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
 * d = 2R × atan2(√a, √(1−a))
 * R = 6371 km
 * Returns full precision distance in kilometers without rounding.
 */
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaPhi = (lat2 - lat1) * toRad;
  const deltaLambda = (lon2 - lon1) * toRad;

  const sinHalfDeltaPhi = Math.sin(deltaPhi / 2);
  const sinHalfDeltaLambda = Math.sin(deltaLambda / 2);

  const a =
    sinHalfDeltaPhi * sinHalfDeltaPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return R * c;
}

export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateHaversineKm(lat1, lon1, lat2, lon2);
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

  if (
    locationObj &&
    isValidCoordinate(locationObj.latitude, locationObj.longitude) &&
    isValidCoordinate(room.latitude, room.longitude)
  ) {
    dist = calculateHaversineKm(locationObj.latitude, locationObj.longitude, room.latitude, room.longitude);
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
  } else {
    dist = undefined;
    distanceScore = locationObj ? 0 : 20;
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

function buildRoomFromRow(
  row: any,
  amenityCodes: string[] = [],
  imagesData: { urls: string[]; items: RoomImage[] } | string[] = { urls: [], items: [] }
): Room {
  const images = Array.isArray(imagesData) ? imagesData : imagesData.urls || [];
  const imageItems = Array.isArray(imagesData) ? undefined : imagesData.items || [];
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
    latitude: row.latitude !== null && row.latitude !== undefined && row.latitude !== '' && !isNaN(Number(row.latitude)) ? Number(row.latitude) : (null as any),
    longitude: row.longitude !== null && row.longitude !== undefined && row.longitude !== '' && !isNaN(Number(row.longitude)) ? Number(row.longitude) : (null as any),
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
    image_items: imageItems,
    created_at: toIsoDate(row.created_at),
    updated_at: toIsoDate(row.updated_at),
    location_verified: row.location_verified === true,
    location_updated_at: row.location_updated_at ? toIsoDate(row.location_updated_at) : undefined,
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

async function getRoomImages(roomIds: string[]): Promise<Map<string, { urls: string[]; items: RoomImage[] }>> {
  if (!roomIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT * FROM room_images 
     WHERE room_id = ANY($1) 
     ORDER BY COALESCE(is_cover, is_primary, false) DESC, COALESCE(sort_order, 0) ASC, created_at ASC`,
    [roomIds]
  );
  const map = new Map<string, { urls: string[]; items: RoomImage[] }>();
  for (const row of rows) {
    if (!map.has(row.room_id)) map.set(row.room_id, { urls: [], items: [] });
    const imgUrl = row.image_url || row.url;
    const isCover = Boolean(row.is_cover ?? row.is_primary ?? false);
    const item: RoomImage = {
      id: row.id,
      room_id: row.room_id,
      storage_path: row.storage_path || '',
      image_url: imgUrl,
      url: imgUrl,
      is_cover: isCover,
      sort_order: Number(row.sort_order || 0),
      created_at: toIsoDate(row.created_at),
    };
    map.get(row.room_id)!.items.push(item);
    map.get(row.room_id)!.urls.push(imgUrl);
  }
  return map;
}

export interface RoomSearchFilters {
  max_price?: number;
  min_price?: number;
  strict_max?: boolean;
  strict_min?: boolean;
  room_type?: string;
}

export async function listRoomsForSearch(filters?: RoomSearchFilters): Promise<Room[]> {
  const conditions: string[] = ["r.province = 'Thái Nguyên'", "(r.status = 'available' OR r.status = 'pending')"];
  const params: any[] = [];

  if (filters?.max_price !== undefined && !isNaN(filters.max_price)) {
    params.push(Math.round(filters.max_price));
    const op = filters.strict_max ? '<' : '<=';
    conditions.push(`r.price ${op} $${params.length}`);
  }

  if (filters?.min_price !== undefined && !isNaN(filters.min_price)) {
    params.push(Math.round(filters.min_price));
    const op = filters.strict_min ? '>' : '>=';
    conditions.push(`r.price ${op} $${params.length}`);
  }

  if (filters?.room_type) {
    params.push(filters.room_type);
    conditions.push(`r.room_type = $${params.length}`);
  }

  const queryText = `
    SELECT r.*, u.full_name AS owner_name, u.phone AS owner_phone, u.avatar AS owner_avatar
    FROM rooms r
    LEFT JOIN users u ON u.id = r.owner_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.created_at DESC
  `;

  const { rows } = await pool.query(queryText, params);
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
      isValidCoordinate(input.latitude, input.longitude) ? Number(input.latitude) : null,
      isValidCoordinate(input.latitude, input.longitude) ? Number(input.longitude) : null,
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

  const images = Array.isArray(input.images) && input.images.length > 0 ? input.images : [];
  if (images.length) {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const isCover = i === 0;
      await pool.query(
        `INSERT INTO room_images (id, room_id, url, image_url, storage_path, is_primary, is_cover, sort_order, created_at)
         VALUES ($1, $2, $3, $3, '', $4, $4, $5, NOW())`,
        [`${id}-${crypto.randomUUID().slice(0, 8)}`, id, img, isCover, i]
      );
    }
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
      isValidCoordinate(next.latitude, next.longitude) ? Number(next.latitude) : null,
      isValidCoordinate(next.latitude, next.longitude) ? Number(next.longitude) : null,
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

  if (updates.images !== undefined) {
    const images = updates.images ?? [];
    await pool.query('DELETE FROM room_images WHERE room_id = $1', [roomId]);
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const isCover = i === 0;
      await pool.query(
        `INSERT INTO room_images (id, room_id, url, image_url, storage_path, is_primary, is_cover, sort_order, created_at)
         VALUES ($1, $2, $3, $3, '', $4, $4, $5, NOW())`,
        [`${roomId}-${crypto.randomUUID().slice(0, 8)}`, roomId, img, isCover, i]
      );
    }
  }

  return (await getRoomById(roomId)) as Room;
}

export async function updateRoomLocation(
  roomId: string,
  latitude: number | null,
  longitude: number | null,
  verified = true
): Promise<Room | null> {
  await pool.query(
    `UPDATE rooms SET
      latitude = $2,
      longitude = $3,
      location_verified = $4,
      location_updated_at = NOW(),
      updated_at = NOW()
     WHERE id = $1`,
    [roomId, latitude, longitude, verified]
  );
  return getRoomById(roomId);
}

export async function getRoomImagesByRoom(roomId: string): Promise<RoomImage[]> {
  const { rows } = await pool.query(
    `SELECT * FROM room_images 
     WHERE room_id = $1 
     ORDER BY COALESCE(is_cover, is_primary, false) DESC, COALESCE(sort_order, 0) ASC, created_at ASC`,
    [roomId]
  );
  return rows.map((row) => ({
    id: row.id,
    room_id: row.room_id,
    storage_path: row.storage_path || '',
    image_url: row.image_url || row.url,
    url: row.image_url || row.url,
    is_cover: Boolean(row.is_cover ?? row.is_primary ?? false),
    sort_order: Number(row.sort_order || 0),
    created_at: toIsoDate(row.created_at),
  }));
}

export async function addRoomImage(input: {
  room_id: string;
  image_url: string;
  storage_path?: string;
  is_cover?: boolean;
  sort_order?: number;
}): Promise<RoomImage> {
  const id = `img-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const { rows: existingRows } = await pool.query(
    'SELECT count(*) as count FROM room_images WHERE room_id = $1',
    [input.room_id]
  );
  const count = parseInt(existingRows[0]?.count || '0', 10);
  const isCover = input.is_cover !== undefined ? input.is_cover : count === 0;
  const sortOrder = input.sort_order !== undefined ? input.sort_order : count;

  if (isCover) {
    await pool.query(
      'UPDATE room_images SET is_cover = false, is_primary = false WHERE room_id = $1',
      [input.room_id]
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO room_images (
       id, room_id, url, image_url, storage_path, is_primary, is_cover, sort_order, created_at
     ) VALUES (
       $1, $2, $3, $3, $4, $5, $5, $6, NOW()
     ) RETURNING *`,
    [id, input.room_id, input.image_url, input.storage_path || '', isCover, sortOrder]
  );

  const row = rows[0];
  return {
    id: row.id,
    room_id: row.room_id,
    storage_path: row.storage_path || '',
    image_url: row.image_url || row.url,
    url: row.image_url || row.url,
    is_cover: Boolean(row.is_cover ?? row.is_primary ?? false),
    sort_order: Number(row.sort_order || 0),
    created_at: toIsoDate(row.created_at),
  };
}

export async function deleteRoomImage(
  imageId: string,
  roomId: string
): Promise<{ success: boolean; storage_path?: string }> {
  const { rows: imgRows } = await pool.query(
    'SELECT * FROM room_images WHERE id = $1 AND room_id = $2 LIMIT 1',
    [imageId, roomId]
  );
  if (!imgRows[0]) {
    return { success: false };
  }

  const image = imgRows[0];
  const storagePath = image.storage_path || '';
  const wasCover = Boolean(image.is_cover ?? image.is_primary ?? false);

  await pool.query('DELETE FROM room_images WHERE id = $1 AND room_id = $2', [imageId, roomId]);

  if (wasCover) {
    const { rows: nextImg } = await pool.query(
      `SELECT id FROM room_images 
       WHERE room_id = $1 
       ORDER BY COALESCE(sort_order, 0) ASC, created_at ASC 
       LIMIT 1`,
      [roomId]
    );
    if (nextImg[0]) {
      await pool.query(
        'UPDATE room_images SET is_cover = true, is_primary = true WHERE id = $1',
        [nextImg[0].id]
      );
    }
  }

  return { success: true, storage_path: storagePath };
}

export async function reorderRoomImages(roomId: string, imageIds: string[]): Promise<RoomImage[]> {
  for (let i = 0; i < imageIds.length; i++) {
    await pool.query(
      'UPDATE room_images SET sort_order = $1 WHERE id = $2 AND room_id = $3',
      [i, imageIds[i], roomId]
    );
  }
  return getRoomImagesByRoom(roomId);
}

export async function setRoomCoverImage(roomId: string, imageId: string): Promise<RoomImage[]> {
  await pool.query(
    'UPDATE room_images SET is_cover = false, is_primary = false WHERE room_id = $1',
    [roomId]
  );
  await pool.query(
    'UPDATE room_images SET is_cover = true, is_primary = true, sort_order = 0 WHERE id = $1 AND room_id = $2',
    [imageId, roomId]
  );
  return getRoomImagesByRoom(roomId);
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

export async function clearChatSession(sessionId: string): Promise<void> {
  await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
  await pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
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
