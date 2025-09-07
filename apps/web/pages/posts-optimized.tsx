import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  Chip, 
  Box, 
  IconButton,
  Alert,
  CircularProgress,
  Fab
} from '@mui/material';
import { 
  Favorite, 
  FavoriteBorder, 
  Share, 
  Brightness4, 
  Brightness7,
  ArrowUpward
} from '@mui/icons-material';
import { useInView } from 'react-intersection-observer';
import { useTheme } from './_app';
import CloudinaryImage from '../components/CloudinaryImage';
import LazyComments from '../components/LazyComments';

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

export default function PostsOptimized() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();

  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px',
  });

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
    
    // Scroll to top handler
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchPosts]);

  // Auto-load more when in view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  }, [inView, hasMore, loading, page, fetchPosts]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <>
      <Helmet>
        <title>Blog Posts - Modern Blog Platform</title>
        <meta name="description" content="Discover the latest blog posts on our modern platform. Read, like, and engage with quality content." />
        <meta name="keywords" content="blog, posts, articles, reading, content" />
        <meta property="og:title" content="Blog Posts - Modern Blog Platform" />
        <meta property="og:description" content="Discover the latest blog posts on our modern platform" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="http://localhost:3000/posts-optimized" />
      </Helmet>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h1" component="h1">
            Blog Posts
          </Typography>
          <IconButton onClick={toggleDarkMode} color="inherit">
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Box>

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
            <Button href="/api-keys" sx={{ ml: 2 }}>Create API Key</Button>
          </Alert>
        )}

        {/* Posts List */}
        {posts.length === 0 && !loading ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
            No posts found. Be the first to create one!
          </Typography>
        ) : (
          <Box>
            {posts.map((post, index) => (
              <Card key={post._id} sx={{ mb: 3 }} component="article">
                <CardContent>
                  <Typography variant="h4" component="h2" gutterBottom>
                    {post.title}
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={2} flexWrap="wrap">
                    <Typography variant="body2" color="text.secondary">
                      By {post.authorId.email}
                    </Typography>
                    {post.categoryId && (
                      <Chip label={post.categoryId.name} size="small" variant="outlined" />
                    )}
                    <Chip label={post.readTime.text} size="small" />
                    <Typography variant="body2" color="text.secondary">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </Typography>
                    <Chip 
                      label={post.status} 
                      size="small" 
                      color={post.status === 'published' ? 'success' : 'warning'}
                    />
                  </Box>

                  {post.excerpt && (
                    <Typography variant="body1" paragraph color="text.secondary">
                      {post.excerpt}
                    </Typography>
                  )}
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Button 
                    startIcon={post.likes > 0 ? <Favorite /> : <FavoriteBorder />}
                    onClick={() => likePost(post._id)}
                    color={post.likes > 0 ? 'error' : 'inherit'}
                  >
                    {post.likes}
                  </Button>
                  
                  <Box>
                    <IconButton>
                      <Share />
                    </IconButton>
                    <Button href={`/posts/${post.slug}`} variant="contained">
                      Read More
                    </Button>
                  </Box>
                </CardActions>
                
                {/* Lazy load comments for first few posts */}
                {index < 3 && (
                  <LazyComments postId={post._id} />
                )}
              </Card>
            ))}
          </Box>
        )}

        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <Box ref={loadMoreRef} sx={{ textAlign: 'center', py: 4 }}>
            {loading ? (
              <CircularProgress />
            ) : (
              <Typography color="text.secondary">
                Scroll for more posts...
              </Typography>
            )}
          </Box>
        )}

        {/* End of Posts */}
        {!hasMore && posts.length > 0 && (
          <Typography 
            color="text.secondary" 
            sx={{ textAlign: 'center', py: 4, fontStyle: 'italic' }}
          >
            You've reached the end! 🎉
          </Typography>
        )}

        {/* Scroll to Top FAB */}
        {showScrollTop && (
          <Fab 
            color="primary" 
            size="small" 
            onClick={scrollToTop}
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
          >
            <ArrowUpward />
          </Fab>
        )}
      </Container>
    </>
  );
}