import { UserModel, RiderModel, MerchantModel } from '../db/models';
import { initDB, closeDB } from '../db/db';
import type { User } from '../types/types';

const demoAccounts = [
  {
    email: 'admin@gram2city.com',
    password: 'Admin123!',
    displayName: 'Gram2City Super Admin',
    role: 'admin',
  },
  {
    email: 'rider@gram2city.com',
    password: 'Rider123!',
    displayName: 'Rahim (Gram Rider)',
    role: 'rider',
    phone: '01711002233',
    vehicle: 'Bike',
  },
  {
    email: 'merchant@gram2city.com',
    password: 'Merchant123!',
    displayName: 'Organic BD Shop',
    role: 'merchant',
    phone: '01822334455',
  },
  {
    email: 'user@gram2city.com',
    password: 'User123!',
    displayName: 'Anisur Rahman',
    role: 'user',
  },
];

async function seed() {
  console.log('🌱 Initializing Database Connection & Indexing...');
  await initDB();

  for (const account of demoAccounts) {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(account.password, 10);

    // Upsert User in MongoDB via UserModel with hashed password
    await UserModel.updateOne(
      { email: account.email },
      {
        $set: {
          email: account.email,
          password: hashedPassword,
          name: account.displayName,
          role: account.role as User['role'],
          photoURL: `https://api.dicebear.com/7.x/lorelei/svg?seed=${account.role}`,
          isProfileComplete: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    // Role-specific records
    if (account.role === 'rider') {
      await RiderModel.updateOne(
        { email: account.email },
        {
          $set: {
            email: account.email,
            name: account.displayName,
            phone: account.phone || '01711002233',
            vehicleType: 'bike',
            status: 'approved',
            is_available: true,
            district: 'Dhaka',
            region: 'Dhaka',
            average_rating: 5.0,
            total_delivered: 24,
          },
        },
        { upsert: true },
      );
    }

    if (account.role === 'merchant') {
      await MerchantModel.updateOne(
        { email: account.email },
        {
          $set: {
            email: account.email,
            businessName: account.displayName,
            businessType: 'Retail',
            phone: account.phone || '01822334455',
            address: 'Farmgate, Tejgaon',
            district: 'Dhaka',
            status: 'approved',
          },
        },
        { upsert: true },
      );
    }
  }

  console.log('🎉 Demo Seed Completed Successfully!');
  await closeDB();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seed error:', err);
  await closeDB();
  process.exit(1);
});
