import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Plant } from '../../types';

interface PlantPaletteProps {
  plants: Plant[];
  onPlantSelect?: (plant: Plant) => void;
}

type CategoryFilter = 'all' | 'vegetable' | 'herb' | 'flower' | 'fruit';

const PlantPalette: React.FC<PlantPaletteProps> = ({ plants, onPlantSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  // Filter plants based on search and category, then sort alphabetically
  const filteredPlants = useMemo(() => {
    return plants
      .filter(plant => {
        const matchesSearch = plant.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || plant.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort A-Z
  }, [plants, searchTerm, selectedCategory]);

  // Category tabs
  const categories: { id: CategoryFilter; label: string; emoji: string }[] = [
    { id: 'all', label: 'All', emoji: '🌱' },
    { id: 'vegetable', label: 'Vegetables', emoji: '🥕' },
    { id: 'herb', label: 'Herbs', emoji: '🌿' },
    { id: 'flower', label: 'Flowers', emoji: '🌸' },
    { id: 'fruit', label: 'Fruits', emoji: '🍓' },
  ];

  return (
    <div className="w-[280px] bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Plant Palette</h3>

        {/* Search Input */}
        <input
          type="text"
          placeholder="Search plants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
              ${selectedCategory === category.id
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <span>{category.emoji}</span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>

      {/* Plant List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredPlants.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No plants found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredPlants.map(plant => (
              <DraggablePlantItem
                key={plant.id}
                plant={plant}
                onSelect={onPlantSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-600 text-center">
          Drag plants onto the garden grid
        </p>
      </div>
    </div>
  );
};

// Draggable Plant Item Component
interface DraggablePlantItemProps {
  plant: Plant;
  onSelect?: (plant: Plant) => void;
}

const DraggablePlantItem: React.FC<DraggablePlantItemProps> = ({ plant, onSelect }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `plant-${plant.id}`,
    data: plant,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={!isDragging ? () => onSelect?.(plant) : undefined}
      className={`bg-transparent p-2 rounded cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-0' : 'hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Plant Icon */}
        <div className="text-2xl flex-shrink-0">
          {plant.icon || '🌱'}
        </div>

        {/* Plant Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">
            {plant.name}
          </div>
          <div className="text-xs text-gray-600">
            {plant.spacing}" spacing • {plant.daysToMaturity}d
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantPalette;
