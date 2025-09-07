import { Router, Response } from 'express';
import { Post } from '../models';
import { authMiddleware, requireScope, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { handleImpersonation } from '../middleware/impersonation';
import { generateSlug } from '../utils/slug';
import { calculateReadTime } from '../utils/readTime';

const router = Router();

// GET /v1/posts - Paginated with filters
router.get('/', authMiddleware, requireScope('read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const author = req.query.author as string;
    const category = req.query.category as string;
    const skip = (page - 1) * limit;

    const filter: any = { deletedAt: { $exists: false } };
    if (status) filter.status = status;
    if (author) filter.authorId = author;
    if (category) filter.categoryId = category;

    const posts = await Post.find(filter)
      .populate('authorId', 'email avatar')
      .populate('categoryId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments(filter);
    const hasMore = skip + posts.length < total;

    // Add read time to each post
    const postsWithReadTime = posts.map(post => ({
      ...post,
      readTime: calculateReadTime(post.content)
    }));

    res.json({
      posts: postsWithReadTime,
      pagination: {
        page,
        limit,
        total,
        hasMore,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /v1/posts/:slug - Get single post by slug
router.get('/:slug', authMiddleware, requireScope('read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await Post.findOne({ 
      slug: req.params.slug, 
      deletedAt: { $exists: false } 
    })
      .populate('authorId', 'email avatar')
      .populate('categoryId', 'name slug')
      .lean();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postWithReadTime = {
      ...post,
      readTime: calculateReadTime(post.content)
    };

    res.json({ post: postWithReadTime });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /v1/posts - Create post
router.post('/', authMiddleware, handleImpersonation, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content, excerpt, status = 'draft', categoryId, tags = [] } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const slug = await generateSlug(title);
    
    const post = await Post.create({
      title,
      content,
      excerpt,
      slug,
      status,
      authorId: req.user!.id,
      categoryId,
      tags,
    });

    const populatedPost = await Post.findById(post._id)
      .populate('authorId', 'email avatar')
      .populate('categoryId', 'name slug')
      .lean();

    const postWithReadTime = {
      ...populatedPost,
      readTime: calculateReadTime(post.content)
    };
    
    res.status(201).json({ post: postWithReadTime });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// PATCH /v1/posts/:id - Update post
router.patch('/:id', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content, excerpt, status, categoryId, tags } = req.body;
    const updateData: any = { updatedAt: new Date() };

    if (title) {
      updateData.title = title;
      updateData.slug = await generateSlug(title);
    }
    if (content) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (status) updateData.status = status;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (tags) updateData.tags = tags;

    const post = await Post.findOneAndUpdate(
      { 
        _id: req.params.id, 
        deletedAt: { $exists: false },
        $or: [
          { authorId: req.user!.id },
          ...(req.user!.role === 'admin' ? [{}] : [])
        ]
      },
      updateData,
      { new: true }
    )
      .populate('authorId', 'email avatar')
      .populate('categoryId', 'name slug')
      .lean();

    if (!post) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    const postWithReadTime = {
      ...post,
      readTime: calculateReadTime(post.content)
    };

    res.json({ post: postWithReadTime });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// DELETE /v1/posts/:id - Soft delete
router.delete('/:id', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await Post.findOneAndUpdate(
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
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }
    
    res.json({ message: 'Post deleted', authMethod: req.user!.authMethod });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// POST /v1/posts/:id/like - Like/unlike post
router.post('/:id/like', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await Post.findOne({ 
      _id: req.params.id, 
      deletedAt: { $exists: false } 
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user!.id;
    const hasLiked = post.likedBy.includes(userId as any);

    if (hasLiked) {
      // Unlike
      post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      // Like
      post.likedBy.push(userId as any);
      post.likes += 1;
    }

    await post.save();

    res.json({ 
      liked: !hasLiked, 
      likes: post.likes,
      message: hasLiked ? 'Post unliked' : 'Post liked'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like post' });
  }
});

export default router;