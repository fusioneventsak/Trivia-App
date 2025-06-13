import React from 'react';
import { getStorageUrl } from '../../lib/utils';

interface MediaDisplayProps {
  url?: string;
  type: 'none' | 'image' | 'gif' | 'youtube';
  alt?: string;
  className?: string;
  fallbackText?: string;
  onError?: (error: any) => void;
}

const MediaDisplay: React.FC<MediaDisplayProps> = ({
  url,
  type,
  alt = 'Media',
  className = '',
  fallbackText = 'Media not available',
  onError
}) => {
  if (!url || type === 'none') return null;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error(`Failed to load image: ${url}`);
    if (onError) onError(e);
    
    // Replace with fallback
    const target = e.currentTarget;
    target.style.display = 'none';
    
    const parent = target.parentElement;
    if (parent && !parent.querySelector('.fallback-message')) {
      const fallback = document.createElement('div');
      fallback.className = 'fallback-message w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 rounded';
      fallback.textContent = fallbackText;
      parent.appendChild(fallback);
    }
  };

  switch (type) {
    case 'image':
    case 'gif':
      return (
        <img
          src={getStorageUrl(url)}
          alt={alt}
          className={className}
          onError={handleImageError}
          loading="lazy"
        />
      );

    case 'youtube':
      const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]+)/)?.[1];
      if (!videoId) {
        return <div className="text-red-500">Invalid YouTube URL</div>;
      }
      return (
        <iframe
          className={className}
          src={`https://www.youtube.com/embed/${videoId}`}
          allowFullScreen
        />
      );

    default:
      return null;
  }
};

export default MediaDisplay;