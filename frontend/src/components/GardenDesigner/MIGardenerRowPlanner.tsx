import React, { useState } from 'react';
import { addDays } from 'date-fns';
import { Plant, GardenBed, PlantedItem, PlantingEvent } from '../../types';
import { API_BASE_URL } from '../../config';
import { useToast } from '../common/Toast';
import RowStrip from './RowStrip';
import RowScheduleModal from './RowScheduleModal';
import { getMIGardenerSpacing, calculateMIGardenerRows } from '../../utils/migardenerSpacing';
import { useNow } from '../../contexts/SimulationContext';

/**
 * Props for MIGardener Row Planner
 */
interface MIGardenerRowPlannerProps {
  bed: GardenBed;
  plants: Plant[];
  plantedItems: PlantedItem[];
  plantingEvents: PlantingEvent[];  // NEW: Need events to access rowNumber
  plantingDate: string;
  onPlantingComplete: () => void;
  activePlant: Plant | null;  // Plant currently being dragged
  quickHarvestDays?: number;  // Quick Harvest Filter timeframe
}

/**
 * Simplified row-based planner for MIGardener beds.
 * Instead of clicking individual grid cells, users plan by row.
 */
const MIGardenerRowPlanner: React.FC<MIGardenerRowPlannerProps> = ({
  bed,
  plants,
  plantedItems,
  plantingEvents,
  plantingDate,
  onPlantingComplete,
  activePlant,
  quickHarvestDays = 60,
}) => {
  const now = useNow();
  const { showSuccess, showError, showWarning } = useToast();

  // State for row schedule modal
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Calculate grid dimensions
  // gridWidth = length of each row (bed LENGTH)
  // gridHeight = number of rows (bed WIDTH)
  const gridWidth = Math.floor((bed.length * 12) / (bed.gridSize || 3));
  const gridHeight = Math.floor((bed.width * 12) / (bed.gridSize || 3));

  // Calculate maximum available rows based on active plant
  let maxAvailableRows = gridHeight; // Default: show all grid rows

  if (activePlant) {
    // Calculate how many physical rows fit for this plant
    maxAvailableRows = calculateMIGardenerRows(
      bed.width,
      activePlant.id,
      activePlant.spacing || 12,
      activePlant.rowSpacing
    );
  }

  // Removed: rows state (now calculating dynamically from plantedItems)
  // Removed: selectedPlantForRow, selectedVariety states (now using drag-and-drop)
  // Removed: cropNames, varieties memoized values (no longer needed)

  /**
   * Calculate how many plants fit in a row based on MIGardener spacing
   */
  const calculatePlantsPerRow = (plantId: string): number => {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return 0;

    const spacing = getMIGardenerSpacing(plant.id, plant.spacing || 12, plant.rowSpacing);
    const bedLengthInches = bed.length * 12;

    // How many plants fit along the row (horizontally)
    // Rows run lengthwise, so length determines plants per row
    return Math.floor(bedLengthInches / spacing.plantSpacing);
  };

  // Removed: handleAddToRow function (replaced by drag-and-drop in GardenDesigner)

  // Removed: createPlantedItemsForRow function (now handled in GardenDesigner)

  /**
   * Clear a row using physical rowNumber (not grid position)
   */
  const handleClearRow = async (rowNumber: number) => {
    // Find all planting events for this physical row number
    const eventsInRow = plantingEvents.filter(
      event => event.gardenBedId === bed.id && event.rowNumber === rowNumber
    );

    if (eventsInRow.length === 0) {
      showWarning(`Row ${rowNumber} is already empty`);
      return;
    }

    // Find all planted items that match these events (by position)
    const itemsInRow = plantedItems.filter(item =>
      item.position && eventsInRow.some(event =>
        event.positionX === item.position.x && event.positionY === item.position.y
      )
    );

    if (itemsInRow.length === 0) {
      showWarning(`Row ${rowNumber} is already empty`);
      return;
    }

    // Delete all items in this row
    try {
      for (const item of itemsInRow) {
        await fetch(`${API_BASE_URL}/api/planted-items/${item.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }

      showSuccess(`Row ${rowNumber} cleared`);
      onPlantingComplete();
    } catch (error) {
      showError(`Failed to clear row ${rowNumber}`);
    }
  };

  /**
   * Check if a row has upcoming plantings (future only, not currently active)
   */
  const hasUpcomingPlantings = (rowNumber: number): boolean => {
    const today = now;
    const futureDate = addDays(today, quickHarvestDays);

    return plantingEvents.some(event => {
      if (event.rowNumber !== rowNumber || event.actualHarvestDate) return false;

      const plantDate = event.transplantDate || event.directSeedDate;
      if (!plantDate) return false;

      const date = new Date(plantDate);
      // Only count future plantings, not currently active ones
      return date > today && date <= futureDate;
    });
  };

  /**
   * Handle row click to show schedule modal
   */
  const handleRowClick = (rowNumber: number) => {
    setSelectedRow(rowNumber);
    setShowScheduleModal(true);
  };

  /**
   * Get plant info for a row from actual planted items OR scheduled plantings
   * Uses PlantingEvents with rowNumber to correctly identify rows
   */
  const getRowPlantInfo = (rowNumber: number) => {
    // Get all planting events for this physical row number
    const eventsInRow = plantingEvents.filter(
      event => event.gardenBedId === bed.id && event.rowNumber === rowNumber
    );

    if (eventsInRow.length === 0) return null;

    // Get planted items that match these events (by position)
    const itemsInRow = plantedItems.filter(item =>
      item.position && eventsInRow.some(event =>
        event.positionX === item.position.x && event.positionY === item.position.y
      )
    );

    // If we have planted items, use those
    if (itemsInRow.length > 0) {
      const firstItem = itemsInRow[0];
      const plant = plants.find(p => p.id === firstItem.plantId);

      // Return null if plant not found
      if (!plant) return null;

      return {
        plant,
        variety: firstItem.variety,
        count: itemsInRow.length,
        isScheduled: false,
      };
    }

    // Otherwise, check if there are scheduled plantings for the current date filter
    const selectedDate = new Date(plantingDate);
    const scheduledEventsForDate = eventsInRow.filter(event => {
      if (event.actualHarvestDate) return false; // Skip harvested events

      const plantDate = event.transplantDate || event.directSeedDate;
      if (!plantDate) return false;

      const eventDate = new Date(plantDate);
      const harvestDate = event.expectedHarvestDate ? new Date(event.expectedHarvestDate) : null;

      // Show if planting is active on the selected date (between plant date and harvest date)
      return eventDate <= selectedDate && (!harvestDate || harvestDate >= selectedDate);
    });

    if (scheduledEventsForDate.length === 0) return null;

    // Use the first scheduled event to show what's planned for this row
    const firstEvent = scheduledEventsForDate[0];
    const plant = plants.find(p => p.id === firstEvent.plantId);

    if (!plant) return null;

    return {
      plant,
      variety: firstEvent.variety,
      count: scheduledEventsForDate.length,
      isScheduled: true,
    };
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          MIGardener Row Planner
        </h3>
        <p className="text-sm text-gray-600">
          Plant by row instead of individual cells. Each row spans the full width ({bed.width} ft = {gridWidth} cells).
        </p>
      </div>

      {/* Instructions for drag-and-drop */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>How to plant:</strong> Drag plants from the palette onto rows to automatically fill the entire row.
          Each row will be filled with the maximum number of plants based on the plant's spacing requirements.
        </p>
      </div>

      {/* Row List - Visual row strips with drag-and-drop support */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* NOTE: Shows grid rows (based on gridSize), not MIGardener rows (based on plant spacing).
            Different plants have different row spacing, so we show all grid rows and let
            validation handle capacity checking based on the specific plant being dragged. */}
        {Array.from({ length: gridHeight }, (_, i) => i + 1).map(rowNumber => {
          // Check if this row is available for the active plant
          const isRowAvailable = activePlant
            ? rowNumber <= maxAvailableRows
            : true; // No plant dragging → show all rows as available

          return (
            <RowStrip
              key={rowNumber}
              rowNumber={rowNumber}
              bedId={bed.id}
              bed={bed}
              plantInfo={getRowPlantInfo(rowNumber)}
              onClear={handleClearRow}
              isDisabled={!isRowAvailable}
              activePlant={activePlant}
              onRowClick={handleRowClick}
              hasUpcomingPlantings={hasUpcomingPlantings(rowNumber)}
            />
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> For MIGardener spacing, leave empty rows between planted rows.
          Example: Plant rows 1, 3, 5 with radish (4" row spacing), leaving rows 2, 4 as spacing.
        </p>
      </div>

      {/* Row Schedule Modal */}
      {showScheduleModal && selectedRow !== null && (
        <RowScheduleModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedRow(null);
          }}
          rowNumber={selectedRow}
          bedName={bed.name || `Bed ${bed.id}`}
          plantingEvents={plantingEvents}
          plants={plants}
          quickHarvestDays={quickHarvestDays}
        />
      )}
    </div>
  );
};

export default MIGardenerRowPlanner;
