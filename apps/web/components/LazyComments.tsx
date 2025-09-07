import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Box, Typography, CircularProgress, Card, CardContent, Button, TextField } from '@mui/material';

interface Comment {
  _id: string;
  content: string;
  authorId: { email: string; avatar?: string };
  createdAt: string;
  replies: Comment[];
}

interface LazyCommentsProps {
  postId: string;
}

export default function LazyComments({ postId }: LazyCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  useEffect(() => {
    if (inView && !loaded && !loading) {
      loadComments();
    }
  }, [inView, loaded, loading]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) return;

      const response = await fetch(`http://localhost:4000/v1/comments?postId=${postId}`, {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
        setLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) return;

      const response = await fetch('http://localhost:4000/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          content: newComment,
          postId
        })
      });
      
      if (response.ok) {
        setNewComment('');
        // Reload comments to show pending status
        loadComments();
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const CommentItem = ({ comment, level = 0 }: { comment: Comment; level?: number }) => (
    <Card 
      sx={{ 
        ml: level * 2, 
        mb: 1, 
        borderLeft: level > 0 ? '2px solid #e0e0e0' : 'none' 
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Typography variant="subtitle2" component="span">
            {comment.authorId.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {new Date(comment.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
        <Typography variant="body2" paragraph>
          {comment.content}
        </Typography>
        {comment.replies?.map(reply => (
          <CommentItem key={reply._id} comment={reply} level={level + 1} />
        ))}
      </CardContent>
    </Card>
  );

  return (
    <Box ref={ref} sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Comments
      </Typography>

      {!loaded && !loading && (
        <Box 
          sx={{ 
            height: 200, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'text.secondary'
          }}
        >
          Scroll to load comments...
        </Box>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {loaded && (
        <>
          {/* Comment Form */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button 
                variant="contained" 
                onClick={submitComment}
                disabled={submitting || !newComment.trim()}
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </CardContent>
          </Card>

          {/* Comments List */}
          {comments.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No comments yet. Be the first to comment!
            </Typography>
          ) : (
            <Box>
              {comments.map(comment => (
                <CommentItem key={comment._id} comment={comment} />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}