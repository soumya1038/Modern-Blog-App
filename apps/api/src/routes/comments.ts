import { Router, Response } from 'express';
import { Comment, Post } from '../models';
import { authMiddleware, requireScope, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { moderateContent } from '../utils/moderation';

const router = Router();

// GET /v1/comments - List comments for a post with threading
router.get('/', authMiddleware, requireScope('read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { postId } = req.query;
    
    if (!postId) {
      return res.status(400).json({ error: 'postId required' });
    }

    // Get all approved comments for the post
    const comments = await Comment.find({
      postId,
      status: 'approved',
      deletedAt: { $exists: false }
    })
      .populate('authorId', 'email avatar')
      .sort({ createdAt: 1 })
      .lean();

    // Build comment tree
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create map and identify root comments
    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment._id.toString(), comment);
      
      if (!comment.parentId) {
        rootComments.push(comment);
      }
    });

    // Second pass: build tree structure
    comments.forEach(comment => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId.toString());
        if (parent) {
          parent.replies.push(comment);
        }
      }
    });

    res.json({ comments: rootComments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /v1/comments - Create comment
router.post('/', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, postId, parentId } = req.body;
    
    if (!content || !postId) {
      return res.status(400).json({ error: 'content and postId required' });
    }

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Verify parent comment exists if provided
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    // Auto-moderate content
    const moderation = await moderateContent(content);
    
    const comment = await Comment.create({
      content,
      authorId: req.user!.id,
      postId,
      parentId: parentId || undefined,
      status: moderation.flagged ? 'spam' : 'pending',
      flaggedReason: moderation.reason,
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate('authorId', 'email avatar')
      .lean();

    res.status(201).json({ 
      comment: populatedComment,
      autoModerated: moderation.flagged
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /v1/comments/:id/moderate - Admin moderation
router.patch('/:id/moderate', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    
    if (!['approved', 'spam'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or spam' });
    }

    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        moderatedBy: req.user!.id,
        moderatedAt: new Date(),
        flaggedReason: reason || undefined,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('authorId', 'email avatar');

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to moderate comment' });
  }
});

// GET /v1/comments/pending - Admin: List pending comments
router.get('/pending', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      status: 'pending',
      deletedAt: { $exists: false }
    })
      .populate('authorId', 'email avatar')
      .populate('postId', 'title slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      status: 'pending',
      deletedAt: { $exists: false }
    });

    res.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + comments.length < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending comments' });
  }
});

// DELETE /v1/comments/:id - Delete comment
router.delete('/:id', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const comment = await Comment.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedAt: { $exists: false },
        $or: [
          { authorId: req.user!.id },
          ...(req.user!.role === 'admin' ? [{}] : [])
        ]
      },
      { deletedAt: new Date() },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;