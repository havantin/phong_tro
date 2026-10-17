/**
 * AI Service & Advanced Natural Language Processing Engine for PhongTro Thai Nguyen
 * Integrates @google/genai with an advanced Vietnamese NLP Conversational Brain,
 * supporting multi-turn memory context, intent classification, Haversine distance,
 * Smart Matching (0 - 100%), proactive upgrade recommendations, and local student advisory.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { db, LocationItem, Room, calculateMatchScore, listRoomsForSearch, refreshStaticData } from './db.js';

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

/**
 * Format price in VND to natural Vietnamese notation:
 * - Dưới 1.000.000 VNĐ: 900k/tháng, 750k/tháng, 950k/tháng
 * - Từ 1.000.000 VNĐ trở lên: 1 triệu/tháng, 1,2 triệu/tháng, 2,3 triệu/tháng
 */
export function formatPriceVND(
  price: number | undefined | null,
  options?: { perMonth?: boolean; compact?: boolean }
): string {
  if (price === undefined || price === null || isNaN(price) || price <= 0) {
    return 'Liên hệ';
  }

  const perMonth = options?.perMonth ?? true;
  const compact = options?.compact ?? false;
  const suffix = perMonth ? (compact ? '/th' : '/tháng') : '';

  if (price < 1000000) {
    const thousands = price / 1000;
    const formattedK = Number.isInteger(thousands)
      ? thousands.toString()
      : thousands.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${formattedK}k${suffix}`;
  }

  const millions = price / 1000000;
  const formattedMillions = Number.isInteger(millions)
    ? millions.toString()
    : millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

  const unit = compact ? 'tr' : 'triệu';
  return `${formattedMillions} ${unit}${suffix}`;
}

export const formatPrice = formatPriceVND;

// Conversational Intent Detection
export type UserIntent =
  | 'OUT_OF_SCOPE'
  | 'IMPROVE_REQUEST'
  | 'FEEDBACK_COMPLAINT'
  | 'GREETING'
  | 'LOCATION_INQUIRY'
  | 'DIRECTIONS_REQUEST'     // Chỉ đường, tìm đường, vị trí phòng trên bản đồ GPS
  | 'PRICE_ADVICE'
  | 'BUDGET_INQUIRY'        // Hỏi ngân sách chưa rõ chu kỳ ("100k", "200k", "ít tiền")
  | 'GENERAL_CONVERSATION'  // Trò chuyện thông thường không liên quan tìm phòng
  | 'PROCEDURE_INQUIRY'     // Hỏi thủ tục, quy trình thuê phòng
  | 'COMPARISON_REQUEST'    // So sánh các phòng
  | 'ROOM_DETAIL_REQUEST'   // Xem chi tiết phòng cụ thể
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

  // Greetings
  if (
    lower === 'chào' ||
    lower === 'xin chào' ||
    lower === 'hello' ||
    lower === 'hi' ||
    lower === 'hey' ||
    lower === 'alo' ||
    lower.startsWith('chào bạn') ||
    lower.startsWith('xin chào') ||
    lower.startsWith('chào bot') ||
    lower.startsWith('chào ad') ||
    lower === 'chào em' ||
    lower === 'chào anh' ||
    lower === 'hello bot'
  ) {
    return 'GREETING';
  }

  // Small budget inquiry: asking if a very small amount is enough (e.g. 100k, 200k, 50k, ít tiền)
  const isSmallBudgetMention =
    /\b(50k|100k|150k|200k|300k|100\.000|100000|100 nghìn|200 nghìn|ít tiền|ngân sách hẹp|ngân sách thấp)\b/i.test(lower);
  if (
    isSmallBudgetMention &&
    (lower.includes('thuê') || lower.includes('được') || lower.includes('phòng nào') || lower.includes('ở được') || lower.includes('có đủ không'))
  ) {
    return 'BUDGET_INQUIRY';
  }

  // General conversation / emotional / small talk
  if (
    lower.includes('buồn') ||
    lower.includes('chán quá') ||
    lower.includes('bạn là ai') ||
    lower.includes('bạn tên gì') ||
    lower.includes('bạn có thể làm gì') ||
    lower.includes('bạn làm được gì') ||
    lower.includes('hôm nay thế nào') ||
    lower.includes('thời tiết') ||
    lower.includes('kể chuyện') ||
    lower.includes('tâm sự') ||
    lower === 'cảm ơn' ||
    lower === 'cảm ơn bạn' ||
    lower === 'ok cảm ơn' ||
    lower === 'thank you' ||
    lower === 'thanks'
  ) {
    return 'GENERAL_CONVERSATION';
  }

  // Procedure & tenancy inquiry
  if (
    lower.includes('thủ tục') ||
    lower.includes('hợp đồng') ||
    lower.includes('tiền cọc') ||
    lower.includes('đặt cọc') ||
    lower.includes('giấy tờ') ||
    lower.includes('tạm trú') ||
    lower.includes('lưu ý khi thuê') ||
    lower.includes('kinh nghiệm thuê') ||
    lower.includes('bị lừa') ||
    lower.includes('lừa đảo') ||
    lower.includes('quy trình thuê')
  ) {
    return 'PROCEDURE_INQUIRY';
  }

  // Comparison request
  if (
    lower.includes('so sánh') ||
    lower.includes('phòng nào tốt hơn') ||
    lower.includes('nên chọn phòng nào') ||
    lower.includes('phòng nào hơn') ||
    lower.includes('khác nhau thế nào')
  ) {
    return 'COMPARISON_REQUEST';
  }

  // Room detail / image request
  if (
    lower.includes('cho xem ảnh') ||
    lower.includes('cho tôi xem ảnh') ||
    lower.includes('xem ảnh phòng') ||
    lower.includes('cho xem phòng') ||
    lower.includes('xem chi tiết phòng') ||
    lower.includes('phòng đầu tiên') ||
    lower.includes('phòng thứ nhất') ||
    lower.includes('phòng thứ 2') ||
    lower.includes('phòng thứ 3') ||
    lower.includes('phòng số 1') ||
    lower.includes('phòng số 2') ||
    lower.includes('phòng số 3')
  ) {
    return 'ROOM_DETAIL_REQUEST';
  }

  // Directions & Map inquiry for rooms
  if (
    lower.includes('chỉ đường') ||
    lower.includes('tìm đường') ||
    lower.includes('đường đi đến') ||
    lower.includes('đường đi tới') ||
    lower.includes('dẫn đường') ||
    lower.includes('tọa độ') ||
    lower.includes('vị trí gps') ||
    lower.includes('vị trí trên bản đồ') ||
    lower.includes('xem trên bản đồ') ||
    lower.includes('ở đâu trên bản đồ') ||
    lower.includes('nằm ở đâu') ||
    lower.includes('google maps')
  ) {
    return 'DIRECTIONS_REQUEST';
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
  // Helper: convert parsed number + unit string to VND integer
  const parsePriceToken = (numStr: string, unitStr?: string): number => {
    const raw = (numStr || '').trim();
    const unit = (unitStr || '').toLowerCase().trim();

    // Check if it's formatted as standard Vietnamese currency like "500.000" or "1.000.000"
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      return parseInt(raw.replace(/\./g, ''), 10);
    }

    const v = parseFloat(raw.replace(',', '.'));
    if (isNaN(v)) return 0;

    if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') return Math.round(v * 1000);
    if (unit === 'triệu' || unit === 'tr' || unit === 'củ') return Math.round(v * 1_000_000);
    if (unit === 'đ' || unit === 'vnd') return Math.round(v);

    // No explicit unit heuristic:
    if (v < 50) return Math.round(v * 1_000_000);             // "1" => 1,000,000; "1.5" => 1,500,000
    if (v >= 100 && v <= 9_999) return Math.round(v * 1000);   // "500" => 500,000; "900" => 900,000
    return Math.round(v);                                      // "500000" => 500,000
  };

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

  // ── Price extraction: one unified pass with correct priority ──────────────
  // Priority order:
  //   1. Range ("từ X đến Y")
  //   2. Rưỡi ("2 rưỡi" = 2.5tr)
  //   3. Compound ("2tr5", "1tr3") — keyword-aware
  //   4. Simple budget keyword + unit ("dưới 900k", "tối đa 1tr", ...)
  //   5. Min-only ("trên 2tr", "từ 2tr trở lên")
  //   6. Target budget / direct mention ("tìm phòng 500k", "phòng 500k", "500k", "phòng 1 triệu", "1tr")
  {
    // 1. RANGE  — handles "từ 1tr đến 2tr", "từ 1tr đến 1tr5", "2 đến 3 triệu"
    const rangeMatch = lower.match(/(?:từ\s*)?(\d+[.,]?\d*)\s*(triệu|tr|củ|k|nghìn|ngàn)?(\d*)\s*(?:đến|tới)\s*(\d+[.,]?\d*)\s*(triệu|tr|củ|k|nghìn|ngàn)(\d*)/);
    if (rangeMatch) {
      const unitMin = rangeMatch[2] || rangeMatch[5];
      const unitMax = rangeMatch[5];
      const minFraction = rangeMatch[3] ? parseFloat(rangeMatch[3]) / 10 : 0;
      const maxFraction = rangeMatch[6] ? parseFloat(rangeMatch[6]) / 10 : 0;
      const minBase = parsePriceToken(rangeMatch[1], unitMin);
      const maxBase = parsePriceToken(rangeMatch[4], unitMax);
      query.min_price = Math.round(minBase + minFraction * 1_000_000);
      query.max_price = Math.round(maxBase + maxFraction * 1_000_000);
    } else {
      // 2. RƯỠI
      const ruoiKeyword = lower.match(/(dưới|không quá|tối đa|tầm|khoảng)?\s*(\d+)\s*(?:triệu|tr)?\s*rưỡi/);
      if (ruoiKeyword) {
        const val = (parseFloat(ruoiKeyword[2]) + 0.5) * 1_000_000;
        const kw = (ruoiKeyword[1] || '').trim();
        query.max_price = kw === 'khoảng' || kw === 'tầm' ? Math.round(val * 1.2) : val;
        if ((kw === 'dưới') ) (query as any)._price_strict_lt = true;
      } else {
        // 3. COMPOUND (keyword)(space)(int)(tr|triệu)(digit)  e.g. "dưới 2tr5", "khoảng 1tr5", "2tr3"
        const compoundMatch = lower.match(/(dưới|không quá|tối đa|nhỏ hơn|khoảng|tầm)?\s*(\d+)\s*(?:tr|triệu)\s*(\d)(?!\d)/);
        if (compoundMatch) {
          const kw = (compoundMatch[1] || '').trim();
          const whole = parseFloat(compoundMatch[2]);
          const fraction = parseFloat(compoundMatch[3]) / 10;
          const val = Math.round((whole + fraction) * 1_000_000);
          if (kw === 'khoảng' || kw === 'tầm') {
            query.max_price = Math.round(val * 1.2);
            if (!query.min_price) query.min_price = Math.round(val * 0.8);
          } else if (kw === 'dưới' || kw === 'nhỏ hơn') {
            query.max_price = val;
            (query as any)._price_strict_lt = true;
          } else {
            // "không quá", "tối đa", or no keyword => <=
            query.max_price = val;
          }
        } else {
          // 4. SIMPLE BUDGET: (keyword) (number)(unit)
          const budgetMatch = lower.match(
            /(dưới|không quá|tối đa|nhỏ hơn|tầm|khoảng|<=?)\s*(\d+[.,]?\d*)\s*(triệu|tr|củ|k|nghìn|ngàn|đ|vnd)\b(?!\s*(?:trở\s*lên|đến|tới))/
          );
          if (budgetMatch) {
            const kw = budgetMatch[1].trim();
            const val = parsePriceToken(budgetMatch[2], budgetMatch[3]);
            if (kw === 'khoảng' || kw === 'tầm') {
              query.max_price = Math.round(val * 1.2);
              if (!query.min_price) query.min_price = Math.round(val * 0.8);
            } else if (kw === 'dưới' || kw === 'nhỏ hơn' || kw === '<') {
              query.max_price = val;
              (query as any)._price_strict_lt = true;
            } else {
              query.max_price = val;
            }
          } else {
            // 5. MIN-ONLY: "trên 2tr", "từ 2tr trở lên", "lớn hơn 1tr"
            const minOnlyMatch = lower.match(/(?:trên|lớn hơn|cao hơn|>)\s*(\d+[.,]?\d*)\s*(triệu|tr|củ|k|nghìn|ngàn)/);
            const minGteMatch = lower.match(/(?:từ|tối thiểu|>=)\s*(\d+[.,]?\d*)\s*(triệu|tr|củ|k|nghìn|ngàn)/);
            if (minOnlyMatch) {
              query.min_price = parsePriceToken(minOnlyMatch[1], minOnlyMatch[2]);
              (query as any)._min_price_strict_gt = true; // strict >
              (query as any)._price_strict_gt = true;
            } else if (minGteMatch && (lower.includes('trở lên') || lower.includes('tối thiểu') || lower.includes('>='))) {
              query.min_price = parsePriceToken(minGteMatch[1], minGteMatch[2]);
            } else {
              // 6. TARGET BUDGET / DIRECT PRICE MENTION (e.g. "tìm phòng 500k", "phòng 500k", "500k", "500 nghìn", "phòng 1 triệu", "1tr", "giá 800k")
              const directPriceMatch = lower.match(
                /(?:tìm\s+phòng|phòng\s+trọ|phòng|thuê|giá|ngân sách|mức|cỡ|có\s+phòng)?\s*(\d+[.,]?\d*)\s*(triệu|tr|củ|k|nghìn|ngàn|đ|vnd)\b/
              );
              if (directPriceMatch) {
                const numStr = directPriceMatch[1];
                const unit = directPriceMatch[2];
                const val = parsePriceToken(numStr, unit);
                if (val >= 100_000 && val <= 50_000_000) {
                  const matchPos = directPriceMatch.index! + directPriceMatch[0].length;
                  const afterText = lower.slice(matchPos, matchPos + 10);
                  if (!/^\s*(km|m2|mét|cây|người|bạn|phòng)/.test(afterText)) {
                    query.max_price = val;
                    (query as any)._target_price = val;
                    if (lower.includes('tầm') || lower.includes('khoảng')) {
                      query.max_price = Math.round(val * 1.2);
                      query.min_price = Math.round(val * 0.8);
                    }
                  }
                }
              } else {
                // Direct pure number like "500000" or "500.000"
                const pureNumMatch = lower.match(/\b(\d{1,3}(?:\.\d{3})+|\d{5,8})\b/);
                if (pureNumMatch) {
                  const val = parsePriceToken(pureNumMatch[1]);
                  if (val >= 100_000 && val <= 50_000_000) {
                    query.max_price = val;
                    (query as any)._target_price = val;
                  }
                }
              }
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
    // Look for explicit distance mentions:
    // e.g. "cách ICTU dưới 2km", "bán kính 3km", "trong vòng 1.5 km", "dưới 500m"
    const kmMatch = lower.match(/(?:dưới|cách|trong vòng|bán kính|tầm|khoảng|tối đa)?\s*(\d+[\.,]?\d*)\s*(?:km|cây|ki-lô-mét)/);
    const meterMatch = lower.match(/(?:dưới|cách|trong vòng|bán kính|tầm|khoảng|tối đa)?\s*(\d+)\s*(?:m|mét|met)\b/);

    if (kmMatch) {
      query.max_distance_km = parseFloat(kmMatch[1].replace(',', '.'));
    } else if (meterMatch && !meterMatch[0].includes('m2') && !meterMatch[0].includes('mét vuông')) {
      query.max_distance_km = parseInt(meterMatch[1], 10) / 1000;
    } else if (lower.includes('gần') && !query.max_distance_km) {
      query.max_distance_km = 3;
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
  locationObj?: LocationItem,
  suggestRooms: any[] = []
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
      const pStr = formatPriceVND(topRoom.price);
      const distStr = topRoom.distance_km !== undefined ? `${topRoom.distance_km.toFixed(1)} km` : '';
      reply += `🌟 **LỰA CHỌN NÂNG CẤP XUẤT SẮC NHẤT (${topRoom.match_score}% phù hợp)**:\n`;
      reply += `• **${topRoom.title}**\n`;
      reply += `• **Giá thuê**: ${pStr} · **Diện tích**: ${topRoom.area} m²\n`;
      if (distStr && locationObj) {
        reply += `• **Vị trí**: Cách ${locationObj.short_name} chỉ ${distStr} (khoảng ${Math.max(2, Math.round(topRoom.distance_km * 13))} phút đi bộ)\n`;
      }
      reply += `• **Ưu điểm vượt trội**: Phòng mới xây, nội thất đồng bộ, điều hòa Inverter thế hệ mới, nước nóng năng lượng mặt trời, ra vào vân tay bảo mật 24/7 và môi trường sinh viên yên tĩnh.\n\n`;
    }

    if (secondRoom) {
      const pStr2 = formatPriceVND(secondRoom.price);
      reply += `🥈 **LỰA CHỌN CAO CẤP THỨ 2 (${secondRoom.match_score}% phù hợp)**:\n`;
      reply += `• **${secondRoom.title}** (${pStr2})\n`;
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
      const pStr = formatPriceVND(topRoom.price);
      reply += `Mình vừa điều chỉnh thuật toán tìm kiếm và chọn lại căn phòng được sinh viên ${locName} đánh giá cao nhất thời điểm hiện tại:\n\n`;
      reply += `👉 **${topRoom.title}** (${pStr} - ${topRoom.match_score}% phù hợp)\n`;
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

  // 3.1 BUDGET INQUIRY HANDLER (e.g. "Tôi có 100k thuê được phòng trọ nào không?")
  if (intent === 'BUDGET_INQUIRY') {
    return `Chào bạn! Bạn đang có khoảng ngân sách nhỏ (như 100k - vài trăm nghìn) để tìm phòng đúng không? 😊\n\n` +
      `Cho mình hỏi rõ hơn một chút nhé, bạn muốn thuê phòng **theo ngày/đêm** hay **theo tháng**?\n\n` +
      `• **Nếu thuê theo tháng**: Tại Thái Nguyên, mức giá phòng trọ riêng thấp nhất mặt bằng chung hiện khoảng **1.0 - 1.5 triệu/tháng**. Ngân sách 100k/tháng sẽ không thuê được phòng riêng, nhưng mình có thể giúp bạn tìm phương án **ở ghép (share phòng)** với các bạn sinh viên khác để tiết kiệm chi phí tối đa.\n` +
      `• **Nếu thuê ngắn ngày/theo ca**: Có một số nhà trọ bình dân hoặc homestay tính theo ngày quanh mức 80k - 120k/đêm.\n\n` +
      `Bạn học trường nào hoặc muốn tìm quanh khu vực nào tại Thái Nguyên? Cứ chia sẻ thêm để mình tư vấn phương án tiết kiệm nhất cho bạn nhé!`;
  }

  // 3.2 GENERAL CONVERSATION HANDLER (e.g. "Tôi đang buồn", "Bạn là ai", "Cảm ơn")
  if (intent === 'GENERAL_CONVERSATION') {
    const lower = userText.toLowerCase();
    if (lower.includes('buồn') || lower.includes('chán')) {
      return `Mình hiểu cảm giác của bạn lúc này. Đôi khi việc học tập, công việc hoặc cuộc sống xa nhà tại Thái Nguyên có thể mang lại nhiều áp lực và mệt mỏi. Hãy hít thở thật sâu, uống một cốc nước ấm hoặc nghe một bản nhạc nhẹ nhàng nhé ☕.\n\n` +
        `Nếu bạn đang muốn tìm một căn phòng trọ yên tĩnh, thoáng đãng hoặc có ban công để đổi không gian sống cho tâm trạng thoải mái hơn, hãy nhắn cho mình bất cứ lúc nào, mình luôn ở đây sẵn sàng hỗ trợ bạn!`;
    }
    if (lower.includes('bạn là ai') || lower.includes('bạn tên gì') || lower.includes('làm được gì')) {
      return `Mình là **AI Trợ lý PhòngTrọTháiNguyên** – hệ thống tư vấn và tìm phòng trọ thông minh dành riêng cho sinh viên và người đi làm tại Tỉnh Thái Nguyên 🤖🏡.\n\n` +
        `Mình có thể giúp bạn:\n` +
        `1. Tìm phòng gần trường (ICTU, TNUT, ĐH Y Dược, ĐH Sư Phạm, Samsung Phổ Yên...)\n` +
        `2. Lọc chính xác theo ngân sách và tiện nghi (điều hòa, máy giặt, nóng lạnh, giờ tự do)\n` +
        `3. Đo khoảng cách GPS thực tế từ phòng đến trường\n` +
        `4. So sánh các phòng và tư vấn hợp đồng, giá điện nước tại Thái Nguyên.\n\n` +
        `Bạn muốn mình hỗ trợ gì ngay bây giờ?`;
    }
    if (lower.includes('cảm ơn') || lower.includes('thanks') || lower.includes('thank you')) {
      return `Dạ không có gì nè! Rất vui được đồng hành cùng bạn trên hành trình tìm phòng trọ ưng ý tại Thái Nguyên. Chúc bạn có một ngày học tập và làm việc thật nhiều năng lượng nhé! ✨`;
    }
    return `Chào bạn! Cảm ơn bạn đã nhắn tin. Mình là AI Trợ lý PhòngTrọTháiNguyên, luôn sẵn sàng lắng nghe và đồng hành cùng bạn. Bạn cần mình tư vấn điều gì về phòng trọ hoặc đời sống sinh viên tại Thái Nguyên không?`;
  }

  // 3.3 PROCEDURE INQUIRY HANDLER
  if (intent === 'PROCEDURE_INQUIRY') {
    return `Dưới đây là một số thủ tục và kinh nghiệm quan trọng khi thuê phòng trọ tại Thái Nguyên bạn cần lưu ý:\n\n` +
      `📋 **1. Tiền đặt cọc & Ký hợp đồng**:\n` +
      `• Mặt bằng chung tại Thái Nguyên thường đặt cọc **1 tháng tiền nhà** (một số nơi yêu cầu 500k đối với phòng giá rẻ).\n` +
      `• Hợp đồng cần ghi rõ: thời hạn thuê (thường 6 tháng - 1 năm), điều kiện được hoàn cọc (báo trước 30 ngày), ngày đóng tiền hàng tháng.\n\n` +
      `⚡ **2. Chốt chỉ số điện nước ngày nhận phòng**:\n` +
      `• Luôn chụp ảnh lại đồng hồ điện, công tơ nước ngay khi nhận chìa khóa.\n` +
      `• Xác nhận rõ đơn giá điện (thường 3.000 - 3.500đ/kWh) và nước (20.000 - 30.000đ/khối hoặc 50k-80k/người).\n\n` +
      `🛡️ **3. Đăng ký tạm trú**:\n` +
      `• Sau khi dọn vào, hãy cung cấp CCCD để chủ trọ khai báo tạm trú trên Cổng dịch vụ công hoặc với Công an phường/xã.\n\n` +
      `⚠️ **4. Cảnh giác tránh bẫy lừa đảo**:\n` +
      `• Tuyệt đối không chuyển khoản tiền cọc giữ chỗ qua mạng khi chưa trực tiếp xem phòng và gặp mặt chủ trọ.\n\n` +
      `Bạn cần mình tư vấn cụ thể khu vực nào quanh trường của bạn không?`;
  }

  // 3.4 COMPARISON REQUEST HANDLER
  if (intent === 'COMPARISON_REQUEST') {
    if (rooms && rooms.length >= 2) {
      const r1 = rooms[0];
      const r2 = rooms[1];
      const p1 = formatPriceVND(r1.price);
      const p2 = formatPriceVND(r2.price);
      const d1 = r1.distance_km !== undefined ? `${r1.distance_km.toFixed(1)} km` : '';
      const d2 = r2.distance_km !== undefined ? `${r2.distance_km.toFixed(1)} km` : '';

      return `Dưới đây là so sánh chi tiết giữa 2 phòng trọ bạn vừa tìm thấy trong cơ sở dữ liệu thực tế:\n\n` +
        `🏢 **1. ${r1.title}**:\n` +
        `• **Giá thuê**: ${p1} · **Diện tích**: ${r1.area} m²\n` +
        (d1 ? `• **Khoảng cách**: ${d1}\n` : '') +
        `• **Tiện nghi nổi bật**: ${r1.amenities.map((a: string) => AMENITY_LABELS_VI[a] || a).join(', ')}\n` +
        `• **Đánh giá phù hợp**: ${r1.match_score || 95}%\n\n` +
        `🏢 **2. ${r2.title}**:\n` +
        `• **Giá thuê**: ${p2} · **Diện tích**: ${r2.area} m²\n` +
        (d2 ? `• **Khoảng cách**: ${d2}\n` : '') +
        `• **Tiện nghi nổi bật**: ${r2.amenities.map((a: string) => AMENITY_LABELS_VI[a] || a).join(', ')}\n` +
        `• **Đánh giá phù hợp**: ${r2.match_score || 90}%\n\n` +
        `💡 **Lời khuyên**: Nếu bạn ưu tiên tiết kiệm tài chính, hãy chọn căn có mức giá thấp hơn. Còn nếu bạn cần tiện nghi và không gian học tập tiện lợi hơn, hãy cân nhắc căn có điểm Smart Match cao nhất nhé!`;
    }
    return `Để so sánh phòng trọ, bạn hãy nhắn yêu cầu tìm kiếm phòng trước (ví dụ: "Tìm phòng gần ICTU dưới 2.5 triệu"), sau đó mình sẽ so sánh chi tiết ưu nhược điểm từng phòng cho bạn ngay nhé!`;
  }

  // 3.5 ROOM DETAIL REQUEST HANDLER
  if (intent === 'ROOM_DETAIL_REQUEST') {
    if (rooms && rooms.length > 0) {
      const topRoom = rooms[0];
      const pStr = formatPriceVND(topRoom.price);
      const distStr = topRoom.distance_km !== undefined ? (topRoom.distance_km < 0.1 ? 'Sát trường (< 100m)' : `${topRoom.distance_km.toFixed(1)} km`) : '';
      const amenitiesStr = (topRoom.amenities || []).map((a: string) => AMENITY_LABELS_VI[a] || a).join(', ');

      const lower = userText.toLowerCase();
      let directAnswer = '';
      if (lower.includes('wifi') || lower.includes('mạng') || lower.includes('internet')) {
        const hasWifi = (topRoom.amenities || []).includes('wifi');
        directAnswer = hasWifi
          ? `✅ **CÓ WIFI**: Phòng "${topRoom.title}" có sẵn mạng wifi cáp quang tốc độ cao cho sinh viên.\n\n`
          : `❌ **CHƯA CÓ WIFI SẴN**: Phòng "${topRoom.title}" trong dữ liệu hiện chưa có gói wifi riêng (bạn có thể kéo mạng chung hoặc đăng ký thêm khi trao đổi với chủ trọ).\n\n`;
      } else if (lower.includes('điều hòa') || lower.includes('máy lạnh')) {
        const hasAC = (topRoom.amenities || []).includes('air_conditioner');
        directAnswer = hasAC
          ? `✅ **CÓ ĐIỀU HÒA**: Phòng "${topRoom.title}" đã được lắp sẵn điều hòa mát mẻ.\n\n`
          : `❌ **CHƯA CÓ ĐIỀU HÒA**: Phòng "${topRoom.title}" chưa có điều hòa.\n\n`;
      } else if (lower.includes('máy giặt')) {
        const hasWM = (topRoom.amenities || []).includes('washing_machine');
        directAnswer = hasWM
          ? `✅ **CÓ MÁY GIẶT**: Phòng "${topRoom.title}" có trang bị máy giặt.\n\n`
          : `❌ **CHƯA CÓ MÁY GIẶT**: Phòng "${topRoom.title}" chưa trang bị máy giặt riêng.\n\n`;
      }

      return `${directAnswer}Dưới đây là thông tin chi tiết và bộ ảnh của phòng trọ bạn quan tâm:\n\n` +
        `🏡 **${topRoom.title}**\n` +
        `• **Giá thuê**: ${pStr}\n` +
        `• **Diện tích**: ${topRoom.area} m²\n` +
        `• **Địa chỉ thực tế**: ${topRoom.address}\n` +
        (distStr ? `• **Khoảng cách**: ${distStr}\n` : '') +
        `• **Tiện nghi đầy đủ**: ${amenitiesStr || 'Cơ bản'}\n` +
        `• **Trạng thái**: Còn phòng trống, sẵn sàng chuyển vào ở ngay.\n\n` +
        `👉 Bạn có thể xem bộ ảnh thực tế của căn phòng này ngay trong thẻ hiển thị bên dưới, hoặc bấm vào nút "Xem chi tiết" để liên hệ trực tiếp với chủ trọ nhé!`;
    }
    return `Hiện chưa có thông tin phòng cụ thể nào trong phiên tìm kiếm trước đó. Bạn hãy nhắn tiêu chí tìm phòng (ví dụ: "Tìm phòng gần ĐH Y Dược") để mình hiển thị danh sách phòng kèm ảnh thực tế nhé!`;
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
    ? `ngân sách dưới ${formatPriceVND(structuredQuery.max_price)}`
    : '';
  const distDesc = structuredQuery.max_distance_km
    ? `cách trường trong vòng ${structuredQuery.max_distance_km} km`
    : '';

  const amenitiesVn = structuredQuery.amenities
    .map((a) => AMENITY_LABELS_VI[a] || a)
    .join(', ');

  if (count === 0) {
    if (structuredQuery.max_price && structuredQuery.max_price < 900000) {
      const budgetFormatted = formatPriceVND(structuredQuery.max_price);
      let reply = `Chào bạn! Mình đã rà soát toàn bộ cơ sở dữ liệu phòng trọ tại Thái Nguyên, hiện tại **không có phòng trọ riêng nào ở mức giá ${budgetFormatted}** (hay dưới ${budgetFormatted}) bạn nhé 🥺.\n\n`;
      reply += `📌 **Thực tế mặt bằng giá phòng tại Thái Nguyên**:\n`;
      reply += `• Phòng trọ riêng độc lập thấp nhất hiện nay dao động từ **900k - 1,5 triệu/tháng** (tùy diện tích và tiện nghi khép kín/nóng lạnh).\n`;
      reply += `• Mức ngân sách ${budgetFormatted} nếu thuê một mình một phòng riêng độc lập thì gần như không thể tìm được tại TP. Thái Nguyên.\n\n`;
      reply += `💡 **Gợi ý giải pháp thông minh dành cho bạn**:\n`;
      reply += `1️⃣ **Phương án Ở ghép (Share phòng)**: Bạn có thể tìm thêm 1-2 bạn sinh viên cùng trường để ở ghép các căn phòng 1.0 - 1.5 triệu/tháng. Khi chia đôi, mỗi người chỉ tốn khoảng **500k - 750k/tháng**, vừa vặn mức tài chính mà vẫn được ở phòng khép kín, an ninh tốt, có wifi và nóng lạnh.\n`;
      reply += `2️⃣ **Các lựa chọn có mức giá gần nhất hiện có trong hệ thống**:\n`;
      if (suggestRooms && suggestRooms.length > 0) {
        suggestRooms.slice(0, 2).forEach((sr: any) => {
          const pStr = formatPriceVND(sr.price);
          const distStr = sr.distance_km ? ` (Cách trường ${sr.distance_km.toFixed(1)} km)` : '';
          reply += `   • **${sr.title}**: **${pStr}**${distStr} - ${sr.address}\n`;
        });
        reply += `\n*(Bạn có thể xem chi tiết các phòng gợi ý này ở phần bên dưới)*\n\n`;
      } else {
        reply += `   • **Ký túc xá cao cấp Homestay giường tầng**: chỉ từ **900k/tháng** (full điều hòa, máy giặt, tủ lạnh, bếp nấu).\n`;
        reply += `   • **Phòng trọ sinh viên gần ĐH Nông Lâm**: giá **1 triệu/tháng**.\n\n`;
      }
      reply += `Bạn đang học trường nào tại Thái Nguyên (ICTU, TNUT, ĐH Y Dược, Sư phạm...)? Cứ chia sẻ thêm để mình tư vấn phương án tiết kiệm nhất cho bạn nhé!`;
      return reply;
    }

    if (suggestRooms && suggestRooms.length > 0) {
      let reply = `Chào bạn! Rất tiếc hiện tại chưa có phòng nào đáp ứng đồng thời 100% tất cả các tiêu chí bạn yêu cầu tại khu vực này.\n\n`;
      reply += `💡 **Hệ thống gợi ý các lựa chọn có mức giá gần nhất hiện có để bạn tham khảo**:\n\n`;
      suggestRooms.slice(0, 2).forEach((sr: any) => {
        const pStr = formatPriceVND(sr.price);
        const distStr = sr.distance_km ? ` (Cách trường ${sr.distance_km.toFixed(1)} km)` : '';
        reply += `• **${sr.title}**: **${pStr}**${distStr} - ${sr.address}\n`;
      });
      reply += `\nBạn có thể tham khảo các phòng gợi ý ở bên dưới hoặc thử mở rộng khoảng cách để mình tìm thêm nhé!`;
      return reply;
    }

    return `Rất tiếc hiện tại chưa có phòng nào đáp ứng đầy đủ các tiêu chí này tại Thái Nguyên. Bạn hãy thử nới lỏng ngân sách hoặc mở rộng khoảng cách để mình tìm thêm các lựa chọn phù hợp nhé!`;
  }

  const topRoom = rooms[0];
  const topPriceStr = formatPriceVND(topRoom.price);
  const topDistStr = topRoom.distance_km !== undefined ? `${topRoom.distance_km.toFixed(1)} km` : '';

  let reply = `Chào bạn! Mình đã phân tích và đối soát yêu cầu${locName ? ` gần ${locName}` : ''}${priceDesc ? `, ${priceDesc}` : ''}${distDesc ? `, ${distDesc}` : ''}${amenitiesVn ? ` cùng tiện ích (${amenitiesVn})` : ''}.\n\n`;

  reply += `Hệ thống đã chọn lọc được **${count} căn phòng phù hợp nhất** từ cơ sở dữ liệu thực tế tại Thái Nguyên:\n\n`;

  reply += `⭐ **Đề xuất nổi bật nhất (${topRoom.match_score}% phù hợp)**:\n`;
  reply += `• **${topRoom.title}**\n`;
  reply += `• **Giá thuê**: ${topPriceStr} · **Diện tích**: ${topRoom.area} m²\n`;
  if (topDistStr && locName) {
    reply += `• **Khoảng cách**: Cách ${locationObj?.short_name} chỉ ${topDistStr} (khoảng ${Math.max(2, Math.round(topRoom.distance_km * 13))} phút đi bộ)\n`;
  }
  reply += `• **Địa chỉ**: ${topRoom.address}\n\n`;

  if (count > 1) {
    const secondRoom = rooms[1];
    const secPriceStr = formatPriceVND(secondRoom.price);
    reply += `💡 Lựa chọn thứ 2 để bạn cân nhắc thêm: **"${secondRoom.title}"** (Giá: ${secPriceStr}, ${secondRoom.match_score}% phù hợp).\n\n`;
  }

  reply += `Bạn có thể bấm vào thẻ phòng bên dưới để xem ảnh chi tiết, tính toán dự toán tiền điện nước hàng tháng, hoặc bấm gọi trực tiếp cho chủ trọ nhé!`;

  return reply;
}

export function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ''
  ).trim();
}

/**
 * Call Gemini API if available and key is valid, otherwise use the advanced fallback brain.
 */
export async function analyzeQueryWithGemini(
  text: string,
  existingContext: Partial<StructuredQuery> = {}
): Promise<StructuredQuery> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return parseVietnameseQuery(text, existingContext);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
Bạn là AI chuyên gia phân tích nhu cầu tìm kiếm phòng trọ tại TỈNH THÁI NGUYÊN, Việt Nam.
Chỉ hỗ trợ tỉnh Thái Nguyên. Nếu người dùng hỏi các tỉnh/thành phố khác (như Hà Nội, TP.HCM, Đà Nẵng, v.v.), hãy đánh dấu is_out_of_scope = true.

PHÂN TÍCH GIÁ TIỀN NGHIÊM NGẶT:
- "dưới Xtr" / "dưới X triệu" / "nhỏ hơn Xtr" => max_price = X*1000000 (giá PHẢI nhỏ hơn, KHÔNG bao gồm X)
- "không quá Xtr" / "tối đa Xtr" => max_price = X*1000000 (giá <= X)
- "khoảng Xtr" / "tầm Xtr" => max_price = X*1000000 (linh hoạt ±20%)
- "trên Xtr" / "từ Xtr trở lên" => min_price = X*1000000
- "từ Xtr đến Ytr" => min_price = X*1000000, max_price = Y*1000000
- Đơn vị: 900k = 900000, 1tr = 1000000, 1tr5 = 1500000, 2 củ = 2000000, 2.5tr = 2500000
- KHÔNG làm tròn hoặc thay đổi giá trị.

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
- near_location: mã địa điểm (ICTU, TNUT, TUMP, TNUE, TUEBA, TUAF, SAMSUNG, KCN_SONGCONG, ...) hoặc null nếu không nhắc tới
- max_distance_km: số km tối đa (float/int) hoặc null nếu không nhắc tới
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
    if (parsed.max_distance_km !== undefined && parsed.max_distance_km <= 0) parsed.max_distance_km = undefined;
    if (parsed.min_price !== undefined && parsed.min_price <= 0) parsed.min_price = undefined;
    if (parsed.max_price !== undefined && parsed.max_price <= 0) parsed.max_price = undefined;
    if (parsed.min_area !== undefined && parsed.min_area <= 0) parsed.min_area = undefined;
    if (parsed.max_area !== undefined && parsed.max_area <= 0) parsed.max_area = undefined;
    if (!parsed.room_type) parsed.room_type = undefined;
    if (!parsed.near_location) parsed.near_location = undefined;
    if (!Array.isArray(parsed.amenities)) parsed.amenities = [];
    return parsed;
  } catch (error: any) {
    console.warn('[AI Service] Gemini query analysis fallback notice:', error?.message);
    return parseVietnameseQuery(text, existingContext);
  }
}

const CANDIDATE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * Robust Gemini caller with multi-model fallback cascade.
 * Tries the fastest/latest models first, gracefully cascading if a model encounters 429 quota or 503 load.
 */
export async function callGeminiCascade(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  systemInstruction?: string,
  jsonSchema?: any
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('No valid GEMINI_API_KEY provided');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Format multi-turn history for Gemini
  const contents: any[] = [];
  const safeHistory = Array.isArray(history) ? history : [];
  const recentHistory = safeHistory.slice(-8);
  for (const h of recentHistory) {
    contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: prompt }],
  });

  let lastError: any = null;

  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (jsonSchema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = jsonSchema;
      }

      const attemptPromise = ai.models.generateContent({
        model,
        contents,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout with model ${model}`)), 10000)
      );

      const response: any = await Promise.race([attemptPromise, timeoutPromise]);
      const reply = response.text?.trim();
      if (reply && reply.length > 5) {
        return reply;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Service] Model ${model} unavailable (${err?.status || err?.message?.slice(0, 45)}), cascading...`);
    }
  }

  throw lastError || new Error('All Gemini candidate models failed');
}

/**
 * Generate natural Vietnamese reply for conversational questions using Gemini (with rich local fallback)
 */
export async function generateGeminiGeneralReply(
  userPrompt: string,
  systemInstruction: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  originalUserText?: string,
  fallbackRooms: any[] = []
): Promise<string> {
  try {
    return await callGeminiCascade(userPrompt, history, systemInstruction);
  } catch (err: any) {
    console.warn('[AI Service] Gemini general reply failed, using Vietnamese engine:', err?.message);
    return generateArticulateVietnameseReply(originalUserText || userPrompt, { province: 'Thái Nguyên', amenities: [] }, fallbackRooms, undefined);
  }
}

/**
 * Generate a conversational Vietnamese reply using Gemini AI with model cascade and history context.
 */
export async function generateConversationalGeminiReply(
  userText: string,
  structuredQuery: StructuredQuery,
  rooms: (Room & { match_score?: number; distance_km?: number })[],
  locationObj?: LocationItem,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  suggestRooms: (Room & { match_score?: number; distance_km?: number })[] = []
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return generateArticulateVietnameseReply(userText, structuredQuery, rooms, locationObj, suggestRooms);
  }

  const topRoomsBrief = rooms.slice(0, 3).map((r, i) => {
    const priceStr = formatPriceVND(r.price);
    const distStr = r.distance_km !== undefined ? `${r.distance_km.toFixed(1)} km` : '';
    return `${i + 1}. "${r.title}" - Giá: ${priceStr}, DT: ${r.area}m², Địa chỉ: ${r.address}${distStr ? `, Cách ${locationObj?.short_name || 'điểm đến'}: ${distStr}` : ''}, Phù hợp: ${r.match_score || 95}%, Tiện nghi: ${r.amenities.join(', ')}`;
  }).join('\n');

  const suggestBrief = suggestRooms.slice(0, 3).map((r, i) => {
    const priceStr = formatPriceVND(r.price);
    return `${i + 1}. "${r.title}" - Giá: ${priceStr} (vượt ngân sách hiện tại), DT: ${r.area}m², Địa chỉ: ${r.address}`;
  }).join('\n');

  const systemInstruction = `
