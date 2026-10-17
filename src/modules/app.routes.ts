import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import userRoutes from './user/user.routes';
import adminRoutes from './admin/admin.routes';
import parcelRoutes from './parcel/parcel.routes';
import riderRoutes from './rider/rider.routes';
import financeRoutes from './finance/finance.routes';
import supportRoutes from './support/support.routes';
import publicRoutes from './public/public.routes';
import uploadRoutes from './upload/upload.routes';

const router = Router();

router.use('/admin', adminRoutes);
router.use('/', authRoutes);
router.use('/', userRoutes);
router.use('/', parcelRoutes);
router.use('/', riderRoutes);
router.use('/', financeRoutes);
router.use('/', supportRoutes);
router.use('/', publicRoutes);
router.use('/', uploadRoutes);

export default router;
