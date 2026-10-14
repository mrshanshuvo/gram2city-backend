import { usersCollection, ridersCollection, merchantsCollection, initDB } from '../db/db';
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

    // Upsert User in MongoDB usersCollection with hashed password
    await usersCollection.updateOne(
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
      await ridersCollection.updateOne(
        { email: account.email },
        {
          $set: {
            email: account.email,
            name: account.displayName,
            phone: account.phone,
            vehicle: account.vehicle,
            status: 'approved',
            workStatus: 'available',
            totalEarnings: 4500,
            cashoutPending: 0,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    if (account.role === 'merchant') {
      await merchantsCollection.updateOne(
        { email: account.email },
        {
          $set: {
            email: account.email,
            storeName: account.displayName,
            phone: account.phone,
            status: 'approved',
            codBalance: 12500,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );
    }
  }

  console.log('🎉 Demo Seed Completed Successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
