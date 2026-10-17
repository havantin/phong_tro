import { listRoomsForSearch, db, refreshStaticData } from '../db.js';

async function main() {
  await refreshStaticData();
  const rooms = await listRoomsForSearch();
  console.log('Total rooms:', rooms.length);
  for (const r of rooms) {
    console.log(JSON.stringify({
      id: r.id,
      title: r.title,
      price: r.price,
      lat: r.latitude,
      lng: r.longitude,
      images: r.images?.slice(0, 2)
    }, null, 2));
  }

  console.log('--- Locations ---');
  for (const l of (db.locations || [])) {
    console.log(`${l.short_name} (${l.id}): lat=${l.latitude}, lng=${l.longitude}`);
  }
}

main().catch(console.error);

