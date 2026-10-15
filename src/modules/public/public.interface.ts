import { ObjectId } from 'mongodb';

export interface BannerSlide {
  _id?: ObjectId;
  image: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  icon?: string;
  isActive: boolean;
  order: number;
}

export interface ServiceItem {
  _id?: ObjectId;
  title: string;
  description: string;
  image?: string;
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
  steps: string[];
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

export interface Merchant {
  _id?: ObjectId;
  userId?: ObjectId;
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

export interface Warehouse {
  _id?: ObjectId;
  name: string;
  district: string;
  city: string;
  region: string;
  status: 'active' | 'limited' | 'inactive';
}
