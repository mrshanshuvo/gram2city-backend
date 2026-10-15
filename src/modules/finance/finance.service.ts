import { ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { config } from '../../config';
import {
  ParcelModel,
  PaymentModel,
  CashoutModel,
  NotificationModel,
  TrackingModel,
} from '../../db/models';
import { Payment } from './finance.interface';

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

export class FinanceService {
  static async getPaymentHistory(email: string): Promise<Payment[]> {
    return PaymentModel.find({ email }).sort({ payment_time: -1 }).lean() as unknown as Payment[];
  }

  static async createPaymentIntent(
    amount: number,
    parcelId: string,
    email: string,
  ): Promise<string> {
    const parcel = await ParcelModel.findOne({
      _id: new ObjectId(parcelId),
      created_by: email,
    }).lean();

    if (!parcel) {
      throw new Error('Unauthorized: You do not own this parcel.');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: config.STRIPE_CURRENCY,
      payment_method_types: ['card'],
      metadata: {
        parcelId: parcelId.toString(),
        userEmail: email,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Failed to create client secret');
    }

    return paymentIntent.client_secret;
  }

  static async recordPayment(
    data: {
      parcelId: string;
      transactionId: string;
      amount: number;
      paymentMethod?: string;
    },
    email: string,
  ): Promise<{
    success: boolean;
    message: string;
    paymentId?: string;
    data?: { paymentInsertResult: { insertedId: string } };
  }> {
    const { parcelId, transactionId, amount, paymentMethod } = data;

    const parcel = await ParcelModel.findOne({
      _id: new ObjectId(parcelId),
      created_by: email,
    }).lean();

    if (!parcel) {
      return {
        success: false,
        message: 'Unauthorized: Parcel not found or not yours.',
      };
    }

    if (parcel.payment_status === 'paid') {
      return { success: false, message: 'Parcel is already paid.' };
    }

    await ParcelModel.updateOne(
      { _id: new ObjectId(parcelId) },
      { $set: { payment_status: 'paid' } },
    );

    const paymentRecord = {
      parcelId: new ObjectId(parcelId),
      email: email,
      transactionId,
      amount: Number(amount) / 100,
      paymentMethod: paymentMethod || 'card',
      paid_at: new Date().toISOString(),
      payment_time: new Date().toISOString(),
    };

    const createdPayment = await PaymentModel.create(paymentRecord);

    await TrackingModel.create({
      trackingId: parcel.trackingId,
      status: 'paid',
      details: `Payment received. Transaction ID: ${transactionId}`,
      location: 'Primary Hub',
      time: new Date().toISOString(),
    });

    await NotificationModel.create({
      email: email,
      message: `Payment Successful: Your parcel "${parcel.parcelName}" is now confirmed for delivery!`,
      time: new Date().toISOString(),
      isRead: false,
      type: 'payment',
    });

    return {
      success: true,
      message: 'Payment recorded successfully.',
      paymentId: createdPayment._id.toString(),
      data: {
        paymentInsertResult: { insertedId: createdPayment._id.toString() },
      },
    };
  }

  static async getCashoutHistory(riderEmail: string): Promise<Record<string, unknown>[]> {
    const cashouts = await CashoutModel.find({ rider_email: riderEmail })
      .populate('parcel_id', 'trackingId parcelName rider_earning')
      .sort({ requested_at: -1 })
      .lean();

    return cashouts.map((raw) => {
      const c = raw as unknown as Record<string, unknown>;
      const parcelObj =
        typeof c.parcel_id === 'object' && c.parcel_id !== null
          ? (c.parcel_id as Record<string, unknown>)
          : null;
      return {
        _id: c._id ? String(c._id) : '',
        rider_email: c.rider_email,
        rider_name: c.rider_name,
        amount: c.amount ?? c.earning ?? 0,
        earning: c.earning ?? c.amount ?? 0,
        status: c.status,
        requested_at: c.requested_at,
        cashed_out_at: c.cashed_out_at || c.requested_at,
        parcel_id: parcelObj?._id ? String(parcelObj._id) : c.parcel_id ? String(c.parcel_id) : '',
        trackingId: c.trackingId || (parcelObj?.trackingId as string) || '',
        parcel_name: c.parcel_name || (parcelObj?.parcelName as string) || '',
      };
    });
  }
}
