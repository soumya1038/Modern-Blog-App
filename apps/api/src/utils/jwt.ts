import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getCurrentJWTSecret, getValidJWTSecrets } from './jwtRotation';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

export const generateTokens = async (userId: string) => {
  const jwtSecret = await getCurrentJWTSecret();
  const accessToken = jwt.sign({ userId }, jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const verifyAccessToken = async (token: string) => {
  const validSecrets = await getValidJWTSecrets();
  
  for (const secret of validSecrets) {
    try {
      return jwt.verify(token, secret) as { userId: string };
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('Invalid token');
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
};

export const generateVerifyToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { token, expires };
};

export const generateVerifyJWT = async (userId: string, email: string) => {
  const jwtSecret = await getCurrentJWTSecret();
  return jwt.sign({ userId, email }, jwtSecret, { expiresIn: '10m' });
};

export const verifyEmailToken = async (token: string) => {
  const validSecrets = await getValidJWTSecrets();
  
  for (const secret of validSecrets) {
    try {
      return jwt.verify(token, secret) as { userId: string; email: string };
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('Invalid token');
};