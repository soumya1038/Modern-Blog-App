import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'user' | 'admin';
    scopes?: string[];
    authMethod: 'jwt' | 'apikey';
    impersonating?: {
      userId: string;
      email: string;
      originalAdminId: string;
    };
  };
}

// Universal auth middleware - tries JWT cookie, then API key, then 401
export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // 1. Try JWT from cookie
    const jwtToken = req.cookies?.refreshToken;
    if (jwtToken) {
      try {
        const { userId } = verifyAccessToken(jwtToken);
        const user = await User.findById(userId);
        if (user) {
          req.user = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            scopes: ['read', 'write', 'admin'],
            authMethod: 'jwt'
          };
          return next();
        }
      } catch (error) {
        // JWT failed, try next method
      }
    }

    // 2. Try API key from header
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const users = await User.find({ 'apiKeys.0': { $exists: true } });
      
      for (const user of users) {
        for (const keyData of user.apiKeys) {
          const isValid = await bcrypt.compare(apiKey, keyData.hashedKey);
          if (isValid) {
            keyData.lastUsedAt = new Date();
            await user.save();
            
            req.user = {
              id: user._id.toString(),
              email: user.email,
              role: user.role,
              scopes: keyData.scopes,
              authMethod: 'apikey'
            };
            return next();
          }
        }
      }
    }

    // 3. No valid auth found - 401
    res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// RBAC helper
export const requireRole = (requiredRole: 'user' | 'admin') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (requiredRole === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    
    next();
  };
};

export const requireScope = (requiredScope: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.scopes?.includes(requiredScope)) {
      return res.status(403).json({ error: `Scope '${requiredScope}' required` });
    }
    next();
  };
};

// Legacy exports for backward compatibility
export const authenticateApiKey = authMiddleware;
export const authenticateJWT = authMiddleware;