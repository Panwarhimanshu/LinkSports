import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

// The Cloudinary SDK v2 auto-reads CLOUDINARY_URL from the environment — no manual parsing needed.
// Only configure manually when individual vars are used instead of CLOUDINARY_URL.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Cloudinary] Configured from individual env vars, cloud:', process.env.CLOUDINARY_CLOUD_NAME);
} else {
  console.log('[Cloudinary] CLOUDINARY_URL detected — SDK auto-config active');
}

export const uploadToCloudinary = (
  buffer: Buffer,
  folder = 'linksports/profiles'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (err, result) => {
        if (err || !result) {
          console.error('[Cloudinary] Upload stream error:', JSON.stringify(err));
          return reject(err ?? new Error('Upload failed'));
        }
        resolve(result.secure_url);
      })
      .end(buffer);
  });
};

/** True when real Cloudinary credentials are set (the .env template's "your_..." placeholders don't count). */
export const cloudinaryConfigured = (): boolean => {
  if (process.env.CLOUDINARY_URL) return true;
  const { CLOUDINARY_CLOUD_NAME: name, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  return [name, key, secret].every((v) => !!v && !v.startsWith('your_'));
};

export class StorageNotConfigured extends Error {}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/**
 * Stores an uploaded image and returns where to find it.
 * Production uses Cloudinary. Without Cloudinary credentials, local development falls back to the
 * backend's ./uploads folder (served at /uploads) so photo upload can still be tried; production
 * refuses instead of silently writing to a serverless disk that is wiped between requests.
 */
export const storeImage = async (buffer: Buffer, mimetype: string): Promise<string> => {
  if (cloudinaryConfigured()) return uploadToCloudinary(buffer);
  if (process.env.NODE_ENV === 'production') throw new StorageNotConfigured('Image storage is not configured');
  const dir = path.join(__dirname, '..', '..', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${EXT[mimetype] || 'jpg'}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return `uploads/${name}`;
};
