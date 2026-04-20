import { v2 as cloudinary } from 'cloudinary';

// Explicitly parse CLOUDINARY_URL if present, otherwise fall back to individual vars
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (cloudinaryUrl) {
  try {
    // Format: cloudinary://api_key:api_secret@cloud_name
    const url = new URL(cloudinaryUrl);
    cloudinary.config({
      cloud_name: url.hostname,
      api_key: url.username,
      api_secret: url.password,
    });
    console.log('[Cloudinary] Configured from CLOUDINARY_URL, cloud:', url.hostname);
  } catch (e) {
    console.error('[Cloudinary] Failed to parse CLOUDINARY_URL:', e);
  }
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Cloudinary] Configured from individual env vars');
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
