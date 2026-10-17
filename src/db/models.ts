import { Schema, model } from 'mongoose';
import type {
  User,
  Parcel,
  Rider,
  Merchant,
  Payment,
  Cashout,
  TrackingUpdate,
  Review,
  Notification,
  AuditLog,
  Feedback,
  SystemSettings,
  FAQ,
  FAQVote,
  BannerSlide,
  ServiceItem,
  FeatureItem,
  PartnerLogo,
  ProcessStep,
  LandingConfig,
  Avatar,
  ChatMessage,
  Address,
} from '../types/types';

// ─── 1. User Schema ─────────────────────────────────────────────────────────
const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    photoURL: { type: String },
    role: {
      type: String,
      enum: ['user', 'admin', 'rider', 'merchant', 'superAdmin'],
      default: 'user',
    },
    phone: { type: String },
    address: { type: String },
    status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' },
    emailVerified: { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false },
    created_at: { type: String, default: () => new Date().toISOString() },
    last_login: { type: String },
  },
  { timestamps: true, collection: 'users' },
);

// ─── 2. Parcel Schema ───────────────────────────────────────────────────────
const parcelSchema = new Schema<Parcel>(
  {
    trackingId: { type: String, required: true, unique: true, index: true },
    parcelName: { type: String, required: true },
    parcelType: { type: String, default: 'Not-Document' },
    created_by: { type: String, required: true, index: true },
    weight: { type: Number, required: true },
    parcelWeight: { type: Number },
    creation_date: { type: String, default: () => new Date().toISOString() },
    createdAt: { type: String, default: () => new Date().toISOString() },

    senderName: { type: String },
    senderAddress: { type: String },
    senderPhone: { type: String },
    senderContact: { type: String },
    senderDistrict: { type: String },
    senderRegion: { type: String },
    senderServiceCenter: { type: String },
    deliveryDate: { type: String },

    receiverName: { type: String, required: true },
    receiverPhone: { type: String, required: true },
    receiverPhoneNumber: { type: String },
    deliveryAddress: { type: String, required: true },
    receiverDistrict: { type: String },
    receiverRegion: { type: String },
    receiverServiceCenter: { type: String },

    cost: { type: Number, required: true },
    rider_earning: { type: Number },
    admin_profit: { type: Number },
    payment_status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid', index: true },
    delivery_status: {
      type: String,
      enum: [
        'pending',
        'assigned',
        'on_the_way',
        'delivered',
        'cancelled',
        'returned',
        'not_collected',
        'picked_up',
      ],
      default: 'not_collected',
      index: true,
    },

    assigned_rider_id: { type: Schema.Types.ObjectId, ref: 'Rider', index: true },
    assigned_rider_name: { type: String },
    assigned_rider_email: { type: String, index: true },
    assigned_rider_phone: { type: String },

    picked_at: { type: String },
    delivered_at: { type: String },
    cancelled_at: { type: String },
    return_reason: { type: String },

    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant' },
    requiredVehicle: {
      type: String,
      enum: ['bike', 'car', 'mini_pickup', 'large_pickup'],
      default: 'bike',
    },
    codAmount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'parcels' },
);

// ─── 3. Rider Schema ────────────────────────────────────────────────────────
const riderSchema = new Schema<Rider>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    photoURL: { type: String },
    district: { type: String },
    region: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

    average_rating: { type: Number, default: 5.0 },
    total_delivered: { type: Number, default: 0 },
    is_available: { type: Boolean, default: true },

    vehicleType: {
      type: String,
      enum: ['bike', 'car', 'mini_pickup', 'large_pickup'],
      default: 'bike',
    },
    vehicleNumber: { type: String },
    drivingLicense: { type: String },
  },
  { timestamps: true, collection: 'riders' },
);

// ─── 4. Merchant Schema ──────────────────────────────────────────────────────
const merchantSchema = new Schema<Merchant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true },
    businessType: { type: String },
    tradeLicense: { type: String },
    logo: { type: String },
    address: { type: String, required: true },
    district: { type: String, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended', 'rejected'],
      default: 'pending',
    },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String },
  },
  { timestamps: true, collection: 'merchants' },
);

