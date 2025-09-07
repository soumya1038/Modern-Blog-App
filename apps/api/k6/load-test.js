import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 200 },  // Ramp up to 200 users (200 RPS target)
    { duration: '2m', target: 200 },   // Stay at 200 users for 2 minutes
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],             // Custom error rate below 10%
  },
};

const BASE_URL = 'http://localhost:4000';

// Test data
let apiKey = null;
let testPosts = [];

export function setup() {
  console.log('Setting up load test...');
  
  // Create test user
  const registerResponse = http.post(`${BASE_URL}/v1/auth/register`, JSON.stringify({
    email: `loadtest-${Date.now()}@example.com`,
    password: 'LoadTest123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (registerResponse.status !== 201) {
    console.error('Failed to create test user:', registerResponse.body);
    return {};
  }
  
  const accessToken = JSON.parse(registerResponse.body).accessToken;
  
  // Create API key
  const apiKeyResponse = http.post(`${BASE_URL}/v1/auth/api-keys`, JSON.stringify({
    name: 'Load Test Key',
    scopes: ['read', 'write']
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (apiKeyResponse.status !== 201) {
    console.error('Failed to create API key:', apiKeyResponse.body);
    return {};
  }
  
  const key = JSON.parse(apiKeyResponse.body).key;
  
  // Create test posts for reading
  const posts = [];
  for (let i = 0; i < 10; i++) {
    const postResponse = http.post(`${BASE_URL}/v1/posts`, JSON.stringify({
      title: `Load Test Post ${i}`,
      content: `This is load test post number ${i} with enough content to test read time calculation and performance under load.`,
      excerpt: `Load test post ${i} excerpt`,
      status: 'published'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': key
      }
    });
    
    if (postResponse.status === 201) {
      posts.push(JSON.parse(postResponse.body).post);
    }
  }
  
  console.log(`Setup complete. Created ${posts.length} test posts.`);
  
  return {
    apiKey: key,
    posts: posts
  };
}

export default function(data) {
  if (!data.apiKey) {
    console.error('No API key available, skipping test');
    return;
  }
  
  const headers = {
    'X-API-Key': data.apiKey,
    'Content-Type': 'application/json'
  };
  
  // Test scenario weights
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - Read posts (most common operation)
    testReadPosts(headers);
  } else if (scenario < 0.6) {
    // 20% - Read single post
    testReadSinglePost(headers, data.posts);
  } else if (scenario < 0.8) {
    // 20% - Create post
    testCreatePost(headers);
  } else if (scenario < 0.9) {
    // 10% - Like post
    testLikePost(headers, data.posts);
  } else {
    // 10% - Create comment
    testCreateComment(headers, data.posts);
  }
  
  sleep(1); // 1 second between requests per user
}

function testReadPosts(headers) {
  const response = http.get(`${BASE_URL}/v1/posts?page=1&limit=10`, { headers });
  
  const success = check(response, {
    'GET /posts status is 200': (r) => r.status === 200,
    'GET /posts response time < 500ms': (r) => r.timings.duration < 500,
    'GET /posts has posts array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.posts);
      } catch (e) {
        return false;
      }
    }
  });
  
  errorRate.add(!success);
}

function testReadSinglePost(headers, posts) {
  if (posts.length === 0) return;
  
  const randomPost = posts[Math.floor(Math.random() * posts.length)];
  const response = http.get(`${BASE_URL}/v1/posts/${randomPost.slug}`, { headers });
  
  const success = check(response, {
    'GET /posts/:slug status is 200': (r) => r.status === 200,
    'GET /posts/:slug response time < 500ms': (r) => r.timings.duration < 500,
    'GET /posts/:slug has readTime': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.post && body.post.readTime;
      } catch (e) {
        return false;
      }
    }
  });
  
  errorRate.add(!success);
}

function testCreatePost(headers) {
  const postData = {
    title: `Load Test Post ${Date.now()}`,
    content: `This is a dynamically created post during load testing at ${new Date().toISOString()}. It contains enough content to test the system under realistic conditions.`,
    excerpt: 'Load test post excerpt',
    status: 'published'
  };
  
  const response = http.post(`${BASE_URL}/v1/posts`, JSON.stringify(postData), { headers });
  
  const success = check(response, {
    'POST /posts status is 201': (r) => r.status === 201,
    'POST /posts response time < 1000ms': (r) => r.timings.duration < 1000,
    'POST /posts returns post with slug': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.post && body.post.slug;
      } catch (e) {
        return false;
      }
    }
  });
  
  errorRate.add(!success);
}

function testLikePost(headers, posts) {
  if (posts.length === 0) return;
  
  const randomPost = posts[Math.floor(Math.random() * posts.length)];
  const response = http.post(`${BASE_URL}/v1/posts/${randomPost._id}/like`, '', { headers });
  
  const success = check(response, {
    'POST /posts/:id/like status is 200': (r) => r.status === 200,
    'POST /posts/:id/like response time < 500ms': (r) => r.timings.duration < 500,
    'POST /posts/:id/like returns likes count': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.likes === 'number';
      } catch (e) {
        return false;
      }
    }
  });
  
  errorRate.add(!success);
}

function testCreateComment(headers, posts) {
  if (posts.length === 0) return;
  
  const randomPost = posts[Math.floor(Math.random() * posts.length)];
  const commentData = {
    content: `Load test comment created at ${new Date().toISOString()}`,
    postId: randomPost._id
  };
  
  const response = http.post(`${BASE_URL}/v1/comments`, JSON.stringify(commentData), { headers });
  
  const success = check(response, {
    'POST /comments status is 201': (r) => r.status === 201,
    'POST /comments response time < 500ms': (r) => r.timings.duration < 500,
    'POST /comments returns comment': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.comment && body.comment.content;
      } catch (e) {
        return false;
      }
    }
  });
  
  errorRate.add(!success);
}

export function teardown(data) {
  console.log('Cleaning up load test data...');
  
  if (!data.apiKey) return;
  
  // Clean up test posts (optional - they'll be soft deleted anyway)
  console.log('Load test teardown complete.');
}