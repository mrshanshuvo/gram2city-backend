import mongoose from 'mongoose';
import {
  MongoClient,
  ServerApiVersion,
  Collection,
  IndexSpecification,
  CreateIndexesOptions,
  Document,
  ObjectId,
} from 'mongodb';
import type {
  User,
  Parcel,
  Rider,
  Payment,
  Cashout,
  TrackingUpdate,
  Review,
  Notification,
  ChatMessage,
  Feedback,
  FAQ,
  FAQVote,
  BannerSlide,
  ServiceItem,
  FeatureItem,
  PartnerLogo,
  ProcessStep,
  LandingConfig,
  Avatar,
  Merchant,
  Address,
} from '../types/types';

import { config } from '../config';

// Re-export Mongoose Models
export * from './models';

// ─── MongoDB Client & Mongoose Connection ────────────────────────────────────

const client = new MongoClient(config.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db(config.DB_NAME);

// Native Collection Exports (for compatibility)
export const usersCollection = db.collection<User>('users');
export const parcelCollection = db.collection<Parcel>('parcels');
export const paymentCollection = db.collection<Payment>('payments');
export const ridersCollection = db.collection<Rider>('riders');
export const cashoutsCollection = db.collection<Cashout>('cashouts');
export const trackingCollection = db.collection<TrackingUpdate>('trackings');
export const reviewsCollection = db.collection<Review>('reviews');
export const notificationsCollection = db.collection<Notification>('notifications');
export const auditCollection = db.collection<Record<string, unknown>>('audit_logs');
export const settingsCollection = db.collection<Record<string, unknown>>('system_settings');
export const messagesCollection = db.collection<ChatMessage>('messages');
export const feedbackCollection = db.collection<Feedback>('feedback');
export const faqsCollection = db.collection<FAQ>('faqs');
export const faqVotesCollection = db.collection<FAQVote>('faq_votes');
export const bannersCollection = db.collection<BannerSlide>('banners');
export const servicesCollection = db.collection<ServiceItem>('services');
export const featuresCollection = db.collection<FeatureItem>('features');
export const partnersCollection = db.collection<PartnerLogo>('partners');
export const processStepsCollection = db.collection<ProcessStep>('process_steps');
export const landingConfigCollection = db.collection<LandingConfig>('landing_config');
export const avatarsCollection = db.collection<Avatar>('avatars');
export const merchantsCollection = db.collection<Merchant>('merchants');
export const warehousesCollection = db.collection('warehouses');
export const newsletterCollection = db.collection('newsletter');
export const testimonialsCollection = db.collection<Record<string, unknown>>('testimonials');
export const addressesCollection = db.collection<Address>('addresses');

export interface RefreshTokenRecord {
  token: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
}
export const refreshTokensCollection = db.collection<RefreshTokenRecord>('refresh_tokens');

// ─── DB Initialization (Mongoose + Indexing) ──────────────────────────────────
export const initDB = async () => {
  try {
    // Connect Mongoose ODM
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI, {
        dbName: config.DB_NAME,
      });
      console.log('✅ Mongoose ODM connected successfully');
    }

    interface IndexableCollection {
      dropIndex(name: string): Promise<unknown>;
      createIndex(keys: IndexSpecification, options?: CreateIndexesOptions): Promise<string>;
    }

    const dropIndexIfExists = async (collection: IndexableCollection, indexName: string) => {
      try {
        await collection.dropIndex(indexName);
      } catch {
        // Ignore if index doesn't exist
      }
    };

    const deduplicateCollection = async (collection: Collection<Document>, key: string) => {
      try {
        const duplicates = await collection
          .aggregate<{ _id: string; ids: ObjectId[]; count: number }>([
            {
              $group: {
                _id: `$${key}`,
                ids: { $push: '$_id' },
                count: { $sum: 1 },
              },
            },
            {
              $match: {
                count: { $gt: 1 },
              },
            },
          ])
          .toArray();

        for (const dup of duplicates) {
          const idsToDelete = dup.ids.slice(1);
          await collection.deleteMany({ _id: { $in: idsToDelete } });
        }
      } catch (err) {
        console.error(`Failed to deduplicate collection:`, err);
      }
    };

    const safeCreateIndex = async (
      collection: IndexableCollection,
      keys: IndexSpecification,
      options?: CreateIndexesOptions,
    ) => {
      try {
        await collection.createIndex(keys, options);
      } catch (err: unknown) {
        const indexError = err as { code?: number; codeName?: string };
        if (indexError?.code === 86 || indexError?.codeName === 'IndexKeySpecsConflict') {
          // If index spec conflicts, drop existing index and recreate
          try {
            const indexName = Object.keys(keys as Record<string, unknown>)
              .map((k) => `${k}_1`)
              .join('_');
            await collection.dropIndex(indexName);
            await collection.createIndex(keys, options);
          } catch {
            // ignore fallback error
          }
        }
      }
    };

    // Safely drop old non-unique or conflicting indexes before replacing them
    await dropIndexIfExists(usersCollection, 'email_1');
    await dropIndexIfExists(merchantsCollection, 'email_1');
    await dropIndexIfExists(merchantsCollection, 'userId_1');
    await dropIndexIfExists(ridersCollection, 'email_1');

    // Clean up any invalid null/empty email rider records if present
    await ridersCollection.deleteMany({
      $or: [{ email: null as unknown as string }, { email: { $exists: false } }],
    });

    // Deduplicate collections to prevent DuplicateKey index build errors
    await deduplicateCollection(db.collection('users'), 'email');
    await deduplicateCollection(db.collection('merchants'), 'email');
    await deduplicateCollection(db.collection('riders'), 'email');

    // 1. usersCollection
    await safeCreateIndex(usersCollection, { email: 1 }, { unique: true });

    // 2. merchantsCollection
    await safeCreateIndex(merchantsCollection, { email: 1 }, { unique: true });
    await safeCreateIndex(merchantsCollection, { userId: 1 });

    // 3. ridersCollection
    await safeCreateIndex(ridersCollection, { email: 1 }, { unique: true, sparse: true });

    // 4. parcelCollection
    await parcelCollection.createIndex({ trackingId: 1 }, { unique: true });
    await parcelCollection.createIndex({
      assigned_rider_email: 1,
      delivery_status: 1,
    });
    await parcelCollection.createIndex({
      assigned_rider_id: 1,
      delivery_status: 1,
    });
    await parcelCollection.createIndex({ created_by: 1, payment_status: 1 });

    // 5. trackingCollection
    await trackingCollection.createIndex({ trackingId: 1 });

    // 6. payments & cashouts
    await paymentCollection.createIndex({ parcelId: 1 });
    await paymentCollection.createIndex({ email: 1 });
    await cashoutsCollection.createIndex({ rider_email: 1, status: 1 });

    // 7. reviews & notifications
    await reviewsCollection.createIndex({ rider_email: 1 });
    await notificationsCollection.createIndex({ email: 1, isRead: 1 });

    // 8. messages
    await messagesCollection.createIndex({ conversationId: 1, timestamp: 1 });
    await messagesCollection.createIndex({ senderEmail: 1 });
    await messagesCollection.createIndex({ receiverEmail: 1 });

    // 9. addresses
    await addressesCollection.createIndex({ userEmail: 1 });

    // 10. refresh tokens (with TTL index for automatic expiry cleanup)
    await safeCreateIndex(refreshTokensCollection, { token: 1 }, { unique: true });
    await safeCreateIndex(refreshTokensCollection, { expiresAt: 1 }, { expireAfterSeconds: 0 });
    await safeCreateIndex(refreshTokensCollection, { email: 1 });

    console.log('✅ Database indexes & Mongoose models initialized smoothly');
  } catch (error) {
    console.error('❌ Database indexing / Mongoose initialization failed:', error);
  }
};
