import jwt from 'jsonwebtoken';
import { config } from '../config';

const ACCESS_TOKEN_SECRET = config.JWT_SECRET;
const REFRESH_TOKEN_SECRET = config.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export interface JWTPayload {
  email: string;
  role: string;
  uid?: string;
}

/**
 * Generates a short-lived Access Token (15 minutes) for authorization headers.
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

/**
 * Backward compatibility alias for generateAccessToken.
 */
export const generateJWT = generateAccessToken;

/**
 * Generates a long-lived Refresh Token (7 days) for secure session rotation.
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};

/**
 * Verifies an Access Token.
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as JWTPayload;
};

/**
 * Backward compatibility alias for verifyAccessToken.
 */
export const verifyJWT = verifyAccessToken;

/**
 * Verifies a Refresh Token against REFRESH_TOKEN_SECRET.
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;
};
