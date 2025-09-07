import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initSentry, Sentry } from './config/sentry';
import { metricsMiddleware, getMetrics } from './middleware/metrics';
import { 
  helmetConfig, 
  corsConfig, 
  sanitizeInput, 
  generalRateLimit, 
  authRateLimit,
  slowDownConfig,
  hppConfig
} from './middleware/security';

// Initialize Sentry before importing other modules
initSentry();
// Conditionally import passport only if Google OAuth is configured
let passport: any;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport = require('./config/passport').default;
}
import authRoutes from './routes/auth';
import testRoutes from './routes/test';
import postsRoutes from './routes/posts';
import mediaRoutes from './routes/media';
import commentsRoutes from './routes/comments';
import adminRoutes from './routes/admin';
import securityRoutes from './routes/security';
import userRoutes from './routes/user';
import { scheduleMediaCleanup } from './jobs/mediaCleanup';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Sentry request handler must be first
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Security middleware
app.use(helmetConfig);
app.use(cors(corsConfig));
app.use(hppConfig);
app.use(sanitizeInput);
app.use(generalRateLimit);
app.use(slowDownConfig);

// Metrics middleware
app.use(metricsMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
if (passport) {
  app.use(passport.initialize());
  app.use(passport.session());
}

// Routes with rate limiting
app.use('/v1/auth', authRateLimit, authRoutes);
app.use('/v1/posts', postsRoutes);
app.use('/v1/media', mediaRoutes);
app.use('/v1/comments', commentsRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/security', securityRoutes);
app.use('/v1/user', userRoutes);
app.use('/test', testRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/metrics', getMetrics);

// Sentry error handler must be before other error handlers
app.use(Sentry.Handlers.errorHandler());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/blog')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  
  // Start media cleanup scheduler
  scheduleMediaCleanup();
});