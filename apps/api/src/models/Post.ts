import mongoose, { Schema, Document } from 'mongoose';

interface IPost extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: 'draft' | 'published' | 'archived';
  authorId: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  tags: string[];
  likes: number;
  likedBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const postSchema = new Schema<IPost>({
  title: { type: String, required: true },
  slug: { type: String, required: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String }],
  likes: { type: Number, default: 0 },
  likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
});

// Compound indexes
postSchema.index({ slug: 1, authorId: 1 });
postSchema.index({ status: 1, createdAt: -1 });

export const Post = mongoose.model<IPost>('Post', postSchema);
export type { IPost };