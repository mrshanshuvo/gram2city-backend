import { ObjectId } from 'mongodb';

// ─── MongoDB Document Interfaces ────────────────────────────────────────────

export interface User {
  _id?: ObjectId;
  email: string;
  password?: string;
  name?: string;
  photoURL?: string;
  role?: 'user' | 'admin' | 'rider' | 'merchant' | 'superAdmin';
  phone?: string;
  address?: string;
  status?: 'active' | 'suspended' | 'pending';
  emailVerified?: boolean;
  isProfileComplete?: boolean;
  created_at?: string;
  last_login?: string;
}

export interface Parcel {
  _id?: ObjectId;
  trackingId: string;
  parcelName: string;
  parcelType?: string;
  created_by: string; // User Email
  weight: number;
  parcelWeight?: number; // Alias for weight used in frontend
  creation_date?: string;
  createdAt?: string;

  senderName?: string; // Added: For UI display
  senderAddress?: string;
  senderPhone?: string;
  senderContact?: string; // Alias for senderPhone used in frontend
  senderDistrict?: string;
  senderRegion?: string; // Alias for senderDistrict used in frontend
  senderServiceCenter?: string;
  deliveryDate?: string;

  receiverName: string;
  receiverPhone: string;
  receiverPhoneNumber?: string; // Alias for receiverPhone used in frontend
  deliveryAddress: string;
  receiverDistrict?: string;
  receiverRegion?: string; // Alias for receiverDistrict used in frontend
  receiverServiceCenter?: string;

  cost: number;
  rider_earning?: number;
  admin_profit?: number;
  payment_status?: 'paid' | 'unpaid';
  delivery_status?:
    | 'pending'
    | 'assigned'
    | 'on_the_way'
    | 'delivered'
    | 'cancelled'
    | 'returned'
    | 'not_collected'
    | 'picked_up';

  assigned_rider_id?: ObjectId;
  assigned_rider_name?: string;
  assigned_rider_email?: string;
  assigned_rider_phone?: string;

  picked_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  return_reason?: string;

  // Multi-Role Support
  merchantId?: ObjectId;
  requiredVehicle?: 'bike' | 'car' | 'mini_pickup' | 'large_pickup';
  codAmount?: number;
}

export interface Rider {
  _id?: ObjectId;
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  district?: string;
  region?: string;
  status: 'pending' | 'approved' | 'rejected';

  // Rider Metrics (Added for Admin Dashboard)
  average_rating?: number;
  total_delivered?: number;
  is_available?: boolean;

  // Vehicle Details
  vehicleType?: 'bike' | 'car' | 'mini_pickup' | 'large_pickup';
  vehicleNumber?: string;
  drivingLicense?: string;
}

export interface Merchant {
  _id?: ObjectId;
  userId: ObjectId;
  email: string;
  businessName: string;
  businessType?: string;
  tradeLicense?: string;
  logo?: string;
  address: string;
  district: string;
  phone: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  _id?: ObjectId;
  parcelId: ObjectId;
  email: string; // Customer Email
  transactionId: string;
  amount: number;
  paymentMethod?: string;
  paid_at: string;
  payment_time: string;
}

export interface Cashout {
  _id?: ObjectId;
  parcel_id?: ObjectId;
  rider_email: string;
  rider_name?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  processed_at?: string;
  processed_by?: string;
}

export interface TrackingUpdate {
  _id?: ObjectId;
  trackingId: string;
  status: string;
  details: string;
  location: string;
  time: string;
}

export interface Review {
  _id?: ObjectId;
  rider_email: string;
  rating: number;
  comment?: string;
  date?: string;
  parcelId?: string;
  user_email?: string;
  [key: string]: unknown;
}

export interface Notification {
  _id?: ObjectId;
  email: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'status_update' | 'payment' | 'admin_alert' | string;
}

// ─── NEW: Administrative Intelligence ────────────────────────────────────────

export interface AuditLog {
  _id?: ObjectId;
  admin_email: string;
  action: string; // e.g., "ROLE_CHANGE", "PARCEL_CANCEL", "RIDER_APPROVAL"
  target_id?: string | ObjectId;
  details: string;
  timestamp: string;
  ip_address?: string;
}

export interface Feedback {
  _id?: ObjectId;
  userEmail: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  category: 'service' | 'app' | 'rider' | 'other';
  timestamp: string;
  isResolved?: boolean;
}

export interface SystemSettings {
  _id?: ObjectId;
  base_delivery_fee: number;
  cost_per_kg: number;
  rider_commission_percentage: number;
  updated_at: string;
  updated_by: string;
}

export interface FAQ {
  _id?: ObjectId;
  question: string;
  answer: string;
  order?: number;
  category?: string;
  isActive: boolean;
  helpfulCount: number;
  createdAt: string;
}

export interface FAQVote {
  _id?: ObjectId;
  faqId: ObjectId;
  identifier: string; // IP or Email
  timestamp: string;
}

export interface ChatMessage {
  _id?: ObjectId;
  senderEmail: string;
  senderName: string;
  senderRole: string;
  receiverEmail: string;
  message: string;
  imageUrl?: string; // Added for image sharing
  timestamp: string;
  isRead: boolean;
  conversationId: string; // Combination of sorted emails (e.g. "email1_email2")
}

// ─── LANDING PAGE CONTENT ────────────────────────────────────────────────────

export interface BannerSlide {
  _id?: ObjectId;
  image: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  icon?: string; // Icon name from Lucide
  isActive: boolean;
  order: number;
}

export interface ServiceItem {
  _id?: ObjectId;
  title: string;
  description: string;
  image?: string; // New: Custom illustration path
  icon: string;
  color?: string;
  isActive: boolean;
  order: number;
}

export interface FeatureItem {
  _id?: ObjectId;
  title: string;
  description: string;
  image: string;
  icon: string;
  isActive: boolean;
  order: number;
}

export interface PartnerLogo {
  _id?: ObjectId;
  name: string;
  logo: string;
  isActive: boolean;
  order: number;
}

export interface ProcessStep {
  _id?: ObjectId;
  title: string;
  description: string;
  icon: string;
  steps: string[]; // Added sub-steps
  isActive: boolean;
  order: number;
}

export interface LandingConfig {
  _id?: ObjectId;
  merchantSection: {
    title: string;
    description: string;
    benefits: string[];
    ctaText: string;
    ctaLink: string;
  };
  contactInfo: {
    address: string;
    email: string;
    phone: string;
    socials: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
  };
}

export interface Avatar {
  _id?: ObjectId;
  url: string;
  name?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Address {
  _id?: ObjectId;
  userEmail: string;
  label: string; // e.g. "Home", "Office", "Main Warehouse"
  fullName: string;
  phone: string;
  address: string;
  district: string;
  region: string;
  isDefault: boolean;
  createdAt: string;
}

// ─── Express Request Augmentation ───────────────────────────────────────────

export interface AuthUser {
  email: string;
  role?: string;
  uid?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}