// ─── 5. Payment Schema ──────────────────────────────────────────────────────
const paymentSchema = new Schema<Payment>(
  {
    parcelId: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    email: { type: String, required: true, index: true },
    transactionId: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'card' },
    paid_at: { type: String, default: () => new Date().toISOString() },
    payment_time: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'payments' },
);

// ─── 6. Cashout Schema ──────────────────────────────────────────────────────
const cashoutSchema = new Schema<Cashout>(
  {
    parcel_id: { type: Schema.Types.ObjectId, ref: 'Parcel' },
    trackingId: { type: String },
    parcel_name: { type: String },
    rider_email: { type: String, required: true, index: true },
    rider_name: { type: String },
    amount: { type: Number, required: true },
    earning: { type: Number },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requested_at: { type: String, default: () => new Date().toISOString() },
    cashed_out_at: { type: String },
    processed_at: { type: String },
    processed_by: { type: String },
  },
  { timestamps: true, collection: 'cashouts' },
);

// ─── 7. Tracking Schema ──────────────────────────────────────────────────────
const trackingSchema = new Schema<TrackingUpdate>(
  {
    trackingId: { type: String, required: true, index: true },
    status: { type: String, required: true },
    details: { type: String, required: true },
    location: { type: String, default: 'Primary Hub' },
    time: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'trackings' },
);

// ─── 8. Review Schema ────────────────────────────────────────────────────────
const reviewSchema = new Schema<Review>(
  {
    rider_email: { type: String, required: true, index: true },
    rating: { type: Number, required: true },
    comment: { type: String },
    date: { type: String, default: () => new Date().toISOString() },
    parcelId: { type: String },
    user_email: { type: String },
  },
  { timestamps: true, collection: 'reviews' },
);

// ─── 9. Notification Schema ──────────────────────────────────────────────────
const notificationSchema = new Schema<Notification>(
  {
    email: { type: String, required: true, index: true },
    message: { type: String, required: true },
    time: { type: String, default: () => new Date().toISOString() },
    isRead: { type: Boolean, default: false, index: true },
    type: { type: String, default: 'status_update' },
  },
  { timestamps: true, collection: 'notifications' },
);

// ─── 10. Audit Log Schema ────────────────────────────────────────────────────
const auditSchema = new Schema<AuditLog>(
  {
    admin_email: { type: String, required: true },
    action: { type: String, required: true },
    target_id: { type: Schema.Types.Mixed },
    details: { type: String, required: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    ip_address: { type: String },
  },
  { timestamps: true, collection: 'audit_logs' },
);

// ─── 11. System Settings Schema ──────────────────────────────────────────────
const settingsSchema = new Schema<SystemSettings>(
  {
    base_delivery_fee: { type: Number, default: 50 },
    cost_per_kg: { type: Number, default: 20 },
    rider_commission_percentage: { type: Number, default: 15 },
    updated_at: { type: String, default: () => new Date().toISOString() },
    updated_by: { type: String, default: 'system' },
  },
  { timestamps: true, collection: 'system_settings' },
);

// ─── 12. Chat Message Schema ─────────────────────────────────────────────────
const chatSchema = new Schema<ChatMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderEmail: { type: String, required: true, index: true },
    senderName: { type: String },
    senderRole: { type: String },
    receiverEmail: { type: String, required: true, index: true },
    message: { type: String },
    imageUrl: { type: String },
    timestamp: { type: String, default: () => new Date().toISOString() },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'messages' },
);

// ─── 13. Feedback Schema ─────────────────────────────────────────────────────
const feedbackSchema = new Schema<Feedback>(
  {
    userEmail: { type: String, required: true },
    userName: { type: String },
    rating: { type: Number },
    comment: { type: String },
    category: { type: String, default: 'service' },
    timestamp: { type: String, default: () => new Date().toISOString() },
    isResolved: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'feedback' },
);

// ─── 14. FAQ & Votes Schema ──────────────────────────────────────────────────
const faqSchema = new Schema<FAQ>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'General' },
    order: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'faqs' },
);

