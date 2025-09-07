import { Router, Response } from 'express';
import { User, Post, Comment, Media, SiteSettings, FeatureFlag } from '../models';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth';
import cloudinary from '../config/cloudinary';
import { moderateContent } from '../utils/moderation';

const router = Router();

// GET /v1/admin/stats - Dashboard KPIs
router.get('/stats', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get basic counts
    const [totalUsers, totalPosts, totalComments, totalMedia] = await Promise.all([
      User.countDocuments({ deletedAt: { $exists: false } }),
      Post.countDocuments({ deletedAt: { $exists: false } }),
      Comment.countDocuments({ deletedAt: { $exists: false } }),
      Media.countDocuments({ deletedAt: { $exists: false } })
    ]);

    // Get pending comments count
    const pendingComments = await Comment.countDocuments({ 
      status: 'pending',
      deletedAt: { $exists: false }
    });

    // Get published posts count
    const publishedPosts = await Post.countDocuments({ 
      status: 'published',
      deletedAt: { $exists: false }
    });

    // Get storage usage
    const mediaFiles = await Media.find({ deletedAt: { $exists: false } });
    const totalStorageBytes = mediaFiles.reduce((sum, media) => sum + media.size, 0);
    const totalStorageGB = Math.round((totalStorageBytes / (1024 * 1024 * 1024)) * 100) / 100;

    // Get Cloudinary usage (if available)
    let cloudinaryUsage = null;
    try {
      if (process.env.CLOUDINARY_API_KEY) {
        const usage = await cloudinary.api.usage();
        cloudinaryUsage = {
          credits: usage.credits,
          used_percent: usage.used_percent,
          limit: usage.limit
        };
      }
    } catch (error) {
      console.warn('Could not fetch Cloudinary usage:', error);
    }

    // Recent activity
    const recentPosts = await Post.find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('authorId', 'email')
      .select('title status createdAt authorId');

    const recentComments = await Comment.find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('authorId', 'email')
      .populate('postId', 'title')
      .select('content status createdAt authorId postId');

    res.json({
      overview: {
        totalUsers,
        totalPosts,
        publishedPosts,
        totalComments,
        pendingComments,
        totalMedia,
        totalStorageGB
      },
      cloudinary: cloudinaryUsage,
      recent: {
        posts: recentPosts,
        comments: recentComments
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /v1/admin/users - List users with pagination
router.get('/users', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({ deletedAt: { $exists: false } })
      .select('-password -verifyToken -apiKeys')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ deletedAt: { $exists: false } });

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /v1/admin/impersonate - Start impersonating user
router.post('/impersonate', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store impersonation in session/token (simplified with response)
    res.json({
      impersonating: {
        userId: targetUser._id,
        email: targetUser.email,
        originalAdminId: req.user!.id
      },
      message: `Now impersonating ${targetUser.email}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start impersonation' });
  }
});

// POST /v1/admin/stop-impersonation - Stop impersonating
router.post('/stop-impersonation', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  res.json({ message: 'Impersonation stopped' });
});

// DELETE /v1/admin/posts/bulk - Bulk delete posts
router.delete('/posts/bulk', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { postIds } = req.body;
    
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ error: 'postIds array required' });
    }

    const result = await Post.updateMany(
      { _id: { $in: postIds } },
      { deletedAt: new Date() }
    );

    res.json({ 
      message: `${result.modifiedCount} posts deleted`,
      deletedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete posts' });
  }
});

// GET /v1/admin/media - Media manager
router.get('/media', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const media = await Media.find({ deletedAt: { $exists: false } })
      .populate('uploadedBy', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Media.countDocuments({ deletedAt: { $exists: false } });
    const totalSize = await Media.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: null, totalBytes: { $sum: '$size' } } }
    ]);

    res.json({
      media,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + media.length < total
      },
      totalSizeGB: totalSize[0] ? Math.round((totalSize[0].totalBytes / (1024 * 1024 * 1024)) * 100) / 100 : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// DELETE /v1/admin/media/purge - Purge media from CDN
router.delete('/media/purge', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mediaIds } = req.body;
    
    if (!Array.isArray(mediaIds)) {
      return res.status(400).json({ error: 'mediaIds array required' });
    }

    const mediaFiles = await Media.find({ _id: { $in: mediaIds } });
    let purgedCount = 0;

    for (const media of mediaFiles) {
      try {
        if (media.metadata?.publicId) {
          await cloudinary.uploader.destroy(media.metadata.publicId);
        }
        media.deletedAt = new Date();
        await media.save();
        purgedCount++;
      } catch (error) {
        console.error(`Failed to purge media ${media._id}:`, error);
      }
    }

    res.json({ 
      message: `${purgedCount} media files purged from CDN`,
      purgedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge media' });
  }
});

// GET /v1/admin/settings - Get site settings
router.get('/settings', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await SiteSettings.find().populate('updatedBy', 'email');
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        updatedBy: setting.updatedBy,
        updatedAt: setting.updatedAt
      };
      return acc;
    }, {} as any);

    res.json({ settings: settingsObj });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /v1/admin/settings - Update site settings
router.put('/settings', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object required' });
    }

    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      updates.push(
        SiteSettings.findOneAndUpdate(
          { key },
          { 
            key, 
            value, 
            updatedBy: req.user!.id, 
            updatedAt: new Date() 
          },
          { upsert: true, new: true }
        )
      );
    }

    await Promise.all(updates);
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /v1/admin/spam-review - AI spam review queue
router.get('/spam-review', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const spamComments = await Comment.find({
      status: 'spam',
      flaggedReason: { $exists: true },
      deletedAt: { $exists: false }
    })
      .populate('authorId', 'email')
      .populate('postId', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    // Re-analyze with AI for confidence scores
    const reviewQueue = [];
    for (const comment of spamComments) {
      const moderation = await moderateContent(comment.content);
      reviewQueue.push({
        ...comment.toObject(),
        aiConfidence: moderation.flagged ? 'high' : 'low',
        recommendedAction: moderation.flagged ? 'keep_spam' : 'approve'
      });
    }

    res.json({ spamQueue: reviewQueue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch spam review queue' });
  }
});

// GET /v1/admin/feature-flags - Get feature flags
router.get('/feature-flags', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const flags = await FeatureFlag.find().populate('updatedBy', 'email');
    res.json({ flags });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// PUT /v1/admin/feature-flags/:name - Update feature flag
router.put('/feature-flags/:name', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled, description, rolloutPercentage } = req.body;
    
    const flag = await FeatureFlag.findOneAndUpdate(
      { name: req.params.name },
      {
        name: req.params.name,
        enabled: enabled !== undefined ? enabled : false,
        description,
        rolloutPercentage: rolloutPercentage !== undefined ? rolloutPercentage : 0,
        updatedBy: req.user!.id,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    ).populate('updatedBy', 'email');

    res.json({ flag });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

export default router;