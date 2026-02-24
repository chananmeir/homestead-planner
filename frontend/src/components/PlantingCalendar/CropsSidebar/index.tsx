import React, { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { Plant } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import SearchBar from './SearchBar';
import FilterPanel from './FilterPanel';
import CropList from './CropList';

interface CropsSidebarProps {
  onPlantSelect: (plant: Plant) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CropsSidebar: React.FC<CropsSidebarProps> = ({
  onPlantSelect,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | undefined>();

  // Debounced search query (300ms delay)
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter plants based on search and category
  const filteredPlants = useMemo(() => {
    let plants = PLANT_DATABASE;

    // Filter by search query
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase();
      plants = plants.filter(
        (plant) =>
          plant.name.toLowerCase().includes(query) ||
          plant.scientificName?.toLowerCase().includes(query)
      );
    }

    // Filter by categories
    if (selectedCategories.length > 0) {
      plants = plants.filter((plant) =>
        selectedCategories.includes(plant.category)
      );
    }

    return plants;
  }, [debouncedQuery, selectedCategories]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PLANT_DATABASE.forEach((plant) => {
      const category = plant.category;
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, []);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handlePlantSelect = (plant: Plant) => {
    setSelectedPlant(plant);
    onPlantSelect(plant);
    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out z-50
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">My Crops</h2>
            <button
              onClick={onClose}
              className="lg:hidden p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <FilterPanel
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
            categoryCounts={categoryCounts}
          />
        </div>

        {/* Scrollable crop list */}
        <div className="flex-1 overflow-y-auto p-4">
          <CropList
            plants={filteredPlants}
            onPlantSelect={handlePlantSelect}
            selectedPlant={selectedPlant}
          />
        </div>

        {/* Footer with count */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3">
          <p className="text-xs text-gray-500 text-center">
            Showing {filteredPlants.length} of {PLANT_DATABASE.length} crops
          </p>
        </div>
      </div>
    </>
  );
};

export default CropsSidebar;
