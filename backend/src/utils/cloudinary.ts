import { v2 as cloudinary } from 'cloudinary';

// SDK auto-reads CLOUDINARY_URL env var — no manual config needed
// Format: cloudinary://api_key:api_secret@cloud_name

export const uploadToCloudinary = (
  buffer: Buffer,
  folder = 'linksports/profiles'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: 'image' }, (err, result) => {
        if (err || !result) {
          console.error('[Cloudinary] Upload error:', err);
          return reject(err ?? new Error('Upload failed'));
        }
        resolve(result.secure_url);
      })
      .end(buffer);
  });
};
