import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  key: string;
  value: any;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);