import { v2 as cloudinary } from 'cloudinary';
import { StoredImage } from '../models/StoredImage';

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

/**
 * Stores an uploaded image and returns where to find it.
 * - With Cloudinary credentials: uploads there and returns the https URL.
 * - Without them: keeps the photo in MongoDB and returns a path (api/v1/images/<id>) that the API serves,
 *   so photo upload works on any deployment with no extra account. Cloudinary is the better choice at scale
 *   because it serves photos from a CDN and does not use database space.
 */
export const storeImage = async (buffer: Buffer, mimetype: string, ownerId: unknown): Promise<string> => {
  if (cloudinaryConfigured()) return uploadToCloudinary(buffer);
  const doc = await StoredImage.create({ ownerId, contentType: mimetype, data: buffer, size: buffer.length });
  return `api/v1/images/${doc._id}`;
};
