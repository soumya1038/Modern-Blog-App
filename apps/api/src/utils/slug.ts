import slugify from 'slugify';
import shortid from 'shortid';
import { Post } from '../models';

export const generateSlug = async (title: string): Promise<string> => {
  const baseSlug = slugify(title, { lower: true, strict: true });
  
  // Check if slug exists
  const existingPost = await Post.findOne({ slug: baseSlug, deletedAt: { $exists: false } });
  
  if (!existingPost) {
    return baseSlug;
  }
  
  // Append short ID for collision
  return `${baseSlug}-${shortid.generate()}`;
};