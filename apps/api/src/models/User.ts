import mongoose, { Schema, Document } from 'mongoose';

interface IApiKey {
  name: string;
  hashedKey: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt?: Date;
}

interface IUser extends Document {
  email: string;
  password?: string;
  provider: 'local' | 'google';
  googleId?: string;
  isEmailVerified: boolean;
  verifyToken?: string;
  verifyTokenExpires?: Date;
  avatar?: string;
  role: 'user' | 'admin';
  apiKeys: IApiKey[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  scheduledDeletion?: Date;
  deletionRequested?: Date;
}

const apiKeySchema = new Schema<IApiKey>({
  name: { type: String, required: true },
  hashedKey: { type: String, required: true },
  scopes: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
});

const userSchema = new Schema<IUser>({
  email: { type: String, required: true },
  password: { type: String, required: function() { return this.provider === 'local'; } },
  provider: { type: String, enum: ['local', 'google'], required: true },
  googleId: { type: String, sparse: true },
  isEmailVerified: { type: Boolean, default: false },
  verifyToken: { type: String },
  verifyTokenExpires: { type: Date },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  apiKeys: [apiKeySchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
  scheduledDeletion: { type: Date },
  deletionRequested: { type: Date },
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const User = mongoose.model<IUser>('User', userSchema);
export type { IUser, IApiKey };