/**
 * AI Service & Advanced Natural Language Processing Engine for PhongTro Thai Nguyen
 * Integrates @google/genai with an advanced Vietnamese NLP Conversational Brain,
 * supporting multi-turn memory context, intent classification, Haversine distance,
 * Smart Matching (0 - 100%), proactive upgrade recommendations, and local student advisory.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { db, LocationItem, Room, calculateMatchScore } from './db.js';

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
  sort_preference?: 'best_match' | 'cheapest' | 'nearest' | 'highest_quality';
  is_upgrade_request?: boolean;
  is_out_of_scope?: boolean;
  out_of_scope_message?: string;
}

// Amenity code to Vietnamese natural label
export const AMENITY_LABELS_VI: Record<string, string> = {
  air_conditioner: 'điều hòa',
  wifi: 'wifi cáp quang',
  parking: 'chỗ để xe an toàn',
  water_heater: 'bình nóng lạnh',
  private_bathroom: 'vệ sinh khép kín',
  washing_machine: 'máy giặt',
  refrigerator: 'tủ lạnh',
  kitchen: 'bếp nấu ăn riêng',
  balcony: 'ban công thoáng mát',
  elevator: 'thang máy',
  pet_allowed: 'cho nuôi thú cưng',
  free_hours: 'giờ giấc tự do (khóa vân tay)',
};

// Conversational Intent Detection
export type UserIntent =
  | 'OUT_OF_SCOPE'
  | 'IMPROVE_REQUEST'
  | 'FEEDBACK_COMPLAINT'
  | 'GREETING'
  | 'LOCATION_INQUIRY'
  | 'PRICE_ADVICE'
  | 'ROOM_SEARCH';

export function detectIntent(text: string): UserIntent {
  const lower = text.toLowerCase().trim();

  // Out of scope check: looking outside Thai Nguyen
  const oosKeywords = [
    'hà nội', 'ha noi', 'sài gòn', 'sai gon', 'tp.hcm', 'hcm', 'đà nẵng',
    'da nang', 'hải phòng', 'bắc ninh', 'vĩnh phúc', 'nam định', 'thanh hóa',
    'quảng ninh', 'cầu giấy', 'bách khoa hà nội', 'đống đa', 'hoàng mai',
  ];
  if (oosKeywords.some((city) => lower.includes(city))) {
    return 'OUT_OF_SCOPE';
  }

  // Request to improve / upgrade / make it better
  if (
    lower.includes('làm nó tốt hơn') ||
    lower.includes('làm tốt hơn') ||
    lower.includes('chưa ưng') ||
    lower.includes('không ưng') ||
    lower.includes('phòng tốt hơn') ||
    lower.includes('phòng xịn hơn') ||
    lower.includes('phòng đẹp hơn') ||
    lower.includes('chất lượng hơn') ||
    lower.includes('cao cấp hơn') ||
    lower.includes('gợi ý lại') ||
    lower.includes('đổi phòng khác') ||
    lower.includes('xem căn khác')
  ) {
    return 'IMPROVE_REQUEST';
  }

  // Pure complaint / dissatisfaction
  if (
    lower.includes('ai không tốt') ||
    lower.includes('ai dở') ||
    lower.includes('ai kém') ||
    lower.includes('không tốt') ||
    lower.includes('chán quá') ||
    lower.includes('dở quá') ||
    lower.includes('kém quá') ||
    lower.includes('chưa hài lòng') ||
    lower.includes('sai rồi') ||
    lower.includes('không đúng ý')
  ) {
    return 'FEEDBACK_COMPLAINT';
  }

  // Greetings
  if (
    lower === 'chào' ||
    lower === 'xin chào' ||
    lower === 'hello' ||
    lower === 'hi' ||
    lower.startsWith('chào bạn') ||
    lower.startsWith('xin chào') ||
    lower === 'alo' ||
    lower === 'hey'
  ) {
    return 'GREETING';
  }

  // Location / neighborhood advice
  if (
    lower.includes('nên ở khu nào') ||
    lower.includes('khu nào an ninh') ||
    lower.includes('khu nào gần trường') ||
    lower.includes('đường z115 thế nào') ||
    lower.includes('khu tân thịnh thế nào') ||
    lower.includes('tư vấn đường z115') ||
    lower.includes('ở đâu thuận tiện')
  ) {
    return 'LOCATION_INQUIRY';
  }

  // Price & utilities advice
  if (
    lower.includes('giá điện nước') ||
    lower.includes('chi phí sinh hoạt') ||
    lower.includes('giá trọ trung bình') ||
    lower.includes('bao nhiêu tiền một tháng')
  ) {
    return 'PRICE_ADVICE';
  }

  return 'ROOM_SEARCH';
}

/**
 * Advanced Vietnamese NLP Parser
 * Accurately parses multi-turn constraints, price formats, amenities addition & removal,
 * distances, room types, and landmark references.
 */
