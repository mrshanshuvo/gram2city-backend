import { Router } from 'express';
import {
  submitApplication,
  getAllRiders,
  getAssignedParcels,
  updateParcelDeliveryStatus,
  getRiderReviews,
  getRiderStats,
  requestPayout,
} from './rider.controller';
import { updateRiderStatus } from '../admin/admin.controller';
import { verifyAuthToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { riderApplicationSchema } from './rider.schema';

const router = Router();

router.post('/riders', verifyAuthToken, validate(riderApplicationSchema), submitApplication);
router.get('/riders', verifyAuthToken, getAllRiders);
router.patch('/riders/:id/status', verifyAuthToken, verifyAdmin, updateRiderStatus);
router.get('/rider/parcels', verifyAuthToken, getAssignedParcels);
router.patch('/rider/parcels/:id/status', verifyAuthToken, updateParcelDeliveryStatus);
router.get('/reviews', verifyAuthToken, getRiderReviews);
router.get('/rider/stats', verifyAuthToken, getRiderStats);
router.get('/rider/stats/:email', verifyAuthToken, getRiderStats);
router.post('/riders/payout', verifyAuthToken, requestPayout);
router.post('/payout', verifyAuthToken, requestPayout);
router.post('/rider/cashout', verifyAuthToken, requestPayout);

export default router;
