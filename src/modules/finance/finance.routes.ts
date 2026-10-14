import { Router } from 'express';
import {
  getPaymentHistory,
  createPaymentIntent,
  recordPayment,
  getCashoutHistory,
} from './finance.controller';
import { verifyAuthToken } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { paymentSchema } from './finance.schema';

const router = Router();

router.get('/payments', verifyAuthToken, getPaymentHistory);
router.post(
  '/create-payment-intent',
  verifyAuthToken,
  validate(paymentSchema),
  createPaymentIntent,
);
router.post('/payments', verifyAuthToken, validate(paymentSchema), recordPayment);
router.get('/cashouts', verifyAuthToken, getCashoutHistory);

export default router;
