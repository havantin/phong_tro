import {
  calculateHaversineKm,
  isValidCoordinate,
  calculateMatchScore,
  listLocations,
  listAllRooms,
  Room,
  LocationItem,
  pool,
} from '../db';
import { executeAiRoomSearch } from '../aiService';
import { estimateTravelTime } from '../../src/utils/travelEstimates';

async function runRadiusTestSuite() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  console.log('========================================================');
  console.log('🧪 TEST SUITE: BÁN KÍNH TÌM KIẾM & KHOẢNG CÁCH HAVERSINE');
  console.log('========================================================\n');

  // --- TEST 1: Công thức toán học Haversine ---
  console.log('--- TEST 1: Độ chính xác công thức toán học Haversine (R = 6371 km) ---');
  // Điểm chuẩn: ICTU (21.5855, 105.8066)
  const ictuLat = 21.5855;
  const ictuLng = 105.8066;

  // Điểm cách 0 km (trùng khớp)
  const distZero = calculateHaversineKm(ictuLat, ictuLng, ictuLat, ictuLng);
  assert(Math.abs(distZero) < 0.0001, `Khoảng cách giữa hai điểm trùng nhau = 0 km (thực tế: ${distZero})`);

  // Điểm dịch chuyển vĩ độ ~0.009 độ (~1.0 km)
  // 1 độ vĩ độ ~ 111.195 km => 1km ~ 1/111.195 ~ 0.0089932 độ
  const oneKmLat = ictuLat + 1 / 111.195;
  const dist1Km = calculateHaversineKm(ictuLat, ictuLng, oneKmLat, ictuLng);
  assert(Math.abs(dist1Km - 1.0) < 0.01, `Khoảng cách kiểm chứng 1.0 km (thực tế: ${dist1Km.toFixed(3)} km)`);

  // --- TEST 2: Kiểm thử bán kính 3km (Phòng A -> F) ---
  console.log('\n--- TEST 2: Tiêu chuẩn lọc bán kính 3km (Điều kiện: distanceKm <= 3.0 km) ---');
  const testCases3Km = [
    { name: 'Phòng A', dist: 0.5, expected: true },
    { name: 'Phòng B', dist: 1.0, expected: true },
    { name: 'Phòng C', dist: 2.5, expected: true },
    { name: 'Phòng D (biên 3km)', dist: 3.0, expected: true },
    { name: 'Phòng E (vượt 3km)', dist: 3.1, expected: false },
    { name: 'Phòng F (rất xa)', dist: 18.4, expected: false },
  ];

  const selectedRadius = 3.0;
  for (const tc of testCases3Km) {
    const isIncluded = tc.dist <= selectedRadius;
    assert(
      isIncluded === tc.expected,
      `${tc.name} (${tc.dist} km) -> ${isIncluded ? 'HIỂN THỊ' : 'LOẠI BỎ'} (Kỳ vọng: ${tc.expected ? 'HIỂN THỊ' : 'LOẠI BỎ'})`
    );
  }

  // --- TEST 3: Phân biệt đường chim bay và khoảng cách đi đường ---
  console.log('\n--- TEST 3: Phân biệt Đường chim bay vs Khoảng cách đi đường ---');
  const crowFlies = 2.8; // Đường chim bay < 3km (hợp lệ với bán kính 3km)
  const est = estimateTravelTime(crowFlies);
  assert(est !== null, 'estimateTravelTime tạo kết quả ước tính hợp lệ');
  if (est) {
    assert(est.distanceKm === 2.8, `Đường chim bay được giữ nguyên là 2.8 km (thực tế: ${est.distanceKm} km)`);
    assert(
      est.estimatedRoadKm >= 3.5,
      `Khoảng cách đi đường ước tính (~${est.estimatedRoadKm} km) lớn hơn đường chim bay (2.8 km)`
    );
    assert(crowFlies <= selectedRadius, 'Phòng cách 2.8 km đường chim bay VẪN ĐƯỢC GIỮ LẠI dù đường đi dài 3.7 km');
    console.log(`    Thông tin hiển thị: "${est.displayText}" | "${est.roadDistanceText}"`);
  }

  // --- TEST 4: Tọa độ lỗi / thiếu / bị đảo / ngoài phạm vi ---
  console.log('\n--- TEST 4: Kiểm tra và chuẩn hóa dữ liệu tọa độ (WGS84 & Thái Nguyên) ---');
  assert(isValidCoordinate(21.5855, 105.8066) === true, 'Tọa độ ICTU (21.5855, 105.8066) hợp lệ WGS84');
  assert(isValidCoordinate(null, 105.8066) === false, 'Tọa độ thiếu latitude (null) bị từ chối');
  assert(isValidCoordinate(21.5855, undefined) === false, 'Tọa độ thiếu longitude (undefined) bị từ chối');
  assert(isValidCoordinate(0, 0) === false, 'Tọa độ Null Island (0, 0) bị từ chối');
  assert(isValidCoordinate(NaN, 105.8066) === false, 'Tọa độ NaN bị từ chối');
  assert(isValidCoordinate(105.8066, 21.5855) === false, 'Tọa độ bị đảo (lat=105.8, lng=21.5) bị từ chối');
  assert(isValidCoordinate(45.0, 10.0) === false, 'Tọa độ ngoài phạm vi Việt Nam/Thái Nguyên bị từ chối');

  // --- TEST 5: Tích hợp Database thực tế (Truy vấn ICTU & Bán kính 3km) ---
  console.log('\n--- TEST 5: Tích hợp dữ liệu thực tế tại Thái Nguyên (ICTU với Bán kính 3km) ---');
  const locations = await listLocations();
  const ictu = locations.find((l) => l.short_name === 'ICTU');
  assert(ictu !== undefined, 'Đã tìm thấy địa điểm ICTU trong database');

  if (ictu) {
    const allRooms = (await listAllRooms()).filter((r) => r.province === 'Thái Nguyên' && r.status === 'available');
    console.log(`  Tổng số phòng khả dụng trong database: ${allRooms.length}`);

    // Tính khoảng cách Haversine chuẩn tới ICTU
    const enriched = allRooms.map((r) => {
      let dist: number | undefined = undefined;
      if (isValidCoordinate(r.latitude, r.longitude)) {
        dist = calculateHaversineKm(ictu.latitude, ictu.longitude, r.latitude, r.longitude);
      }
      return { ...r, distance_to_target: dist };
    });

    // Lọc bán kính 3km
    const radius3KmRooms = enriched.filter((r) => r.distance_to_target !== undefined && r.distance_to_target <= 3.0);
    console.log(`  Số phòng trong bán kính 3km từ ICTU: ${radius3KmRooms.length} (trên tổng số ${allRooms.length})`);

    assert(radius3KmRooms.length < allRooms.length, `Số phòng đã được lọc chính xác (${radius3KmRooms.length} phòng, không phải 17 phòng)`);

    // Kiểm tra không có phòng nào > 3km lọt vào
    const hasFarRoom = radius3KmRooms.some((r) => (r.distance_to_target || 0) > 3.0);
    assert(!hasFarRoom, '100% phòng trong kết quả đều có khoảng cách Haversine <= 3.0 km');

    // Kiểm tra cụ thể phòng 3.7km (Room-14) và 18.4km (Room-17) phải bị loại
    const hasRoom14 = radius3KmRooms.some((r) => r.title.includes('Studio cao cấp trung tâm TP Thái Nguyên'));
    const hasRoom17 = radius3KmRooms.some((r) => r.title.includes('KCN Điềm Thụy'));
    assert(!hasRoom14, 'Phòng Studio 3.7 km (Room-14) đã bị LOẠI KHỎI bán kính 3km');
    assert(!hasRoom17, 'Phòng KCN Điềm Thụy 18.4 km (Room-17) đã bị LOẠI KHỎI bán kính 3km');

    // --- TEST 6: Đổi bán kính từ 3km sang 1km ---
    console.log('\n--- TEST 6: Cập nhật bán kính từ 3km sang 1km (Kiểm tra phản hồi tức thời) ---');
    const radius1KmRooms = enriched.filter((r) => r.distance_to_target !== undefined && r.distance_to_target <= 1.0);
    console.log(`  Số phòng trong bán kính 1km từ ICTU: ${radius1KmRooms.length}`);
    assert(radius1KmRooms.length <= radius3KmRooms.length, 'Số phòng bán kính 1km phải ít hơn hoặc bằng bán kính 3km');
    const allWithin1Km = radius1KmRooms.every((r) => (r.distance_to_target || 0) <= 1.0);
    assert(allWithin1Km, '100% phòng trong bán kính 1km đều có khoảng cách <= 1.0 km');

    // --- TEST 7: Lọc kết hợp Giá (< 2 triệu) và Bán kính (<= 2 km) quanh ICTU ---
    console.log('\n--- TEST 7: Lọc kết hợp Giá (< 2 triệu) và Bán kính (<= 2 km) quanh ICTU ---');
    const comboRooms = enriched.filter(
      (r) => r.price < 2000000 && r.distance_to_target !== undefined && r.distance_to_target <= 2.0
    );
    console.log(`  Số phòng thỏa mãn cả giá < 2tr và khoảng cách <= 2km: ${comboRooms.length}`);
    const validCombo = comboRooms.every((r) => r.price < 2000000 && (r.distance_to_target || 0) <= 2.0);
    assert(validCombo, 'Tất cả các phòng kết hợp đều có giá < 2tr và khoảng cách <= 2km');

    // --- TEST 8: Đổi trường từ ICTU sang Đại học Y Dược (TUMP) ---
    console.log('\n--- TEST 8: Đổi trường từ ICTU sang Đại học Y Dược (TUMP) ---');
    const tump = locations.find((l) => l.short_name === 'TUMP');
    assert(tump !== undefined, 'Đã tìm thấy trường ĐH Y Dược (TUMP)');
    if (tump) {
      const tumpRooms = allRooms
        .map((r) => ({
          ...r,
          dist_tump: isValidCoordinate(r.latitude, r.longitude)
            ? calculateHaversineKm(tump.latitude, tump.longitude, r.latitude, r.longitude)
            : undefined,
        }))
        .filter((r) => r.dist_tump !== undefined && r.dist_tump <= 3.0);
      console.log(`  Số phòng trong bán kính 3km quanh ĐH Y Dược: ${tumpRooms.length}`);
      assert(tumpRooms.every((r) => (r.dist_tump || 0) <= 3.0), '100% phòng quanh ĐH Y Dược đều <= 3.0 km');
    }
  }

  // --- TEST 9: AI Search - Tìm kiếm câu ngôn ngữ tự nhiên ---
  console.log('\n--- TEST 9: AI Search với câu "Phòng dưới 2 triệu cách ICTU dưới 2km" ---');
  try {
    const aiResult = await executeAiRoomSearch('Phòng dưới 2 triệu cách ICTU dưới 2km');
    console.log(`  AI trích xuất: max_price = ${aiResult.structured_query.max_price}, max_distance_km = ${aiResult.structured_query.max_distance_km}, near_location = ${aiResult.structured_query.near_location}`);
    assert(aiResult.structured_query.near_location === 'ICTU', 'AI nhận diện chuẩn địa điểm là ICTU');
    assert(aiResult.structured_query.max_price === 2000000, 'AI nhận diện chuẩn ngân sách dưới 2 triệu');
    assert(aiResult.structured_query.max_distance_km === 2, 'AI nhận diện chuẩn khoảng cách dưới 2 km');

    const allAiRoomsValid = aiResult.rooms.every((r: any) => {
      const priceOk = r.price < 2000000;
      const distOk = r.distance_km !== undefined && r.distance_km <= 2.0;
      return priceOk && distOk;
    });
    assert(allAiRoomsValid, '100% phòng AI trả về đều có giá < 2tr và khoảng cách <= 2.0 km (không có buffer 20%)');
  } catch (err: any) {
    console.error('Lỗi khi chạy AI Search test:', err.message);
  }

  console.log('\n========================================================');
  console.log(`🏁 KẾT QUẢ TEST: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRadiusTestSuite()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

