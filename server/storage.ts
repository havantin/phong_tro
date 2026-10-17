import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

// Determine Supabase URL
let supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl && process.env.DATABASE_URL) {
  // Try extracting project ref from Supabase DATABASE_URL: postgres.PROJECT_REF:...
  const match = process.env.DATABASE_URL.match(/postgres\.([a-z0-9]+):/i);
  if (match && match[1]) {
    supabaseUrl = `https://${match[1]}.supabase.co`;
  }
}

const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseKey = rawKey.trim();

export const BUCKET_NAME = 'room-images';
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_ROOM = 15;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey && supabaseKey.length > 10) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    console.log(`[Storage] Initialized Supabase Storage client with URL: ${supabaseUrl}`);
  } catch (err: any) {
    console.warn(`[Storage] Warning: Failed to initialize Supabase client: ${err?.message}`);
    supabase = null;
  }
} else {
  console.warn(
    `[Storage] Warning: SUPABASE_SERVICE_ROLE_KEY is not set or empty. Uploaded images will be saved locally to /uploads folder for testing until key is configured.`
  );
}

// Local upload directory fallback
const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(supabase);
}

/**
 * Validates a file before upload
 */
export function validateImageFile(file: Express.Multer.File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Không tìm thấy file ảnh' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    return {
      valid: false,
      error: `Định dạng ảnh "${file.mimetype}" không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG, WebP.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Ảnh "${file.originalname}" dung lượng ${sizeInMb}MB vượt quá giới hạn tối đa 5MB.`,
    };
  }

  return { valid: true };
}

/**
 * Upload an image to Supabase Storage (with fallback to local storage if credentials missing)
 */
export async function uploadRoomImage(
  ownerId: string,
  roomId: string,
  file: Express.Multer.File
): Promise<{ storagePath: string; publicUrl: string }> {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '') || 'jpg';
  const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const uniqueFilename = `${Date.now()}-${randomSuffix}.${cleanExt}`;

  // Storage path structure: room-images/{owner_id}/{room_id}/{unique_filename}
  const relativePath = `${ownerId}/${roomId}/${uniqueFilename}`;

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(relativePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('[Storage] Supabase upload error:', error);
        throw new Error(`Lỗi tải ảnh lên Supabase Storage: ${error.message}`);
      }

      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(relativePath);

      return {
        storagePath: `${BUCKET_NAME}/${relativePath}`,
        publicUrl: publicData.publicUrl,
      };
    } catch (err: any) {
      console.error('[Storage] Upload exception:', err);
      throw err;
    }
  }

  // Fallback to local storage
  const targetDir = path.join(LOCAL_UPLOAD_DIR, 'room-images', ownerId, roomId);
  fs.mkdirSync(targetDir, { recursive: true });
  const localFilePath = path.join(targetDir, uniqueFilename);
  fs.writeFileSync(localFilePath, file.buffer);

  const publicUrl = `/uploads/room-images/${ownerId}/${roomId}/${uniqueFilename}`;
  return {
    storagePath: `local://room-images/${ownerId}/${roomId}/${uniqueFilename}`,
    publicUrl,
  };
}

/**
 * Delete an image from storage
 */
export async function deleteRoomImageFromStorage(storagePath: string): Promise<boolean> {
  if (!storagePath) return false;

  try {
    if (storagePath.startsWith('local://')) {
      const localRel = storagePath.replace('local://', '');
      const localAbs = path.join(LOCAL_UPLOAD_DIR, localRel);
      if (fs.existsSync(localAbs)) {
        fs.unlinkSync(localAbs);
      }
      return true;
    }

    if (supabase) {
      // Remove bucket name prefix if present
      const cleanPath = storagePath.startsWith(`${BUCKET_NAME}/`)
        ? storagePath.slice(BUCKET_NAME.length + 1)
        : storagePath;

      const { error } = await supabase.storage.from(BUCKET_NAME).remove([cleanPath]);
      if (error) {
        console.warn('[Storage] Supabase delete warning:', error.message);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error('[Storage] Delete error:', err);
    return false;
  }

  return false;
}

