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
