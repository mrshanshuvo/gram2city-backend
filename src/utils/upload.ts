import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

// Configure Cloudinary SDK once at module load
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

/**
 * Hardened Multer instance for server-side fallbacks.
 * Enforces a strict 5MB ceiling and image-only MIME filter to safeguard Render 512MB RAM.
 */
export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
    }
  },
});

/**
 * Uploads a file buffer to Cloudinary and returns the secure HTTPS URL.
 * Drop-in replacement for uploadToImgBB — same signature.
 *
 * @param file  - Multer file object (memoryStorage)
 * @param folder - Optional Cloudinary folder (e.g. "gram2city/banners")
 */
export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder = 'gram2city',
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Auto-select best format (WebP/AVIF where browser supports it)
        fetch_format: 'auto',
        quality: 'auto',
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error('Cloudinary upload returned no result'));
        }
        resolve(result.secure_url);
      },
    );

    uploadStream.end(file.buffer);
  });
};