Bạn là AI Trợ lý Tìm phòng trọ Thông minh tại Tỉnh Thái Nguyên (PhòngTrọTháiNguyên).
Hãy trả lời người dùng một cách tự nhiên, thân thiện, súc tích và nhiệt tình bằng tiếng Việt.
Tuyệt đối không bịa đặt thông tin phòng trọ, giá cả, hoặc địa chỉ ngoài dữ liệu thực tế được cung cấp bên dưới.
Nếu danh sách phòng rỗng hoặc chưa khớp hoàn toàn, hãy giải thích nhẹ nhàng và gợi ý phương án điều chỉnh tiêu chí.
QUY TẮC HIỂN THỊ GIÁ TIỀN: Luôn hiển thị giá theo chuẩn: dưới 1 triệu ghi dạng "900k/tháng", "750k/tháng", "950k/tháng"; từ 1 triệu trở lên ghi dạng "1 triệu/tháng", "1,2 triệu/tháng", "2,3 triệu/tháng". Tuyệt đối không ghi dạng "0,9 triệu/tháng".
`;

  const budgetDesc = structuredQuery.max_price ? formatPriceVND(structuredQuery.max_price, { perMonth: false }) : 'không giới hạn';
  const isStrictBudget = (structuredQuery as any)._price_strict_lt === true;

  const prompt = rooms.length === 0
    ? `Người dùng yêu cầu: "${userText}".
