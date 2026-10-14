/**
 * migrate-imgbb-to-cloudinary.ts
 *
 * One-shot migration script — finds every document with an i.ibb.co URL,
 * re-uploads it to Cloudinary, and updates the record in-place.
 *
 * Usage (from gram2city-server root):
 *   npx ts-node --transpile-only src/scripts/migrate-imgbb-to-cloudinary.ts
 *
 * Safe to re-run — Cloudinary URLs are never re-processed.
 */

require('dotenv').config();

const axios = require('axios');
const { MongoClient } = require('mongodb');
const cloudinaryPkg = require('cloudinary');
const cloudinary = cloudinaryPkg.v2;

// ─── Config ───────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI as string;
const DB_NAME = process.env.DB_NAME as string;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME as string;
const API_KEY = process.env.CLOUDINARY_API_KEY as string;
const API_SECRET = process.env.CLOUDINARY_API_SECRET as string;

if (!MONGODB_URI || !DB_NAME || !CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('❌ Missing required environment variables. Check your .env file.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Gram2City-migrator/1.0)',
      Referer: 'https://ibb.co/',
    },
  });
  return Buffer.from(res.data);
}

function uploadBufferToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'image',
          fetch_format: 'auto',
          quality: 'auto',
        },
        (err: any, result: any) => {
          if (err || !result) return reject(err ?? new Error('No Cloudinary result'));
          resolve(result.secure_url);
        },
      )
      .end(buffer);
  });
}

// ─── Targets ─────────────────────────────────────────────────────────────────
const targets = [
  { collection: 'banners', field: 'image', folder: 'gram2city/banners' },
  { collection: 'features', field: 'image', folder: 'gram2city/features' },
  {
    collection: 'testimonials',
    field: 'image',
    folder: 'gram2city/testimonials',
  },
  { collection: 'partners', field: 'logo', folder: 'gram2city/partners' },
  { collection: 'users', field: 'photoURL', folder: 'gram2city/avatars' },
  { collection: 'avatars', field: 'image', folder: 'gram2city/avatars' },
  { collection: 'messages', field: 'imageUrl', folder: 'gram2city/chat' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function migrate() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('✅ Connected to MongoDB\n');

  const db = client.db(DB_NAME);
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const target of targets) {
    const col = db.collection(target.collection);

    const docs = await col
      .find({ [target.field]: { $regex: 'i\\.ibb\\.co', $options: 'i' } })
      .toArray();

    if (docs.length === 0) {
      console.log(`⏭  ${target.collection}.${target.field} — no ImgBB URLs`);
      continue;
    }

    console.log(`\n📦 ${target.collection}.${target.field} — ${docs.length} record(s)`);

    for (const doc of docs) {
      const oldUrl: string = doc[target.field];
      const id = doc._id;

      try {
        process.stdout.write(`   ↳ [${id}] Downloading... `);
        const buffer = await downloadBuffer(oldUrl);

        process.stdout.write('Uploading... ');
        const newUrl = await uploadBufferToCloudinary(buffer, target.folder);

        await col.updateOne({ _id: id }, { $set: { [target.field]: newUrl } });
        console.log('✅');
        console.log(`      OLD: ${oldUrl}`);
        console.log(`      NEW: ${newUrl}`);
        totalUpdated++;
      } catch (err: any) {
        console.log('❌ FAILED');
        console.error(`      ${err?.message ?? err}`);
        totalFailed++;
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Updated : ${totalUpdated}`);
  console.log(`❌ Failed  : ${totalFailed}`);

  await client.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
