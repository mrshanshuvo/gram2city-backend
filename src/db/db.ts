import mongoose from 'mongoose';
import {
  Collection,
  IndexSpecification,
  CreateIndexesOptions,
  Document,
  ObjectId,
  Db,
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

// ─── Raw Database Accessor ───────────────────────────────────────────────────
/**
 * Exposes the underlying MongoDB native Db instance from Mongoose.
 * Use strictly for bulk analytics, large-scale migrations, or raw aggregation pipelines.
 */
export const getRawDB = (): Db => {
  if (!mongoose.connection.db) {
    throw new Error('Database not connected. Please invoke initDB() first.');
  }
  return mongoose.connection.db as unknown as Db;
};

// ─── Backwards-Compatible Collection Proxies ─────────────────────────────────
// These proxies delegate dynamically to mongoose.connection.db for zero-overhead compatibility.
const createCollectionProxy = <T extends Document>(collectionName: string): Collection<T> => {
  return new Proxy({} as Collection<T>, {
    get(_target, prop) {
      const col = getRawDB().collection<T>(collectionName);
      const value = (col as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(col) : value;
    },
  });
};

export const usersCollection = createCollectionProxy<User>('users');
export const parcelCollection = createCollectionProxy<Parcel>('parcels');
export const paymentCollection = createCollectionProxy<Payment>('payments');
export const ridersCollection = createCollectionProxy<Rider>('riders');
export const cashoutsCollection = createCollectionProxy<Cashout>('cashouts');
export const trackingCollection = createCollectionProxy<TrackingUpdate>('trackings');
export const reviewsCollection = createCollectionProxy<Review>('reviews');
export const notificationsCollection = createCollectionProxy<Notification>('notifications');
export const auditCollection = createCollectionProxy<Record<string, unknown>>('audit_logs');
export const settingsCollection = createCollectionProxy<Record<string, unknown>>('system_settings');
export const messagesCollection = createCollectionProxy<ChatMessage>('messages');
export const feedbackCollection = createCollectionProxy<Feedback>('feedback');
export const faqsCollection = createCollectionProxy<FAQ>('faqs');
export const faqVotesCollection = createCollectionProxy<FAQVote>('faq_votes');
export const bannersCollection = createCollectionProxy<BannerSlide>('banners');
export const servicesCollection = createCollectionProxy<ServiceItem>('services');
export const featuresCollection = createCollectionProxy<FeatureItem>('features');
export const partnersCollection = createCollectionProxy<PartnerLogo>('partners');
export const processStepsCollection = createCollectionProxy<ProcessStep>('process_steps');
export const landingConfigCollection = createCollectionProxy<LandingConfig>('landing_config');
export const avatarsCollection = createCollectionProxy<Avatar>('avatars');
export const merchantsCollection = createCollectionProxy<Merchant>('merchants');
export const warehousesCollection = createCollectionProxy<Document>('warehouses');
export const newsletterCollection = createCollectionProxy<Document>('newsletter');
export const testimonialsCollection =
  createCollectionProxy<Record<string, unknown>>('testimonials');
export const addressesCollection = createCollectionProxy<Address>('addresses');

export interface RefreshTokenRecord {
  token: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
}
export const refreshTokensCollection = createCollectionProxy<RefreshTokenRecord>('refresh_tokens');

// ─── DB Initialization (Mongoose + Indexing) ──────────────────────────────────
export const initDB = async (): Promise<void> => {
  try {
    // Connect Mongoose ODM (single unified connection pool)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI, {
        dbName: config.DB_NAME,
      });
      console.log('✅ Mongoose ODM connected successfully (Unified Driver Pool)');
    }

    const rawDb = getRawDB();

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

    const usersCol = rawDb.collection('users');
    const merchantsCol = rawDb.collection('merchants');
    const ridersCol = rawDb.collection('riders');
    const parcelCol = rawDb.collection('parcels');
    const trackingCol = rawDb.collection('trackings');
    const paymentCol = rawDb.collection('payments');
    const cashoutsCol = rawDb.collection('cashouts');
    const reviewsCol = rawDb.collection('reviews');
    const notificationsCol = rawDb.collection('notifications');
    const messagesCol = rawDb.collection('messages');
    const addressesCol = rawDb.collection('addresses');
    const refreshTokensCol = rawDb.collection('refresh_tokens');

    // Safely drop old non-unique or conflicting indexes before replacing them
    await dropIndexIfExists(usersCol, 'email_1');
    await dropIndexIfExists(merchantsCol, 'email_1');
    await dropIndexIfExists(merchantsCol, 'userId_1');
    await dropIndexIfExists(ridersCol, 'email_1');

    // Clean up any invalid null/empty email rider records if present
    await ridersCol.deleteMany({
      $or: [{ email: null as unknown as string }, { email: { $exists: false } }],
    });

    // Deduplicate collections to prevent DuplicateKey index build errors
    await deduplicateCollection(usersCol, 'email');
    await deduplicateCollection(merchantsCol, 'email');
    await deduplicateCollection(ridersCol, 'email');

    // 1. users
    await safeCreateIndex(usersCol, { email: 1 }, { unique: true });

    // 2. merchants
    await safeCreateIndex(merchantsCol, { email: 1 }, { unique: true });
    await safeCreateIndex(merchantsCol, { userId: 1 });

    // 3. riders
    await safeCreateIndex(ridersCol, { email: 1 }, { unique: true, sparse: true });

    // 4. parcels
    await parcelCol.createIndex({ trackingId: 1 }, { unique: true });
    await parcelCol.createIndex({
      assigned_rider_email: 1,
      delivery_status: 1,
    });
    await parcelCol.createIndex({
      assigned_rider_id: 1,
      delivery_status: 1,
    });
    await parcelCol.createIndex({ created_by: 1, payment_status: 1 });

    // 5. trackings
    await trackingCol.createIndex({ trackingId: 1 });

    // 6. payments & cashouts
    await paymentCol.createIndex({ parcelId: 1 });
    await paymentCol.createIndex({ email: 1 });
    await cashoutsCol.createIndex({ rider_email: 1, status: 1 });

    // 7. reviews & notifications
    await reviewsCol.createIndex({ rider_email: 1 });
    await notificationsCol.createIndex({ email: 1, isRead: 1 });

    // 8. messages
    await messagesCol.createIndex({ conversationId: 1, timestamp: 1 });
    await messagesCol.createIndex({ senderEmail: 1 });
    await messagesCol.createIndex({ receiverEmail: 1 });

    // 9. addresses
    await addressesCol.createIndex({ userEmail: 1 });

    // 10. refresh tokens (with TTL index for automatic expiry cleanup)
    await safeCreateIndex(refreshTokensCol, { token: 1 }, { unique: true });
    await safeCreateIndex(refreshTokensCol, { expiresAt: 1 }, { expireAfterSeconds: 0 });
    await safeCreateIndex(refreshTokensCol, { email: 1 });

    console.log('✅ Database indexes & Mongoose models initialized smoothly');
  } catch (error) {
    console.error('❌ Database indexing / Mongoose initialization failed:', error);
  }
};

/**
 * Gracefully disconnect Mongoose ODM.
 */
export const closeDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('✅ Database connection closed cleanly');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};
