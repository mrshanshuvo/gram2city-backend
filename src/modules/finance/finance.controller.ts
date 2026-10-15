import { Request, Response } from 'express';
import { FinanceService } from './finance.service';
import { catchAsync } from '../../utils/catchAsync';

export const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email as string;
  const payments = await FinanceService.getPaymentHistory(email);
  res.send({ success: true, data: payments });
});

export const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
  const { amount, parcelId } = req.body;
  const clientSecret = await FinanceService.createPaymentIntent(
    amount,
    parcelId,
    req.user?.email as string,
  );
  res.json({ clientSecret });
});

export const recordPayment = catchAsync(async (req: Request, res: Response) => {
  const { parcelId, transactionId, amount, paymentMethod } = req.body;
  const email = req.user?.email as string;

  if (!parcelId || !transactionId || !amount) {
    return res.status(400).send({ success: false, message: 'Missing payment information' });
  }

  const result = await FinanceService.recordPayment(
    { parcelId, transactionId, amount, paymentMethod },
    email,
  );

  if (!result.success) {
    return res.status(400).send(result);
  }

  res.send(result);
});

export const getCashoutHistory = catchAsync(async (req: Request, res: Response) => {
  const rider_email = req.query.rider_email as string | undefined;
  if (!rider_email) {
    return res.status(400).send({ success: false, message: 'Missing rider_email' });
  }
  const result = await FinanceService.getCashoutHistory(rider_email);
  res.send(result);
});
