import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  content: string;
  authorId: mongoose.Types.ObjectId;
  postId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'spam';
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  flaggedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const commentSchema = new Schema<IComment>({
  content: { type: String, required: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'spam'], 
    default: 'pending' 
  },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date },
  flaggedReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
});

commentSchema.index({ postId: 1, status: 1 });
commentSchema.index({ parentId: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);