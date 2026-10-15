import { ObjectId } from 'mongodb';
import { ParcelModel, TrackingModel, SettingsModel, AuditModel } from '../../db/models';
import { Parcel, TrackingUpdate } from './parcel.interface';
import { SystemSettings } from '../admin/admin.interface';

export class ParcelService {
  static async getMyParcels(
    email: string,
    payment_status?: string,
    delivery_status?: string,
  ): Promise<Parcel[]> {
    const query: Record<string, unknown> = { created_by: email };
    if (payment_status) query.payment_status = payment_status;
    if (delivery_status) query.delivery_status = delivery_status;

    return ParcelModel.find(query).sort({ createdAt: -1 }).lean() as unknown as Parcel[];
  }

  static async getMyParcelStats(email: string) {
    const stats = await ParcelModel.aggregate([
      { $match: { created_by: email } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$cost' },
          totalParcels: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [{ $eq: ['$delivery_status', 'delivered'] }, 1, 0],
            },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$delivery_status', 'pending'] }, 1, 0] },
          },
          on_the_way: {
            $sum: {
              $cond: [{ $eq: ['$delivery_status', 'on_the_way'] }, 1, 0],
            },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        totalSpent: 0,
        totalParcels: 0,
        delivered: 0,
        pending: 0,
        on_the_way: 0,
      }
    );
  }

  static async calculateCost(weight: number, requiredVehicle: string = 'bike') {
    const settings = (await SettingsModel.findOne({}).lean()) as unknown as SystemSettings;
    const baseFee = settings?.base_delivery_fee || 50;
    const costPerKg = settings?.cost_per_kg || 20;
    const riderCommissionPct = settings?.rider_commission_percentage || 15;

    const vehicleMultipliers = {
      bike: 1,
      car: 1.5,
      mini_pickup: 2.2,
      large_pickup: 3.5,
    };
    const multiplier = vehicleMultipliers[requiredVehicle as keyof typeof vehicleMultipliers] || 1;

    const baseCost = baseFee + (weight > 1 ? (weight - 1) * costPerKg : 0);
    const totalCost = baseCost * multiplier;

    const riderEarning = (totalCost * riderCommissionPct) / 100;
    const adminProfit = totalCost - riderEarning;

    return { totalCost, riderEarning, adminProfit };
  }

  static async bookParcel(parcel: Omit<Parcel, '_id'>) {
    const created = await ParcelModel.create(parcel);
    await TrackingModel.create({
      trackingId: parcel.trackingId,
      status: 'booked',
      details: 'Your parcel has been booked and is awaiting collection.',
      location: 'Primary Hub',
      time: new Date().toISOString(),
    });
    return { insertedId: created._id };
  }

  static async getParcelById(id: string): Promise<Parcel | null> {
    return ParcelModel.findOne({
      _id: new ObjectId(String(id)),
    }).lean() as unknown as Parcel | null;
  }

  static async updateParcel(id: string, updateData: Partial<Parcel>) {
    return ParcelModel.updateOne({ _id: new ObjectId(String(id)) }, { $set: updateData });
  }

  static async deleteParcel(id: string) {
    return ParcelModel.deleteOne({ _id: new ObjectId(String(id)) });
  }

  static async markPicked(id: string) {
    const result = await ParcelModel.updateOne(
      { _id: new ObjectId(String(id)) },
      {
        $set: {
          delivery_status: 'on_the_way',
          picked_at: new Date().toISOString(),
        },
      },
    );

    const parcel = await this.getParcelById(id);
    if (parcel) {
      await TrackingModel.create({
        trackingId: parcel.trackingId,
        status: 'on_the_way',
        details: 'Parcel has been picked up and is on the way.',
        location: 'Pickup Point',
        time: new Date().toISOString(),
      });
    }

    return result;
  }

  static async markDelivered(id: string) {
    const result = await ParcelModel.updateOne(
      { _id: new ObjectId(String(id)) },
      {
        $set: {
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
        },
      },
    );

    const parcel = await this.getParcelById(id);
    if (parcel) {
      await TrackingModel.create({
        trackingId: parcel.trackingId,
        status: 'delivered',
        details: 'Parcel has been successfully delivered to the recipient.',
        location: parcel.receiverDistrict || 'Destination',
        time: new Date().toISOString(),
      });
    }

    return result;
  }

  static async bulkIngestParcels(newParcels: Parcel[], email: string): Promise<void> {
    await ParcelModel.insertMany(newParcels);
    await AuditModel.create({
      admin_email: email,
      action: 'BULK_PARCEL_INGEST',
      details: `Merchant ${email} uploaded ${newParcels.length} parcels.`,
      timestamp: new Date().toISOString(),
    });
  }

  static async getTrackingHistory(trackingId: string): Promise<TrackingUpdate[]> {
    return TrackingModel.find({ trackingId })
      .sort({ time: -1 })
      .lean() as unknown as TrackingUpdate[];
  }

  static async getRecentTrackings(): Promise<TrackingUpdate[]> {
    return TrackingModel.find({})
      .sort({ time: -1 })
      .limit(10)
      .lean() as unknown as TrackingUpdate[];
  }

  static async addManualTrackingUpdate(
    trackingId: string,
    status: string,
    details: string,
    location: string = 'Processing Center',
  ) {
    return TrackingModel.create({
      trackingId,
      status,
      details,
      location,
      time: new Date().toISOString(),
    });
  }
}