Ngân sách người dùng tìm: ${budgetDesc} (${isStrictBudget ? 'dưới' : 'khoảng / tối đa'}).
Kết quả kiểm tra cơ sở dữ liệu: Hiện KHÔNG CÓ phòng nào trong hệ thống tại Thái Nguyên thỏa mãn mức giá này (mức giá rẻ nhất hiện có trong DB là từ 900k/tháng).
${suggestBrief ? `Các phòng có mức giá thấp nhất, gần nhất với ngân sách hiện có trong cơ sở dữ liệu:\n${suggestBrief}` : 'Không có phòng gần ngân sách này.'}

Yêu cầu trả lời của AI Trợ lý (RẤT QUAN TRỌNG - TRẢ LỜI THÔNG MINH, KHÔN KHÉO, THỰC TẾ, KHÔNG MÁY MÓC):
1. Khẳng định trực tiếp và trung thực: Hệ thống đã kiểm tra toàn bộ dữ liệu thực tế tại Thái Nguyên và HIỆN KHÔNG CÓ phòng nào ở mức giá ${budgetDesc}/tháng (hoặc dưới ${budgetDesc}).
2. Phân tích thực tế thị trường: Mặt bằng chung phòng trọ tại TP. Thái Nguyên hiện nay thấp nhất khoảng 900k - 1,2 triệu/tháng (đối với ký túc xá giường tầng hoặc phòng sinh viên bình dân). Mức ${budgetDesc}/tháng là không đủ để thuê một phòng riêng độc lập.
3. Tư vấn giải pháp tài chính thông minh (tư vấn khôn, có tâm):
   - Phương án Ở ghép (Share phòng): Gợi ý người dùng tìm thêm 1-2 bạn sinh viên ở ghép trong các phòng 1.0 - 1.5 triệu/tháng để chia đôi tiền phòng (~500k - 750k/người), vừa đúng mức ngân sách lại ở được phòng rộng rãi, đầy đủ nóng lạnh/wifi.
   - Giới thiệu 1-2 phòng có mức giá thấp nhất, gần nhất với khả năng tài chính của người dùng từ danh sách trên (ví dụ: Ký túc xá Homestay giường tầng 900k/tháng, Phòng sinh viên 1 triệu/tháng).
