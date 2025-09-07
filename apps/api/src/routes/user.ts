import { Router, Response } from 'express';
import { User, Post, Comment, Media } from '../models';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import archiver from 'archiver';
import { Readable } from 'stream';

const router = Router();

// GET /v1/user/export - GDPR data export
router.get('/export', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Gather all user data
    const [user, posts, comments, media] = await Promise.all([
      User.findById(userId).select('-password -apiKeys.hashedKey'),
      Post.find({ authorId: userId, deletedAt: { $exists: false } }),
      Comment.find({ authorId: userId, deletedAt: { $exists: false } }),
      Media.find({ uploadedBy: userId, deletedAt: { $exists: false } })
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create export data
    const exportData = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        provider: user.provider,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      posts: posts.map(post => ({
        id: post._id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        slug: post.slug,
        status: post.status,
        likes: post.likes,
        readTime: post.readTime,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      })),
      comments: comments.map(comment => ({
        id: comment._id,
        content: comment.content,
        postId: comment.postId,
        parentId: comment.parentId,
        status: comment.status,
        createdAt: comment.createdAt
      })),
      media: media.map(file => ({
        id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.createdAt
      })),
      exportedAt: new Date().toISOString(),
      exportedBy: 'GDPR Data Export Request'
    };

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${userId}.zip"`);
    
    archive.pipe(res);
    
    // Add JSON data
    const jsonBuffer = Buffer.from(JSON.stringify(exportData, null, 2));
    archive.append(jsonBuffer, { name: 'user-data.json' });
    
    // Add README
    const readmeContent = `# GDPR Data Export

This archive contains all your personal data from the Blog App platform.

## Contents:
- user-data.json: Complete data export in JSON format
- This includes:
  - Your user profile information
  - All posts you've created (${posts.length} posts)
  - All comments you've made (${comments.length} comments)  
  - All media files you've uploaded (${media.length} files)

## Data Usage:
This data was exported on ${new Date().toISOString()} in compliance with GDPR Article 20 (Right to Data Portability).

## Questions:
If you have questions about this export, please contact support.
`;
    
    archive.append(readmeContent, { name: 'README.txt' });
    
    await archive.finalize();
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// DELETE /v1/user/account - GDPR account deletion
router.delete('/account', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { confirmEmail } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Require email confirmation
    if (confirmEmail !== user.email) {
      return res.status(400).json({ 
        error: 'Email confirmation required',
        message: 'Please confirm your email address to delete your account'
      });
    }
    
    // Schedule deletion in 30 days
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);
    
    user.scheduledDeletion = deletionDate;
    user.deletionRequested = new Date();
    await user.save();
    
    // Soft delete user content immediately
    await Promise.all([
      Post.updateMany({ authorId: userId }, { deletedAt: new Date() }),
      Comment.updateMany({ authorId: userId }, { deletedAt: new Date() }),
      Media.updateMany({ uploadedBy: userId }, { deletedAt: new Date() })
    ]);
    
    res.json({
      message: 'Account deletion scheduled',
      deletionDate: deletionDate.toISOString(),
      notice: 'Your account and all associated data will be permanently deleted in 30 days. Contact support to cancel this request.'
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to schedule account deletion' });
  }
});

// POST /v1/user/cancel-deletion - Cancel scheduled deletion
router.post('/cancel-deletion', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const user = await User.findById(userId);
    if (!user || !user.scheduledDeletion) {
      return res.status(400).json({ error: 'No deletion scheduled' });
    }
    
    // Cancel deletion
    user.scheduledDeletion = undefined;
    user.deletionRequested = undefined;
    await user.save();
    
    // Restore user content
    await Promise.all([
      Post.updateMany({ authorId: userId, deletedAt: { $exists: true } }, { $unset: { deletedAt: 1 } }),
      Comment.updateMany({ authorId: userId, deletedAt: { $exists: true } }, { $unset: { deletedAt: 1 } }),
      Media.updateMany({ uploadedBy: userId, deletedAt: { $exists: true } }, { $unset: { deletedAt: 1 } })
    ]);
    
    res.json({ message: 'Account deletion cancelled successfully' });
    
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({ error: 'Failed to cancel deletion' });
  }
});

// GET /v1/user/profile - Get user profile
router.get('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-password -apiKeys.hashedKey');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;