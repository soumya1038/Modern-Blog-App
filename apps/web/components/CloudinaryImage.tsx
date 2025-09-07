import Image from 'next/image';
import { useState } from 'react';

interface CloudinaryImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export default function CloudinaryImage({ 
  src, 
  alt, 
  width = 800, 
  height = 600, 
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
}: CloudinaryImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Generate Cloudinary responsive URLs
  const generateSrcSet = (baseSrc: string) => {
    if (!baseSrc.includes('cloudinary.com')) {
      return baseSrc;
    }

    const baseUrl = baseSrc.split('/upload/')[0] + '/upload/';
    const imagePath = baseSrc.split('/upload/')[1];
    
    const transformations = [
      'w_400,f_webp,q_auto',
      'w_800,f_webp,q_auto', 
      'w_1200,f_webp,q_auto',
      'w_1600,f_webp,q_auto'
    ];

    return transformations.map((transform, index) => {
      const size = [400, 800, 1200, 1600][index];
      return `${baseUrl}${transform}/${imagePath} ${size}w`;
    }).join(', ');
  };

  const optimizedSrc = src.includes('cloudinary.com') 
    ? src.replace('/upload/', `/upload/w_${width},h_${height},c_fill,f_webp,q_auto/`)
    : src;

  if (error) {
    return (
      <div 
        className={className}
        style={{
          width,
          height,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '14px'
        }}
      >
        Failed to load image
      </div>
    );
  }

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      <Image
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        style={{
          width: '100%',
          height: 'auto',
          transition: 'opacity 0.3s ease',
          opacity: isLoading ? 0 : 1,
        }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setIsLoading(false);
        }}
      />
      
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 1.5s ease-in-out infinite alternate'
          }}
        >
          <style jsx>{`
            @keyframes pulse {
              0% { opacity: 1; }
              100% { opacity: 0.5; }
            }
          `}</style>
          Loading...
        </div>
      )}
    </div>
  );
}