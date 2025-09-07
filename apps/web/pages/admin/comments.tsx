import { useState, useEffect } from 'react';

interface PendingComment {
  _id: string;
  content: string;
  authorId: { email: string; avatar?: string };
  postId: { title: string; slug: string };
  flaggedReason?: string;
  createdAt: string;
}

export default function AdminComments() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingComments = async () => {
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required. Create one at /api-keys');
        return;
      }

      const response = await fetch('http://localhost:4000/v1/comments/pending', {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    }
  };

  useEffect(() => {
    fetchPendingComments();
  }, []);

  const moderateComment = async (commentId: string, status: 'approved' | 'spam', reason?: string) => {
    setLoading(true);
    
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required');
        return;
      }

      const response = await fetch(`http://localhost:4000/v1/comments/${commentId}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ status, reason })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to moderate comment');
      }
      
      // Remove comment from pending list
      setComments(prev => prev.filter(c => c._id !== commentId));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to moderate comment');
    } finally {
      setLoading(false);
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
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Comment Moderation</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <a href="/" style={{ marginRight: '1rem' }}>← Home</a>
        <a href="/comments" style={{ marginRight: '1rem' }}>View Comments</a>
        <a href="/api-keys">Manage API Keys</a>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#e3f2fd', borderRadius: '4px' }}>
        <h3>Pending Comments: {comments.length}</h3>
        <p style={{ margin: 0, color: '#666' }}>
          Comments require admin approval before appearing publicly. 
          Auto-flagged comments are marked with reasons.
        </p>
      </div>

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <h3>No pending comments</h3>
          <p>All comments have been moderated!</p>
        </div>
      ) : (
        <div>
          {comments.map(comment => (
            <div key={comment._id} style={{ 
              background: '#fff', 
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {comment.authorId.avatar && (
                    <img 
                      src={comment.authorId.avatar} 
                      alt="Avatar" 
                      style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '0.75rem' }}
                    />
                  )}
                  <div>
                    <strong>{comment.authorId.email}</strong>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      on "{comment.postId.title}" • {new Date(comment.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                {comment.flaggedReason && (
                  <span style={{ 
                    background: '#dc3545', 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    AUTO-FLAGGED
                  </span>
                )}
              </div>

              <div style={{ 
                background: '#f8f9fa', 
                padding: '1rem', 
                borderRadius: '4px',
                marginBottom: '1rem',
                border: comment.flaggedReason ? '2px solid #dc3545' : '1px solid #dee2e6'
              }}>
                <p style={{ margin: 0, lineHeight: '1.6' }}>
                  {comment.content}
                </p>
              </div>

              {comment.flaggedReason && (
                <div style={{ 
                  background: '#fff3cd', 
                  color: '#856404',
                  padding: '0.75rem', 
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  border: '1px solid #ffeaa7'
                }}>
                  <strong>Flagged Reason:</strong> {comment.flaggedReason}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => moderateComment(comment._id, 'approved')}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✓ Approve
                </button>
                
                <button
                  onClick={() => {
                    const reason = prompt('Reason for marking as spam (optional):');
                    moderateComment(comment._id, 'spam', reason || undefined);
                  }}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✗ Mark as Spam
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}