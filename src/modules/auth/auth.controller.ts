import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { User } from '../../types/types';
import { config } from '../../config';

const REFRESH_COOKIE_NAME = 'gram2city_refresh_token';

const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name, photoURL: bodyPhotoURL } = req.body;
  let photoURL = bodyPhotoURL || '';

  try {
    const existingUser = await AuthService.getUserRecordByEmail(email);
    if (existingUser) {
      return res.status(400).send({
        success: false,
        message: 'This email is already registered.',
      });
    }

    if (req.file) {
      try {
        photoURL = await AuthService.uploadProfileImage(req.file);
      } catch (imgError) {
        console.error('Profile image upload error:', imgError);
      }
    }

    const hashedPassword = await AuthService.hashPassword(password);

    const newUser: User = {
      email,
      password: hashedPassword,
      name,
      photoURL: photoURL || `https://api.dicebear.com/7.x/lorelei/svg?seed=${email}`,
      role: 'user',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };
    await AuthService.createUserRecord(newUser);

    const { generateAccessToken, generateRefreshToken } = await import('../../utils/jwt');
    const token = generateAccessToken({ email: newUser.email, role: 'user' });
    const refreshToken = generateRefreshToken({ email: newUser.email, role: 'user' });

    await AuthService.saveRefreshToken(
      refreshToken,
      newUser.email,
      'user',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    setRefreshCookie(res, refreshToken);

    res.status(201).send({
      success: true,
      message: 'Registration successful! Welcome to Gram2City.',
      token,
      role: newUser.role,
      user: {
        email: newUser.email,
        name: newUser.name,
        photoURL: newUser.photoURL,
        role: newUser.role,
      },
    });
  } catch (error: unknown) {
    console.error('Unexpected Register Error:', error);
    res.status(500).send({
      success: false,
      message: 'An unexpected error occurred during registration.',
    });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await AuthService.getUserRecordByEmail(email);

    if (!user) {
      // Fallback: Check if Firebase user exists
      try {
        const fbLogin = await AuthService.loginFirebaseUser(email, password);
        const { idToken, expiresIn } = fbLogin;
        return res.send({
          success: true,
          message: 'Login successful',
          token: idToken,
          role: 'user',
          expiresIn,
        });
      } catch {
        return res.status(401).send({
          success: false,
          message: 'Invalid email or password.',
        });
      }
    }

    if (user.password) {
      const isMatch = await AuthService.comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).send({
          success: false,
          message: 'Invalid email or password.',
        });
      }
    }

    const { generateAccessToken, generateRefreshToken } = await import('../../utils/jwt');
    const token = generateAccessToken({ email: user.email, role: user.role || 'user' });
    const refreshToken = generateRefreshToken({ email: user.email, role: user.role || 'user' });

    await AuthService.saveRefreshToken(
      refreshToken,
      user.email,
      user.role || 'user',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    setRefreshCookie(res, refreshToken);
    const lastLogin = await AuthService.updateLastLogin(email);

    res.send({
      success: true,
      message: 'Login successful',
      token,
      role: user.role || 'user',
      lastLogin,
      user: {
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error('Login Error:', error);
    res.status(401).send({ success: false, message: 'Login failed.' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).send({ success: false, message: 'Unauthorized' });
    }
    const user = await AuthService.getUserRecordByEmail(email);

    if (!user) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    res.send({
      success: true,
      user: {
        ...user,
        emailVerified: req.user?.email_verified || false,
      },
    });
  } catch {
    res.status(500).send({ success: false, message: 'Server error' });
  }
};

export const sendVerification = async (req: Request, res: Response) => {
  try {
    const idToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!idToken) {
      return res.status(400).send({ success: false, message: 'Token is required.' });
    }

    await AuthService.sendFirebaseVerification(idToken);

    res.send({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } } } };
    res.status(400).send({
      success: false,
      message: err.response?.data?.error?.message || 'Failed to send verification email.',
    });
  }
};

export const deleteMe = async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid || !email) {
      return res.status(401).send({ success: false, message: 'Unauthorized' });
    }

    // 1. Delete from Firebase
    await AuthService.deleteFirebaseUser(uid);

    // 2. Delete from MongoDB
    await AuthService.deleteUserRecord(email);

    res.send({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).send({ success: false, message: 'Failed to delete account.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ success: false, message: 'Email is required.' });

  try {
    await AuthService.sendFirebasePasswordReset(email);
    res.send({
      success: true,
      message: 'A password reset link has been sent to your email.',
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } } } };
    const fbErrMsg = err.response?.data?.error?.message || '';
    let message = 'Failed to send reset email.';

    if (fbErrMsg.includes('EMAIL_NOT_FOUND')) message = 'No account found with this email address.';
    else if (fbErrMsg.includes('INVALID_EMAIL')) message = 'Please enter a valid email address.';

    res.status(400).send({ success: false, message });
  }
};

