import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';
import { User } from '../models';
import { generateTokens, verifyRefreshToken, generateVerifyToken, generateVerifyJWT, verifyEmailToken } from '../utils/jwt';
import { queueVerificationEmail } from '../utils/queue';
import { generateApiKey } from '../utils/apiKey';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const { token, expires } = generateVerifyToken();
    
    const user = await User.create({
      email,
      password: hashedPassword,
      provider: 'local',
      verifyToken: token,
      verifyTokenExpires: expires,
      isEmailVerified: false,
    });

    await queueVerificationEmail(email, token);

    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email, provider: 'local' });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const { userId } = verifyRefreshToken(refreshToken);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(userId);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// GET /v1/auth/verify-email
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }

    const user = await User.findOne({
      verifyToken: token,
      verifyTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.isEmailVerified = true;
    user.verifyToken = undefined;
    user.verifyTokenExpires = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Email verified successfully',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: true,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /v1/auth/google
router.get('/google', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res);
});

// GET /v1/auth/google/callback
router.get('/google/callback', (req: Request, res: Response, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', { session: false }, async (err: any, user: any) => {
    try {
      if (err || !user) {
        return res.redirect(`${process.env.NEXTAUTH_URL}?error=auth_failed`);
      }
      
      const { accessToken, refreshToken } = generateTokens(user._id.toString());
      
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      res.redirect(`${process.env.NEXTAUTH_URL}?token=${accessToken}&user=${encodeURIComponent(JSON.stringify({
        id: user._id,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified
      }))}`);
    } catch (error) {
      res.redirect(`${process.env.NEXTAUTH_URL}?error=auth_failed`);
    }
  })(req, res, next);
});

// POST /v1/auth/api-keys
router.post('/api-keys', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, scopes } = req.body;
    
    if (!name || !scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ error: 'Name and scopes array required' });
    }
    
    const validScopes = ['read', 'write', 'admin'];
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return res.status(400).json({ error: `Invalid scopes: ${invalidScopes.join(', ')}` });
    }
    
    const plainKey = generateApiKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);
    
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.apiKeys.push({
      name,
      hashedKey,
      scopes,
      createdAt: new Date(),
    });
    
    await user.save();
    
    res.status(201).json({
      key: plainKey,
      name,
      scopes,
      message: 'Store this key securely - it will not be shown again'
    });
  } catch (error) {
    res.status(500).json({ error: 'API key creation failed' });
  }
});

// GET /v1/auth/api-keys
router.get('/api-keys', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const apiKeys = user.apiKeys.map((key, index) => ({
      id: index,
      name: key.name,
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));
    
    res.json({ apiKeys });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// DELETE /v1/auth/api-keys/:id
router.delete('/api-keys/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keyIndex = parseInt(req.params.id);
    
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (keyIndex < 0 || keyIndex >= user.apiKeys.length) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    user.apiKeys.splice(keyIndex, 1);
    await user.save();
    
    res.json({ message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// POST /v1/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

export default router;