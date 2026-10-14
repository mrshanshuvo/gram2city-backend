import axios from 'axios';
import admin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../../db/models';
import { refreshTokensCollection, RefreshTokenRecord } from '../../db/db';
import type { User } from '../../types/types';
import { FirebaseAuthResponse } from './auth.interface';
import { uploadToCloudinary } from '../../utils/upload';
import { config } from '../../config';

const googleOAuthClient = new OAuth2Client(config.GOOGLE_CLIENT_ID || undefined);

const API_KEY = config.FB_WEB_API_KEY;

export class AuthService {
  static async uploadProfileImage(file: Express.Multer.File): Promise<string> {
    return uploadToCloudinary(file, 'gram2city/avatars');
  }

  static async registerFirebaseUser(
    email: string,
    password: string,
  ): Promise<FirebaseAuthResponse> {
    const fbRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      { email, password, returnSecureToken: true },
    );
    return {
      idToken: fbRes.data.idToken,
      expiresIn: fbRes.data.expiresIn,
    };
  }

  static async createUserRecord(newUser: User): Promise<void> {
    await UserModel.create(newUser);
  }

  static async loginFirebaseUser(email: string, password: string): Promise<FirebaseAuthResponse> {
    const fbRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password, returnSecureToken: true },
    );
    return {
      idToken: fbRes.data.idToken,
      expiresIn: fbRes.data.expiresIn,
    };
  }

  static async getUserRecordByEmail(email: string): Promise<User | null> {
    return UserModel.findOne({ email }).lean() as unknown as User | null;
  }

  static async getFirebaseUserByEmail(email: string) {
    return admin.auth().getUserByEmail(email);
  }

  static async updateLastLogin(email: string): Promise<string> {
    const lastLogin = new Date().toISOString();
    await UserModel.updateOne({ email }, { $set: { last_login: lastLogin } });
    return lastLogin;
  }

  static async sendFirebaseVerification(idToken: string): Promise<void> {
    await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
      { requestType: 'VERIFY_EMAIL', idToken },
    );
  }

  static async deleteFirebaseUser(uid: string): Promise<void> {
    await admin.auth().deleteUser(uid);
  }

  static async deleteUserRecord(email: string): Promise<void> {
    await UserModel.deleteOne({ email });
  }

  static async sendFirebasePasswordReset(email: string): Promise<void> {
    await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
      { requestType: 'PASSWORD_RESET', email },
    );
  }

  static async createFirebaseUserAdmin(email: string, password: string, name: string) {
    return admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
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
    await refreshTokensCollection.insertOne({
      token,
      email,
      role,
      expiresAt,
      createdAt: new Date(),
    });
  }

  static async findRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
    return refreshTokensCollection.findOne({ token });
  }

  static async deleteRefreshToken(token: string): Promise<void> {
    await refreshTokensCollection.deleteOne({ token });
  }

  static async deleteUserRefreshTokens(email: string): Promise<void> {
    await refreshTokensCollection.deleteMany({ email });
  }

  // ─── Direct Google OAuth 2.0 Verification ──────────────────────────────────

  static async verifyGoogleIdToken(idToken: string) {
    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID ? config.GOOGLE_CLIENT_ID : undefined,
      });
      return ticket.getPayload();
    } catch (googleErr) {
      // Fallback for seamless transition: Verify via Firebase Admin SDK if token was from Firebase popup
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return {
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
        };
      } catch {
        throw googleErr;
      }
    }
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
