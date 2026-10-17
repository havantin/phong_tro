import dotenv from 'dotenv';
dotenv.config();
import { executeChatResponse } from './aiService.js';
import { ensureDatabaseConnection } from './db.js';

async function runTests() {
  await ensureDatabaseConnection();
  console.log('=== TEST SUITE: PhongTro Thai Nguyen AI Engine ===');

  let sessionContext: any = {};
  let history: any[] = [];

  // Scenario 1: 'Xin chào' -> AI greets naturally, 0 rooms forced
  console.log('\n--- Test 1: Xin chào ---');
  let res1 = await executeChatResponse('Xin chào', sessionContext, history);
  console.log('Intent:', res1.intent);
  console.log('Rooms count:', res1.rooms.length);
  console.log('Reply preview:\n', res1.reply_text.slice(0, 180));
  if (res1.intent !== 'GREETING' || res1.rooms.length !== 0) {
    throw new Error('Test 1 failed: Expected GREETING and 0 rooms');
  }
  history.push({ role: 'user', content: 'Xin chào' });
  history.push({ role: 'assistant', content: res1.reply_text });

  // Scenario 2: 'Tôi có 100k thuê phòng được không?' -> asks clarify day vs month, 0 rooms
  console.log('\n--- Test 2: Tôi có 100k thuê phòng được không? ---');
  let res2 = await executeChatResponse('Tôi có 100k thuê phòng được không?', sessionContext, history);
  console.log('Intent:', res2.intent);
  console.log('Rooms count:', res2.rooms.length);
  console.log('Reply preview:\n', res2.reply_text.slice(0, 250));
  if (res2.intent !== 'BUDGET_INQUIRY' || res2.rooms.length !== 0) {
    throw new Error('Test 2 failed: Expected BUDGET_INQUIRY and 0 rooms');
  }

  // Scenario 8: 'Tôi đang buồn' -> emotional empathy, 0 rooms
  console.log('\n--- Test 8: Tôi đang buồn ---');
  let res8 = await executeChatResponse('Tôi đang buồn', sessionContext, history);
  console.log('Intent:', res8.intent);
  console.log('Rooms count:', res8.rooms.length);
  console.log('Reply preview:\n', res8.reply_text.slice(0, 200));
  if (res8.intent !== 'GENERAL_CONVERSATION' || res8.rooms.length !== 0) {
    throw new Error('Test 8 failed: Expected GENERAL_CONVERSATION and 0 rooms');
  }

  // Scenario 4: 'Tìm phòng gần ICTU' -> finds real rooms near ICTU from DB
  console.log('\n--- Test 4: Tìm phòng gần ICTU ---');
  let res4 = await executeChatResponse('Tìm phòng gần ICTU', sessionContext, history);
  sessionContext.structured_query = res4.structured_query;
  sessionContext.last_rooms = res4.rooms;
  console.log('Intent:', res4.intent);
  console.log('Location:', res4.structured_query.near_location);
  console.log('Rooms found:', res4.rooms.length);
  console.log('Top room:', res4.rooms[0]?.title, '- Price:', res4.rooms[0]?.price);
  if (res4.structured_query.near_location !== 'ICTU' || res4.rooms.length === 0) {
    throw new Error('Test 4 failed: Expected near_location ICTU and >0 rooms');
  }
  history.push({ role: 'user', content: 'Tìm phòng gần ICTU' });
  history.push({ role: 'assistant', content: res4.reply_text });

  // Scenario 5: 'Có điều hòa không?' -> Keep context ICTU + add air_conditioner
  console.log('\n--- Test 5: Có điều hòa không? (Context preservation) ---');
  let res5 = await executeChatResponse('Có điều hòa không?', sessionContext, history);
  sessionContext.structured_query = res5.structured_query;
  sessionContext.last_rooms = res5.rooms;
  console.log('Intent:', res5.intent);
  console.log('Preserved Location:', res5.structured_query.near_location);
  console.log('Amenities added:', res5.structured_query.amenities);
  console.log('Rooms found:', res5.rooms.length);
  if (res5.structured_query.near_location !== 'ICTU' || !res5.structured_query.amenities.includes('air_conditioner')) {
    throw new Error('Test 5 failed: Expected preserved ICTU and air_conditioner');
  }

  // Scenario 6: 'Có phòng nào rẻ hơn không?' -> updates price/sorting
  console.log('\n--- Test 6: Có phòng nào rẻ hơn không? ---');
  let res6 = await executeChatResponse('Có phòng nào rẻ hơn không?', sessionContext, history);
  sessionContext.structured_query = res6.structured_query;
  sessionContext.last_rooms = res6.rooms;
  console.log('Intent:', res6.intent);
  console.log('Sort / max price:', res6.structured_query.sort_preference, res6.structured_query.max_price);
  console.log('Rooms found:', res6.rooms.length);

  // Scenario 10: 'So sánh hai phòng vừa tìm'
  console.log('\n--- Test 10: So sánh hai phòng vừa tìm ---');
  let res10 = await executeChatResponse('So sánh hai phòng vừa tìm', sessionContext, history);
  console.log('Intent:', res10.intent);
  console.log('Rooms compared:', res10.rooms.length);
  console.log('Reply preview:\n', res10.reply_text.slice(0, 250));
  if (res10.intent !== 'COMPARISON_REQUEST' || res10.rooms.length < 2) {
    throw new Error('Test 10 failed: Expected COMPARISON_REQUEST and 2 rooms compared');
  }

  // Scenario 7: 'Cho xem phòng thứ 2'
  console.log('\n--- Test 7: Cho xem phòng thứ 2 ---');
  let res7 = await executeChatResponse('Cho xem phòng thứ 2', sessionContext, history);
  console.log('Intent:', res7.intent);
  console.log('Rooms shown:', res7.rooms.length);
  console.log('Room title:', res7.rooms[0]?.title);
  if (res7.intent !== 'ROOM_DETAIL_REQUEST' || res7.rooms.length !== 1) {
    throw new Error('Test 7 failed: Expected ROOM_DETAIL_REQUEST and 1 room');
  }

  // Scenario 9: 'Có phòng dưới 2 triệu gần Đại học Y Dược không?'
  console.log('\n--- Test 9: Có phòng dưới 2 triệu gần Đại học Y Dược không? ---');
  let res9 = await executeChatResponse('Có phòng dưới 2 triệu gần Đại học Y Dược không?', {}, []);
  console.log('Intent:', res9.intent);
  console.log('Location:', res9.structured_query.near_location);
  console.log('Max price:', res9.structured_query.max_price);
  console.log('Rooms found:', res9.rooms.length);
  if (res9.structured_query.near_location !== 'TUMP' || res9.structured_query.max_price !== 2000000) {
    throw new Error('Test 9 failed: Expected TUMP and 2000000 max price');
  }

  console.log('\n==========================================');
  console.log('🎉 ALL AI TESTS PASSED COMPLETELY AND VERIFIED!');
  console.log('==========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});

