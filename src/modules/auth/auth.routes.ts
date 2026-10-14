import { Router } from 'express';
import multer from 'multer';
import {
  register,
  login,
  getMe,
  sendVerification,
  deleteMe,
  resetPassword,
  adminCreateUser,
  refreshTokenHandler,
  logoutHandler,
  googleAuth,
} from './auth.controller';
import { verifyFBToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { registerAuthSchema, loginSchema, adminCreateUserSchema } from './auth.schema';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/auth/register', upload.single('image'), validate(registerAuthSchema), register);
router.post('/auth/login', validate(loginSchema), login);
router.post('/auth/refresh', refreshTokenHandler);
router.post('/auth/logout', logoutHandler);
router.post('/auth/google', googleAuth);
router.get('/auth/me', verifyFBToken, getMe);
router.post('/auth/send-verification', verifyFBToken, sendVerification);
router.delete('/auth/me', verifyFBToken, deleteMe);
router.post('/auth/reset-password', resetPassword);
router.post(
  '/auth/admin/create-user',
  verifyFBToken,
  verifyAdmin,
  validate(adminCreateUserSchema),
  adminCreateUser,
);

export default router;
