import { Router } from 'express';
import multer from 'multer';
import {
  getMyParcels,
  getMyParcelStats,
  bookParcel,
  getParcelById,
  updateParcel,
  deleteParcel,
  markPicked,
  bulkIngestParcels,
  markDelivered,
  getTrackingHistory,
  getRecentTrackings,
  addManualTrackingUpdate,
  uploadImage,
} from './parcel.controller';
import { verifyAuthToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { parcelSchema, updateParcelSchema, trackingSchema } from './parcel.schema';

const router = Router();

// Multer Configuration for uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB Limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Parcel Routes
router.get('/parcels', verifyAuthToken, getMyParcels);
router.get('/parcels/stats', verifyAuthToken, getMyParcelStats);
router.post('/parcels', verifyAuthToken, validate(parcelSchema), bookParcel);
router.get('/parcels/:id', verifyAuthToken, getParcelById);
router.patch('/parcels/:id', verifyAuthToken, validate(updateParcelSchema), updateParcel);
router.delete('/parcels/:id', verifyAuthToken, deleteParcel);

// Rider Operations
router.patch('/parcels/:id/pick', verifyAuthToken, markPicked);
router.patch('/parcels/:id/deliver', verifyAuthToken, markDelivered);

// Merchant Bulk Upload
router.post('/parcels/bulk', verifyAuthToken, bulkIngestParcels);

// Tracking Routes
router.get('/trackings/:trackingId', getTrackingHistory);
router.get('/trackings/all/recent', verifyAuthToken, verifyAdmin, getRecentTrackings);
router.post(
  '/trackings',
  verifyAuthToken,
  verifyAdmin,
  validate(trackingSchema),
  addManualTrackingUpdate,
);

// Image Uploads Route
router.post('/upload', verifyAuthToken, upload.single('image'), uploadImage);

// Multer Error Handler
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send({ success: false, message: 'File too large. Max limit is 5MB.' });
    }
    return res.status(400).send({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).send({ success: false, message: err.message });
  }
  next();
});

export default router;
