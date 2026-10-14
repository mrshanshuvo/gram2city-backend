import { Router } from 'express';
import {
  getAuditLogs,
  getStats,
  announce,
  getSettings,
  updateSettings,
  updateUserStatus,
  getAllParcels,
  assignRider,
  getMerchants,
  updateMerchantStatus,
  getFleet,
  getPayouts,
  updatePayoutStatus,
  getAllUsers,
} from './admin.controller';
import { verifyAuthToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  adminSettingsSchema,
  announceSchema,
  userStatusSchema,
  assignRiderSchema,
} from './admin.schema';

const router = Router();

// Apply Admin security to ALL routes in this file
router.use(verifyAuthToken, verifyAdmin);

router.get('/audit-logs', getAuditLogs);
router.get('/stats', getStats);
router.post('/announce', validate(announceSchema), announce);
router.get('/settings', getSettings);
router.patch('/settings', validate(adminSettingsSchema), updateSettings);
router.get('/users', getAllUsers);
router.patch('/users/:email/status', validate(userStatusSchema), updateUserStatus);
router.get('/all-parcels', getAllParcels);
router.patch('/parcels/:id/assign', validate(assignRiderSchema), assignRider);
router.get('/merchants', getMerchants);
router.patch('/merchants/:id/status', updateMerchantStatus);
router.get('/fleet', getFleet);
router.get('/payouts', getPayouts);
router.patch('/payouts/:id/status', updatePayoutStatus);

export default router;
