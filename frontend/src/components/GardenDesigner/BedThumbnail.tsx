import React from 'react';
import { GardenBed, PlantedItem, Plant } from '../../types';

interface BedThumbnailProps {
  bed: GardenBed;
  activePlantedItems: PlantedItem[];
  plants: Plant[];
  maxWidth?: number;
  maxHeight?: number;
}

const PLANT_FAMILY_COLORS: Record<string, string> = {
  'Solanaceae': '#ef4444',   // red - tomatoes, peppers
  'Cucurbitaceae': '#f97316', // orange - squash, cucumbers
  'Fabaceae': '#22c55e',     // green - beans, peas
  'Brassicaceae': '#3b82f6', // blue - broccoli, kale
  'Apiaceae': '#f59e0b',     // amber - carrots, celery
  'Amaryllidaceae': '#a855f7', // purple - onions, garlic
  'Asteraceae': '#ec4899',   // pink - lettuce, sunflowers
  'Poaceae': '#eab308',      // yellow - corn
  'Chenopodiaceae': '#14b8a6', // teal - beets, spinach
};

const BedThumbnail: React.FC<BedThumbnailProps> = ({
  bed,
  activePlantedItems,
  plants,
  maxWidth = 140,
  maxHeight = 100,
}) => {
  const gridWidth = Math.floor((bed.width * 12) / bed.gridSize);
  const gridHeight = Math.floor((bed.length * 12) / bed.gridSize);

  // Calculate cell size to fit within max bounds
  const cellSize = Math.min(
    Math.floor(maxWidth / gridWidth),
    Math.floor(maxHeight / gridHeight),
    16 // cap cell size
  );
  const svgWidth = gridWidth * cellSize;
  const svgHeight = gridHeight * cellSize;

  // Build a map of occupied positions
  const occupiedCells = new Map<string, { plantId: string; family?: string }>();
  for (const item of activePlantedItems) {
    const key = `${item.position.x},${item.position.y}`;
    const plant = plants.find(p => p.id === item.plantId);
    occupiedCells.set(key, { plantId: item.plantId, family: plant?.family });
  }

  const getColor = (family?: string): string => {
    if (!family) return '#86efac'; // default green
    return PLANT_FAMILY_COLORS[family] || '#86efac';
  };

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="rounded border border-gray-200"
    >
      {/* Background */}
      <rect width={svgWidth} height={svgHeight} fill="#fefce8" rx={2} />

      {/* Grid lines */}
      {Array.from({ length: gridWidth + 1 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={i * cellSize} y1={0}
          x2={i * cellSize} y2={svgHeight}
          stroke="#e5e7eb" strokeWidth={0.5}
        />
      ))}
      {Array.from({ length: gridHeight + 1 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1={0} y1={i * cellSize}
          x2={svgWidth} y2={i * cellSize}
          stroke="#e5e7eb" strokeWidth={0.5}
        />
      ))}

      {/* Planted cells as colored dots */}
      {Array.from(occupiedCells.entries()).map(([key, { family }]) => {
        const [x, y] = key.split(',').map(Number);
        if (x >= gridWidth || y >= gridHeight) return null;
        const cx = x * cellSize + cellSize / 2;
        const cy = y * cellSize + cellSize / 2;
        const r = Math.max(cellSize * 0.35, 2);
        return (
          <circle
            key={key}
            cx={cx}
            cy={cy}
            r={r}
            fill={getColor(family)}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
};

export default BedThumbnail;
