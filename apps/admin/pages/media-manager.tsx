import { useState, useEffect } from 'react';

interface MediaFile {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: { email: string };
  createdAt: string;
  metadata?: {
    width?: number;
    height?: number;
    publicId?: string;
  };
}

export default function MediaManager() {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSizeGB, setTotalSizeGB] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) return;

      const response = await fetch('http://localhost:4000/v1/admin/media', {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMedia(data.media);
        setTotalSizeGB(data.totalSizeGB);
      }
    } catch (err) {
      setError('Failed to fetch media');
    }
  };

  const purgeSelected = async () => {
    if (selectedMedia.length === 0) return;
    
    if (!confirm(`Purge ${selectedMedia.length} files from CDN? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) return;

      const response = await fetch('http://localhost:4000/v1/admin/media/purge', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ mediaIds: selectedMedia })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`${result.purgedCount} files purged successfully`);
        setSelectedMedia([]);
        fetchMedia();
      } else {
        throw new Error('Failed to purge media');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge media');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (mediaId: string) => {
    setSelectedMedia(prev => 
      prev.includes(mediaId) 
        ? prev.filter(id => id !== mediaId)
        : [...prev, mediaId]
    );
  };

  const selectAll = () => {
    setSelectedMedia(media.map(m => m._id));
  };

  const clearSelection = () => {
    setSelectedMedia([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Media Manager</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <a href="/" style={{ marginRight: '1rem' }}>← Admin Dashboard</a>
        <a href="http://localhost:3000/upload">Upload Media</a>
      </div>

      {error && (
        <div style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '1rem', 
          borderRadius: '4px',
          marginBottom: '2rem'
        }}>
          {error}
        </div>
      )}

      <div style={{ 
        background: '#e3f2fd', 
        padding: '1rem', 
        borderRadius: '4px',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <strong>Total Storage: {totalSizeGB} GB</strong>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {media.length} files • {selectedMedia.length} selected
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={selectAll} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
            Select All
          </button>
          <button onClick={clearSelection} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
            Clear
          </button>
          <button 
            onClick={purgeSelected}
            disabled={selectedMedia.length === 0 || loading}
            style={{
              padding: '0.5rem 1rem',
              background: selectedMedia.length > 0 ? '#dc3545' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedMedia.length > 0 && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? 'Purging...' : `Purge Selected (${selectedMedia.length})`}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {media.map(file => (
          <div key={file._id} style={{
            background: '#fff',
            border: selectedMedia.includes(file._id) ? '2px solid #007bff' : '1px solid #dee2e6',
            borderRadius: '8px',
            overflow: 'hidden',
            cursor: 'pointer'
          }}
          onClick={() => toggleSelection(file._id)}
          >
            <div style={{ position: 'relative' }}>
              <img 
                src={file.url} 
                alt={file.originalName}
                style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NDQgMjEgMyAxNi45NzA2IDMgMTJDMyA3LjAyOTQ0IDcuMDI5NDQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQ0IDIxIDEyWiIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K';
                }}
              />
              {selectedMedia.includes(file._id) && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: '#007bff',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>
                  ✓
                </div>
              )}
            </div>
            
            <div style={{ padding: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '14px' }}>
                {file.originalName}
              </div>
              
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>
                {formatFileSize(file.size)} • {file.mimeType}
                {file.metadata?.width && file.metadata?.height && (
                  <span> • {file.metadata.width}×{file.metadata.height}</span>
                )}
              </div>
              
              <div style={{ fontSize: '12px', color: '#666' }}>
                By {file.uploadedBy.email}
                <br />
                {new Date(file.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {media.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <h3>No media files found</h3>
          <p>Upload some images to get started!</p>
        </div>
      )}
    </div>
  );
}