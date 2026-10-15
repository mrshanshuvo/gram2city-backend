import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import {
  getPublicSettings,
  getPublicTracking,
  getProcessSteps,
  getLandingConfig,
  updateLandingConfig,
  getBanners,
  getServices,
  getFeatures,
  getPartners,
  getTestimonials,
  getStats,
  subscribeNewsletter,
  getNewsletterSubscribers,
  getWarehouses,
  applyMerchant,
  getMerchantProfile,
  getMerchantStats,
  createLandingItem,
  updateLandingItem,
  deleteLandingItem,
} from './public.controller';
import { verifyAuthToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  newsletterSchema,
  bannerSchema,
  serviceSchema,
  featureSchema,
  partnerSchema,
  testimonialSchema,
  processStepSchema,
  landingConfigUpdateSchema,
} from './public.schema';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const parseNestedBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) {
    const result: Record<string, unknown> = {};
    for (const key in req.body) {
      const value = req.body[key];
      if (key.includes('[')) {
        const parts = key.split(/[[\]]+/).filter(Boolean);
        const isArray = key.endsWith('[]');
        let current: Record<string, unknown> = result;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (i === parts.length - 1) {
            if (isArray) {
              current[part] = (current[part] as unknown[]) || [];
              if (Array.isArray(value)) {
                (current[part] as unknown[]).push(...value);
              } else {
                (current[part] as unknown[]).push(value);
              }
            } else {
              current[part] = value;
            }
          } else {
            current[part] = current[part] || {};
            current = current[part] as Record<string, unknown>;
          }
        }
      } else {
        result[key] = value;
      }
    }
    req.body = result;
  }
  next();
};

// ─── PUBLIC GENERAL ROUTES ──────────────────────────────────────────────────
router.get('/public/settings', getPublicSettings);
router.get('/public/tracking/:trackingId', getPublicTracking);

// ─── LANDING PAGE PUBLIC ROUTES ──────────────────────────────────────────────
router.get('/landing/process-steps', getProcessSteps);
router.get('/landing/config', getLandingConfig);
router.get('/landing/banners', getBanners);
router.get('/landing/services', getServices);
router.get('/landing/features', getFeatures);
router.get('/landing/partners', getPartners);
router.get('/landing/testimonials', getTestimonials);
router.get('/landing/stats', getStats);
router.post('/landing/subscribe', validate(newsletterSchema), subscribeNewsletter);
router.get('/landing/warehouses', getWarehouses);

// ─── LANDING CONFIG ADMIN ROUTES ─────────────────────────────────────────────
router.patch(
  '/landing/config',
  verifyAuthToken,
  verifyAdmin,
  upload.single('ogImage'),
  parseNestedBody,
  validate(landingConfigUpdateSchema),
  updateLandingConfig,
);
router.get('/landing/newsletter', verifyAuthToken, verifyAdmin, getNewsletterSubscribers);

// ─── MERCHANT ONBOARDING & PERFORMANCE ───────────────────────────────────────
router.post('/merchants', verifyAuthToken, applyMerchant);
router.get('/merchants/me', verifyAuthToken, getMerchantProfile);
router.get('/merchants/stats', verifyAuthToken, getMerchantStats);

// ─── LANDING ELEMENTS CRUD ADMIN ROUTES ──────────────────────────────────────
const registerCRUD = (
  name: string,
  schema?: Parameters<typeof validate>[0],
  imageField?: string,
) => {
  const middleware: RequestHandler[] = [];
  if (imageField) middleware.push(upload.single(imageField));
  if (schema) middleware.push(validate(schema));

  router.post(`/landing/${name}`, verifyAuthToken, verifyAdmin, ...middleware, createLandingItem);
  router.patch(
    `/landing/${name}/:id`,
    verifyAuthToken,
    verifyAdmin,
    ...middleware,
    updateLandingItem,
  );
  router.delete(`/landing/${name}/:id`, verifyAuthToken, verifyAdmin, deleteLandingItem);
};

registerCRUD('banners', bannerSchema, 'image');
registerCRUD('services', serviceSchema, 'image');
registerCRUD('features', featureSchema, 'image');
registerCRUD('partners', partnerSchema, 'logo');
registerCRUD('process-steps', processStepSchema);
registerCRUD('testimonials', testimonialSchema, 'image');

// ─── Multer Error Handler ──────────────────────────────────────────────────
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send({ success: false, message: 'File too large. Max limit is 5MB.' });
    }
    return res.status(400).send({ success: false, message: err.message });
  } else if (err instanceof Error) {
    return res.status(400).send({ success: false, message: err.message });
  }
  next();
});

export default router;