export const adminCreateUser = async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).send({
      success: false,
      message: 'All fields (email, password, name, role) are required.',
    });
  }

  try {
    // 1. Create in Firebase
    const fbUser = await AuthService.createFirebaseUserAdmin(email, password, name);

    // 2. Save to MongoDB
    const newUser: User = {
      email,
      name,
      photoURL: '',
      role: role as User['role'],
      created_at: new Date().toISOString(),
      last_login: '',
    };
    await AuthService.createUserRecord(newUser);

    res.status(201).send({
      success: true,
      message: `Successfully onboarded new ${role}: ${name}`,
      uid: fbUser.uid,
    });
  } catch (error: unknown) {
    const err = error as { code?: string };
    let message = 'Failed to create user.';

    if (err.code === 'auth/email-already-exists') message = 'This email is already registered.';
    else if (err.code === 'auth/invalid-password')
      message = 'Password must be at least 6 characters.';
    else if (err.code === 'auth/invalid-email') message = 'The email address is badly formatted.';

    res.status(400).send({ success: false, message });
  }
};

// ─── Dual-Token: Refresh Token Endpoint ──────────────────────────────────────

export const refreshTokenHandler = async (req: Request, res: Response) => {
  try {
    const incomingRefreshToken = req.cookies[REFRESH_COOKIE_NAME];
    if (!incomingRefreshToken) {
      return res.status(401).send({ success: false, message: 'No refresh token provided' });
    }

    // 1. Verify token signature
    const { verifyRefreshToken, generateAccessToken, generateRefreshToken } =
      await import('../../utils/jwt');
    let decoded: import('../../utils/jwt').JWTPayload;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      return res.status(401).send({ success: false, message: 'Invalid or expired refresh token' });
    }

    // 2. Verify token presence in database
    const storedToken = await AuthService.findRefreshToken(incomingRefreshToken);
    if (!storedToken) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      return res.status(401).send({ success: false, message: 'Refresh token revoked or invalid' });
    }

    // 3. Rotate token
    await AuthService.deleteRefreshToken(incomingRefreshToken);

    const payload = { email: decoded.email, role: decoded.role, uid: decoded.uid };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await AuthService.saveRefreshToken(
      newRefreshToken,
      decoded.email,
      decoded.role,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    setRefreshCookie(res, newRefreshToken);

    res.send({
      success: true,
      token: newAccessToken,
      role: decoded.role,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).send({ success: false, message: 'Failed to refresh token' });
  }
};

// ─── Dual-Token: Logout Endpoint ─────────────────────────────────────────────

export const logoutHandler = async (req: Request, res: Response) => {
  try {
    const token = req.cookies[REFRESH_COOKIE_NAME];
    if (token) {
      await AuthService.deleteRefreshToken(token);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    res.send({ success: true, message: 'Logged out successfully' });
  } catch {
    res.status(500).send({ success: false, message: 'Logout error' });
  }
};

// ─── Direct Google OAuth 2.0 Endpoint ────────────────────────────────────────

export const googleAuth = async (req: Request, res: Response) => {
  const { credential, access_token } = req.body;
  if (!credential && !access_token) {
    return res.status(400).send({
      success: false,
      message: 'Google credential or access token is required',
    });
  }

  try {
    let email: string | undefined;
    let name: string | undefined;
    let picture: string | undefined;

    if (credential) {
      const payload = await AuthService.verifyGoogleIdToken(credential);
      email = payload?.email;
      name = payload?.name;
      picture = payload?.picture;
    } else if (access_token) {
      const info = await AuthService.verifyGoogleAccessToken(access_token);
      email = info.email;
      name = info.name;
      picture = info.picture;
    }

    if (!email) {
      return res.status(401).send({ success: false, message: 'Invalid Google token' });
    }

    let user = await AuthService.getUserRecordByEmail(email);

    if (!user) {
      // Auto-provision Google user in MongoDB
      const newUser: User = {
        email,
        name: name || email.split('@')[0],
        photoURL: picture || `https://api.dicebear.com/7.x/lorelei/svg?seed=${email}`,
        role: 'user',
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      };
      await AuthService.createUserRecord(newUser);
      user = newUser;
    } else {
      await AuthService.updateLastLogin(email);
    }

    const { generateAccessToken, generateRefreshToken } = await import('../../utils/jwt');
    const accessToken = generateAccessToken({ email: user.email, role: user.role || 'user' });
    const refreshToken = generateRefreshToken({ email: user.email, role: user.role || 'user' });

    await AuthService.saveRefreshToken(
      refreshToken,
      user.email,
      user.role || 'user',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    setRefreshCookie(res, refreshToken);

    res.send({
      success: true,
      message: 'Google login successful',
      token: accessToken,
      role: user.role || 'user',
      user: {
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        role: user.role || 'user',
      },
    });
  } catch (error: unknown) {
    console.error('Google Auth Error:', error);
    res.status(401).send({ success: false, message: 'Google authentication failed' });
  }
};
