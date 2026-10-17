import { parseVietnameseQuery, StructuredQuery } from '../aiService.js';

interface TestRoom {
  id: string;
  name: string;
  price: number;
}

const DATASET: TestRoom[] = [
  { id: 'A', name: 'Phòng A (900k)', price: 900000 },
  { id: 'B', name: 'Phòng B (1 triệu)', price: 1000000 },
  { id: 'C', name: 'Phòng C (1.5 triệu)', price: 1500000 },
  { id: 'D', name: 'Phòng D (2 triệu)', price: 2000000 },
  { id: 'E', name: 'Phòng E (2.3 triệu)', price: 2300000 },
];

function filterRooms(dataset: TestRoom[], query: StructuredQuery): TestRoom[] {
  return dataset.filter(r => {
    if (query.max_price !== undefined) {
      if ((query as any)._price_strict_lt) {
        if (r.price >= query.max_price) return false;
      } else {
        if (r.price > query.max_price) return false;
      }
    }
    if (query.min_price !== undefined) {
      if ((query as any)._price_strict_gt) {
        if (r.price <= query.min_price) return false;
      } else {
        if (r.price < query.min_price) return false;
      }
    }
    return true;
  });
}

interface TestCase {
  query: string;
  expectedIds: string[];
  description: string;
}

const testCases: TestCase[] = [
  {
    query: 'Liệt kê các phòng dưới 2tr cho tôi gần cntt',
    expectedIds: ['A', 'B', 'C'],
    description: 'Dưới 2tr phải строго < 2.000.000 (Loại bỏ D 2tr và E 2.3tr)',
  },
  {
    query: 'Tìm phòng không quá 2tr',
    expectedIds: ['A', 'B', 'C', 'D'],
    description: 'Không quá 2tr: <= 2.000.000 (Bao gồm A, B, C, D)',
  },
  {
    query: 'Phòng tối đa 2tr gần trường',
    expectedIds: ['A', 'B', 'C', 'D'],
    description: 'Tối đa 2tr: <= 2.000.000 (Bao gồm A, B, C, D)',
  },
  {
    query: 'Liệt kê các phòng dưới 1tr cho tôi',
    expectedIds: ['A'],
    description: 'Dưới 1tr: < 1.000.000 (Chỉ có A 900k, loại B 1tr)',
  },
  {
    query: 'Tìm phòng không quá 1tr',
    expectedIds: ['A', 'B'],
    description: 'Không quá 1tr: <= 1.000.000 (A và B)',
  },
  {
    query: 'Tìm phòng từ 1tr đến 2tr',
    expectedIds: ['B', 'C', 'D'],
    description: 'Từ 1tr đến 2tr: >= 1tr và <= 2tr (B, C, D)',
  },
  {
    query: 'Tìm phòng trên 2tr',
    expectedIds: ['E'],
    description: 'Trên 2tr: > 2.000.000 (Chỉ có E 2.3tr, loại D 2tr)',
  },
  {
    query: 'Tìm phòng từ 2tr trở lên',
    expectedIds: ['D', 'E'],
    description: 'Từ 2tr trở lên: >= 2.000.000 (D và E)',
  },
  {
    query: 'Tìm phòng dưới 900k',
    expectedIds: [],
    description: 'Dưới 900k: < 900.000 (Không có phòng nào)',
  },
  {
    query: 'Tìm phòng tối đa 900k',
    expectedIds: ['A'],
    description: 'Tối đa 900k: <= 900.000 (Phòng A)',
  },
];

console.log('====================================================');
console.log('CHẠY TEST BỘ DỮ LIỆU ĐẶC BIỆT 5 PHÒNG (A, B, C, D, E)');
console.log('Dataset:');
DATASET.forEach(r => console.log(`  - [${r.id}] ${r.name}: ${r.price.toLocaleString('vi-VN')} đ`));
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

for (const t of testCases) {
  const sq = parseVietnameseQuery(t.query);
  const matched = filterRooms(DATASET, sq);
  const matchedIds = matched.map(m => m.id);

  const isPass =
    matchedIds.length === t.expectedIds.length &&
    matchedIds.every((id, idx) => id === t.expectedIds[idx]);

  if (isPass) {
    passCount++;
    console.log(`✅ [PASS] "${t.query}"`);
    console.log(`   -> Filter: min=${sq.min_price}, max=${sq.max_price}, strict_lt=${(sq as any)._price_strict_lt}, strict_gt=${(sq as any)._price_strict_gt}`);
    console.log(`   -> Kết quả: [${matchedIds.join(', ')}] | Kỳ vọng: [${t.expectedIds.join(', ')}]`);
  } else {
    failCount++;
    console.error(`❌ [FAIL] "${t.query}"`);
    console.error(`   -> Mô tả: ${t.description}`);
    console.error(`   -> Filter: min=${sq.min_price}, max=${sq.max_price}, strict_lt=${(sq as any)._price_strict_lt}, strict_gt=${(sq as any)._price_strict_gt}`);
    console.error(`   -> Kết quả thực tế: [${matchedIds.join(', ')}] != Kỳ vọng: [${t.expectedIds.join(', ')}]`);
  }
}

console.log('\n====================================================');
console.log(`KẾT QUẢ: ${passCount}/${testCases.length} PASS, ${failCount} FAIL`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