4. Nhắc người dùng có thể xem các phòng gợi ý này ở danh sách bên dưới hoặc bấm xem chi tiết.
5. Hỏi lại thân thiện: Bạn đang học trường nào tại Thái Nguyên để mình tư vấn khu trọ phù hợp nhất?
TUYỆT ĐỐI KHÔNG nói là "tìm thấy phòng phù hợp với yêu cầu của bạn", TUYỆT ĐỐI KHÔNG bịa đặt phòng ${budgetDesc} khi dữ liệu không có.
`
    : `Câu hỏi/yêu cầu của người dùng: "${userText}"
Địa điểm hướng tới: ${locationObj ? `${locationObj.name} (${locationObj.short_name})` : 'Thái Nguyên'}
Tiêu chí đã lọc: Ngân sách ${isStrictBudget ? 'dưới' : 'tối đa'} ${budgetDesc}, Tiện nghi: ${structuredQuery.amenities.join(', ') || 'cơ bản'}.

Hệ thống đã lọc được chính xác ${rooms.length} phòng trọ THỰC TẾ thỏa mãn điều kiện từ cơ sở dữ liệu:
${topRoomsBrief}

Yêu cầu câu trả lời:
1. Thông báo rõ ràng: "Hệ thống tìm thấy **${rooms.length} phòng** phù hợp với yêu cầu của bạn. Dưới đây là ${Math.min(2, rooms.length)} lựa chọn nổi bật nhất (bạn có thể xem danh sách đầy đủ ${rooms.length} phòng ở bên dưới):".
2. Nêu bật 1-2 phòng tốt nhất từ danh sách trên kèm mức giá và khoảng cách thực tế (tuyệt đối không bịa đặt thông tin ngoài danh sách, hiển thị giá theo chuẩn format như 900k/tháng, 1,2 triệu/tháng).
3. ${!structuredQuery.max_price && !structuredQuery.min_price ? 'Vì người dùng chưa cung cấp mức ngân sách dự kiến, hãy lịch sự hỏi thêm: "Bạn dự định thuê trong khoảng ngân sách bao nhiêu mỗi tháng (ví dụ: dưới 1.5 triệu, dưới 2 triệu hay 2-3 triệu) để mình lọc chính xác nhất?"' : 'Đưa ra 1-2 lời khuyên hữu ích cho sinh viên/người thuê (an ninh, di chuyển xe máy/đi bộ, khu vực đường Z115, Tân Thịnh, Quyết Thắng, Quang Trung hoặc chi phí điện nước).'}
4. Nhắc người dùng có thể bấm vào thẻ phòng bên dưới để xem bộ ảnh thực tế, tính toán tiền điện nước hoặc liên hệ trực tiếp chủ trọ.
5. Định dạng Markdown rõ ràng, dùng icon sinh động.
`;

  try {
    return await callGeminiCascade(prompt, history, systemInstruction);
  } catch (err: any) {
    console.warn('[AI Service] Fast fallback to Vietnamese engine:', err?.message);
    return generateArticulateVietnameseReply(userText, structuredQuery, rooms, locationObj, suggestRooms);
  }
}

/**
 * Main AI Search Resolver
 * Implements full search pipeline with intent classification, Haversine formula,
 * Smart Matching (0 - 100%), and proactive Vietnamese conversational reply.
 */
export async function executeAiRoomSearch(
  userText: string,
  existingContext: Partial<StructuredQuery> = {},
  history: { role: 'user' | 'assistant'; content: string }[] = []
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
  const ruleParsed = parseVietnameseQuery(userText, existingContext);
  const hasExtractedInfo = Boolean(
    ruleParsed.near_location ||
    ruleParsed.max_price ||
    ruleParsed.min_price ||
    ruleParsed.amenities.length > 0 ||
    ruleParsed.max_distance_km ||
    ruleParsed.room_type
  );

  let structuredQuery: StructuredQuery;
  if (hasExtractedInfo || intent !== 'ROOM_SEARCH') {
    structuredQuery = ruleParsed;
  } else {
    try {
      structuredQuery = await analyzeQueryWithGemini(userText, existingContext);
    } catch {
      structuredQuery = ruleParsed;
    }
  }

  // 3. Resolve location in Thai Nguyen
  if (!db.locations || db.locations.length === 0) {
    try {
      await refreshStaticData();
    } catch (e: any) {
      console.warn('[AI Service] Failed to refresh locations:', e?.message);
    }
  }

  let locationObj: LocationItem | undefined;
  if (structuredQuery.near_location) {
    locationObj = db.locations.find(
      (l) =>
        l.short_name.toLowerCase() === structuredQuery.near_location?.toLowerCase() ||
        l.id.toLowerCase() === structuredQuery.near_location?.toLowerCase()
    );
  }

  // 4. Query PostgreSQL DB store with mandatory database-level filtering (Step A)
  const isStrictLt = (structuredQuery as any)._price_strict_lt === true;
  const isStrictGt = (structuredQuery as any)._min_price_strict_gt === true;

  let candidateRooms: Room[] = [];
  try {
    candidateRooms = await listRoomsForSearch({
      max_price: structuredQuery.max_price,
      min_price: structuredQuery.min_price,
      strict_max: isStrictLt,
      strict_min: isStrictGt,
      room_type: structuredQuery.room_type,
    });
  } catch (err: any) {
    console.error('[AI Service] Error loading candidate rooms from PostgreSQL:', err);
    candidateRooms = db.rooms || [];
  }

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

  // 6. Hard-filter by criteria (price and distance strictly enforced)

  let filtered = scoredRooms.filter((r) => {
    // --- HARD FILTER: price ---
    if (structuredQuery.max_price !== undefined) {
      if (isStrictLt) {
        if (r.price >= structuredQuery.max_price) return false; // strict less-than
      } else {
        if (r.price > structuredQuery.max_price) return false;  // less-than-or-equal
      }
    }
    if (structuredQuery.min_price !== undefined) {
      if (isStrictGt) {
        if (r.price <= structuredQuery.min_price) return false;
      } else {
        if (r.price < structuredQuery.min_price) return false;
      }
    }
    // --- HARD FILTER: distance (strictly enforced, no buffer, exclude invalid GPS) ---
    if (locationObj && structuredQuery.max_distance_km) {
      if (r.distance_km === undefined || isNaN(r.distance_km)) return false;
      if (r.distance_km > structuredQuery.max_distance_km) return false;
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
      const qualityA = (a.match_score || 0) * 2 + a.amenities.length * 3 + (a.price >= 2000000 ? 4 : 0);
      const qualityB = (b.match_score || 0) * 2 + b.amenities.length * 3 + (b.price >= 2000000 ? 4 : 0);
      return qualityB - qualityA;
    });
  } else {
    filtered.sort((a, b) => b.match_score - a.match_score);
  }

  // 6.5. Collect alternative suggestions when 0 rooms match
  // Load from DB all available rooms without budget restriction to find the closest alternatives
  let suggestRooms: (Room & { match_score?: number; distance_km?: number })[] = [];

  if (filtered.length === 0) {
    try {
      const allAvailable = await listRoomsForSearch({
        room_type: structuredQuery.room_type,
      });

      const scoredAvailable = allAvailable.map((room) => {
        const match = calculateMatchScore(room, structuredQuery, locationObj);
        return {
          ...room,
          match_score: match.score,
          distance_km: match.distance,
          score_breakdown: match.breakdown,
        };
      });

      if (structuredQuery.max_price !== undefined) {
        suggestRooms = scoredAvailable
          .filter((r) => r.price > structuredQuery.max_price!)
          .sort((a, b) => a.price - b.price)
          .slice(0, 3);
      } else {
        suggestRooms = scoredAvailable.slice(0, 3);
      }
    } catch (e) {
      console.warn('[AI Service] Failed to load alternative suggestions:', e);
    }
  }

  const finalRooms = filtered;

  // 7. Generate articulate, conversational Vietnamese reply using Gemini AI (with fallback)
  const replyText = await generateConversationalGeminiReply(
    userText,
    structuredQuery,
    finalRooms,
    locationObj,
    history,
    suggestRooms
  );

  return {
    structured_query: structuredQuery,
    reply_text: replyText,
    rooms: finalRooms.slice(0, 10),
    total_matched: finalRooms.length,
    suggest_rooms: suggestRooms,
    location_info: locationObj || null,
  };
}

/**
 * Intelligent Conversational Chat Dispatcher
 * Properly routes intents (GREETING, BUDGET_INQUIRY, GENERAL_CONVERSATION, PROCEDURE, COMPARISON, DETAIL, SEARCH),
 * maintaining multi-turn context memory and only querying rooms when appropriate.
 */
export async function executeChatResponse(
  userText: string,
  sessionContext: {
    structured_query?: StructuredQuery;
    last_rooms?: any[];
    [key: string]: any;
  } = {},
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<{
  reply_text: string;
  rooms: any[];
  structured_query: StructuredQuery;
  total_matched: number;
  location_info: LocationItem | null;
  intent: UserIntent;
  suggest_rooms?: any[];
  last_rooms?: any[];
}> {
  const intent = detectIntent(userText);
  const existingQuery: StructuredQuery = sessionContext.structured_query || {
    province: 'Thái Nguyên',
    amenities: [],
  };
  const lastRooms: any[] = sessionContext.last_rooms || [];

  // 1. OUT_OF_SCOPE
  if (intent === 'OUT_OF_SCOPE') {
    return {
      reply_text:
        'Hiện tại hệ thống PhòngTrọTháiNguyên chỉ hỗ trợ tìm kiếm và tư vấn phòng trọ tại **Tỉnh Thái Nguyên** (quanh các trường ICTU, TNUT, ĐH Y Dược, ĐH Sư Phạm, KCN Samsung Phổ Yên...). Bạn muốn tìm phòng ở khu vực nào tại Thái Nguyên? Cứ nhắn cho mình nhé!',
      rooms: [],
      structured_query: { ...existingQuery, is_out_of_scope: true },
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 2. GREETING
  if (intent === 'GREETING') {
    const prompt = `Người dùng chào: "${userText}". Hãy gửi lời chào nồng nhiệt, xưng mình và gọi bạn, giới thiệu mình là AI Trợ lý Tìm phòng trọ Thái Nguyên. Hỏi xem bạn ấy đang cần tìm phòng quanh trường nào (ICTU, TNUT, ĐH Y Dược, Sư phạm, Samsung Phổ Yên...) hoặc cần hỗ trợ gì. Tuyệt đối không liệt kê danh sách phòng khi người dùng chỉ chào hỏi.`;
    const replyText = await generateGeminiGeneralReply(
      prompt,
      'Bạn là AI Trợ lý Tìm phòng trọ Thông minh tại Tỉnh Thái Nguyên. Trả lời thân thiện, nhiệt tình bằng tiếng Việt.',
      conversationHistory,
      userText
    );
    return {
      reply_text: replyText,
      rooms: [],
      structured_query: existingQuery,
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 3. BUDGET_INQUIRY (e.g. "Tôi có 100k thuê được phòng trọ nào không?")
  if (intent === 'BUDGET_INQUIRY') {
    const prompt = `Người dùng hỏi: "${userText}".
