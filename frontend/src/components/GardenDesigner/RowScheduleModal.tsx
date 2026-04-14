import React from 'react';
import { addDays, differenceInDays, format, isBefore } from 'date-fns';
import { Modal } from '../common/Modal';
import { PlantingEvent, Plant } from '../../types';
import PlantIcon from '../common/PlantIcon';
import { useNow } from '../../contexts/SimulationContext';

interface RowScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rowNumber: number;
  bedName: string;
  plantingEvents: PlantingEvent[];
  plants: Plant[];
  quickHarvestDays: number;
}

/**
 * Modal that displays all scheduled plantings for a specific MIGardener row
 * Shows both active (currently growing) and upcoming plantings within the specified timeframe
 */
const RowScheduleModal: React.FC<RowScheduleModalProps> = ({
  isOpen,
  onClose,
  rowNumber,
  bedName,
  plantingEvents,
  plants,
  quickHarvestDays,
}) => {
  const now = useNow();
  const today = now;
  const futureDate = addDays(today, quickHarvestDays);

  /**
   * Get plant name from plant ID
   */
  const getPlantName = (plantId: string): string => {
    const plant = plants.find(p => p.id === plantId);
    return plant ? plant.name : plantId;
  };

  /**
   * Get plant icon from plant ID
   */
  const getPlantIcon = (plantId: string): string | undefined => {
    const plant = plants.find(p => p.id === plantId);
    return plant?.icon;
  };

  /**
   * Filter and categorize plantings for this row
   */
  const getFilteredPlantings = () => {
    return plantingEvents
      .filter(event => event.rowNumber === rowNumber)
      .filter(event => {
        // Exclude harvested/completed plantings
        if (event.actualHarvestDate) return false;

        // Get the planting date (transplant or direct seed)
        const plantDate = event.transplantDate || event.directSeedDate;
        if (!plantDate) return false;

        const date = new Date(plantDate);
        // Show if planted already (active) or will be planted within range (future)
        return date <= futureDate;
      })
      .sort((a, b) => {
        // Sort by planting date (earliest first)
        const dateA = new Date(a.transplantDate || a.directSeedDate || '');
        const dateB = new Date(b.transplantDate || b.directSeedDate || '');
        return dateA.getTime() - dateB.getTime();
      });
  };

  /**
   * Categorize a planting as active or upcoming
   */
  const categorizePlanting = (event: PlantingEvent): 'active' | 'upcoming' => {
    const plantDate = new Date(event.transplantDate || event.directSeedDate || '');
    return isBefore(plantDate, today) || plantDate.toDateString() === today.toDateString()
      ? 'active'
      : 'upcoming';
  };

  /**
   * Format relative date (e.g., "in 14 days" or "10 days ago")
   */
  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const days = differenceInDays(date, today);

    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    if (days > 0) return `in ${days} days`;
    return `${Math.abs(days)} days ago`;
  };

  const filteredPlantings = getFilteredPlantings();
  const activePlantings = filteredPlantings.filter(e => categorizePlanting(e) === 'active');
  const upcomingPlantings = filteredPlantings.filter(e => categorizePlanting(e) === 'upcoming');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Row ${rowNumber} Schedule - ${bedName}`}
      size="medium"
    >
      <div className="space-y-4">
        {/* Timeframe subtitle */}
        <p className="text-sm text-gray-600">
          Showing plantings for the next {quickHarvestDays} days
        </p>

        {/* Currently Planted Section */}
        {activePlantings.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Currently Planted</h3>
            <div className="space-y-3">
              {activePlantings.map(event => {
                const plantDate = event.transplantDate || event.directSeedDate;
                const plantingMethod = event.transplantDate ? 'Transplanted' : 'Direct Seeded';
                const icon = event.plantId ? getPlantIcon(event.plantId) : null;
                const plantName = event.plantId ? getPlantName(event.plantId) : 'Unknown Plant';

                return (
                  <div
                    key={event.id}
                    className="p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-start space-x-3">
                      {icon && event.plantId && <PlantIcon plantId={event.plantId} plantIcon={icon} size={32} />}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {plantName}
                          {event.variety && (
                            <span className="text-sm text-gray-600 ml-2">({event.variety})</span>
                          )}
                          {event.successionPlanting && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Succession
                            </span>
                          )}
                        </div>
                        {plantDate && (
                          <div className="text-sm text-gray-600 mt-1">
                            {plantingMethod}: {format(new Date(plantDate), 'MMM d, yyyy')}
                          </div>
                        )}
                        {event.expectedHarvestDate && (
                          <div className="text-sm text-green-700 mt-1">
                            Expected Harvest: {format(new Date(event.expectedHarvestDate), 'MMM d, yyyy')}{' '}
                            ({formatRelativeDate(event.expectedHarvestDate)})
                          </div>
                        )}
                        {event.notes && (
                          <div className="text-sm text-gray-500 mt-1 italic">{event.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Plantings Section */}
        {upcomingPlantings.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Upcoming Plantings</h3>
            <div className="space-y-3">
              {upcomingPlantings.map(event => {
                const plantDate = event.transplantDate || event.directSeedDate;
                const plantingMethod = event.transplantDate ? 'Transplant' : 'Direct Seed';
                const icon = event.plantId ? getPlantIcon(event.plantId) : null;
                const plantName = event.plantId ? getPlantName(event.plantId) : 'Unknown Plant';

                return (
                  <div
                    key={event.id}
                    className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">📅</span>
                      {icon && event.plantId && <PlantIcon plantId={event.plantId} plantIcon={icon} size={24} />}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {plantName}
                          {event.variety && (
                            <span className="text-sm text-gray-600 ml-2">({event.variety})</span>
                          )}
                          {event.successionPlanting && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Succession
                            </span>
                          )}
                        </div>
                        {plantDate && (
                          <div className="text-sm text-blue-700 mt-1">
                            {plantingMethod}: {format(new Date(plantDate), 'MMM d, yyyy')}{' '}
                            ({formatRelativeDate(plantDate)})
                          </div>
                        )}
                        {event.expectedHarvestDate && (
                          <div className="text-sm text-gray-600 mt-1">
                            Expected Harvest: {format(new Date(event.expectedHarvestDate), 'MMM d, yyyy')}
                          </div>
                        )}
                        {event.notes && (
                          <div className="text-sm text-gray-500 mt-1 italic">{event.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredPlantings.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-gray-600">
              No plantings scheduled in the next {quickHarvestDays} days for Row {rowNumber}
            </p>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RowScheduleModal;
