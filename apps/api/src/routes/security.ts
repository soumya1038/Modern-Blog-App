import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { rotateJWTSecret, getCurrentJWTSecret } from '../utils/jwtRotation';
import { validateInput } from '../middleware/security';

const router = Router();

// POST /v1/security/rotate-jwt - Rotate JWT secret
router.post('/rotate-jwt', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const newSecrets = await rotateJWTSecret();
    
    res.json({
      message: 'JWT secret rotated successfully',
      rotatedAt: newSecrets.rotatedAt,
      // Don't expose the actual secrets
      hasCurrentSecret: !!newSecrets.current,
      hasPreviousSecret: !!newSecrets.previous
    });
  } catch (error) {
    console.error('JWT rotation failed:', error);
    res.status(500).json({ error: 'Failed to rotate JWT secret' });
  }
});

// GET /v1/security/jwt-status - Get JWT rotation status
router.get('/jwt-status', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentSecret = await getCurrentJWTSecret();
    
    res.json({
      hasSecret: !!currentSecret,
      secretLength: currentSecret?.length || 0,
      lastRotation: new Date().toISOString() // This would come from secrets file in real implementation
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get JWT status' });
  }
});

// POST /v1/security/validate-input - Test input validation
router.post('/validate-input', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, value } = req.body;
    
    let isValid = false;
    let message = '';
    
    switch (type) {
      case 'email':
        isValid = validateInput.email(value);
        message = isValid ? 'Valid email' : 'Invalid email format';
        break;
      case 'password':
        isValid = validateInput.password(value);
        message = isValid ? 'Valid password' : 'Password must be 8-128 characters';
        break;
      case 'apiKeyName':
        isValid = validateInput.apiKeyName(value);
        message = isValid ? 'Valid API key name' : 'Invalid API key name format';
        break;
      case 'postTitle':
        isValid = validateInput.postTitle(value);
        message = isValid ? 'Valid post title' : 'Post title must be 1-200 characters';
        break;
      case 'postContent':
        isValid = validateInput.postContent(value);
        message = isValid ? 'Valid post content' : 'Post content must be 1-50000 characters';
        break;
      case 'commentContent':
        isValid = validateInput.commentContent(value);
        message = isValid ? 'Valid comment content' : 'Comment must be 1-2000 characters';
        break;
      default:
        return res.status(400).json({ error: 'Invalid validation type' });
    }
    
    res.json({
      type,
      value: value.substring(0, 50) + (value.length > 50 ? '...' : ''), // Truncate for security
      isValid,
      message
    });
  } catch (error) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

export default router;