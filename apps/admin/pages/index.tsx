import { useState, useEffect } from 'react';

interface AdminStats {
  overview: {
    totalUsers: number;
    totalPosts: number;
    publishedPosts: number;
    totalComments: number;
    pendingComments: number;
    totalMedia: number;
    totalStorageGB: number;
  };
  cloudinary?: {
    credits: number;
    used_percent: number;
    limit: number;
  };
  recent: {
    posts: Array<{
      _id: string;
      title: string;
      status: string;
      createdAt: string;
      authorId: { email: string };
    }>;
    comments: Array<{
      _id: string;
      content: string;
      status: string;
      createdAt: string;
      authorId: { email: string };
      postId: { title: string };
    }>;
  };
}

function KPICard({ title, value, subtitle, color = '#007bff' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '1.5rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ color: '#666', fontSize: '14px', marginBottom: '0.5rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color, marginBottom: '0.25rem' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ color: '#666', fontSize: '12px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required. Please login first.');
        return;
      }

      const response = await fetch('http://localhost:4000/v1/admin/stats', {
        headers: { 'X-API-Key': apiKey }
      });

      if (response.status === 403) {
        setError('Admin access required. You need admin role to view this page.');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
      setUserRole('admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Loading Admin Dashboard...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '1rem', 
          borderRadius: '4px',
          border: '1px solid #f5c6cb',
          marginBottom: '2rem'
        }}>
          <h2>Access Denied</h2>
          <p>{error}</p>
          <div style={{ marginTop: '1rem' }}>
            <a href="http://localhost:3000/api-keys" style={{ marginRight: '1rem' }}>
              Get API Key
            </a>
            <a href="http://localhost:3000">
              Back to Main Site
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'Arial, sans-serif', 
      background: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#333', marginBottom: '0.5rem' }}>
            Admin Dashboard
          </h1>
          <p style={{ color: '#666', margin: 0 }}>
            Blog management and analytics overview
          </p>
        </header>

        {/* KPI Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          <KPICard 
            title="Total Users" 
            value={stats.overview.totalUsers}
            color="#28a745"
          />
          <KPICard 
            title="Total Posts" 
            value={stats.overview.totalPosts}
            subtitle={`${stats.overview.publishedPosts} published`}
            color="#007bff"
          />
          <KPICard 
            title="Comments" 
            value={stats.overview.totalComments}
            subtitle={`${stats.overview.pendingComments} pending`}
            color="#ffc107"
          />
          <KPICard 
            title="Media Files" 
            value={stats.overview.totalMedia}
            subtitle={`${stats.overview.totalStorageGB} GB used`}
            color="#17a2b8"
          />
        </div>

        {/* Cloudinary Usage */}
        {stats.cloudinary && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Cloudinary Usage</h2>
            <div style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Credits Used: {stats.cloudinary.used_percent}%</strong>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    {stats.cloudinary.credits} / {stats.cloudinary.limit} credits
                  </div>
                </div>
                <div style={{
                  width: '200px',
                  height: '8px',
                  background: '#e9ecef',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${stats.cloudinary.used_percent}%`,
                    height: '100%',
                    background: stats.cloudinary.used_percent > 80 ? '#dc3545' : '#28a745',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Recent Posts */}
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Recent Posts</h2>
            <div style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {stats.recent.posts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  No posts yet
                </div>
              ) : (
                stats.recent.posts.map(post => (
                  <div key={post._id} style={{
                    padding: '1rem',
                    borderBottom: '1px solid #f8f9fa'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {post.title}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      by {post.authorId.email} • {new Date(post.createdAt).toLocaleDateString()}
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        background: post.status === 'published' ? '#d4edda' : '#fff3cd',
                        color: post.status === 'published' ? '#155724' : '#856404'
                      }}>
                        {post.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Comments */}
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Recent Comments</h2>
            <div style={{
              background: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {stats.recent.comments.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  No comments yet
                </div>
              ) : (
                stats.recent.comments.map(comment => (
                  <div key={comment._id} style={{
                    padding: '1rem',
                    borderBottom: '1px solid #f8f9fa'
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      {comment.content.substring(0, 100)}
                      {comment.content.length > 100 && '...'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      by {comment.authorId.email} on "{comment.postId.title}"
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '12px',
                        background: comment.status === 'approved' ? '#d4edda' : 
                                   comment.status === 'pending' ? '#fff3cd' : '#f8d7da',
                        color: comment.status === 'approved' ? '#155724' : 
                               comment.status === 'pending' ? '#856404' : '#721c24'
                      }}>
                        {comment.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Quick Actions</h2>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a 
              href="http://localhost:3000/admin/comments"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              Moderate Comments ({stats.overview.pendingComments})
            </a>
            <a 
              href="http://localhost:3000/posts"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#28a745',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              View Posts
            </a>
            <a 
              href="http://localhost:3000"
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              Main Site
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}