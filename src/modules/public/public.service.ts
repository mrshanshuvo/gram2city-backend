import { ObjectId } from 'mongodb';
import {
  SettingsModel,
  TrackingModel,
  ProcessStepModel,
  LandingConfigModel,
  BannerModel,
  ServiceModel,
  FeatureModel,
  PartnerModel,
  TestimonialModel,
  WarehouseModel,
  NewsletterModel,
  RiderModel,
  MerchantModel,
  UserModel,
  ParcelModel,
} from '../../db/models';
import {
  ProcessStep,
  LandingConfig,
  BannerSlide,
  ServiceItem,
  FeatureItem,
  PartnerLogo,
  Warehouse,
  Merchant,
} from './public.interface';

interface GenericLandingModel {
  create: (doc: Record<string, unknown>) => Promise<{ insertedId?: ObjectId; _id?: ObjectId }>;
  updateOne: (
    filter: { _id: ObjectId },
    update: { $set: Record<string, unknown> },
  ) => Promise<{ matchedCount: number }>;
  deleteOne: (filter: { _id: ObjectId }) => Promise<{ deletedCount: number }>;
}

const modelMap: Record<string, GenericLandingModel> = {
  banners: BannerModel as unknown as GenericLandingModel,
  services: ServiceModel as unknown as GenericLandingModel,
  features: FeatureModel as unknown as GenericLandingModel,
  partners: PartnerModel as unknown as GenericLandingModel,
  'process-steps': ProcessStepModel as unknown as GenericLandingModel,
  testimonials: TestimonialModel as unknown as GenericLandingModel,
};

export class PublicService {
  // Public general endpoints
  static async getPublicSettings() {
    return SettingsModel.findOne({}).lean();
  }

  static async getPublicTracking(trackingId: string) {
    return TrackingModel.find({ trackingId }).sort({ timestamp: -1 }).lean();
  }

  static async getProcessSteps(showAll?: boolean): Promise<ProcessStep[]> {
    const query = showAll ? {} : { isActive: true };
    return ProcessStepModel.find(query).sort({ order: 1 }).lean() as unknown as ProcessStep[];
  }

  static async getLandingConfig(): Promise<LandingConfig | null> {
    return LandingConfigModel.findOne({}).lean() as unknown as LandingConfig | null;
  }

  static async updateLandingConfig(update: Partial<LandingConfig>) {
    return LandingConfigModel.updateOne({}, { $set: update }, { upsert: true });
  }

  static async getBanners(showAll?: boolean): Promise<BannerSlide[]> {
    const query = showAll ? {} : { isActive: true };
    return BannerModel.find(query).sort({ order: 1 }).lean() as unknown as BannerSlide[];
  }

  static async getServices(showAll?: boolean): Promise<ServiceItem[]> {
    const query = showAll ? {} : { isActive: true };
    return ServiceModel.find(query).sort({ order: 1 }).lean() as unknown as ServiceItem[];
  }

  static async getFeatures(showAll?: boolean): Promise<FeatureItem[]> {
    const query = showAll ? {} : { isActive: true };
    return FeatureModel.find(query).sort({ order: 1 }).lean() as unknown as FeatureItem[];
  }

  static async getPartners(showAll?: boolean): Promise<PartnerLogo[]> {
    const query = showAll ? {} : { isActive: true };
    return PartnerModel.find(query).sort({ order: 1 }).lean() as unknown as PartnerLogo[];
  }

  static async getTestimonials(showAll?: boolean): Promise<Record<string, unknown>[]> {
    const query = showAll ? {} : { isActive: true };
    return TestimonialModel.find(query).sort({ createdAt: -1 }).lean() as unknown as Record<
      string,
      unknown
    >[];
  }

