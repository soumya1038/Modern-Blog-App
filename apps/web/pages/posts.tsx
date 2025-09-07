import { useState, useEffect, useCallback } from 'react';

interface Post {
  _id: string;
  title: string;
  content: string;
  excerpt?: string;
  slug: string;
  status: string;
  likes: number;
  authorId: { email: string; avatar?: string };
  categoryId?: { name: string };
  readTime: { text: string; minutes: number; words: number };
  createdAt: string;
}

interface PostsResponse {
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
  };
}

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (pageNum: number, reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required. Create one at /api-keys');
        return;
      }

      const response = await fetch(`/api/v1/posts?page=${pageNum}&limit=5`, {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: PostsResponse = await response.json();
      
      setPosts(prev => reset ? data.posts : [...prev, ...data.posts]);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  };

  const likePost = async (postId: string) => {
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) return;

      const response = await fetch(`/api/v1/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey }
      });
      
      if (response.ok) {
        const result = await response.json();
        setPosts(prev => prev.map(post => 
          post._id === postId 
            ? { ...post, likes: result.likes }
            : post
        ));
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <a href="/api-keys">Create API Key</a>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Blog Posts</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <a href="/" style={{ marginRight: '1rem' }}>← Home</a>
        <a href="/api-keys">Manage API Keys</a>
      </div>

      {posts.length === 0 && !loading ? (
        <p>No posts found</p>
      ) : (
        <div>
          {posts.map((post) => (
            <article key={post._id} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '1.5rem', 
              marginBottom: '1.5rem',
              backgroundColor: '#fff'
            }}>
              <h2 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                <a href={`/posts/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {post.title}
                </a>
              </h2>
              
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '1rem' }}>
                <span>By {post.authorId.email}</span>
                {post.categoryId && <span> in {post.categoryId.name}</span>}
                <span> • {post.readTime.text}</span>
                <span> • {new Date(post.createdAt).toLocaleDateString()}</span>
                <span style={{ 
                  backgroundColor: post.status === 'published' ? '#28a745' : '#ffc107',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '12px',
                  marginLeft: '0.5rem'
                }}>
                  {post.status}
                </span>
              </div>

              {post.excerpt && (
                <p style={{ color: '#555', lineHeight: '1.6' }}>{post.excerpt}</p>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button 
                  onClick={() => likePost(post._id)}
                  style={{ 
                    background: 'none', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  ❤️ {post.likes}
                </button>
                
                <a 
                  href={`/posts/${post.slug}`}
                  style={{ 
                    color: '#007bff', 
                    textDecoration: 'none',
                    fontWeight: 'bold'
                  }}
                >
                  Read more →
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <button 
            onClick={loadMore}
            disabled={loading}
            style={{
              padding: '1rem 2rem',
              fontSize: '16px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Load More Posts'}
          </button>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: '#666', margin: '2rem 0' }}>
          <p>No more posts to load</p>
        </div>
      )}
    </div>
  );
}