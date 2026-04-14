import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { GardenBed, Plant } from '../../types';
import PlantIcon from '../common/PlantIcon';

interface RowStripProps {
  rowNumber: number;
  bedId: number;
  bed: GardenBed;
  plantInfo: { plant: Plant; variety?: string; count: number; isScheduled?: boolean } | null;
  onClear: (rowNumber: number) => void;
  isDisabled?: boolean;
  activePlant?: Plant | null;
  onRowClick?: (rowNumber: number) => void;
  hasUpcomingPlantings?: boolean;
}

/**
 * RowStrip - Visual representation of a single row in MIGardener bed
 * Acts as a drop target for drag-and-drop planting
 */
const RowStrip: React.FC<RowStripProps> = ({
  rowNumber,
  bedId,
  bed,
  plantInfo,
  onClear,
  isDisabled = false,
  activePlant,
  onRowClick,
  hasUpcomingPlantings = false,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `migardener-row-${bedId}-${rowNumber}`,
    disabled: isDisabled,
    data: {
      type: 'migardener-row',
      bedId,
      displayRowIndex: rowNumber,  // Explicit: visual row number (not physical row)
      bed,
    },
  });

  const isOccupied = plantInfo !== null;

  // Determine visual styling based on state
  const getRowStyles = () => {
    if (isDisabled) {
      return 'bg-gray-200 border-gray-400 cursor-not-allowed relative overflow-hidden';
    }
    if (isOver && !isDisabled) {
      return 'border-blue-400 bg-blue-50 animate-pulse';
    }
    if (isOccupied) {
      // Different styling for scheduled vs actual plantings
      if (plantInfo?.isScheduled) {
        return 'bg-blue-50 border-blue-200';
      }
      return 'bg-green-50 border-green-200';
    }
    return 'bg-gray-50 border-gray-300 border-dashed cursor-pointer hover:bg-gray-100';
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 min-h-[60px] relative ${getRowStyles()}`}
      onClick={() => onRowClick?.(rowNumber)}
      style={{ cursor: onRowClick && !isDisabled ? 'pointer' : 'default' }}
    >
      {/* Diagonal stripes overlay for disabled rows */}
      {isDisabled && (
        <div
          className="absolute inset-0 pointer-events-none opacity-30 rounded-lg"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.08) 10px, rgba(0, 0, 0, 0.08) 20px)',
          }}
        />
      )}

      {/* Calendar badge for upcoming plantings */}
      {hasUpcomingPlantings && (
        <div
          className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm z-20"
          title="Has scheduled plantings"
          onClick={(e) => {
            e.stopPropagation();
            onRowClick?.(rowNumber);
          }}
        >
          📅
        </div>
      )}

      {/* Row Number */}
      <div className="flex items-center space-x-4 flex-1 relative z-10">
        <span className={`font-mono text-sm font-semibold w-16 relative z-10 ${isDisabled ? 'text-gray-500' : 'text-gray-700'}`}>
          Row {rowNumber}
        </span>

        {/* Plant Info or Empty State */}
        {isOccupied ? (
          <div className="flex-1 flex items-center space-x-3">
            {/* Plant Icon (if available) */}
            <PlantIcon plantId={plantInfo.plant.id} plantIcon={plantInfo.plant.icon || '🌱'} size={32} />

            {/* Plant Details */}
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                {plantInfo.plant.name}
                {plantInfo.variety && (
                  <span className="text-sm text-gray-600 ml-2">
                    ({plantInfo.variety})
                  </span>
                )}
                {plantInfo.isScheduled && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Scheduled
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {plantInfo.count} planting position{plantInfo.count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            {isDisabled && activePlant ? (
              <span className="text-sm font-medium text-gray-600">
                Not available for {activePlant.name} (need {activePlant.rowSpacing || 12}" row spacing)
              </span>
            ) : (
              <span className="italic text-gray-500">
                {isOver ? 'Drop to plant entire row' : 'Drag plant here to fill row'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {isOccupied && (
          <button
            onClick={() => onClear(rowNumber)}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default RowStrip;
