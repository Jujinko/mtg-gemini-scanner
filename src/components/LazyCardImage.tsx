import React, { useState } from 'react';

interface LazyCardImageProps {
  src: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  onLoad?: (e: any) => void;
  style?: React.CSSProperties;
}

export default function LazyCardImage({ src, alt, className, containerClassName, onLoad, style }: LazyCardImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative ${containerClassName || ''} overflow-hidden`}>
      {/* Skeleton */}
      <div 
        className={`absolute inset-0 bg-zinc-800 animate-pulse transition-opacity duration-300 ${loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
      />
      {/* Image */}
      <img
        src={src}
        alt={alt}
        style={style}
        className={`${className || ''} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={(e) => {
          setLoaded(true);
          if (onLoad) onLoad(e);
        }}
        loading="lazy"
      />
    </div>
  );
}
