import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { User } from '../../types/types';
import { config } from '../../config';
import { catchAsync } from '../../utils/catchAsync';

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

export const register = catchAsync(async (req: Request, res: Response) => {
  const { email, password, name, photoURL: bodyPhotoURL } = req.body;
  let photoURL = bodyPhotoURL || '';

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
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await AuthService.getUserRecordByEmail(email);

  if (!user || !user.password) {
    return res.status(401).send({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  const isMatch = await AuthService.comparePassword(password, user.password);
  if (!isMatch) {
    return res.status(401).send({
      success: false,
      message: 'Invalid email or password.',
    });
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
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
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
});

export const sendVerification = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  res.send({
    success: true,
    message: 'Verification request received. Please check your inbox.',
  });
});

export const deleteMe = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  await AuthService.deleteUserRefreshTokens(email);
  await AuthService.deleteUserRecord(email);

  res.send({ success: true, message: 'Account deleted successfully.' });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ success: false, message: 'Email is required.' });

  await AuthService.getUserRecordByEmail(email);
  // Standard response to prevent email enumeration
  res.send({
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  });
});

export const adminCreateUser = catchAsync(async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).send({
      success: false,
      message: 'All fields (email, password, name, role) are required.',
    });
  }

  const existing = await AuthService.getUserRecordByEmail(email);
  if (existing) {
    return res.status(400).send({
      success: false,
      message: 'This email is already registered.',
    });
  }

  const hashedPassword = await AuthService.hashPassword(password);
  const newUser: User = {
    email,
    password: hashedPassword,
    name,
    photoURL: `https://api.dicebear.com/7.x/lorelei/svg?seed=${email}`,
    role: role as User['role'],
    created_at: new Date().toISOString(),
    last_login: '',
  };
  await AuthService.createUserRecord(newUser);

  res.status(201).send({
    success: true,
    message: `Successfully onboarded new ${role}: ${name}`,
  });
});

// ─── Dual-Token: Refresh Token Endpoint ──────────────────────────────────────

export const refreshTokenHandler = catchAsync(async (req: Request, res: Response) => {
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
});

// ─── Dual-Token: Logout Endpoint ─────────────────────────────────────────────

export const logoutHandler = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies[REFRESH_COOKIE_NAME];
  if (token) {
    await AuthService.deleteRefreshToken(token);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.send({ success: true, message: 'Logged out successfully' });
});

// ─── Direct Google OAuth 2.0 Endpoint ────────────────────────────────────────

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const { credential, access_token } = req.body;
  if (!credential && !access_token) {
    return res.status(400).send({
      success: false,
      message: 'Google credential or access token is required',
    });
  }

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
});
