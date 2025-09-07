import { useState, useEffect } from 'react';

interface User {
  _id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface ImpersonationState {
  userId: string;
  email: string;
  originalAdminId: string;
}

export default function Impersonate() {
  const [users, setUsers] = useState<User[]>([]);
  const [impersonating, setImpersonating] = useState<ImpersonationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    
    // Check if already impersonating
    const stored = localStorage.getItem('impersonating');
    if (stored) {
      try {
        setImpersonating(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('impersonating');
      }
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) return;

      const response = await fetch('http://localhost:4000/v1/admin/users', {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  const startImpersonation = async (userId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required');
        return;
      }

      const response = await fetch('http://localhost:4000/v1/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start impersonation');
      }
      
      const result = await response.json();
      setImpersonating(result.impersonating);
      localStorage.setItem('impersonating', JSON.stringify(result.impersonating));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start impersonation');
    } finally {\n      setLoading(false);\n    }\n  };\n\n  const stopImpersonation = async () => {\n    setLoading(true);\n    \n    try {\n      const apiKey = localStorage.getItem('apiKey');\n      if (!apiKey) return;\n\n      await fetch('http://localhost:4000/v1/admin/stop-impersonation', {\n        method: 'POST',\n        headers: { 'X-API-Key': apiKey }\n      });\n      \n      setImpersonating(null);\n      localStorage.removeItem('impersonating');\n      \n    } catch (err) {\n      setError('Failed to stop impersonation');\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const createTestPost = async () => {\n    if (!impersonating) return;\n    \n    setLoading(true);\n    \n    try {\n      const apiKey = localStorage.getItem('apiKey');\n      if (!apiKey) return;\n\n      const response = await fetch('http://localhost:4000/v1/posts', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'X-API-Key': apiKey,\n          'X-Impersonate-User': JSON.stringify(impersonating)\n        },\n        body: JSON.stringify({\n          title: `Test Post by ${impersonating.email}`,\n          content: `This post was created while impersonating ${impersonating.email}`,\n          status: 'published'\n        })\n      });\n      \n      if (response.ok) {\n        alert('Test post created successfully!');\n      } else {\n        throw new Error('Failed to create post');\n      }\n      \n    } catch (err) {\n      setError(err instanceof Error ? err.message : 'Failed to create test post');\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return (\n    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>\n      <h1>User Impersonation</h1>\n      \n      <div style={{ marginBottom: '2rem' }}>\n        <a href=\"/\" style={{ marginRight: '1rem' }}>← Admin Dashboard</a>\n        <a href=\"http://localhost:3000/posts\">View Posts</a>\n      </div>\n\n      {error && (\n        <div style={{ \n          background: '#f8d7da', \n          color: '#721c24', \n          padding: '1rem', \n          borderRadius: '4px',\n          marginBottom: '2rem'\n        }}>\n          {error}\n        </div>\n      )}\n\n      {impersonating ? (\n        <div style={{ \n          background: '#d1ecf1', \n          color: '#0c5460', \n          padding: '1.5rem', \n          borderRadius: '8px',\n          marginBottom: '2rem',\n          border: '1px solid #bee5eb'\n        }}>\n          <h2>🎭 Currently Impersonating</h2>\n          <p><strong>User:</strong> {impersonating.email}</p>\n          <p><strong>User ID:</strong> {impersonating.userId}</p>\n          \n          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>\n            <button\n              onClick={createTestPost}\n              disabled={loading}\n              style={{\n                padding: '0.75rem 1.5rem',\n                background: '#28a745',\n                color: 'white',\n                border: 'none',\n                borderRadius: '4px',\n                cursor: loading ? 'not-allowed' : 'pointer'\n              }}\n            >\n              Create Test Post as User\n            </button>\n            \n            <button\n              onClick={stopImpersonation}\n              disabled={loading}\n              style={{\n                padding: '0.75rem 1.5rem',\n                background: '#dc3545',\n                color: 'white',\n                border: 'none',\n                borderRadius: '4px',\n                cursor: loading ? 'not-allowed' : 'pointer'\n              }}\n            >\n              Stop Impersonation\n            </button>\n          </div>\n        </div>\n      ) : (\n        <div>\n          <h2>Select User to Impersonate</h2>\n          <p style={{ color: '#666', marginBottom: '2rem' }}>\n            Impersonation allows you to perform actions as another user for testing and support purposes.\n          </p>\n          \n          {users.length === 0 ? (\n            <p>Loading users...</p>\n          ) : (\n            <div style={{ display: 'grid', gap: '1rem' }}>\n              {users.map(user => (\n                <div key={user._id} style={{\n                  background: '#fff',\n                  border: '1px solid #dee2e6',\n                  borderRadius: '8px',\n                  padding: '1rem',\n                  display: 'flex',\n                  justifyContent: 'space-between',\n                  alignItems: 'center'\n                }}>\n                  <div>\n                    <strong>{user.email}</strong>\n                    <div style={{ fontSize: '14px', color: '#666' }}>\n                      Role: {user.role} • Joined: {new Date(user.createdAt).toLocaleDateString()}\n                    </div>\n                  </div>\n                  \n                  <button\n                    onClick={() => startImpersonation(user._id)}\n                    disabled={loading || user.role === 'admin'}\n                    style={{\n                      padding: '0.5rem 1rem',\n                      background: user.role === 'admin' ? '#6c757d' : '#007bff',\n                      color: 'white',\n                      border: 'none',\n                      borderRadius: '4px',\n                      cursor: (loading || user.role === 'admin') ? 'not-allowed' : 'pointer'\n                    }}\n                  >\n                    {user.role === 'admin' ? 'Cannot Impersonate Admin' : 'Impersonate'}\n                  </button>\n                </div>\n              ))}\n            </div>\n          )}\n        </div>\n      )}\n\n      <div style={{ marginTop: '3rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>\n        <h3>E2E Test Flow:</h3>\n        <ol style={{ margin: 0 }}>\n          <li>Select a user to impersonate</li>\n          <li>Click \"Create Test Post as User\"</li>\n          <li>Stop impersonation</li>\n          <li>Visit posts page to verify post is listed under the impersonated user</li>\n        </ol>\n      </div>\n    </div>\n  );\n}"