import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export const handleImpersonation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Check for impersonation header
  const impersonationData = req.headers['x-impersonate-user'];
  
  if (impersonationData && req.user?.role === 'admin') {
    try {
      const impersonation = JSON.parse(impersonationData as string);
      
      // Override user context for impersonation
      req.user.impersonating = {
        userId: impersonation.userId,
        email: impersonation.email,
        originalAdminId: req.user.id
      };
      
      // For actions that need user ID, use impersonated user
      req.user.id = impersonation.userId;
      req.user.email = impersonation.email;
      
    } catch (error) {
      console.error('Invalid impersonation data:', error);
    }
  }
  
  next();
};