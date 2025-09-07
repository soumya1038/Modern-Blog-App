import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import cron from 'node-cron';
import { Media, Post } from '../models';
import cloudinary from '../config/cloudinary';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const mediaCleanupQueue = new Queue('media-cleanup', { connection: redis });

// Worker to process cleanup jobs
const mediaCleanupWorker = new Worker('media-cleanup', async (job) => {
  console.log('Starting media cleanup job...');
  
  try {
    // Find orphaned media (not referenced in any posts and older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const orphanedMedia = await Media.find({
      createdAt: { $lt: oneDayAgo },
      deletedAt: { $exists: false }
    });
    
    let cleanedCount = 0;
    
    for (const media of orphanedMedia) {
      // Check if media is referenced in any post content
      const referencedInPost = await Post.findOne({
        content: { $regex: media.url, $options: 'i' },
        deletedAt: { $exists: false }
      });
      
      if (!referencedInPost) {
        // Mark as deleted
        media.deletedAt = new Date();
        await media.save();
        
        // Delete from Cloudinary
        if (media.metadata?.publicId) {
          try {
            await cloudinary.uploader.destroy(media.metadata.publicId);
          } catch (error) {
            console.error(`Failed to delete from Cloudinary: ${media.metadata.publicId}`, error);
          }
        }
        
        cleanedCount++;
      }
    }
    
    console.log(`Media cleanup completed. Cleaned ${cleanedCount} orphaned files.`);
    return { cleanedCount };
  } catch (error) {
    console.error('Media cleanup job failed:', error);
    throw error;
  }
}, { connection: redis });

// Schedule nightly cleanup at 2 AM
export const scheduleMediaCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('Scheduling nightly media cleanup...');
    await mediaCleanupQueue.add('cleanup', {}, {
      removeOnComplete: 5,
      removeOnFail: 3
    });
  });
  
  console.log('Media cleanup scheduler initialized (runs daily at 2 AM)');
};