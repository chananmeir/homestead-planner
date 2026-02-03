import React from 'react';
import { Plant } from '../../../types';
import PlantIcon from '../../common/PlantIcon';

interface CropCardProps {
  plant: Plant;
  onClick: (plant: Plant) => void;
  isSelected?: boolean;
}

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
        <PlantIcon
          plantId={plant.id}
          plantIcon={plant.icon || '🌱'}
          size={32}
          className="flex-shrink-0"
        />
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
