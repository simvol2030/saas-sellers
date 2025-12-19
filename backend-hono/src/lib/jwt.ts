/**
 * JWT Utilities for Authentication
 *
 * Uses jose library for JWT operations (works in Node.js and Edge)
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

// Encode secret for jose
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload extends JWTPayload {
  userId: number;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

/**
 * Generate Access Token (short-lived)
 */
export async function generateAccessToken(payload: {
  userId: number;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRES)
    .setSubject(String(payload.userId))
    .sign(secretKey);
}

/**
 * Generate Refresh Token (long-lived)
 */
export async function generateRefreshToken(payload: {
  userId: number;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_REFRESH_EXPIRES)
    .setSubject(String(payload.userId))
    .sign(secretKey);
}

/**
 * Verify and decode token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(payload: {
  userId: number;
  email: string;
  role: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);
  return { accessToken, refreshToken };
}

/**
 * Parse expiration string to milliseconds
 */
export function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

/**
 * Get refresh token expiration date
 */
export function getRefreshTokenExpiry(): Date {
  const ms = parseExpiration(JWT_REFRESH_EXPIRES);
  return new Date(Date.now() + ms);
}
