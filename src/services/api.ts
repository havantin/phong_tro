/**
 * Frontend API client
 */
import { Room, LocationItem, Amenity, User, Review, Report, StructuredQuery } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('phongtro_tn_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Đăng nhập thất bại');
    }
    return res.json();
  },

  async register(data: { full_name: string; email: string; phone?: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Đăng ký thất bại');
    }
    return res.json();
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error('Chưa đăng nhập');
    }
    return res.json();
  },

  // Locations & Amenities
  async getLocations(): Promise<LocationItem[]> {
    const res = await fetch(`${API_BASE}/locations`);
    return res.json();
  },

  async getAmenities(): Promise<Amenity[]> {
    const res = await fetch(`${API_BASE}/amenities`);
    return res.json();
  },

  // Rooms
  async getRooms(params: Record<string, any> = {}): Promise<{
    data: Room[];
    meta: { total: number; page: number; limit: number; totalPages: number };
    target_location?: LocationItem;
  }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });

    const res = await fetch(`${API_BASE}/rooms?${query.toString()}`);
    return res.json();
  },

  async getRoomDetail(id: string): Promise<
    Room & {
      distances: Array<{
        location_id: string;
        location_name: string;
        short_name: string;
        type: string;
        distance_km: number;
      }>;
      reviews: Review[];
      average_rating: number;
      similar_rooms: Room[];
    }
  > {
    const res = await fetch(`${API_BASE}/rooms/${id}`);
    if (!res.ok) {
      throw new Error('Không tìm thấy phòng trọ');
    }
    return res.json();
  },

  async createRoom(data: Partial<Room>): Promise<Room> {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Không thể tạo phòng trọ');
    }
    return res.json();
  },

  async updateRoom(id: string, data: Partial<Room>): Promise<Room> {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Không thể cập nhật phòng trọ');
    }
    return res.json();
  },

  async deleteRoom(id: string) {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Không thể xóa phòng trọ');
    }
    return res.json();
  },

  // AI Chat & AI Search
  async sendAiChat(message: string, sessionId?: string): Promise<{
    session_id: string;
    reply_text: string;
    structured_query: StructuredQuery;
    rooms: Room[];
    total_matched: number;
    location_info?: LocationItem;
  }> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi xử lý AI Chat');
    }
    return res.json();
  },

  async searchAi(query: string): Promise<{
    structured_query: StructuredQuery;
    reply_text: string;
    rooms: Room[];
    total_matched: number;
    location_info?: LocationItem;
  }> {
    const res = await fetch(`${API_BASE}/ai/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi tìm kiếm bằng AI');
    }
    return res.json();
  },

  // Favorites
  async getFavorites(): Promise<Room[]> {
    const res = await fetch(`${API_BASE}/favorites`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async toggleFavorite(roomId: string, isFav: boolean) {
    const method = isFav ? 'DELETE' : 'POST';
    const res = await fetch(`${API_BASE}/favorites/${roomId}`, {
      method,
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Reviews
  async submitReview(roomId: string, rating: number, comment: string): Promise<Review> {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ room_id: roomId, rating, comment }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Không thể gửi đánh giá');
    }
    return res.json();
  },

  // Reports
  async submitReport(roomId: string, reason: string, details: string) {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ room_id: roomId, reason, details }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Không thể gửi báo cáo');
    }
    return res.json();
  },

  // Contact
  async sendContact(roomId: string, name: string, phone: string, note: string) {
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ room_id: roomId, name, phone, note }),
    });
    return res.json();
  },

  // Owner Dashboard
  async getOwnerDashboard() {
    const res = await fetch(`${API_BASE}/owner/dashboard`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error('Lỗi tải dữ liệu chủ trọ');
    }
    return res.json();
  },

  // Admin Dashboard
  async getAdminDashboard() {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error('Lỗi tải dữ liệu quản trị viên');
    }
    return res.json();
  },

  async getAdminUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getAdminRooms(): Promise<Room[]> {
    const res = await fetch(`${API_BASE}/admin/rooms`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async toggleUserStatus(userId: string, status: 'active' | 'locked') {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  async updateRoomStatus(roomId: string, status: string) {
    const res = await fetch(`${API_BASE}/admin/rooms/${roomId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  async getAdminReports(): Promise<Report[]> {
    const res = await fetch(`${API_BASE}/admin/reports`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async updateReportStatus(reportId: string, status: string) {
    const res = await fetch(`${API_BASE}/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },
};