  static async getStats() {
    const warehouses = (await WarehouseModel.find({}).lean()) as unknown as Warehouse[];
    const totalDistricts = [...new Set(warehouses.map((w) => w.district))];
    const activeHubs = warehouses.filter((w) => w.status === 'active').length;
    const expressZones = warehouses.filter((w) => w.status === 'limited').length;
    const approvedRiders = await RiderModel.countDocuments({
      status: 'approved',
    });

    return {
      districts: totalDistricts.length || 64,
      activeHubs: activeHubs || 0,
      expressZones: expressZones || 0,
      riders: approvedRiders || 0,
    };
  }

  static async subscribeNewsletter(email: string) {
    const existing = await NewsletterModel.findOne({ email }).lean();
    if (existing) {
      return { success: false, message: 'Already subscribed!' };
    }

    await NewsletterModel.create({
      email,
      subscribedAt: new Date().toISOString(),
    });

    return { success: true, message: 'Welcome to the family!' };
  }

  static async getNewsletterSubscribers(): Promise<Record<string, unknown>[]> {
    return NewsletterModel.find({}).sort({ subscribedAt: -1 }).lean() as unknown as Record<
      string,
      unknown
    >[];
  }

  static async getWarehouses(filter: {
    search?: string;
    district?: string;
    status?: string;
  }): Promise<Warehouse[]> {
    const query: Record<string, unknown> = {};

    if (filter.search) {
      query.$or = [
        { district: { $regex: filter.search, $options: 'i' } },
        { city: { $regex: filter.search, $options: 'i' } },
        { region: { $regex: filter.search, $options: 'i' } },
      ];
    }
    if (filter.district) query.district = filter.district;
    if (filter.status) query.status = filter.status;

    return WarehouseModel.find(query).lean() as unknown as Warehouse[];
  }

  // Merchant operations
  static async applyMerchant(data: Omit<Merchant, '_id'>) {
    const existing = await MerchantModel.findOne({ email: data.email }).lean();
    if (existing) {
      return { success: false, message: 'Merchant application already submitted.' };
    }

    const result = await MerchantModel.create(data);

    // Also update role if needed, or leave it as pending
    await UserModel.updateOne({ email: data.email }, { $set: { role: 'merchant' } });

    return {
      success: true,
      message: 'Application submitted successfully and is pending approval.',
      merchantId: (result as { _id?: unknown })._id,
    };
  }

  static async getMerchantProfile(email: string): Promise<Merchant | null> {
    return MerchantModel.findOne({
      email,
    }).lean() as unknown as Merchant | null;
  }

  static async getMerchantStats(email: string) {
    const merchant = await this.getMerchantProfile(email);
    if (!merchant) {
      return null;
    }

    const stats = await ParcelModel.aggregate([
      { $match: { merchantId: merchant._id } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalCODCollected: {
            $sum: {
              $cond: [{ $eq: ['$delivery_status', 'delivered'] }, '$codAmount', 0],
            },
          },
          pendingCOD: {
            $sum: {
              $cond: [{ $ne: ['$delivery_status', 'delivered'] }, '$codAmount', 0],
            },
          },
          deliveredCount: {
            $sum: {
              $cond: [{ $eq: ['$delivery_status', 'delivered'] }, 1, 0],
            },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        totalBookings: 0,
        totalCODCollected: 0,
        pendingCOD: 0,
        deliveredCount: 0,
      }
    );
  }

  // Generic landing CRUD helpers
  static async createLandingItem(name: string, item: Record<string, unknown>) {
    const MModel = modelMap[name];
    if (!MModel) throw new Error(`Model not found for: ${name}`);

    if (item.isActive === undefined) item.isActive = true;
    item.createdAt = new Date().toISOString();

    return MModel.create(item);
  }

  static async updateLandingItem(name: string, id: string, update: Record<string, unknown>) {
    const MModel = modelMap[name];
    if (!MModel) throw new Error(`Model not found for: ${name}`);

    return MModel.updateOne({ _id: new ObjectId(id) }, { $set: update });
  }

  static async deleteLandingItem(name: string, id: string) {
    const MModel = modelMap[name];
    if (!MModel) throw new Error(`Model not found for: ${name}`);

    return MModel.deleteOne({ _id: new ObjectId(id) });
  }
}
