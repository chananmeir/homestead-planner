import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PlantingCalendar, Plant, GardenBed } from '../../../types';
import {
  calculateBarPosition,
  calculateBarWidth,
  getCategoryColor,
  getPrimaryPlantingDate,
  calculateDuration,
  formatDateRange,
} from './utils';
import { ConflictDetailsModal } from './ConflictDetailsModal';

interface TimelineBarProps {
  event: PlantingCalendar;
  plant: Plant | undefined; // From plant database - may not be found
  timelineStart: Date;
  monthWidth: number;
  beds: GardenBed[];
  onClick: (event: PlantingCalendar) => void;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  event,
  plant,
  timelineStart,
  monthWidth,
  beds,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const plantDate = getPrimaryPlantingDate(event);
  if (!plantDate || !event.expectedHarvestDate) {
    return null; // Can't render without dates
  }

  const duration = calculateDuration(plantDate, event.expectedHarvestDate);
  const barLeft = calculateBarPosition(plantDate, timelineStart, monthWidth);
  const barWidth = calculateBarWidth(duration, monthWidth);
  const colors = getCategoryColor(plant?.category || 'vegetable');

  // Minimum width for visibility
  const displayWidth = Math.max(barWidth, 20);

  // Look up bed name and bed object
  const gardenBed = beds.find(b => b.id === event.gardenBedId);
  const bedName = gardenBed?.name || 'Unknown Bed';

  // Calculate space required in cells (if position exists)
  const spaceInCells = event.spaceRequired || (plant?.spacing ? Math.ceil(plant.spacing / 12) : null);

  const handleBarClick = () => {
    // If has position or conflict override, show details modal
    if (event.positionX !== undefined || event.conflictOverride) {
      setShowConflictModal(true);
    } else {
      // Otherwise, trigger the standard edit handler
      onClick(event);
    }
  };

  return (
    <div className="flex items-center border-b border-gray-100 hover:bg-gray-50">
      {/* Label column */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900">{plant?.name || event.plantId}</div>
          {event.positionX !== undefined && event.positionY !== undefined && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              📍 ({event.positionX},{event.positionY})
            </span>
          )}
        </div>
        {event.variety && <div className="text-xs text-gray-600">{event.variety}</div>}
      </div>

      {/* Timeline area */}
      <div className="relative flex-1 h-12">
        {/* The bar */}
        <div
          className={`absolute top-2 h-8 rounded cursor-pointer border-2 ${colors.bg} ${colors.border}
                      opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center
                      ${event.completed ? 'opacity-50' : ''}
                      ${event.conflictOverride ? 'border-red-500 ring-1 ring-red-400' : ''}`}
          style={{
            left: `${barLeft}px`,
            width: `${displayWidth}px`,
          }}
          onClick={handleBarClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Conflict warning icon */}
          {event.conflictOverride && (
            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
              <AlertTriangle className="w-3 h-3 text-white" />
            </div>
          )}

          {/* Label inside bar if wide enough */}
          {barWidth > 60 && (
            <span className="text-xs font-medium text-white px-1 truncate">
              {plant?.icon || '🌱'} {plant?.name}
            </span>
          )}

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-20">
              <div className="font-semibold mb-1">
                {plant?.icon || '🌱'} {plant?.name || event.plantId}
              </div>
              {event.variety && (
                <div className="text-gray-300 mb-1">Variety: {event.variety}</div>
              )}

              {/* Garden bed information */}
              <div className="text-gray-300 mb-1">Bed: {bedName}</div>

              {/* Position information (if exists) */}
              {event.positionX !== undefined && event.positionY !== undefined && (
                <div className="text-blue-300 mb-1">
                  📍 Position: ({event.positionX}, {event.positionY})
                  {spaceInCells && (
                    <span className="ml-1">• {spaceInCells} cells</span>
                  )}
                </div>
              )}

              <div className="text-gray-300">
                {formatDateRange(plantDate, event.expectedHarvestDate)}
              </div>
              <div className="text-gray-300">{duration} days to harvest</div>
              {event.successionGroupId && (
                <div className="text-purple-300 mt-1">
                  🔄 Succession planting
                </div>
              )}
              {event.conflictOverride && (
                <div className="text-amber-300 mt-1">
                  ⚠️ Conflict Override - planted despite space conflict
                </div>
              )}
              {event.completed && (
                <div className="text-green-300 mt-1">✓ Completed</div>
              )}
              {event.notes && (
                <div className="text-gray-400 mt-1 text-xs italic">{event.notes}</div>
              )}
            </div>
          )}
        </div>

        {/* Succession group indicator */}
        {event.successionGroupId && (
          <div
            className="absolute top-0 w-1 h-1 bg-purple-500 rounded-full"
            style={{ left: `${barLeft}px` }}
          />
        )}
      </div>

      {/* Conflict Details Modal */}
      <ConflictDetailsModal
        isOpen={showConflictModal}
        event={event}
        plant={plant}
        gardenBed={gardenBed}
        onClose={() => setShowConflictModal(false)}
        onEdit={() => onClick(event)}
      />
    </div>
  );
};
