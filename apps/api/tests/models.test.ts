import mongoose from 'mongoose';
import { User, Post, Category } from '../src/models';
import bcrypt from 'bcrypt';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
  await Category.deleteMany({});
});

describe('Domain Models', () => {
  test('creates local user with API key', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const hashedApiKey = await bcrypt.hash('api-key-123', 10);
    
    const user = await User.create({
      email: 'local@test.com',
      password: hashedPassword,
      provider: 'local',
      isEmailVerified: true,
      apiKeys: [{
        name: 'Test API Key',
        hashedKey: hashedApiKey,
        scopes: ['read', 'write'],
      }]
    });

    expect(user.provider).toBe('local');
    expect(user.password).toBeDefined();
    expect(user.apiKeys).toHaveLength(1);
    expect(user.apiKeys[0].name).toBe('Test API Key');
  });

  test('creates google user without password', async () => {
    const user = await User.create({
      email: 'google@test.com',
      provider: 'google',
      googleId: 'google-123',
      isEmailVerified: true,
    });

    expect(user.provider).toBe('google');
    expect(user.googleId).toBe('google-123');
    expect(user.password).toBeUndefined();
  });

  test('referential integrity works', async () => {
    const user = await User.create({
      email: 'author@test.com',
      provider: 'local',
      password: 'hashed',
    });

    const category = await Category.create({
      name: 'Tech',
      slug: 'tech',
    });

    const post = await Post.create({
      title: 'Test Post',
      slug: 'test-post',
      content: 'Content',
      authorId: user._id,
      categoryId: category._id,
      status: 'published',
    });

    const populatedPost = await Post.findById(post._id)
      .populate('authorId')
      .populate('categoryId');

    expect(populatedPost?.authorId.email).toBe('author@test.com');
    expect(populatedPost?.categoryId.name).toBe('Tech');
  });
});