Phân tích:
1. Nhận biết người dùng đang có ngân sách nhỏ (100k hoặc vài trăm nghìn) và hỏi thuê được phòng không.
2. Giải thích mặt bằng chung: phòng trọ theo tháng tại Thái Nguyên thường từ 1.0 - 2.5 triệu/tháng. 
3. Với mức 100k: Nếu thuê theo ngày/đêm thì có thể tìm được phòng bình dân hoặc giường dorm; nếu tính theo tháng thì không đủ cho phòng riêng, nhưng có thể tìm phương án "ở ghép" (share phòng) để chia nhỏ chi phí.
4. Hỏi lại người dùng: muốn thuê theo ngày hay theo tháng? Học trường nào hoặc muốn tìm quanh khu vực nào tại Thái Nguyên để bạn tư vấn phương án tiết kiệm nhất.
Tuyệt đối không từ chối cứng nhắc và không bịa đặt danh sách phòng trọ 100k/tháng.`;

    const replyText = await generateGeminiGeneralReply(
      prompt,
      'Bạn là AI Trợ lý Tư vấn Tìm phòng trọ Tỉnh Thái Nguyên (PhòngTrọTháiNguyên). Luôn thấu hiểu, giải thích rõ ràng và hỏi lại người dùng để tư vấn đúng nhu cầu.',
      conversationHistory,
      userText
    );
    return {
      reply_text: replyText,
      rooms: [],
      structured_query: existingQuery,
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 4. GENERAL_CONVERSATION (e.g. "Tôi đang buồn", "Bạn là ai", "Cảm ơn")
  if (intent === 'GENERAL_CONVERSATION') {
    const prompt = `Người dùng nói: "${userText}".
