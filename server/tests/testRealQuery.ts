import { pool, listRoomsForSearch, refreshStaticData, db } from '../db.js';
import { executeAiRoomSearch } from '../aiService.js';

async function testQuery() {
  await refreshStaticData();
  console.log('Testing: "Liệt kê các phòng dưới 2tr cho tôi gần cntt"');
  const res = await executeAiRoomSearch('Liệt kê các phòng dưới 2tr cho tôi gần cntt');
  console.log('Total matched:', res.total_matched);
  console.log('Structured query:', res.structured_query);
  console.log('Rooms count:', res.rooms.length);
  for (const r of res.rooms) {
    console.log(`- ${r.title} | ${r.price} VNĐ | ${r.distance_km} km | Match: ${r.match_score}%`);
  }
  console.log('--- Reply Text ---');
  console.log(res.reply_text);
  await pool.end();
}

testQuery().catch(console.error);

