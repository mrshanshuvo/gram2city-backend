import { ObjectId } from 'mongodb';

export interface Rider {
  _id?: ObjectId;
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  district?: string;
  region?: string;
  status: 'pending' | 'approved' | 'rejected';

  // Rider Metrics
  average_rating?: number;
  total_delivered?: number;
  is_available?: boolean;

  // Vehicle Details
  vehicleType?: 'bike' | 'car' | 'mini_pickup' | 'large_pickup';
  vehicleNumber?: string;
  drivingLicense?: string;
}

export interface Cashout {
  _id?: ObjectId;
  parcel_id?: ObjectId;
  trackingId?: string;
  parcel_name?: string;
  rider_email: string;
  rider_name?: string;
  amount: number;
  earning?: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  cashed_out_at?: string;
  processed_at?: string;
  processed_by?: string;
}
