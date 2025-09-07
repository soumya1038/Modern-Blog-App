import { useState, useCallback } from 'react';

interface UploadResponse {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  uploadParams: any;
  uploadUrl: string;
}

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    const file = files[0];
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) {
        setError('API key required. Create one at /api-keys');
        return;
      }

      // Get signed upload parameters
      const signResponse = await fetch(`http://localhost:4000/v1/media/sign?fileSize=${file.size}`, {
        headers: { 'X-API-Key': apiKey }
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json();
        throw new Error(errorData.error || 'Failed to get upload signature');
      }

      const uploadData: UploadResponse = await signResponse.json();

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', uploadData.signature);
      formData.append('timestamp', uploadData.timestamp.toString());
      formData.append('api_key', uploadData.apiKey);
      
      // Add upload parameters
      Object.entries(uploadData.uploadParams).forEach(([key, value]) => {
        if (key !== 'eager') {
          formData.append(key, value as string);
        } else {
          formData.append(key, JSON.stringify(value));
        }
      });

      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const result = await uploadResponse.json();
      setUploadedImages(prev => [...prev, result.secure_url]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Media Upload</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <a href="/" style={{ marginRight: '1rem' }}>← Home</a>
        <a href="/api-keys">Manage API Keys</a>
      </div>

      {error && (
        <div style={{ 
          background: '#fee', 
          color: '#c33', 
          padding: '1rem', 
          borderRadius: '4px', 
          marginBottom: '2rem' 
        }}>
          {error}
        </div>
      )}

      <div
        style={{
          border: dragActive ? '2px dashed #007bff' : '2px dashed #ccc',
          borderRadius: '8px',
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: dragActive ? '#f8f9fa' : '#fff',
          cursor: 'pointer',
          marginBottom: '2rem'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        {uploading ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p>Uploading...</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
            <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              Drag & drop an image here, or click to select
            </p>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Max {process.env.MAX_IMAGE_SIZE_MB || 10}MB • WebP optimization included
            </p>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div>
          <h2>Uploaded Images</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {uploadedImages.map((url, index) => (
              <div key={index} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                <img 
                  src={url} 
                  alt={`Uploaded ${index + 1}`}
                  style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                />
                <div style={{ padding: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={url} 
                    readOnly 
                    style={{ width: '100%', fontSize: '12px', padding: '4px' }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>Features:</h3>
        <ul style={{ margin: 0 }}>
          <li>✅ Drag & drop upload</li>
          <li>✅ Automatic WebP conversion (800w, 1600w)</li>
          <li>✅ Size and storage quota enforcement</li>
          <li>✅ Secure signed uploads</li>
          <li>✅ Fast CDN delivery</li>
        </ul>
      </div>
    </div>
  );
}