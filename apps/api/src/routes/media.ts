import { Router, Response } from 'express';
import { Media } from '../models';
import { authMiddleware, requireScope, AuthenticatedRequest } from '../middleware/auth';
import cloudinary from '../config/cloudinary';
import { checkImageSizeQuota, checkUserStorageQuota, getUserStorageUsage } from '../utils/mediaQuota';

const router = Router();

// GET /v1/media/sign - Generate signed upload parameters
router.get('/sign', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileSize } = req.query;
    const fileSizeBytes = parseInt(fileSize as string);
    
    if (!fileSizeBytes || !checkImageSizeQuota(fileSizeBytes)) {
      return res.status(400).json({ 
        error: `File size exceeds ${process.env.MAX_IMAGE_SIZE_MB || 10}MB limit` 
      });
    }
    
    const canUpload = await checkUserStorageQuota(req.user!.id, fileSizeBytes);
    if (!canUpload) {
      return res.status(413).json({ 
        error: `Storage quota exceeded. Max ${process.env.MAX_STORAGE_GB_PER_USER || 5}GB per user` 
      });
    }
    
    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadParams = {
      timestamp,
      folder: `blog/${req.user!.id}`,
      eager: [
        { width: 800, height: 600, crop: 'limit', format: 'webp', quality: 'auto' },
        { width: 1600, height: 1200, crop: 'limit', format: 'webp', quality: 'auto' }
      ],
      notification_url: `${process.env.API_URL}/v1/media/webhook`,
      context: `user_id=${req.user!.id}`
    };
    
    const signature = cloudinary.utils.api_sign_request(uploadParams, process.env.CLOUDINARY_API_SECRET!);
    
    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      uploadParams,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
});

// POST /v1/media/webhook - Cloudinary webhook
router.post('/webhook', async (req, res) => {
  try {
    const { public_id, secure_url, bytes, format, width, height, context, eager } = req.body;
    
    if (!context?.user_id) {
      return res.status(400).json({ error: 'Missing user context' });
    }
    
    const userId = context.user_id;
    const filename = public_id.split('/').pop();
    
    await Media.create({
      filename,
      originalName: filename,
      mimeType: `image/${format}`,
      size: bytes,
      url: secure_url,
      uploadedBy: userId,
      metadata: {
        width,
        height,
        format,
        publicId: public_id,
        eager: eager || []
      }
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET /v1/media - List user's media
router.get('/', authMiddleware, requireScope('read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const media = await Media.find({ 
      uploadedBy: req.user!.id,
      deletedAt: { $exists: false }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Media.countDocuments({ 
      uploadedBy: req.user!.id,
      deletedAt: { $exists: false }
    });
    
    const storageUsage = await getUserStorageUsage(req.user!.id);
    
    res.json({
      media,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + media.length < total
      },
      storageUsage
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// DELETE /v1/media/:id - Delete media
router.delete('/:id', authMiddleware, requireScope('write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const media = await Media.findOneAndUpdate(
      { 
        _id: req.params.id,
        uploadedBy: req.user!.id,
        deletedAt: { $exists: false }
      },
      { deletedAt: new Date() },
      { new: true }
    );
    
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    // Delete from Cloudinary
    if (media.metadata?.publicId) {
      await cloudinary.uploader.destroy(media.metadata.publicId);
    }
    
    res.json({ message: 'Media deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;