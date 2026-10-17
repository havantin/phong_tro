import { executeChatResponse } from '../aiService.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

async function runMultiTurnTest() {
  console.log('====================================================');
  console.log('BẮT ĐẦU KIỂM THỬ KỊCH BẢN CHATBOT 6 LƯỢT (MULTI-TURN)');
  console.log('====================================================\n');

  let history: Message[] = [];
  let lastContext: any = {};
  let lastRooms: any[] = [];

  const turns = [
    {
      turn: 1,
      input: 'Chào bạn',
      verify: (res: any) => {
        const hasRooms = (res.rooms && res.rooms.length > 0);
        const text = res.reply_text || '';
        console.log(`   Phản hồi: "${text.substring(0, 100)}..."`);
        console.log(`   Số phòng trả về: ${res.rooms?.length || 0}`);
        if (hasRooms) {
          throw new Error('Lượt 1 là lời chào, không được tự động trả về danh sách phòng!');
        }
        if (!text.toLowerCase().includes('chào') && !text.toLowerCase().includes('giúp')) {
          throw new Error('Lượt 1 phải là lời chào hỏi tự nhiên!');
        }
      },
    },
    {
      turn: 2,
      input: 'Tôi muốn tìm phòng gần ICTU',
      verify: (res: any) => {
        const text = res.reply_text || '';
        console.log(`   Phản hồi: "${text.substring(0, 120)}..."`);
        console.log(`   Số phòng: ${res.rooms?.length || 0}`);
        console.log(`   Context near_location: ${res.structured_query?.near_location}`);
        if (res.structured_query?.near_location !== 'ICTU') {
          throw new Error('Lượt 2 phải nhận diện được địa điểm ICTU!');
        }
      },
    },
    {
      turn: 3,
      input: 'Dưới 2 triệu',
      verify: (res: any) => {
        const text = res.reply_text || '';
        const rooms = res.rooms || [];
        console.log(`   Phản hồi: "${text.substring(0, 120)}..."`);
        console.log(`   Số phòng trả về: ${rooms.length}`);
        console.log(`   Max price filter: ${res.structured_query?.max_price}, strict_lt: ${res.structured_query?._price_strict_lt}`);
        console.log(`   Các mức giá phòng: ${rooms.map((r: any) => r.price).join(', ')}`);

        if (res.structured_query?.near_location !== 'ICTU') {
          throw new Error('Lượt 3 phải kế thừa địa điểm ICTU từ lượt trước!');
        }
        if (res.structured_query?.max_price !== 2000000 || !res.structured_query?._price_strict_lt) {
          throw new Error('Lượt 3 phải có max_price = 2000000 và _price_strict_lt = true!');
        }
        for (const r of rooms) {
          if (r.price >= 2000000) {
            throw new Error(`Phòng "${r.title}" có giá ${r.price} >= 2.000.000, vi phạm điều kiện "dưới 2tr"!`);
          }
        }
      },
    },
    {
      turn: 4,
      input: 'Có phòng nào rẻ hơn không?',
      verify: (res: any) => {
        const text = res.reply_text || '';
        const rooms = res.rooms || [];
        console.log(`   Phản hồi: "${text.substring(0, 120)}..."`);
        console.log(`   Max price mới: ${res.structured_query?.max_price}`);
        console.log(`   Số phòng: ${rooms.length}`);
        console.log(`   Các mức giá phòng: ${rooms.map((r: any) => r.price).join(', ')}`);
        for (const r of rooms) {
          if (res.structured_query?.max_price && r.price >= res.structured_query.max_price) {
            throw new Error(`Phòng ${r.price} không rẻ hơn mức trần ${res.structured_query.max_price}!`);
          }
        }
      },
    },
    {
      turn: 5,
      input: 'Phòng thứ nhất có wifi không?',
      verify: (res: any) => {
        const text = res.reply_text || '';
        console.log(`   Phản hồi: "${text.substring(0, 150)}..."`);
        if (!text.toLowerCase().includes('wifi') && !text.toLowerCase().includes('mạng')) {
          throw new Error('Lượt 5 phải trả lời trực tiếp về wifi!');
        }
      },
    },
    {
      turn: 6,
      input: 'Tôi đang buồn quá',
      verify: (res: any) => {
        const text = res.reply_text || '';
        const rooms = res.rooms || [];
        console.log(`   Phản hồi: "${text.substring(0, 120)}..."`);
        console.log(`   Số phòng trả lời: ${rooms.length}`);
        if (rooms.length > 0) {
          throw new Error('Lượt 6 là chia sẻ cảm xúc, không được ép trả về danh sách phòng!');
        }
      },
    },
  ];

  let passCount = 0;

  for (const t of turns) {
    console.log(`\n--- [LƯỢT ${t.turn}] Người dùng: "${t.input}" ---`);

    const result = await executeChatResponse(
      t.input,
      { structured_query: lastContext, last_rooms: lastRooms },
      history
    );

    t.verify(result);

    passCount++;
    console.log(`✅ [LƯỢT ${t.turn} PASS]`);

    // Cập nhật context cho lượt tiếp theo
    history.push({ role: 'user', content: t.input });
    history.push({ role: 'assistant', content: result.reply_text });
    if (result.structured_query) {
      lastContext = { ...lastContext, ...result.structured_query };
    }
    if (result.rooms && result.rooms.length > 0) {
      lastRooms = result.rooms;
    }
  }

  console.log('\n====================================================');
  console.log(`TỔNG KẾT: ${passCount}/${turns.length} LƯỢT HỘI THOẠI ĐẠT CHUẨN!`);
  console.log('====================================================');
}

runMultiTurnTest().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ TEST THẤT BẠI:', err);
  process.exit(1);
});