Hãy phản hồi một cách tự nhiên, chân thành, thấu hiểu và ấm áp bằng tiếng Việt như một người bạn đại học đáng tin cậy. Nếu người dùng buồn hay mệt mỏi, hãy an ủi và lắng nghe. Nếu người dùng cảm ơn, hãy đáp lại vui vẻ. Cuối câu có thể nhắc nhẹ rằng bạn là trợ lý phòng trọ Thái Nguyên và luôn sẵn sàng hỗ trợ bất cứ khi nào bạn ấy cần. Không ép sang tìm phòng nếu người dùng chưa yêu cầu.`;

    const replyText = await generateGeminiGeneralReply(
      prompt,
      'Bạn là AI Trợ lý Sinh viên tại Thái Nguyên. Trò chuyện tự nhiên, giàu cảm xúc, lịch thiệp.',
      conversationHistory,
      userText
    );
    return {
      reply_text: replyText,
      rooms: [],
      structured_query: existingQuery,
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 5. PROCEDURE_INQUIRY
  if (intent === 'PROCEDURE_INQUIRY') {
    const prompt = `Người dùng hỏi về thủ tục/quy trình/hợp đồng/tiền cọc: "${userText}".
Hãy tư vấn chi tiết, súc tích và thiết thực cho sinh viên tại Thái Nguyên:
- Tiền cọc: thường là 1 tháng tiền nhà.
- Hợp đồng thuê: kiểm tra điều khoản hoàn cọc, thời hạn thuê, ngày đóng tiền hàng tháng, cam kết giá điện nước.
- Bàn giao: chụp ảnh hiện trạng, chốt số công tơ điện nước ngày đầu vào ở.
- Tạm trú: chủ nhà hỗ trợ đăng ký tạm trú với Công an xã/phường.
- Tránh lừa đảo: không chuyển khoản đặt cọc qua mạng trước khi xem phòng trực tiếp.`;

    const replyText = await generateGeminiGeneralReply(
      prompt,
      'Bạn là AI Trợ lý PhòngTrọTháiNguyên, chuyên gia tư vấn pháp lý và kinh nghiệm thuê trọ cho sinh viên.',
      conversationHistory,
      userText
    );
    return {
      reply_text: replyText,
      rooms: [],
      structured_query: existingQuery,
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 6. LOCATION_INQUIRY
  if (intent === 'LOCATION_INQUIRY') {
    const prompt = `Người dùng hỏi về vị trí/khu vực tại Thái Nguyên: "${userText}".
