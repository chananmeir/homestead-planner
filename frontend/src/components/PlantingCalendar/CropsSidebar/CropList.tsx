import React from 'react';
import { Plant } from '../../../types';
import CropCard from './CropCard';

interface CropListProps {
  plants: Plant[];
  onPlantSelect: (plant: Plant) => void;
  selectedPlant?: Plant;
}

const CropList: React.FC<CropListProps> = ({ plants, onPlantSelect, selectedPlant }) => {
  if (plants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No crops found</p>
        <p className="text-xs mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  // Group plants by category
  const groupedPlants = plants.reduce((acc, plant) => {
    const category = plant.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(plant);
    return acc;
  }, {} as Record<string, Plant[]>);

  const categoryLabels: Record<string, string> = {
    vegetable: 'Vegetables',
    herb: 'Herbs',
    fruit: 'Fruits',
    flower: 'Flowers',
    'cover-crop': 'Cover Crops',
    other: 'Other',
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedPlants).map(([category, categoryPlants]) => (
        <div key={category}>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 px-2">
            {categoryLabels[category] || category} ({categoryPlants.length})
          </h4>
          <div className="space-y-2">
            {categoryPlants.map((plant) => (
              <CropCard
                key={plant.id}
                plant={plant}
                onClick={onPlantSelect}
                isSelected={selectedPlant?.id === plant.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CropList;