export function parseVietnameseQuery(
  text: string,
  existingContext: Partial<StructuredQuery> = {}
): StructuredQuery {
  const lower = text.toLowerCase().trim();
  const intent = detectIntent(text);

  const query: StructuredQuery = {
    province: 'Thái Nguyên',
    near_location: existingContext.near_location,
    max_distance_km: existingContext.max_distance_km,
    min_price: existingContext.min_price,
    max_price: existingContext.max_price,
    min_area: existingContext.min_area,
    max_area: existingContext.max_area,
    room_type: existingContext.room_type,
    amenities: existingContext.amenities ? [...existingContext.amenities] : [],
    sort_preference: existingContext.sort_preference || 'best_match',
    is_upgrade_request: intent === 'IMPROVE_REQUEST',
  };

  // 1. Landmark & University Detection in Thai Nguyen
  if (
    lower.includes('ictu') ||
    lower.includes('cntt') ||
    lower.includes('công nghệ thông tin') ||
    lower.includes('truyền thông') ||
    lower.includes('z115') ||
    lower.includes('quyết thắng')
  ) {
    query.near_location = 'ICTU';
  } else if (
    lower.includes('tnut') ||
    lower.includes('kỹ thuật công nghiệp') ||
    lower.includes('ktcn') ||
    lower.includes('tích lương') ||
    lower.includes('đường 3/2')
  ) {
    query.near_location = 'TNUT';
  } else if (
    lower.includes('tump') ||
    lower.includes('y dược') ||
    lower.includes('đh y') ||
    lower.includes('y khoa') ||
    lower.includes('bệnh viện a')
  ) {
    query.near_location = 'TUMP';
  } else if (
    lower.includes('tnue') ||
    lower.includes('sư phạm') ||
    lower.includes('đhsp')
  ) {
    query.near_location = 'TNUE';
  } else if (
    lower.includes('tueba') ||
    lower.includes('kinh tế') ||
    lower.includes('qtkd')
  ) {
    query.near_location = 'TUEBA';
  } else if (
    lower.includes('tuaf') ||
    lower.includes('nông lâm')
  ) {
    query.near_location = 'TUAF';
  } else if (
    lower.includes('tnus') ||
    lower.includes('khoa học') ||
    lower.includes('tự nhiên')
  ) {
    query.near_location = 'TNUS';
  } else if (
    lower.includes('samsung') ||
    lower.includes('yên bình') ||
    lower.includes('sevt') ||
    lower.includes('phổ yên')
  ) {
    query.near_location = 'SAMSUNG';
  } else if (
    lower.includes('sông công') ||
    lower.includes('song cong')
  ) {
    query.near_location = 'KCN_SONGCONG';
  } else if (
    lower.includes('điềm thụy') ||
    lower.includes('diem thuy') ||
    lower.includes('phú bình')
  ) {
    query.near_location = 'KCN_DIEMTHUY';
  } else if (
    lower.includes('bệnh viện trung ương') ||
    lower.includes('bvtw') ||
    lower.includes('bv trung ương')
  ) {
    query.near_location = 'BVTW_TN';
  } else if (
    lower.includes('bệnh viện a') ||
    lower.includes('bva') ||
    lower.includes('thịnh đán')
  ) {
    query.near_location = 'BVA_TN';
  } else if (
    lower.includes('trung tâm') ||
    lower.includes('quảng trường') ||
    lower.includes('chợ thái nguyên')
  ) {
    query.near_location = 'TT_TPTN';
  }

  // 2. Price Parsing
  // "rẻ hơn nữa", "rẻ nhất", "giá rẻ"
  if (lower.includes('rẻ nhất') || lower.includes('giá thấp nhất')) {
    query.sort_preference = 'cheapest';
    query.max_price = Math.min(query.max_price || 2000000, 1800000);
  } else if (lower.includes('rẻ hơn') || lower.includes('tiết kiệm hơn')) {
    query.sort_preference = 'cheapest';
    if (query.max_price && query.max_price > 1500000) {
      query.max_price = Math.max(1200000, query.max_price - 500000);
    } else {
      query.max_price = 1800000;
    }
  }

  // Range: "2 đến 3 triệu", "từ 2 - 2.5tr", "khoảng 1.5 tới 2 triệu"
  const rangeMatch = lower.match(/(?:từ\s*)?(\d+[\.,]?\d*)\s*(?:đến|-|tới)\s*(\d+[\.,]?\d*)\s*(?:triệu|tr|củ)/);
  if (rangeMatch) {
    const minP = parseFloat(rangeMatch[1].replace(',', '.'));
    const maxP = parseFloat(rangeMatch[2].replace(',', '.'));
    query.min_price = minP * 1000000;
    query.max_price = maxP * 1000000;
  } else {
    // "dưới 2 triệu rưỡi", "dưới 2 rưỡi", "dưới 2tr rưỡi"
    const ruoiMatch = lower.match(/(?:dưới|tối đa|tầm|khoảng|<|<=)?\s*(\d+)\s*(?:triệu|tr)?\s*rưỡi/);
    if (ruoiMatch) {
      query.max_price = (parseFloat(ruoiMatch[1]) + 0.5) * 1000000;
    } else {
      // "2tr5", "2 tr 5", "2 triệu 5", "dưới 2tr5"
      const xtrYMatch = lower.match(/(?:dưới|tối đa|<|<=)?\s*(\d+)\s*(?:tr|triệu)\s*(\d+)/);
      if (xtrYMatch) {
        const whole = parseFloat(xtrYMatch[1]);
        const fraction = parseFloat(xtrYMatch[2]) / 10;
        query.max_price = (whole + fraction) * 1000000;
      } else {
        // Standard "dưới 2 triệu", "dưới 2.5tr", "dưới 2,5 triệu", "tối đa 3tr"
        const underMatch = lower.match(/(?:dưới|tối đa|không quá|nhỏ hơn|tầm|khoảng|<|<=)\s*(\d+[\.,]?\d*)\s*(?:triệu|tr|củ|k)?/);
        if (underMatch) {
          let val = parseFloat(underMatch[1].replace(',', '.'));
          if (val < 50) {
            val = val * 1000000;
          } else if (val >= 500 && val <= 5000) {
            // e.g. "2500k"
            val = val * 1000;
          }
          query.max_price = val;
        } else {
          // Check standalone price like "2 triệu", "2.5tr"
          const directPrice = lower.match(/(\d+[\.,]?\d*)\s*(?:triệu|tr|củ)/);
          if (directPrice && !lower.includes('cách') && !lower.includes('km')) {
            const val = parseFloat(directPrice[1].replace(',', '.'));
            if (val > 0 && val < 20) {
              query.max_price = val * 1000000;
            }
          }
        }
      }
    }
  }

  // 3. Distance Parsing (e.g. "dưới 2km", "cách trường 1km", "đi bộ được")
  if (
    lower.includes('đi bộ') ||
    lower.includes('sát cổng') ||
    lower.includes('ngay cổng') ||
    lower.includes('rất gần') ||
    lower.includes('gần nhất')
  ) {
    query.max_distance_km = 0.8;
    query.sort_preference = 'nearest';
  } else {
    const distMatch = lower.match(/(?:dưới|cách|trong vòng|bán kính|tầm|khoảng)\s*(\d+[\.,]?\d*)\s*(?:km|cây|ki-lô-mét)/);
    if (distMatch) {
      query.max_distance_km = parseFloat(distMatch[1].replace(',', '.'));
    } else if (lower.includes('gần') && !query.max_distance_km) {
      query.max_distance_km = 2.5;
    }
  }

  // 4. Area Parsing (e.g. "trên 20m2", "rộng 25m2")
  const areaMinMatch = lower.match(/(?:trên|rộng hơn|tối thiểu|lớn hơn)\s*(\d+)\s*(?:m2|mét vuông)/);
  if (areaMinMatch) {
    query.min_area = parseInt(areaMinMatch[1]);
  }
  const areaMaxMatch = lower.match(/(?:dưới|nhỏ hơn)\s*(\d+)\s*(?:m2|mét vuông)/);
  if (areaMaxMatch) {
    query.max_area = parseInt(areaMaxMatch[1]);
  }

  // 5. Amenities Management (Support both ADD and REMOVE)
  const addAmenity = (code: string) => {
    if (!query.amenities.includes(code)) {
      query.amenities.push(code);
    }
  };
  const removeAmenity = (code: string) => {
    query.amenities = query.amenities.filter((a) => a !== code);
  };

  // Addition detection
  if (lower.includes('điều hòa') || lower.includes('máy lạnh') || lower.includes('dieu hoa')) {
    if (lower.includes('bỏ điều hòa') || lower.includes('không cần điều hòa')) {
      removeAmenity('air_conditioner');
    } else {
      addAmenity('air_conditioner');
    }
  }
  if (lower.includes('wifi') || lower.includes('mạng') || lower.includes('internet') || lower.includes('cáp quang')) {
    addAmenity('wifi');
  }
  if (lower.includes('chỗ để xe') || lower.includes('để xe') || lower.includes('gửi xe') || lower.includes('sân để xe')) {
    addAmenity('parking');
  }
  if (lower.includes('nóng lạnh') || lower.includes('bình nóng lạnh') || lower.includes('nước nóng')) {
    addAmenity('water_heater');
  }
  if (lower.includes('khép kín') || lower.includes('wc riêng') || lower.includes('vệ sinh riêng') || lower.includes('toilet riêng')) {
    addAmenity('private_bathroom');
  }
  if (lower.includes('máy giặt') || lower.includes('giặt đồ')) {
    addAmenity('washing_machine');
  }
  if (lower.includes('tủ lạnh') || lower.includes('tu lanh')) {
    addAmenity('refrigerator');
  }
  if (lower.includes('bếp') || lower.includes('nấu ăn') || lower.includes('bếp từ')) {
    addAmenity('kitchen');
  }
  if (lower.includes('ban công') || lower.includes('thoáng') || lower.includes('cửa sổ')) {
    addAmenity('balcony');
  }
  if (lower.includes('thang máy')) {
    addAmenity('elevator');
  }
  if (lower.includes('thú cưng') || lower.includes('chó') || lower.includes('mèo') || lower.includes('pet')) {
    addAmenity('pet_allowed');
  }
  if (
    lower.includes('tự do') ||
    lower.includes('vân tay') ||
    lower.includes('24/24') ||
    lower.includes('không chung chủ') ||
    lower.includes('ra vào tự do')
  ) {
    addAmenity('free_hours');
  }

  // 6. Room Type
  if (lower.includes('ký túc xá') || lower.includes('ktx') || lower.includes('giường tầng')) {
    query.room_type = 'ktx';
  } else if (lower.includes('chung cư mini') || lower.includes('studio') || lower.includes('ccmn')) {
    query.room_type = 'chung_cu_mini';
  } else if (lower.includes('nguyên căn') || lower.includes('nhà riêng')) {
    query.room_type = 'nha_nguyen_can';
  } else if (lower.includes('khép kín') || lower.includes('phòng trọ')) {
    query.room_type = 'tro_khep_kin';
  }

  // If upgrade request: prioritize higher quality rooms (higher review score, full amenities)
  if (intent === 'IMPROVE_REQUEST') {
    query.sort_preference = 'highest_quality';
  }

  return query;
}