Hãy tư vấn chi tiết đặc điểm từng khu:
- Khu đường Z115, Quyết Thắng (gần ICTU): nhộn nhịp, nhiều quán xá, phòng mới xây, mạng mạnh, giá 1.8 - 2.5tr.
- Khu Tân Thịnh, Đồi Chè (gần TUEBA, ICTU): yên tĩnh, mát mẻ, giá mềm hơn 1.2 - 1.8tr.
- Khu Lương Ngọc Quyến, Quang Trung (gần ĐH Y Dược, ĐH Sư Phạm): trung tâm thành phố, tiện xe bus, giá 2.0 - 3.5tr.
- Khu Tích Lương, đường 3/2 (gần TNUT): đông đúc sinh viên kỹ thuật, đồ ăn rẻ.
- Khu Phổ Yên, Yên Bình (Samsung): tập trung công nhân và kỹ sư, nhiều phòng khép kín và căn hộ mini.
Hỏi người dùng muốn tìm phòng ở khu vực nào trong số này.`;

    const replyText = await generateGeminiGeneralReply(
      prompt,
      'Bạn là AI Trợ lý am hiểu địa lý và đời sống sinh viên Tỉnh Thái Nguyên.',
      conversationHistory,
      userText
    );
    return {
      reply_text: replyText,
      rooms: [],
      structured_query: existingQuery,
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 7. PRICE_ADVICE
  if (intent === 'PRICE_ADVICE') {
    const prompt = `Người dùng hỏi về giá cả/chi phí sinh hoạt tại Thái Nguyên: "${userText}".
Tư vấn rõ ràng mặt bằng giá:
- Phòng trọ bình dân: 1.0 - 1.5 triệu/tháng.
- Phòng khép kín có điều hòa, nóng lạnh: 1.8 - 2.5 triệu/tháng.
- Chung cư mini / studio full nội thất: 2.8 - 4.0 triệu/tháng.
- Biểu phí dịch vụ: điện 3.000 - 3.500đ/số, nước 20.000 - 30.000đ/khối (hoặc 50k-80k/người), internet 50k - 80k/phòng.
Khuyên người dùng cân đối ngân sách và hỏi mức chi trả dự kiến của họ.`;

    const replyText = await generateGeminiGeneralReply(
      prompt,
      'Bạn là AI Trợ lý PhòngTrọTháiNguyên tư vấn chi phí và tài chính thuê nhà cho sinh viên.',
      conversationHistory,
      userText
    );
    return {
      reply_text: replyText,
      rooms: [],
      structured_query: existingQuery,
      total_matched: 0,
      location_info: null,
      intent,
      last_rooms: lastRooms,
    };
  }

  // 8. COMPARISON_REQUEST
  if (intent === 'COMPARISON_REQUEST') {
    if (lastRooms && lastRooms.length >= 2) {
      const r1 = lastRooms[0];
      const r2 = lastRooms[1];
      const p1 = formatPriceVND(r1.price);
      const p2 = formatPriceVND(r2.price);
      const d1 = r1.distance_km !== undefined ? `${r1.distance_km.toFixed(1)} km` : 'Chưa rõ khoảng cách';
      const d2 = r2.distance_km !== undefined ? `${r2.distance_km.toFixed(1)} km` : 'Chưa rõ khoảng cách';

      const prompt = `Người dùng yêu cầu: "${userText}".
Dưới đây là thông tin thực tế từ cơ sở dữ liệu của 2 phòng vừa tìm thấy:
1. "${r1.title}" - Giá: ${p1}, Diện tích: ${r1.area}m², Địa chỉ: ${r1.address}, Khoảng cách: ${d1}, Tiện nghi: ${r1.amenities?.join(', ') || 'Cơ bản'}, Điểm phù hợp: ${r1.match_score || 95}%.
2. "${r2.title}" - Giá: ${p2}, Diện tích: ${r2.area}m², Địa chỉ: ${r2.address}, Khoảng cách: ${d2}, Tiện nghi: ${r2.amenities?.join(', ') || 'Cơ bản'}, Điểm phù hợp: ${r2.match_score || 90}%.

Hãy so sánh chi tiết ưu nhược điểm của 2 phòng này (về tài chính, không gian sống, sự tiện lợi đi lại, tiện nghi) và đưa ra lời khuyên chân thành sinh viên nên chọn căn nào tùy theo ưu tiên.`;

      const replyText = await generateGeminiGeneralReply(
        prompt,
        'Bạn là AI Trợ lý PhòngTrọTháiNguyên, khách quan và chuyên nghiệp trong việc phân tích, so sánh phòng trọ.',
        conversationHistory,
        userText
      );
      return {
        reply_text: replyText,
        rooms: [r1, r2],
        structured_query: existingQuery,
        total_matched: 2,
        location_info: null,
        intent,
        last_rooms: lastRooms,
      };
    } else {
      return {
        reply_text:
          'Hiện tại trong danh sách gợi ý gần nhất chưa có đủ 2 phòng để so sánh. Bạn hãy tìm kiếm trước (ví dụ: "Tìm phòng gần ICTU dưới 2.5 triệu"), sau đó mình sẽ so sánh chi tiết các lựa chọn cho bạn ngay nhé!',
        rooms: [],
        structured_query: existingQuery,
        total_matched: 0,
        location_info: null,
        intent,
        last_rooms: lastRooms,
      };
    }
  }

  // 9. ROOM_DETAIL_REQUEST (e.g. "Cho xem ảnh phòng đầu tiên", "Cho xem phòng thứ 2")
  if (intent === 'ROOM_DETAIL_REQUEST') {
    const lower = userText.toLowerCase();
    let targetIndex = 0;
    if (lower.includes('thứ 2') || lower.includes('thứ hai') || lower.includes('số 2') || lower.includes('phòng 2')) {
      targetIndex = 1;
    } else if (lower.includes('thứ 3') || lower.includes('thứ ba') || lower.includes('số 3') || lower.includes('phòng 3')) {
      targetIndex = 2;
    }

    if (lastRooms && lastRooms[targetIndex]) {
      const targetRoom = lastRooms[targetIndex];
      const pStr = formatPriceVND(targetRoom.price);
      const distStr = targetRoom.distance_km != null 
        ? (targetRoom.distance_km < 0.1 ? 'Sát trường (< 100m)' : `${targetRoom.distance_km.toFixed(1)} km`)
        : '';
      const amenitiesList = (targetRoom.amenities || []).map((a: string) => AMENITY_LABELS_VI[a] || a).join(', ');
      const prompt = `Người dùng đặt câu hỏi hoặc yêu cầu xem phòng thứ ${targetIndex + 1}: "${userText}".
