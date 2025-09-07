import mongoose, { Schema, Document } from 'mongoose';

export interface IFeatureFlag extends Document {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage: number;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const featureFlagSchema = new Schema<IFeatureFlag>({
  name: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  description: { type: String },
  rolloutPercentage: { type: Number, default: 0, min: 0, max: 100 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const FeatureFlag = mongoose.model<IFeatureFlag>('FeatureFlag', featureFlagSchema);