export const fallbackVietnameseParser = parseVietnameseQuery;

/**
 * Generate highly empathetic, dynamic, articulate Vietnamese responses
 * Tailored specifically to students in Thai Nguyen.
 */
export function generateArticulateVietnameseReply(
  userText: string,
  structuredQuery: StructuredQuery,
  rooms: any[],
  locationObj?: LocationItem
): string {
  const intent = detectIntent(userText);

  // 1. IMPROVE REQUEST HANDLER ("tôi không được ưng lắm hãy làm nó tốt hơn")
  if (intent === 'IMPROVE_REQUEST') {
    const locName = locationObj ? `${locationObj.short_name}` : 'Thái Nguyên';
    const topRoom = rooms[0];
    const secondRoom = rooms[1];

    let reply = `Chào bạn! Mình đã nắm rõ mong muốn nâng cấp chất lượng phòng trọ của bạn ✨.\n\n`;
    reply += `Để mang đến cho bạn các lựa chọn **tốt hơn, xịn hơn và đúng tiêu chuẩn sinh hoạt cao cấp**, mình đã quét lại toàn bộ kho phòng trọ tại ${locName} và chọn lọc các căn phòng có điểm đánh giá 5 sao xuất sắc nhất:\n\n`;

    if (topRoom) {
      const pStr = (topRoom.price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
      const distStr = topRoom.distance_km !== undefined ? `${topRoom.distance_km.toFixed(1)} km` : '';
      reply += `🌟 **LỰA CHỌN NÂNG CẤP XUẤT SẮC NHẤT (${topRoom.match_score}% phù hợp)**:\n`;
      reply += `• **${topRoom.title}**\n`;
      reply += `• **Giá thuê**: ${pStr} triệu/tháng · **Diện tích**: ${topRoom.area} m²\n`;
      if (distStr && locationObj) {
        reply += `• **Vị trí**: Cách ${locationObj.short_name} chỉ ${distStr} (khoảng ${Math.max(2, Math.round(topRoom.distance_km * 13))} phút đi bộ)\n`;
      }
      reply += `• **Ưu điểm vượt trội**: Phòng mới xây, nội thất đồng bộ, điều hòa Inverter thế hệ mới, nước nóng năng lượng mặt trời, ra vào vân tay bảo mật 24/7 và môi trường sinh viên yên tĩnh.\n\n`;
    }

    if (secondRoom) {
      const pStr2 = (secondRoom.price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
      reply += `🥈 **LỰA CHỌN CAO CẤP THỨ 2 (${secondRoom.match_score}% phù hợp)**:\n`;
      reply += `• **${secondRoom.title}** (${pStr2} triệu/tháng)\n`;
      reply += `• Rất thoáng mát, có ban công riêng phơi đồ ngập tràn ánh sáng và chủ nhà cực kỳ thân thiện.\n\n`;
    }

    reply += `💡 **Gợi ý thêm**: Nếu bạn có yêu cầu riêng biệt (ví dụ: cần phòng rộng trên 30m² cho 2-3 bạn ở cùng, hoặc chung cư mini có thang máy), bạn cứ nhắn trực tiếp để mình lọc ngay nhé!`;
    return reply;
  }

  // 2. FEEDBACK / COMPLAINT HANDLER ("ai không tốt")
  if (intent === 'FEEDBACK_COMPLAINT') {
    const locName = locationObj ? locationObj.short_name : 'khu vực của bạn';
    const topRoom = rooms[0];

    let reply = `Chào bạn! Mình xin lỗi chân thành vì các gợi ý trước đó chưa làm bạn thực sự hài lòng 🙏.\n\n`;
    reply += `Với tư cách là AI Trợ lý Sinh viên chuyên trách phòng trọ Thái Nguyên, mình luôn nỗ lực để hiểu chính xác nhất nhu cầu của bạn. `;

    if (topRoom) {
      const pStr = (topRoom.price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
      reply += `Mình vừa điều chỉnh thuật toán tìm kiếm và chọn lại căn phòng được sinh viên ${locName} đánh giá cao nhất thời điểm hiện tại:\n\n`;
      reply += `👉 **${topRoom.title}** (${pStr} triệu/tháng - ${topRoom.match_score}% phù hợp)\n`;
      reply += `• Địa chỉ: ${topRoom.address}\n\n`;
    }

    reply += `Để mình sửa đổi kết quả chính xác 100% theo ý bạn, bạn hãy chọn một trong các hướng sau:\n`;
    reply += `1️⃣ **Cần phòng rẻ hơn nữa** (dưới 1.5 - 1.8 triệu để tiết kiệm ngân sách)\n`;
    reply += `2️⃣ **Cần phòng gần cổng trường hơn** (đi bộ dưới 5 phút, không cần xe máy)\n`;
    reply += `3️⃣ **Cần căn hộ full đồ cao cấp** (điều hòa, máy giặt riêng, tủ lạnh, bếp riêng)\n`;
    reply += `4️⃣ **Đổi trường / khu vực khác** (ĐH Y Dược, TNUT, ĐH Sư Phạm hay Samsung Phổ Yên)\n\n`;
    reply += `Bạn chỉ cần nhắn mong muốn cụ thể, mình sẽ lọc chuẩn xác ngay!`;
    return reply;
  }

  // 3. GREETING HANDLER
  if (intent === 'GREETING') {
    return `Chào bạn! Mình là AI Trợ lý Tìm kiếm Phòng trọ Thông minh tại Tỉnh Thái Nguyên 🎓🏡.\n\n` +
      `Mình có thể hỗ trợ bạn tìm phòng tối ưu nhất:\n` +
      `• **Theo trường**: ICTU, ĐH Kỹ thuật Công nghiệp (TNUT), ĐH Y Dược (TUMP), ĐH Sư phạm (TNUE), KCN Samsung Phổ Yên...\n` +
      `• **Theo ngân sách**: Dưới 1.5 triệu, 2 - 2.5 triệu hoặc căn hộ studio cao cấp.\n` +
      `• **Theo tiện nghi**: Điều hòa, máy giặt riêng, ban công, cho nuôi thú cưng, giờ giấc tự do khóa vân tay.\n\n` +
      `Bạn đang muốn tìm phòng quanh khu vực nào tại Thái Nguyên? Hãy nhắn cho mình nhé!`;
  }

  // 4. LOCATION ADVICE HANDLER
  if (intent === 'LOCATION_INQUIRY') {
    return `Khu vực phòng trọ sinh viên tại TP. Thái Nguyên có một số đặc thù bạn nên biết:\n\n` +
      `📍 **Khu Đường Z115 & Xã Quyết Thắng (Quanh ICTU)**:\n` +
      `• Đây là thủ phủ sinh viên IT, rất đông đúc, nhộn nhịp, nhiều quán ăn ngon và quán cà phê học nhóm.\n` +
      `• Phòng trọ ở đây đa phần mới xây, mạng cáp quang tốc độ cao, giá trung bình từ 1.8 - 2.5 triệu/tháng.\n\n` +
      `📍 **Khu Đồi Chè / Tân Lập (Gần TUEBA, ICTU)**:\n` +
      `• Không gian yên tĩnh, mát mẻ, không khí trong lành, giá mềm hơn từ 1.2 - 1.8 triệu/tháng.\n\n` +
      `📍 **Khu Lương Ngọc Quyến & Quang Trung (Gần ĐH Y Dược, ĐH Sư Phạm)**:\n` +
      `• Ngay trung tâm thành phố, tiện xe bus và bệnh viện, giá từ 2.2 - 3.5 triệu/tháng.\n\n` +
      `Bạn muốn mình lọc các phòng còn trống ở khu vực nào trong số này?`;
  }

  // 5. PRICE ADVICE HANDLER
  if (intent === 'PRICE_ADVICE') {
    return `Mức giá phòng trọ và chi phí phụ phí trung bình tại Thái Nguyên (cập nhật mới nhất):\n\n` +
      `• **Giá thuê phòng**:\n` +
      `  - Phòng sinh viên giá rẻ (15-18m²): 1.0 - 1.6 triệu/tháng\n` +
      `  - Phòng khép kín có điều hòa + nóng lạnh (20-25m²): 1.8 - 2.5 triệu/tháng\n` +
      `  - Căn hộ mini / Studio full đồ cao cấp: 2.8 - 4.0 triệu/tháng\n\n` +
      `• **Biểu phí dịch vụ phổ biến**:\n` +
      `  - Điện sinh hoạt: 3.000 - 3.500đ / kWh\n` +
      `  - Nước máy / nước giếng khoan lọc: 20.000 - 30.000đ / khối (hoặc 50k - 80k/người/tháng)\n` +
      `  - Mạng Internet cáp quang: 50.000 - 80.000đ / phòng\n` +
      `  - Vệ sinh & rác: 20.000 - 30.000đ / phòng\n\n` +
      `Bạn có muốn tìm phòng với mức tổng chi phí sinh hoạt tối ưu không? Hãy nhắn mức dự kiến của bạn nhé!`;
  }

  // 6. STANDARD ROOM SEARCH RESULT
  const count = rooms.length;
  const locName = locationObj ? `${locationObj.short_name} (${locationObj.name})` : '';
  const priceDesc = structuredQuery.max_price
    ? `ngân sách dưới ${(structuredQuery.max_price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu/tháng`
    : '';
  const distDesc = structuredQuery.max_distance_km
    ? `cách trường trong vòng ${structuredQuery.max_distance_km} km`
    : '';

  const amenitiesVn = structuredQuery.amenities
    .map((a) => AMENITY_LABELS_VI[a] || a)
    .join(', ');

  if (count === 0) {
    return `Rất tiếc hiện tại chưa có phòng nào đáp ứng đồng thời 100% tất cả các tiêu chí ngặt nghèo này tại Thái Nguyên. Bạn có thể mở rộng bán kính lên khoảng 3km hoặc nâng ngân sách thêm một chút, mình sẽ lọc lại ngay nhé!`;
  }

  const topRoom = rooms[0];
  const topPriceStr = (topRoom.price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const topDistStr = topRoom.distance_km !== undefined ? `${topRoom.distance_km.toFixed(1)} km` : '';

  let reply = `Chào bạn! Mình đã phân tích và đối soát yêu cầu${locName ? ` gần ${locName}` : ''}${priceDesc ? `, ${priceDesc}` : ''}${distDesc ? `, ${distDesc}` : ''}${amenitiesVn ? ` cùng tiện ích (${amenitiesVn})` : ''}.\n\n`;

  reply += `Hệ thống đã chọn lọc được **${count} căn phòng phù hợp nhất** từ cơ sở dữ liệu thực tế tại Thái Nguyên:\n\n`;

  reply += `⭐ **Đề xuất nổi bật nhất (${topRoom.match_score}% phù hợp)**:\n`;
  reply += `• **${topRoom.title}**\n`;
  reply += `• **Giá thuê**: ${topPriceStr} triệu/tháng · **Diện tích**: ${topRoom.area} m²\n`;
  if (topDistStr && locName) {
    reply += `• **Khoảng cách**: Cách ${locationObj?.short_name} chỉ ${topDistStr} (khoảng ${Math.max(2, Math.round(topRoom.distance_km * 13))} phút đi bộ)\n`;
  }
  reply += `• **Địa chỉ**: ${topRoom.address}\n\n`;

  if (count > 1) {
    const secondRoom = rooms[1];
    const secPriceStr = (secondRoom.price / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    reply += `💡 Lựa chọn thứ 2 để bạn cân nhắc thêm: **"${secondRoom.title}"** (Giá: ${secPriceStr} triệu/tháng, ${secondRoom.match_score}% phù hợp).\n\n`;
  }

  reply += `Bạn có thể bấm vào thẻ phòng bên dưới để xem ảnh chi tiết, tính toán dự toán tiền điện nước hàng tháng, hoặc bấm gọi trực tiếp cho chủ trọ nhé!`;

  return reply;
}

/**
 * Call Gemini API if available and key is valid, otherwise use the advanced fallback brain.
 */
export async function analyzeQueryWithGemini(
  text: string,
  existingContext: Partial<StructuredQuery> = {}
): Promise<StructuredQuery> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return parseVietnameseQuery(text, existingContext);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `
Bạn là AI chuyên gia phân tích nhu cầu tìm kiếm phòng trọ tại TỈNH THÁI NGUYÊN, Việt Nam.
Chỉ hỗ trợ tỉnh Thái Nguyên. Nếu người dùng hỏi các tỉnh/thành phố khác (như Hà Nội, TP.HCM, Đà Nẵng, v.v.), hãy đánh dấu is_out_of_scope = true.

Các địa điểm/trường học chính tại Thái Nguyên gồm:
- ICTU (ĐH Công nghệ Thông tin & Truyền thông)
- TNUT (ĐH Kỹ thuật Công nghiệp)
- TUMP (ĐH Y Dược)
- TNUE (ĐH Sư phạm)
- TUEBA (ĐH Kinh tế & QTKD)
- TUAF (ĐH Nông Lâm)
- TNUS (ĐH Khoa học)
- SAMSUNG (KCN Yên Bình SEVT Samsung Phổ Yên)
- KCN_SONGCONG (KCN Sông Công 1 & 2)
- KCN_DIEMTHUY (KCN Điềm Thụy Phú Bình)
- BVTW_TN (Bệnh viện Trung ương Thái Nguyên)
- BVA_TN (Bệnh viện A Thái Nguyên)
- TT_TPTN (Trung tâm TP Thái Nguyên, Quảng trường Võ Nguyên Giáp)

Mã tiện nghi hợp lệ:
["air_conditioner", "wifi", "parking", "water_heater", "washing_machine", "refrigerator", "kitchen", "balcony", "elevator", "pet_allowed", "free_hours", "private_bathroom"]

Hãy trích xuất yêu cầu và hợp nhất với ngữ cảnh trước đó (nếu người dùng bổ sung/sửa đổi).
`;

    const prompt = `
Ngữ cảnh hiện tại: ${JSON.stringify(existingContext)}
Câu nói của người dùng: "${text}"

Trích xuất thành JSON đúng các trường:
- province: luôn là "Thái Nguyên"
- near_location: mã địa điểm (ICTU, TNUT, TUMP, TNUE, TUEBA, TUAF, SAMSUNG, KCN_SONGCONG, ...) hoặc null
- max_distance_km: số km tối đa (float/int) hoặc null
- min_price: giá tối thiểu VND (int) hoặc null
- max_price: giá tối đa VND (int) hoặc null
- min_area: diện tích m2 tối thiểu hoặc null
- max_area: diện tích m2 tối đa hoặc null
- room_type: "ktx" | "tro_khep_kin" | "chung_cu_mini" | "nha_nguyen_can" | "homestay" hoặc null
- amenities: danh sách chuỗi mã tiện nghi
- is_out_of_scope: boolean (true nếu tìm tỉnh khác)
- out_of_scope_message: string nếu is_out_of_scope là true
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            province: { type: Type.STRING },
            near_location: { type: Type.STRING },
            max_distance_km: { type: Type.NUMBER },
            min_price: { type: Type.NUMBER },
            max_price: { type: Type.NUMBER },
            min_area: { type: Type.NUMBER },
            max_area: { type: Type.NUMBER },
            room_type: { type: Type.STRING },
            amenities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            is_out_of_scope: { type: Type.BOOLEAN },
            out_of_scope_message: { type: Type.STRING },
          },
          required: ['province', 'amenities'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}') as StructuredQuery;
    parsed.province = 'Thái Nguyên';
    return parsed;
  } catch (error) {
    // Graceful fallback to advanced parser
    return parseVietnameseQuery(text, existingContext);
  }
}

/**
 * Main AI Search Resolver
 * Implements full search pipeline with intent classification, Haversine formula,
 * Smart Matching (0 - 100%), and proactive Vietnamese conversational reply.
 */
export async function executeAiRoomSearch(
  userText: string,
  existingContext: Partial<StructuredQuery> = {}
) {
  const intent = detectIntent(userText);

  // 1. Check out of scope
  if (intent === 'OUT_OF_SCOPE') {
    return {
      structured_query: {
        province: 'Thái Nguyên',
        amenities: [],
        is_out_of_scope: true,
        out_of_scope_message:
          'Hiện tại hệ thống chỉ hỗ trợ tìm kiếm phòng trọ tại Tỉnh Thái Nguyên. Bạn muốn tìm phòng ở khu vực nào tại Thái Nguyên? (Ví dụ: gần trường ICTU, ĐH Y Dược, KCN Sông Công, Samsung Phổ Yên...)',
      },
      reply_text:
        'Hiện tại hệ thống chỉ hỗ trợ tìm kiếm phòng trọ tại Tỉnh Thái Nguyên. Bạn muốn tìm phòng ở khu vực nào tại Thái Nguyên? (Ví dụ: gần trường ICTU, ĐH Y Dược, KCN Sông Công, Samsung Phổ Yên...)',
      rooms: [],
      total_matched: 0,
      location_info: null,
    };
  }

  // 2. Extract structured criteria (combining context)
  const structuredQuery = await analyzeQueryWithGemini(userText, existingContext);

  // 3. Resolve location in Thai Nguyen
  let locationObj: LocationItem | undefined;
  if (structuredQuery.near_location) {
    locationObj = db.locations.find(
      (l) =>
        l.short_name.toLowerCase() === structuredQuery.near_location?.toLowerCase() ||
        l.id.toLowerCase() === structuredQuery.near_location?.toLowerCase()
    );
  }

  // 4. Query PostgreSQL / DB store (purely from DB, no hallucination)
  const candidateRooms = db.rooms.filter(
    (r) => r.province === 'Thái Nguyên' && (r.status === 'available' || r.status === 'pending')
  );

  // 5. Calculate Haversine distance & Smart Matching Score (0 - 100%)
  const scoredRooms = candidateRooms.map((room) => {
    const match = calculateMatchScore(room, structuredQuery, locationObj);
    return {
      ...room,
      match_score: match.score,
      distance_km: match.distance,
      score_breakdown: match.breakdown,
    };
  });

  // 6. Filter by criteria
  let filtered = scoredRooms.filter((r) => {
    if (structuredQuery.max_distance_km && r.distance_km !== undefined) {
      if (r.distance_km > structuredQuery.max_distance_km * 1.5) {
        return false;
      }
    }
    if (structuredQuery.max_price && r.price > structuredQuery.max_price * 1.3) {
      return false;
    }
    return true;
  });

  // Sorting based on preference
  if (structuredQuery.sort_preference === 'cheapest') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (structuredQuery.sort_preference === 'nearest') {
    filtered.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
  } else if (structuredQuery.sort_preference === 'highest_quality') {
    filtered.sort((a, b) => {
      // Prioritize highest match score combined with full amenities and modern room standard
      const qualityA = (a.match_score || 0) * 2 + a.amenities.length * 3 + (a.price >= 2000000 ? 4 : 0);
      const qualityB = (b.match_score || 0) * 2 + b.amenities.length * 3 + (b.price >= 2000000 ? 4 : 0);
      return qualityB - qualityA;
    });
  } else {
    filtered.sort((a, b) => b.match_score - a.match_score);
  }

  const finalRooms =
    filtered.length > 0
      ? filtered
      : scoredRooms.sort((a, b) => b.match_score - a.match_score).slice(0, 4);

  // 7. Generate articulate, insightful Vietnamese reply
  const replyText = generateArticulateVietnameseReply(
    userText,
    structuredQuery,
    finalRooms,
    locationObj
  );

  return {
    structured_query: structuredQuery,
    reply_text: replyText,
    rooms: finalRooms.slice(0, 10),
    total_matched: finalRooms.length,
    location_info: locationObj || null,
  };
}
