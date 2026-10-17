-- ==============================================================================
-- Migration: Upgrade room_images table for Supabase Storage & Gallery Management
-- PhongTro Thai Nguyen - Tim phong thong minh AI
-- ==============================================================================

-- 1. Add columns to room_images if not already present
ALTER TABLE room_images ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
ALTER TABLE room_images ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE room_images ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT false;
ALTER TABLE room_images ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Synchronize existing records to maintain backwards compatibility
UPDATE room_images 
SET image_url = url 
WHERE image_url IS NULL AND url IS NOT NULL;

UPDATE room_images 
SET is_cover = is_primary 
WHERE is_cover IS NULL AND is_primary IS NOT NULL;

UPDATE room_images 
SET url = image_url 
WHERE url IS NULL AND image_url IS NOT NULL;

UPDATE room_images 
SET is_primary = is_cover 
WHERE is_primary IS NULL AND is_cover IS NOT NULL;

-- 3. Create helpful indexes
CREATE INDEX IF NOT EXISTS ix_room_images_room_id ON room_images (room_id);
CREATE INDEX IF NOT EXISTS ix_room_images_is_cover ON room_images (is_cover);
CREATE INDEX IF NOT EXISTS ix_room_images_sort_order ON room_images (sort_order);

-- 4. Supabase Storage Bucket setup (Optional if running in Supabase SQL editor)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('room-images', 'room-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to room images in storage
CREATE POLICY "Public Access room-images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'room-images');

