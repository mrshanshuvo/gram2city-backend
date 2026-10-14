import { ObjectId } from 'mongodb';
import {
  UserModel,
  AuditModel,
  SettingsModel,
  MerchantModel,
  ParcelModel,
  PaymentModel,
  RiderModel,
  CashoutModel,
  NotificationModel,
  TrackingModel,
} from '../../db/models';
import { AuditLog, SystemSettings } from './admin.interface';

export class AdminService {
  static async getAuditLogs(): Promise<AuditLog[]> {
    return AuditModel.find().sort({ timestamp: -1 }).limit(100).lean() as unknown as AuditLog[];
  }

  static async getStats() {
    // 1. Parcel Stats
    const totalParcels = await ParcelModel.countDocuments();
    const pendingParcels = await ParcelModel.countDocuments({
      delivery_status: {
        $in: ['pending', 'assigned', 'not_collected', 'picked_up'],
      },
    });
    const onTheWayParcels = await ParcelModel.countDocuments({
      delivery_status: 'on_the_way',
    });
    const deliveredParcels = await ParcelModel.countDocuments({
      delivery_status: 'delivered',
    });
    const cancelledParcels = await ParcelModel.countDocuments({
      delivery_status: 'cancelled',
    });
    const returnedParcels = await ParcelModel.countDocuments({
      delivery_status: 'returned',
    });

    // 2. Financial Stats (Aggregation)
    const revenueData = await PaymentModel.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ]);

    const profitData = await ParcelModel.aggregate([
      {
        $group: {
          _id: null,
          totalProfit: {
            $sum: {
              $ifNull: ['$admin_profit', { $multiply: ['$cost', 0.85] }],
            },
          },
        },
      },
    ]);

    // 3. User Stats
    const totalUsers = await UserModel.countDocuments({ role: 'user' });
    const totalRiders = await RiderModel.countDocuments();

    // 4. Daily Bookings (Last 7 Days - Comprehensive)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const bookingsRaw = await ParcelModel.aggregate([
      {
        $match: {
          $or: [
            { creation_date: { $gte: sevenDaysAgo.toISOString() } },
            { createdAt: { $gte: sevenDaysAgo.toISOString() } },
          ],
        },
      },
      {
        $group: {
          _id: {
            $substr: [{ $ifNull: ['$creation_date', '$createdAt'] }, 0, 10],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyBookings = last7Days.map((date) => ({
      _id: date,
      count: bookingsRaw.find((b: any) => b._id === date)?.count || 0,
    }));

    // 5. Parcel Type Distribution
    const typeDistribution = await ParcelModel.aggregate([
      { $group: { _id: '$parcelType', count: { $sum: 1 } } },
    ]);

    // 6. Average Delivery Time (in hours)
    const deliveryTimeData = await ParcelModel.aggregate([
      {
        $match: {
          delivery_status: 'delivered',
          delivered_at: { $exists: true },
        },
      },
      {
        $project: {
          duration: {
            $divide: [
              {
                $subtract: [
                  { $toDate: '$delivered_at' },
                  { $toDate: { $ifNull: ['$creation_date', '$createdAt'] } },
                ],
              },
              3600000, // Convert ms to hours
            ],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: '$duration' } } },
    ]);

    // 7. Rider Leaderboard (Top 5 by Deliveries)
    const riderLeaderboard = await ParcelModel.aggregate([
      {
        $match: {
          delivery_status: 'delivered',
          assigned_rider_id: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$assigned_rider_id',
          deliveredCount: { $sum: 1 },
          avgRating: { $first: '$assigned_rider_rating' },
        },
      },
      {
        $lookup: {
          from: 'riders',
          localField: '_id',
          foreignField: '_id',
          as: 'riderDetails',
        },
      },
      { $unwind: '$riderDetails' },
      {
        $project: {
          name: '$riderDetails.name',
          email: '$riderDetails.email',
          deliveredCount: 1,
          rating: { $ifNull: ['$riderDetails.average_rating', 0] },
        },
      },
      { $sort: { deliveredCount: -1 } },
      { $limit: 5 },
    ]);

    // 8. Geographic Distribution (by District)
    const districtDistribution = await ParcelModel.aggregate([
      { $group: { _id: '$receiverDistrict', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // 9. Fleet Distribution (by Vehicle Type)
    const fleetDistribution = await RiderModel.aggregate([
      { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
    ]);

    return {
      parcels: {
        total: totalParcels,
        pending: pendingParcels,
        onTheWay: onTheWayParcels,
        delivered: deliveredParcels,
        cancelled: cancelledParcels,
        returned: returnedParcels,
      },
      revenue: revenueData[0]?.totalRevenue || 0,
      profit: profitData[0]?.totalProfit || 0,
      users: { customers: totalUsers, riders: totalRiders },
      dailyBookings,
      parcelTypeDistribution: typeDistribution,
      avgDeliveryTime: deliveryTimeData[0]?.avgHours || 0,
      riderLeaderboard,
      districtDistribution,
      fleetDistribution,
    };
  }

  static async createAnnouncement(message: string, adminEmail: string): Promise<number> {
    const users = await UserModel.find({}, 'email').lean();

    const notifications = users.map((u) => ({
      email: u.email,
      message: `ANNOUNCEMENT: ${message}`,
      time: new Date().toISOString(),
      isRead: false,
      type: 'admin_alert',
    }));

    if (notifications.length > 0) {
      await NotificationModel.insertMany(notifications);
    }

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'BULK_ANNOUNCEMENT',
      details: `Sent announcement: ${message}`,
      timestamp: new Date().toISOString(),
    });

    return users.length;
  }

  static async getSettings(): Promise<SystemSettings> {
    let settings = await SettingsModel.findOne({}).lean();

    if (!settings) {
      const defaultSettings = {
        base_delivery_fee: 50,
        cost_per_kg: 20,
        rider_commission_percentage: 15,
        updated_at: new Date().toISOString(),
        updated_by: 'system',
      };
      await SettingsModel.create(defaultSettings);
      settings = defaultSettings as any;
    }

    return settings as unknown as SystemSettings;
  }

  static async updateSettings(
    data: {
      base_delivery_fee?: number;
      cost_per_kg?: number;
      rider_commission_percentage?: number;
    },
    adminEmail: string,
  ): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: adminEmail,
    };

    if (data.base_delivery_fee !== undefined)
      updateData.base_delivery_fee = Number(data.base_delivery_fee);
    if (data.cost_per_kg !== undefined) updateData.cost_per_kg = Number(data.cost_per_kg);
    if (data.rider_commission_percentage !== undefined)
      updateData.rider_commission_percentage = Number(data.rider_commission_percentage);

    await SettingsModel.updateOne({}, { $set: updateData }, { upsert: true });

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'UPDATE_SETTINGS',
      details: `Updated system settings: ${JSON.stringify(updateData)}`,
      timestamp: new Date().toISOString(),
    });
  }

  static async updateUserStatus(email: string, status: string, adminEmail: string): Promise<void> {
    await UserModel.updateOne({ email }, { $set: { status: status as any } });

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'USER_STATUS_CHANGE',
      target_id: email,
      details: `Changed user ${email} status to ${status}`,
      timestamp: new Date().toISOString(),
    });
  }

  static async getAllParcels(
    filter: { delivery_status?: string; startDate?: string; endDate?: string },
    page: number,
    size: number,
  ) {
    const skip = (page - 1) * size;
    const query: any = {};

    if (filter.delivery_status && filter.delivery_status !== 'all') {
      query.delivery_status = filter.delivery_status;
    }

    if (filter.startDate || filter.endDate) {
      query.creation_date = {};
      if (filter.startDate) query.creation_date.$gte = new Date(filter.startDate).toISOString();
      if (filter.endDate) query.creation_date.$lte = new Date(filter.endDate).toISOString();
    }

    const totalItems = await ParcelModel.countDocuments(query);
    const parcels = await ParcelModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean();

    return { parcels, totalItems };
  }

  static async assignRiderToParcel(
    parcelId: string,
    riderId: string,
    adminEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const rider = await RiderModel.findOne({
      _id: new ObjectId(String(riderId)),
    }).lean();
    if (!rider) {
      return { success: false, message: 'Rider not found' };
    }

    const parcel = await ParcelModel.findOne({
      _id: new ObjectId(String(parcelId)),
    }).lean();
    if (!parcel) {
      return { success: false, message: 'Parcel not found' };
    }

    if (
      parcel.requiredVehicle &&
      rider.vehicleType &&
      parcel.requiredVehicle !== rider.vehicleType
    ) {
      return {
        success: false,
        message: `Vehicle mismatch: Parcel requires ${parcel.requiredVehicle}, but rider has ${rider.vehicleType}.`,
      };
    }

    const result = await ParcelModel.updateOne(
      { _id: new ObjectId(String(parcelId)) },
      {
        $set: {
          assigned_rider_id: rider._id,
          assigned_rider_name: rider.name,
          assigned_rider_email: rider.email,
          assigned_rider_phone: rider.phone,
          delivery_status: 'assigned',
        },
      },
    );

    if (result.modifiedCount === 0) {
      return { success: false, message: 'Parcel not found or already updated' };
    }

    await TrackingModel.create({
      trackingId: parcel.trackingId,
      status: 'assigned',
      details: `Parcel assigned to rider ${rider.name}`,
      location: 'Admin Dashboard',
      time: new Date().toISOString(),
    });

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'PARCEL_ASSIGNMENT',
      target_id: parcelId,
      details: `Assigned parcel ${parcel.trackingId} to rider ${rider.name} (${rider.email})`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: 'Rider assigned successfully' };
  }

  static async getMerchants(status?: string): Promise<any[]> {
    const query: any = {};
    if (status) query.status = status;

    return MerchantModel.find(query).sort({ createdAt: -1 }).lean();
  }

  static async updateMerchantStatus(
    id: string,
    status: string,
    adminEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const merchant = await MerchantModel.findOne({
      _id: new ObjectId(String(id)),
    }).lean();
    if (!merchant) {
      return { success: false, message: 'Merchant not found' };
    }

    await MerchantModel.updateOne(
      { _id: new ObjectId(String(id)) },
      { $set: { status: status as any, updatedAt: new Date().toISOString() } },
    );

    if (status === 'approved') {
      await UserModel.updateOne({ email: merchant.email }, { $set: { role: 'merchant' } });
    }

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'MERCHANT_STATUS_CHANGE',
      target_id: id,
      details: `Changed merchant ${merchant.businessName} status to ${status}`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: `Merchant status updated to ${status}` };
  }

  static async updateRiderStatus(
    id: string,
    status: string,
    adminEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const rider = await RiderModel.findOne({
      _id: new ObjectId(String(id)),
    }).lean();
    if (!rider) {
      return { success: false, message: 'Rider not found' };
    }

    await RiderModel.updateOne(
      { _id: new ObjectId(String(id)) },
      { $set: { status: status as any, updatedAt: new Date().toISOString() } },
    );

    if (status === 'approved') {
      await UserModel.updateOne({ email: rider.email }, { $set: { role: 'rider' } });
    } else if (status === 'rejected') {
      await UserModel.updateOne({ email: rider.email }, { $set: { role: 'user' } });
    }

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'RIDER_STATUS_CHANGE',
      target_id: id,
      details: `Changed rider ${rider.name} (${rider.email}) status to ${status}`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: `Rider status updated to ${status}` };
  }

  static async getFleetDistribution(): Promise<any[]> {
    return RiderModel.aggregate([{ $group: { _id: '$vehicleType', count: { $sum: 1 } } }]);
  }

  static async getPayouts(): Promise<any[]> {
    return CashoutModel.find().sort({ requested_at: -1 }).lean();
  }

  static async updatePayoutStatus(
    id: string,
    status: string,
    adminEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const payout = await CashoutModel.findOne({
      _id: new ObjectId(String(id)),
    }).lean();
    if (!payout) {
      return { success: false, message: 'Payout request not found' };
    }

    await CashoutModel.updateOne(
      { _id: new ObjectId(String(id)) },
      {
        $set: {
          status: status as any,
          processed_at: new Date().toISOString(),
          processed_by: adminEmail,
        },
      },
    );

    await NotificationModel.create({
      email: payout.rider_email,
      message: `Your payout request of ${payout.amount} BDT has been ${status}.`,
      time: new Date().toISOString(),
      isRead: false,
      type: 'payment',
    });

    await AuditModel.create({
      admin_email: adminEmail,
      action: 'PAYOUT_STATUS_CHANGE',
      target_id: id,
      details: `Set payout status for ${payout.rider_email} to ${status}`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: `Payout request ${status} successfully.` };
  }

  static async getAllUsers(search?: string, page: number = 1, size: number = 10) {
    const skip = (page - 1) * size;
    const query: any = { role: 'user' };

    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }

    const totalItems = await UserModel.countDocuments(query);
    const users = await UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(size).lean();

    return { users, totalItems };
  }
}
