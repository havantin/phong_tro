/**
 * Application Type Definitions
 */

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'USER' | 'OWNER' | 'ADMIN';
  status: 'active' | 'locked';
  created_at: string;
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
  province: string; // "Thái Nguyên"
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
  status: 'available' | 'rented' | 'pending' | 'rejected' | 'hidden';
  view_count: number;
  contact_count: number;
  amenities: string[];
  images: string[];
  created_at: string;
  updated_at: string;

  // Dynamically enriched fields
  distance_to_target?: number;
  distance_km?: number;
  match_score?: number;
  score_breakdown?: Record<string, number>;
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

export interface StructuredQuery {
  province: string;
  near_location?: string;
  max_distance_km?: number;
  min_price?: number;
  max_price?: number;
  min_area?: number;
  max_area?: number;
  room_type?: string;
  amenities: string[];
  is_out_of_scope?: boolean;
  out_of_scope_message?: string;
}