Dữ liệu THỰC TẾ của phòng được hỏi:
- Tiêu đề: "${targetRoom.title}"
- Giá thuê: ${pStr}
- Diện tích: ${targetRoom.area} m²
- Địa chỉ: ${targetRoom.address}${distStr ? `, Khoảng cách: ${distStr}` : ''}
- Tiện nghi thực tế có sẵn: ${amenitiesList || 'Cơ bản'}
- Mô tả chi tiết: ${targetRoom.description || 'Phòng sạch đẹp, an ninh tốt'}

Yêu cầu trả lời:
1. Trả lời TRỰC TIẾP và CHÍNH XÁC câu hỏi của người dùng (ví dụ: nếu hỏi phòng có wifi/điều hòa/máy giặt/chỗ để xe không, hãy đối soát danh sách tiện nghi thực tế trên và trả lời CÓ hoặc KHÔNG một cách rõ ràng, trung thực, tuyệt đối không bịa đặt tiện nghi không có trong dữ liệu).
2. Tóm tắt thêm 1-2 điểm nổi bật nhất (giá ${pStr}, diện tích ${targetRoom.area}m², khoảng cách).
3. Mời người dùng bấm vào thẻ phòng bên dưới để xem trọn bộ ảnh thực tế, tính tiền điện nước hoặc liên hệ trực tiếp chủ nhà.`;

      const replyText = await generateGeminiGeneralReply(
        prompt,
        'Bạn là AI Trợ lý PhòngTrọTháiNguyên, nhiệt tình giới thiệu chi tiết phòng trọ thực tế.',
        conversationHistory,
        userText,
        [targetRoom]
      );
      return {
        reply_text: replyText,
        rooms: [targetRoom],
        structured_query: existingQuery,
        total_matched: 1,
        location_info: null,
        intent,
        last_rooms: lastRooms,
      };
    } else {
      return {
        reply_text:
          'Hiện tại chưa có phòng nào được lưu trong phiên hội thoại để hiển thị chi tiết. Bạn hãy nhắn yêu cầu tìm phòng (ví dụ: "Tìm phòng gần ĐH Y Dược dưới 2 triệu") để mình đưa ra danh sách phòng kèm ảnh thực tế nhé!',
        rooms: [],
        structured_query: existingQuery,
        total_matched: 0,
        location_info: null,
        intent,
        last_rooms: lastRooms,
      };
    }
  }

  // 9.2. DIRECTIONS_REQUEST (e.g. "Chỉ đường đến phòng thứ nhất", "Phòng này ở đâu?", "Vị trí phòng trên bản đồ")
  if (intent === 'DIRECTIONS_REQUEST') {
    const lower = userText.toLowerCase();
    let targetIndex = 0;
    if (lower.includes('thứ 2') || lower.includes('thứ hai') || lower.includes('số 2') || lower.includes('phòng 2')) {
      targetIndex = 1;
    } else if (lower.includes('thứ 3') || lower.includes('thứ ba') || lower.includes('số 3') || lower.includes('phòng 3')) {
      targetIndex = 2;
    }

    let targetRoom = lastRooms && lastRooms[targetIndex] ? lastRooms[targetIndex] : null;

    if (!targetRoom) {
      try {
        const allRooms = await listRoomsForSearch({});
        const match = allRooms.find((r) =>
          lower.includes(r.title.toLowerCase()) ||
          lower.includes(r.address.toLowerCase()) ||
          (r.title.toLowerCase().includes('hà tín') && lower.includes('hà tín'))
        );
        if (match) targetRoom = match;
      } catch (e) {
        // ignore
      }
    }

    if (targetRoom) {
      const hasGPS = Boolean(
        targetRoom.latitude &&
        targetRoom.longitude &&
        Number(targetRoom.latitude) !== 0 &&
        Number(targetRoom.longitude) !== 0 &&
        !isNaN(Number(targetRoom.latitude)) &&
        !isNaN(Number(targetRoom.longitude))
      );

      if (hasGPS) {
        const lat = Number(targetRoom.latitude).toFixed(6);
        const lng = Number(targetRoom.longitude).toFixed(6);
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
        const pStr = formatPriceVND(targetRoom.price);

        const prompt = `Người dùng hỏi đường hoặc vị trí của phòng: "${targetRoom.title}".
Dữ liệu GPS THỰC TẾ:
- Tên phòng: "${targetRoom.title}"
- Giá thuê: ${pStr}
- Địa chỉ: ${targetRoom.address}, ${targetRoom.ward || ''}, Thái Nguyên
- Tọa độ GPS chính xác: ${lat}, ${lng}
- Link Google Maps chỉ đường: ${mapsUrl}

Hãy trả lời nhiệt tình, hướng dẫn người dùng:
1. Nêu rõ địa chỉ và tọa độ GPS của phòng.
2. Cung cấp đường dẫn mở Google Maps dẫn đường trực tiếp: [Chỉ đường trên Google Maps](${mapsUrl}).
3. Mời người dùng bấm vào thẻ phòng bên dưới hoặc vào trang chi tiết để xem bản đồ Leaflet tương tác.`;

        const replyText = await generateGeminiGeneralReply(
          prompt,
          'Bạn là AI Trợ lý PhòngTrọTháiNguyên, hướng dẫn đường đi và vị trí GPS chính xác.',
          conversationHistory,
          userText,
          [targetRoom]
        );

        return {
          reply_text: replyText,
          rooms: [targetRoom],
          structured_query: existingQuery,
          total_matched: 1,
          location_info: null,
          intent,
          last_rooms: lastRooms,
        };
      } else {
        // Room has NO GPS (e.g. Trọ hà tín)
        const prompt = `Người dùng hỏi đường hoặc vị trí phòng "${targetRoom.title}", nhưng phòng này CHƯA có tọa độ GPS trong hệ thống.
Thông tin thực tế:
- Tên phòng: "${targetRoom.title}"
- Địa chỉ văn bản: ${targetRoom.address}, ${targetRoom.ward || ''}, Thái Nguyên
- Tình trạng GPS: Chủ phòng trọ chưa cập nhật tọa độ GPS chính xác trên bản đồ.

Hãy trả lời rõ ràng, trung thực:
1. Giải thích rằng phòng trọ này hiện tại CHƯA được chủ trọ cập nhật tọa độ GPS trên hệ thống (hệ thống không tự gán vị trí giả định để tránh dẫn đường sai).
2. Cung cấp địa chỉ văn bản thực tế của phòng: "${targetRoom.address}".
3. Khuyên người dùng bấm vào thẻ phòng bên dưới để xem chi tiết và gọi điện trực tiếp cho chủ phòng (${targetRoom.owner_phone || 'qua nút liên hệ'}) để được đón hoặc chỉ đường chi tiết.`;

        const replyText = await generateGeminiGeneralReply(
          prompt,
          'Bạn là AI Trợ lý PhòngTrọTháiNguyên, trung thực và minh bạch về thông tin GPS.',
          conversationHistory,
          userText,
          [targetRoom]
        );

        return {
          reply_text: replyText,
          rooms: [targetRoom],
          structured_query: existingQuery,
          total_matched: 1,
          location_info: null,
          intent,
          last_rooms: lastRooms,
        };
      }
    } else {
      return {
        reply_text:
          'Bạn muốn tìm đường đến phòng trọ nào? Hãy nhập tên phòng (ví dụ: "Chỉ đường đến Trọ hà tín") hoặc tìm kiếm phòng quanh trường của bạn trước nhé!',
        rooms: [],
        structured_query: existingQuery,
        total_matched: 0,
        location_info: null,
        intent,
        last_rooms: lastRooms,
      };
    }
  }

  // 9.5 Follow-up: "Có phòng nào rẻ hơn không?"
  const lowerText = userText.toLowerCase();
  const isCheaperFollowUp =
    lowerText.includes('rẻ hơn') ||
    lowerText.includes('giá thấp hơn') ||
    lowerText.includes('tiết kiệm hơn') ||
    lowerText.includes('ít tiền hơn');

  if (isCheaperFollowUp && lastRooms && lastRooms.length > 0) {
    const validPrices = lastRooms.map((r: any) => r.price).filter((p: number) => typeof p === 'number' && p > 0);
    if (validPrices.length > 0) {
      const minCurrentPrice = Math.min(...validPrices);
      existingQuery.max_price = minCurrentPrice;
      (existingQuery as any)._price_strict_lt = true;
      existingQuery.sort_preference = 'cheapest';
    }
  }

  // 10. ROOM_SEARCH & IMPROVE_REQUEST & FEEDBACK_COMPLAINT
  const searchResult = await executeAiRoomSearch(userText, existingQuery, conversationHistory);
  return {
    ...searchResult,
    intent,
    last_rooms: searchResult.rooms.length > 0 ? searchResult.rooms : (searchResult.suggest_rooms && searchResult.suggest_rooms.length > 0 ? searchResult.suggest_rooms : lastRooms),
  };
}
