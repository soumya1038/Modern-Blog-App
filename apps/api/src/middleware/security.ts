import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import mongoSanitize from 'mongo-sanitize';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

// Generate CSP nonce
export const generateNonce = () => {
  return Buffer.from(Math.random().toString()).toString('base64');
};

// Helmet configuration with CSP
export const helmetConfig = (req: Request, res: Response, next: NextFunction) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;
  
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com"],
        connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })(req, res, next);
};

// CORS whitelist
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL
].filter(Boolean);

export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Impersonate-User']
};

// MongoDB sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
};

// General rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API key specific rate limiting (per user)
export const apiKeyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per API key
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id || req.ip;
  },
  message: {
    error: 'API key rate limit exceeded. Maximum 60 requests per minute.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down middleware for repeated requests
export const slowDownConfig = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: 500, // slow down subsequent requests by 500ms per request
  maxDelayMs: 20000, // maximum delay of 20 seconds
});

// HPP (HTTP Parameter Pollution) protection
export const hppConfig = hpp({
  whitelist: ['tags', 'scopes'] // allow arrays for these parameters
});

// Input validation helpers
export const validateInput = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },
  
  password: (password: string): boolean => {
    return password.length >= 8 && password.length <= 128;
  },
  
  apiKeyName: (name: string): boolean => {
    return name.length >= 1 && name.length <= 100 && /^[a-zA-Z0-9\s\-_]+$/.test(name);
  },
  
  postTitle: (title: string): boolean => {
    return title.length >= 1 && title.length <= 200;
  },
  
  postContent: (content: string): boolean => {
    return content.length >= 1 && content.length <= 50000;
  },
  
  commentContent: (content: string): boolean => {
    return content.length >= 1 && content.length <= 2000;
  }
};