import React, { useState, useEffect } from 'react';

interface PlantIconProps {
  plantId: string;
  plantIcon: string; // Emoji fallback
  size?: number; // Size in pixels
  className?: string;
}

/**
 * PlantIcon component that displays custom plant images with emoji fallback
 *
 * Always tries to load PNG image first, falls back to emoji on error
 * - Attempts to load image from /plant-icons/{plantId}.png
 * - Shows emoji while loading or if image fails to load
 *
 * For SVG contexts (like garden grid), use PlantIconSVG instead
 */
export const PlantIcon: React.FC<PlantIconProps> = ({
  plantId,
  plantIcon,
  size = 40,
  className = ''
}) => {
  const [useImage, setUseImage] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const imagePath = `/plant-icons/${plantId}.png`;

  // Reset state when plantId changes
  useEffect(() => {
    console.log(`[PlantIcon] Mounting/Resetting: ${plantId}, useImage=true`);
    setUseImage(true);
    setImageLoaded(false);

    // Check if image is already loaded (cached)
    if (imgRef.current?.complete && imgRef.current.naturalHeight !== 0) {
      console.log(`[PlantIcon] Image already cached: ${imagePath}`);
      setImageLoaded(true);
    }
  }, [plantId, imagePath]);

  const handleImageError = () => {
    console.warn(`[PlantIcon] Failed to load: ${imagePath}`);
    setUseImage(false);
  };

  const handleImageLoad = () => {
    console.log(`[PlantIcon] Successfully loaded: ${imagePath}`);
    setImageLoaded(true);
  };

  // Try to render image first, fall back to emoji
  if (useImage) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <img
          ref={imgRef}
          src={imagePath}
          alt={plantId}
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
            {plantIcon}
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
      {plantIcon}
    </div>
  );
};

/**
 * SVG version for use in SVG contexts (like garden grids)
 *
 * Always tries to load PNG image first, falls back to emoji on error
 */
interface PlantIconSVGProps {
  plantId: string;
  plantIcon: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PlantIconSVG: React.FC<PlantIconSVGProps> = ({
  plantId,
  plantIcon,
  x,
  y,
  width,
  height
}) => {
  const [useImage, setUseImage] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imagePath = `/plant-icons/${plantId}.png`;

  // Reset state when plantId changes
  useEffect(() => {
    console.log(`[PlantIconSVG] Mounting/Resetting: ${plantId}, useImage=true`);
    setUseImage(true);
    setImageLoaded(false);

    // For cached SVG images, onLoad might not fire
    // Set a timeout to assume image loaded if no error after 100ms
    const timeoutId = setTimeout(() => {
      console.log(`[PlantIconSVG] Assuming cached image loaded: ${imagePath}`);
      setImageLoaded(true);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [plantId, imagePath]);

  const handleImageError = () => {
    console.warn(`[PlantIconSVG] Failed to load: ${imagePath}`);
    setUseImage(false);
  };

  const handleImageLoad = () => {
    console.log(`[PlantIconSVG] Successfully loaded: ${imagePath}`);
    setImageLoaded(true);
  };

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
          onError={handleImageError}
          onLoad={handleImageLoad}
          preserveAspectRatio="xMidYMid meet"
          style={{ opacity: imageLoaded ? 1 : 0 }}
        />
        {/* Show emoji placeholder while loading */}
        {!imageLoaded && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            fontSize={height * 0.7}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {plantIcon}
          </text>
        )}
      </>
    );
  }

  // Fallback to emoji if image failed
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fontSize={height * 0.7}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {plantIcon}
    </text>
  );
};

export default PlantIcon;
