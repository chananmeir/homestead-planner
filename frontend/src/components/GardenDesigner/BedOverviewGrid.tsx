import React from 'react';
import { GardenBed, PlantedItem, Plant } from '../../types';
import BedSummaryCard from './BedSummaryCard';

interface BedOverviewGridProps {
  beds: GardenBed[];
  plants: Plant[];
  getActivePlantedItems: (bed: GardenBed) => PlantedItem[];
  onSelectBed: (bed: GardenBed) => void;
  onCreateBed: () => void;
}

const BedOverviewGrid: React.FC<BedOverviewGridProps> = ({
  beds,
  plants,
  getActivePlantedItems,
  onSelectBed,
  onCreateBed,
}) => {
  if (beds.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">{'\uD83C\uDFA8'}</div>
          <p className="text-lg mb-4">No garden beds created yet.</p>
          <button
            data-testid="add-bed-btn-empty"
            onClick={onCreateBed}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Create Your First Bed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="bed-overview-grid"
      className="flex-1 overflow-auto p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {beds.map(bed => (
          <BedSummaryCard
            key={bed.id}
            bed={bed}
            plants={plants}
            activePlantedItems={getActivePlantedItems(bed)}
            onSelect={() => onSelectBed(bed)}
          />
        ))}

        {/* Add Bed Card */}
        <div
          onClick={onCreateBed}
          className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-4 cursor-pointer transition-all hover:border-green-400 hover:bg-green-50 flex flex-col items-center justify-center min-h-[200px]"
        >
          <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium text-gray-500">Add New Bed</span>
        </div>
      </div>
    </div>
  );
};

export default BedOverviewGrid;
