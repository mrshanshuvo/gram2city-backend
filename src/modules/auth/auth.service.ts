import { OAuth2Client } from 'google-auth-library';
import { UserModel, RefreshTokenModel, type RefreshToken } from '../../db/models';
import type { User } from '../../types/types';
import { uploadToCloudinary } from '../../utils/upload';
import { config } from '../../config';

const googleOAuthClient = new OAuth2Client(config.GOOGLE_CLIENT_ID || undefined);

export class AuthService {
  static async uploadProfileImage(file: Express.Multer.File): Promise<string> {
    return uploadToCloudinary(file, 'gram2city/avatars');
  }

  static async createUserRecord(newUser: User): Promise<void> {
    await UserModel.create(newUser);
  }

  static async getUserRecordByEmail(email: string): Promise<User | null> {
    return UserModel.findOne({ email }).lean() as unknown as User | null;
  }

  static async updateLastLogin(email: string): Promise<string> {
    const lastLogin = new Date().toISOString();
    await UserModel.updateOne({ email }, { $set: { last_login: lastLogin } });
    return lastLogin;
  }

  static async deleteUserRecord(email: string): Promise<void> {
    await UserModel.deleteOne({ email });
  }

  static async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  // ─── Dual-Token Architecture & Session Tracking ────────────────────────────

  static async saveRefreshToken(
    token: string,
    email: string,
    role: string,
    expiresAt: Date,
  ): Promise<void> {
    await RefreshTokenModel.create({
      token,
      email,
      role,
      expiresAt,
    });
  }

  static async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return RefreshTokenModel.findOne({ token }).lean();
  }

  static async deleteRefreshToken(token: string): Promise<void> {
    await RefreshTokenModel.deleteOne({ token });
  }

  static async deleteUserRefreshTokens(email: string): Promise<void> {
    await RefreshTokenModel.deleteMany({ email });
  }

  // ─── Direct Google OAuth 2.0 Verification ──────────────────────────────────

  static async verifyGoogleIdToken(idToken: string) {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID ? config.GOOGLE_CLIENT_ID : undefined,
    });
    return ticket.getPayload();
  }

  static async verifyGoogleAccessToken(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to verify Google access token');
    const data = (await res.json()) as { email: string; name?: string; picture?: string };
    return data;
  }
}
