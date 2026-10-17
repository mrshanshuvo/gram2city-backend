import { Request, Response, NextFunction } from 'express';
import { UserModel, MerchantModel, RiderModel } from '../db/models';
import { verifyAccessToken } from '../utils/jwt';

// ─── Token Verification ───────────────────────────────────────────────────────

export const verifyAuthToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ success: false, message: 'Unauthorized: No token provided' });
    return;
  }

  // Robust token extraction: Remove "Bearer" (case-insensitive) and any leading/trailing spaces
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    res.status(401).send({ success: false, message: 'Unauthorized: Invalid token format' });
    return;
  }
  try {
    const decodedJwt = verifyAccessToken(token);
    req.user = decodedJwt;
    return next();
  } catch {
    res.status(401).send({ success: false, message: 'Unauthorized: Invalid or expired token' });
  }
};

// ─── Admin Guard ──────────────────────────────────────────────────────────────

export const verifyAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const email = req.user.email;
  const user = await UserModel.findOne({ email }).lean();
  if (user?.role !== 'admin' && user?.role !== 'superAdmin') {
    res.status(403).send({ success: false, message: 'Forbidden' });
    return;
  }
  next();
};

// ─── Role-Based Guards ────────────────────────────────────────────────────────

export const verifyMerchant = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const email = req.user.email;
  const user = await UserModel.findOne({ email }).lean();

  if (user?.role === 'merchant') {
    return next();
  }

  if (user?.role === 'admin' || user?.role === 'superAdmin') {
    const merchantProfile = await MerchantModel.findOne({ email }).lean();
    if (merchantProfile) {
      return next();
    }
  }

  res.status(403).send({ success: false, message: 'Merchant access required' });
};

export const verifyRider = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const email = req.user.email;
  const user = await UserModel.findOne({ email }).lean();

  if (user?.role === 'rider') {
    return next();
  }

  if (user?.role === 'admin' || user?.role === 'superAdmin') {
    const riderProfile = await RiderModel.findOne({ email }).lean();
    if (riderProfile) {
      return next();
    }
  }

  res.status(403).send({ success: false, message: 'Rider access required' });
};
