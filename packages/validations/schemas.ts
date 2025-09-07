import { z } from 'zod';

// User schemas
export const apiKeySchema = z.object({
  name: z.string().min(1),
  hashedKey: z.string(),
  scopes: z.array(z.string()),
  createdAt: z.date().default(() => new Date()),
  lastUsedAt: z.date().optional(),
});

export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  provider: z.enum(['local', 'google']),
  googleId: z.string().optional(),
  isEmailVerified: z.boolean().default(false),
  verifyToken: z.string().optional(),
  apiKeys: z.array(apiKeySchema).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  deletedAt: z.date().optional(),
});

// Post schema
export const postSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string(),
  excerpt: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  authorId: z.string(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  deletedAt: z.date().optional(),
});

// Media schema
export const mediaSchema = z.object({
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string().url(),
  uploadedBy: z.string(),
  createdAt: z.date().default(() => new Date()),
  deletedAt: z.date().optional(),
});

// Comment schema
export const commentSchema = z.object({
  content: z.string().min(1),
  authorId: z.string(),
  postId: z.string(),
  parentId: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  deletedAt: z.date().optional(),
});

// Category schema
export const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  deletedAt: z.date().optional(),
});

export type User = z.infer<typeof userSchema>;
export type Post = z.infer<typeof postSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type Category = z.infer<typeof categorySchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;