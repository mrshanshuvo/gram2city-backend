import { ObjectId } from 'mongodb';
import {
  RiderModel,
  ParcelModel,
  CashoutModel,
  NotificationModel,
  ReviewModel,
  TrackingModel,
} from '../../db/models';
import { Rider, Cashout } from './rider.interface';
import { Parcel } from '../parcel/parcel.interface';

export class RiderService {
  static async submitApplication(application: Omit<Rider, '_id'>) {
    return RiderModel.create(application);
  }

  static async getAllRiders(status?: string, pageNum: number = 1, sizeNum: number = 50) {
    const query: any = {};
    if (status === 'available') {
      query.status = 'approved';
    } else if (status) {
      query.status = status;
    }

    const totalItems = await RiderModel.countDocuments(query);
    const riders = (await RiderModel.find(query)
      .skip((pageNum - 1) * sizeNum)
      .limit(sizeNum)
      .lean()) as unknown as Rider[];

    return { riders, totalItems };
  }

  static async getRiderByEmail(email: string): Promise<Rider | null> {
    return RiderModel.findOne({ email }).lean() as unknown as Rider | null;
  }

  static async getAssignedParcels(riderId: ObjectId): Promise<Parcel[]> {
    return ParcelModel.find({
      assigned_rider_id: riderId,
      delivery_status: { $in: ['assigned', 'on_the_way', 'delivered'] },
    })
      .sort({ creation_date: -1 })
      .lean() as unknown as Parcel[];
  }

  static async updateParcelDeliveryStatus(id: string, riderId: ObjectId, delivery_status: string) {
    const parcel = await ParcelModel.findOne({
      _id: new ObjectId(String(id)),
      assigned_rider_id: riderId,
    }).lean();

    if (!parcel) {
      return { success: false, message: 'Parcel not assigned to you.' };
    }

    const updateFields: any = { delivery_status };

    if (delivery_status === 'delivered') {
      updateFields.delivered_at = new Date().toISOString();

      // Update Rider Performance Metrics
      await RiderModel.updateOne({ _id: riderId }, { $inc: { total_delivered: 1 } });
    }

    await ParcelModel.updateOne({ _id: new ObjectId(String(id)) }, { $set: updateFields });

    const statusMsg = delivery_status === 'delivered' ? 'delivered successfully' : 'now on the way';
    await TrackingModel.create({
      trackingId: parcel.trackingId,
      status: delivery_status,
      details: `Parcel has been ${statusMsg}.`,
      location: 'Transit Center',
      time: new Date().toISOString(),
    });

    await NotificationModel.create({
      email: parcel.created_by,
      message: `Status Update: Your parcel "${parcel.parcelName}" is ${statusMsg}!`,
      time: new Date().toISOString(),
      isRead: false,
      type: 'status_update',
    });

    return { success: true, message: `Status updated to ${delivery_status}.` };
  }

  static async getRiderReviews(email: string): Promise<any[]> {
    return ReviewModel.find({ rider_email: email }).sort({ date: -1 }).lean();
  }

  static async getRiderStats(email: string) {
    const deliveryStats = await ParcelModel.aggregate([
      {
        $match: { assigned_rider_email: email, delivery_status: 'delivered' },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$rider_earning' },
          totalDelivered: { $sum: 1 },
        },
      },
    ]);

    const rider = await this.getRiderByEmail(email);

    return {
      totalEarnings: deliveryStats[0]?.totalEarnings || 0,
      totalDelivered: rider?.total_delivered || deliveryStats[0]?.totalDelivered || 0,
      averageRating: rider?.average_rating || 0,
    };
  }

  static async requestPayout(email: string, amount: number, parcelId?: string) {
    const rider = await this.getRiderByEmail(email);
    if (!rider) {
      return { success: false, message: 'Rider not found' };
    }

    if (parcelId) {
      const existingCashout = await CashoutModel.findOne({
        parcel_id: new ObjectId(String(parcelId)),
        status: { $ne: 'rejected' },
      }).lean();
      if (existingCashout) {
        return {
          success: false,
          message: 'Payout for this parcel has already been requested or processed.',
        };
      }
    }

    // Calculate actual earnings minus already cashed out
    const deliveryStats = await ParcelModel.aggregate([
      {
        $match: { assigned_rider_email: email, delivery_status: 'delivered' },
      },
      { $group: { _id: null, total: { $sum: '$rider_earning' } } },
    ]);

    const cashedOut = await CashoutModel.aggregate([
      { $match: { rider_email: email, status: { $ne: 'rejected' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const available = (deliveryStats[0]?.total || 0) - (cashedOut[0]?.total || 0);

    if (amount > available) {
      return { success: false, message: 'Insufficient balance.' };
    }

    const payoutRequest: any = {
      rider_email: email,
      rider_name: rider.name,
      amount: Number(amount),
      earning: Number(amount),
      status: 'pending' as const,
      requested_at: new Date().toISOString(),
      cashed_out_at: new Date().toISOString(),
    };

    if (parcelId) {
      const parcel = await ParcelModel.findOne({ _id: new ObjectId(String(parcelId)) }).lean();
      payoutRequest.parcel_id = new ObjectId(String(parcelId));
      if (parcel) {
        payoutRequest.trackingId = parcel.trackingId;
        payoutRequest.parcel_name = parcel.parcelName;
      }
    }

    await CashoutModel.create(payoutRequest);

    return { success: true, message: 'Payout request submitted successfully.' };
  }
}
