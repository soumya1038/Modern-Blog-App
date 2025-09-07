import { Media } from '../models';

const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '10');
const MAX_STORAGE_GB_PER_USER = parseInt(process.env.MAX_STORAGE_GB_PER_USER || '5');

export const checkImageSizeQuota = (sizeInBytes: number): boolean => {
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB <= MAX_IMAGE_SIZE_MB;
};

export const checkUserStorageQuota = async (userId: string, newFileSizeBytes: number): Promise<boolean> => {
  const userMedia = await Media.find({ 
    uploadedBy: userId, 
    deletedAt: { $exists: false } 
  });
  
  const totalBytes = userMedia.reduce((sum, media) => sum + media.size, 0) + newFileSizeBytes;
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  
  return totalGB <= MAX_STORAGE_GB_PER_USER;
};

export const getUserStorageUsage = async (userId: string) => {
  const userMedia = await Media.find({ 
    uploadedBy: userId, 
    deletedAt: { $exists: false } 
  });
  
  const totalBytes = userMedia.reduce((sum, media) => sum + media.size, 0);
  const usedGB = totalBytes / (1024 * 1024 * 1024);
  
  return {
    usedGB: Math.round(usedGB * 100) / 100,
    maxGB: MAX_STORAGE_GB_PER_USER,
    remainingGB: Math.round((MAX_STORAGE_GB_PER_USER - usedGB) * 100) / 100,
    percentage: Math.round((usedGB / MAX_STORAGE_GB_PER_USER) * 100)
  };
};