const faqVoteSchema = new Schema<FAQVote>(
  {
    faqId: { type: Schema.Types.ObjectId, ref: 'FAQ', required: true },
    identifier: { type: String, required: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'faq_votes' },
);

// ─── 15. CMS Landing Schemas ─────────────────────────────────────────────────
const bannerSchema = new Schema<BannerSlide>(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    image: { type: String, required: true },
    ctaText: { type: String },
    ctaLink: { type: String },
    icon: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'banners' },
);

const serviceSchema = new Schema<ServiceItem>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    image: { type: String },
    color: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'services' },
);

const featureSchema = new Schema<FeatureItem>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    image: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'features' },
);

const partnerSchema = new Schema<PartnerLogo>(
  {
    name: { type: String, required: true },
    logo: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'partners' },
);

const processStepSchema = new Schema<ProcessStep>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    steps: [{ type: String }],
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'process_steps' },
);

const landingConfigSchema = new Schema<LandingConfig>(
  {
    merchantSection: { type: Schema.Types.Mixed },
    contactInfo: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'landing_config' },
);

const avatarSchema = new Schema<Avatar>(
  {
    name: { type: String },
    url: { type: String, required: true },
    category: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'avatars' },
);

const warehouseSchema = new Schema(
  {
    region: { type: String, required: true },
    district: { type: String, required: true },
    covered_area: [{ type: String }],
  },
  { timestamps: true, collection: 'warehouses' },
);

const newsletterSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    subscribedAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'newsletter' },
);

const testimonialSchema = new Schema(
  {
    name: { type: String, required: true },
    role: { type: String },
    avatar: { type: String },
    rating: { type: Number, default: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true, collection: 'testimonials' },
);

const addressSchema = new Schema<Address>(
  {
    userEmail: { type: String, required: true, index: true },
    label: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    region: { type: String, required: true },
    district: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: 'addresses' },
);

// ─── 27. Refresh Token Schema (TTL Automatic Expiration) ────────────────────
export interface RefreshToken {
  token: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const refreshTokenSchema = new Schema<RefreshToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    role: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: 'refresh_tokens' },
);

// ─── Exported Mongoose Models ────────────────────────────────────────────────
export const UserModel = model<User>('User', userSchema);
export const ParcelModel = model<Parcel>('Parcel', parcelSchema);
export const RiderModel = model<Rider>('Rider', riderSchema);
export const MerchantModel = model<Merchant>('Merchant', merchantSchema);
export const PaymentModel = model<Payment>('Payment', paymentSchema);
export const CashoutModel = model<Cashout>('Cashout', cashoutSchema);
export const TrackingModel = model<TrackingUpdate>('TrackingUpdate', trackingSchema);
export const ReviewModel = model<Review>('Review', reviewSchema);
export const NotificationModel = model<Notification>('Notification', notificationSchema);
export const AuditModel = model<AuditLog>('AuditLog', auditSchema);
export const SettingsModel = model<SystemSettings>('SystemSettings', settingsSchema);
export const MessageModel = model<ChatMessage>('ChatMessage', chatSchema);
export const FeedbackModel = model<Feedback>('Feedback', feedbackSchema);
export const FAQModel = model<FAQ>('FAQ', faqSchema);
export const FAQVoteModel = model<FAQVote>('FAQVote', faqVoteSchema);
export const BannerModel = model<BannerSlide>('Banner', bannerSchema);
export const ServiceModel = model<ServiceItem>('Service', serviceSchema);
export const FeatureModel = model<FeatureItem>('Feature', featureSchema);
export const PartnerModel = model<PartnerLogo>('Partner', partnerSchema);
export const ProcessStepModel = model<ProcessStep>('ProcessStep', processStepSchema);
export const LandingConfigModel = model<LandingConfig>('LandingConfig', landingConfigSchema);
export const AvatarModel = model<Avatar>('Avatar', avatarSchema);
export const WarehouseModel = model('Warehouse', warehouseSchema);
export const NewsletterModel = model('Newsletter', newsletterSchema);
export const TestimonialModel = model('Testimonial', testimonialSchema);
export const AddressModel = model<Address>('Address', addressSchema);
export const RefreshTokenModel = model<RefreshToken>('RefreshToken', refreshTokenSchema);
