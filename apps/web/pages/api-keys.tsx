import { useState, useEffect } from 'react';

interface ApiKey {
  id: number;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState({ name: '', scopes: [] as string[] });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch('http://localhost:4000/v1/auth/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error('Failed to fetch API keys');
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const createApiKey = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token || !newKey.name || newKey.scopes.length === 0) return;

    try {
      const response = await fetch('http://localhost:4000/v1/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newKey),
      });
      
      const data = await response.json();
      if (response.ok) {
        setGeneratedKey(data.key);
        setNewKey({ name: '', scopes: [] });
        fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to create API key');
    }
  };

  const revokeApiKey = async (id: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      await fetch(`http://localhost:4000/v1/auth/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to revoke API key');
    }
  };

  const handleScopeChange = (scope: string) => {
    setNewKey(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>API Keys</h1>
      
      {generatedKey && (
        <div style={{ background: '#f0f8ff', padding: '1rem', marginBottom: '2rem', border: '1px solid #ccc' }}>
          <h3>Your new API key:</h3>
          <code style={{ background: '#fff', padding: '0.5rem', display: 'block', marginBottom: '1rem' }}>
            {generatedKey}
          </code>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Store this key securely - it will not be shown again!
          </p>
          <button onClick={() => setGeneratedKey(null)}>Close</button>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2>Create New API Key</h2>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Key name"
            value={newKey.name}
            onChange={(e) => setNewKey(prev => ({ ...prev, name: e.target.value }))}
            style={{ padding: '0.5rem', marginRight: '1rem', width: '200px' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Scopes:</label>
          {['read', 'write', 'admin'].map(scope => (
            <label key={scope} style={{ marginLeft: '1rem' }}>
              <input
                type="checkbox"
                checked={newKey.scopes.includes(scope)}
                onChange={() => handleScopeChange(scope)}
              />
              {scope}
            </label>
          ))}
        </div>
        <button onClick={createApiKey} style={{ padding: '0.5rem 1rem' }}>
          Create API Key
        </button>
      </div>

      <div>
        <h2>Existing API Keys</h2>
        {apiKeys.length === 0 ? (
          <p>No API keys found</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Scopes</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Created</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Last Used</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(key => (
                <tr key={key.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{key.name}</td>
                  <td style={{ padding: '0.5rem' }}>{key.scopes.join(', ')}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button 
                      onClick={() => revokeApiKey(key.id)}
                      style={{ color: 'red', cursor: 'pointer' }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}