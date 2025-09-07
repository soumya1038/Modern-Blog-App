import mongoose, { Schema, Document } from 'mongoose';

interface IMedia extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: mongoose.Types.ObjectId;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    publicId?: string;
    eager?: any[];
  };
  createdAt: Date;
  deletedAt?: Date;
}

const mediaSchema = new Schema<IMedia>({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    publicId: String,
    eager: [Schema.Types.Mixed]
  },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
});

export const Media = mongoose.model<IMedia>('Media', mediaSchema);
export type { IMedia };