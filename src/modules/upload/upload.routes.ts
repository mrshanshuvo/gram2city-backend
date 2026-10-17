import { Router } from 'express';
import { getUploadSignature } from './upload.controller';
import { uploadSignatureSchema } from './upload.schema';
import { verifyAuthToken } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const router = Router();

// Authenticated route for generating Cloudinary direct signed upload parameters
router.post(
  '/upload/signature',
  verifyAuthToken,
  validate(uploadSignatureSchema),
  getUploadSignature,
);

export default router;
