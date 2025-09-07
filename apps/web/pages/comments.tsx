import { useState, useEffect } from 'react';

interface Comment {
  _id: string;
  content: string;
  authorId: { email: string; avatar?: string };
  createdAt: string;
  replies: Comment[];
}

interface CommentsProps {
  postId?: string;
}

function CommentItem({ comment, level = 0, onReply }: { 
  comment: Comment; 
  level?: number; 
  onReply: (parentId: string) => void;
}) {
  const maxLevel = 3;
  const canReply = level < maxLevel - 1;

  return (
    <div style={{ 
      marginLeft: `${level * 2}rem`,
      borderLeft: level > 0 ? '2px solid #eee' : 'none',
      paddingLeft: level > 0 ? '1rem' : '0',
      marginBottom: '1rem'
    }}>
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1rem', 
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          {comment.authorId.avatar && (
            <img 
              src={comment.authorId.avatar} 
              alt="Avatar" 
              style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '0.5rem' }}
            />
          )}
          <strong>{comment.authorId.email}</strong>
          <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '14px' }}>
            {new Date(comment.createdAt).toLocaleString()}
          </span>
          <span style={{ 
            background: '#007bff', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: '3px', 
            fontSize: '12px',
            marginLeft: '0.5rem'
          }}>
            Level {level + 1}
          </span>
        </div>
        
        <p style={{ margin: '0 0 0.5rem 0', lineHeight: '1.5' }}>
          {comment.content}
        </p>
        
        {canReply && (
          <button 
            onClick={() => onReply(comment._id)}
            style={{ 
              background: 'none', 
              border: '1px solid #007bff', 
              color: '#007bff',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Reply
          </button>
        )}
      </div>
      
      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply._id} 
              comment={reply} 
              level={level + 1}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Comments({ postId = 'test-post-id' }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required. Create one at /api-keys');
        return;
      }

      const response = await fetch(`http://localhost:4000/v1/comments?postId=${postId}`, {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required');
        return;
      }

      const response = await fetch('http://localhost:4000/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          content: newComment,
          postId,
          parentId: replyTo
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post comment');
      }
      
      const result = await response.json();
      
      setNewComment('');
      setReplyTo(null);
      
      if (result.autoModerated) {
        alert('Comment flagged by auto-moderation and sent for review');
      } else {
        alert('Comment submitted for moderation');
      }
      
      // Refresh comments
      fetchComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
    document.getElementById('comment-input')?.focus();
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
      <h1>Comments Thread Demo</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <a href="/" style={{ marginRight: '1rem' }}>← Home</a>
        <a href="/api-keys">Manage API Keys</a>
      </div>

      {/* Comment Form */}
      <div style={{ 
        background: '#fff', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        border: '1px solid #ddd',
        marginBottom: '2rem'
      }}>
        <h3>
          {replyTo ? 'Reply to Comment' : 'Add Comment'}
          {replyTo && (
            <button 
              onClick={() => setReplyTo(null)}
              style={{ 
                marginLeft: '1rem', 
                background: '#dc3545', 
                color: 'white', 
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Cancel Reply
            </button>
          )}
        </h3>
        
        <textarea
          id="comment-input"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write your comment..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
        
        <button
          onClick={submitComment}
          disabled={loading || !newComment.trim()}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Posting...' : (replyTo ? 'Post Reply' : 'Post Comment')}
        </button>
      </div>

      {/* Comments List */}
      <div>
        <h2>Comments ({comments.length})</h2>
        
        {comments.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            No approved comments yet. Be the first to comment!
          </p>
        ) : (
          <div>
            {comments.map(comment => (
              <CommentItem 
                key={comment._id} 
                comment={comment} 
                onReply={handleReply}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>Features Demonstrated:</h3>
        <ul style={{ margin: 0 }}>
          <li>✅ 3-level comment threading</li>
          <li>✅ Reply functionality with visual nesting</li>
          <li>✅ Auto-moderation with OpenAI (optional)</li>
          <li>✅ Pending status for new comments</li>
          <li>✅ Admin approval required</li>
          <li>✅ Level indicators and reply limits</li>
        </ul>
      </div>
    </div>
  );
}