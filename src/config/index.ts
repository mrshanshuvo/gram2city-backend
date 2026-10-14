import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z
    .string()
    .refine((val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must be a valid MongoDB connection string',
    }),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters for security'),
  FB_SERVICE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_CURRENCY: z.string().default('usd'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  FB_WEB_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
};

export const config = parseEnv();
export type Config = z.infer<typeof envSchema>;
