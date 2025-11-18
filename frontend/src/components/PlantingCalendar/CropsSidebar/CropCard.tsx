import React from 'react';
import { Plant } from '../../../types';

interface CropCardProps {
  plant: Plant;
  onClick: (plant: Plant) => void;
  isSelected?: boolean;
}

// Plant icon mapping
const PLANT_ICONS: Record<string, string> = {
  tomato: '🍅',
  lettuce: '🥬',
  carrot: '🥕',
  pepper: '🌶️',
  spinach: '🥬',
  kale: '🥬',
  broccoli: '🥦',
  cabbage: '🥬',
  onion: '🧅',
  garlic: '🧄',
  potato: '🥔',
  cucumber: '🥒',
  squash: '🎃',
  pumpkin: '🎃',
  zucchini: '🥒',
  bean: '🫘',
  pea: '🫛',
  corn: '🌽',
  radish: '🥕',
  beet: '🥕',
  strawberry: '🍓',
  raspberry: '🫐',
  blueberry: '🫐',
  basil: '🌿',
  parsley: '🌿',
  cilantro: '🌿',
  dill: '🌿',
  thyme: '🌿',
  rosemary: '🌿',
  mint: '🌿',
  oregano: '🌿',
  sunflower: '🌻',
  marigold: '🌼',
  nasturtium: '🌸',
};

const getPlantIcon = (plant: Plant): string => {
  const name = plant.name.toLowerCase();
  for (const [key, icon] of Object.entries(PLANT_ICONS)) {
    if (name.includes(key)) {
      return icon;
    }
  }
  // Default icon based on category
  if (plant.category === 'herb') return '🌿';
  if (plant.category === 'fruit') return '🍇';
  if (plant.category === 'flower') return '🌸';
  if (plant.category === 'cover-crop') return '🌾';
  return '🌱';
};

const CropCard: React.FC<CropCardProps> = ({ plant, onClick, isSelected }) => {
  return (
    <button
      onClick={() => onClick(plant)}
      className={`
        w-full text-left p-3 rounded-lg border transition-all
        ${isSelected
          ? 'bg-green-50 border-green-500 shadow-sm'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{getPlantIcon(plant)}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-800 truncate">
            {plant.name}
          </h4>
          <p className="text-xs text-gray-600 mt-0.5">
            {plant.daysToMaturity} days to maturity
          </p>
        </div>
      </div>
    </button>
  );
};

export default CropCard;
