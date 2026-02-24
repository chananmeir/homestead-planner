import React, { useState, useEffect } from 'react';

interface StructureIconProps {
  structureId: string;
  structureIcon: string; // Emoji fallback
  size?: number; // Size in pixels
  className?: string;
}

/**
 * StructureIcon component that displays custom structure images with emoji fallback
 *
 * Automatically tries to load an image from /structure-icons/{structureId}.png
 * Falls back to emoji if image doesn't exist or fails to load
 *
 * For SVG contexts (like property map), renders as <image> element
 * For regular contexts, can render as img or text
 */
export const StructureIcon: React.FC<StructureIconProps> = ({
  structureId,
  structureIcon,
  size = 40,
  className = ''
}) => {
  const [useImage, setUseImage] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imagePath = `/structure-icons/${structureId}.png`;

  // Reset state when structureId changes
  useEffect(() => {
    setUseImage(true);
    setImageLoaded(false);
  }, [structureId]);

  const handleImageError = () => {
    setUseImage(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Try to render image first, fall back to emoji
  if (useImage) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <img
          src={imagePath}
          alt={structureId}
          width={size}
          height={size}
          onError={handleImageError}
          onLoad={handleImageLoad}
          className={`transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectFit: 'contain' }}
        />
        {/* Show emoji while image is loading */}
        {!imageLoaded && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ fontSize: size * 0.7 }}
          >
            {structureIcon}
          </div>
        )}
      </div>
    );
  }

  // Fallback to emoji
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.7 }}
    >
      {structureIcon}
    </div>
  );
};

/**
 * SVG version for use in SVG contexts (like property maps)
 */
interface StructureIconSVGProps {
  structureId: string;
  structureIcon: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const StructureIconSVG: React.FC<StructureIconSVGProps> = ({
  structureId,
  structureIcon,
  x,
  y,
  width,
  height
}) => {
  const [useImage, setUseImage] = useState(true);
  const imagePath = `/structure-icons/${structureId}.png`;

  // Reset state when structureId changes
  useEffect(() => {
    setUseImage(true);
  }, [structureId]);

  // Try to render image first, fall back to emoji
  if (useImage) {
    return (
      <>
        <image
          x={x}
          y={y}
          width={width}
          height={height}
          href={imagePath}
          onError={() => setUseImage(false)}
          preserveAspectRatio="xMidYMid meet"
        />
      </>
    );
  }

  // Fallback to emoji text
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fontSize={height * 0.7}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {structureIcon}
    </text>
  );
};

export default StructureIcon;
