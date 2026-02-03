import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { addWeeks } from 'date-fns';
import { PlantingCalendar, Plant, GardenBed, ConflictCheck } from '../../../types';
import { apiPost } from '../../../utils/api';
import { getPrimaryPlantingDate } from './utils';

interface ConflictDetailsModalProps {
  isOpen: boolean;
  event: PlantingCalendar;
  plant: Plant | undefined;
  gardenBed: GardenBed | undefined;
  onClose: () => void;
  onEdit: () => void;
}

export const ConflictDetailsModal: React.FC<ConflictDetailsModalProps> = ({
  isOpen,
  event,
  plant,
  gardenBed,
  onClose,
  onEdit,
}) => {
  const [conflictCheck, setConflictCheck] = useState<ConflictCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate seed start date if missing but transplant date exists
  const displaySeedStartDate = useMemo(() => {
    if (event.seedStartDate) {
      return { date: event.seedStartDate, calculated: false };
    }

    // If transplant date exists but no seed start, calculate it
    if (event.transplantDate && plant?.transplantWeeksBefore) {
      return {
        date: addWeeks(event.transplantDate, -plant.transplantWeeksBefore),
        calculated: true,
      };
    }

    return null;
  }, [event.seedStartDate, event.transplantDate, plant?.transplantWeeksBefore]);

  useEffect(() => {
    if (isOpen && event.positionX !== undefined && event.positionY !== undefined) {
      checkConflicts();
    } else {
      setConflictCheck(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event.id]);

  const checkConflicts = async () => {
    if (!event.positionX || !event.positionY || !event.gardenBedId) {
      setConflictCheck({ hasConflict: false, conflicts: [] });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const plantDate = getPrimaryPlantingDate(event);
      if (!plantDate || !event.expectedHarvestDate) {
        setConflictCheck({ hasConflict: false, conflicts: [] });
        return;
      }

      const response = await apiPost('/api/planting-events/check-conflict', {
        gardenBedId: event.gardenBedId,
        positionX: event.positionX,
        positionY: event.positionY,
        startDate: plantDate.toISOString(),
        endDate: event.expectedHarvestDate.toISOString(),
        plantId: event.plantId,
        transplantDate: event.transplantDate?.toISOString(),
        directSeedDate: event.directSeedDate?.toISOString(),
        seedStartDate: event.seedStartDate?.toISOString(),
        excludeEventId: event.id,
      });

      if (!response.ok) {
        throw new Error('Failed to check conflicts');
      }

      const data = await response.json();
      setConflictCheck(data);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking conflicts:', err);
      }
      setError('Failed to load conflict details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasPosition = event.positionX !== undefined && event.positionY !== undefined;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {plant?.icon || '🌱'} {plant?.name || event.plantId} Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Event Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Planting Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              {event.variety && (
                <div>
                  <span className="font-medium text-gray-700">Variety:</span>{' '}
                  <span className="text-gray-600">{event.variety}</span>
                </div>
              )}
              {gardenBed && (
                <div>
                  <span className="font-medium text-gray-700">Garden Bed:</span>{' '}
                  <span className="text-gray-600">{gardenBed.name}</span>
                  {gardenBed.width && gardenBed.length && (
                    <span className="text-gray-500 ml-1">
                      ({gardenBed.width}' × {gardenBed.length}')
                    </span>
                  )}
                </div>
              )}
              {hasPosition && (
                <div>
                  <span className="font-medium text-gray-700">Position:</span>{' '}
                  <span className="text-blue-600">
                    ({event.positionX}, {event.positionY})
                  </span>
                  {event.spaceRequired && (
                    <span className="text-gray-500 ml-1">
                      • Uses {event.spaceRequired} cells
                    </span>
                  )}
                </div>
              )}
              {displaySeedStartDate && (
                <div>
                  <span className="font-medium text-gray-700">Seed Start:</span>{' '}
                  <span className="text-gray-600">
                    {displaySeedStartDate.date.toLocaleDateString()}
                    {displaySeedStartDate.calculated && (
                      <span className="text-xs text-gray-500 ml-1">(calculated)</span>
                    )}
                  </span>
                </div>
              )}
              {event.transplantDate && (
                <div>
                  <span className="font-medium text-gray-700">Transplant:</span>{' '}
                  <span className="text-gray-600">
                    {event.transplantDate.toLocaleDateString()}
                  </span>
                </div>
              )}
              {event.directSeedDate && (
                <div>
                  <span className="font-medium text-gray-700">Direct Seed:</span>{' '}
                  <span className="text-gray-600">
                    {event.directSeedDate.toLocaleDateString()}
                  </span>
                </div>
              )}
              {event.expectedHarvestDate && (
                <div>
                  <span className="font-medium text-gray-700">Expected Harvest:</span>{' '}
                  <span className="text-gray-600">
                    {event.expectedHarvestDate.toLocaleDateString()}
                  </span>
                </div>
              )}
              {event.notes && (
                <div>
                  <span className="font-medium text-gray-700">Notes:</span>{' '}
                  <span className="text-gray-600 italic">{event.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Conflict Information */}
          {hasPosition && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Space Conflict Check</h3>

              {loading && (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
                  Loading conflict details...
                </div>
              )}

              {error && (
                <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {!loading && !error && conflictCheck && (
                <>
                  {conflictCheck.hasConflict ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <span className="font-semibold text-amber-900">
                          Space Conflicts Detected
                        </span>
                      </div>

                      <div className="space-y-3">
                        {conflictCheck.conflicts.map((conflict, index) => (
                          <div
                            key={index}
                            className="bg-white rounded-lg p-3 border border-amber-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {conflict.plantName}
                                  {conflict.variety && (
                                    <span className="text-gray-600 font-normal ml-1">
                                      ({conflict.variety})
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {conflict.dates}
                                </div>
                                <div className="text-sm text-blue-600 mt-1">
                                  Position: ({conflict.position.x}, {conflict.position.y})
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  conflict.type === 'both'
                                    ? 'bg-red-100 text-red-800'
                                    : conflict.type === 'spatial'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {conflict.type === 'both'
                                  ? 'Space & Time'
                                  : conflict.type === 'spatial'
                                  ? 'Space Only'
                                  : 'Time Only'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {event.conflictOverride && (
                        <div className="mt-3 text-sm text-amber-700">
                          ⚠️ This event was planted with conflict override enabled.
                        </div>
                      )}

                      <div className="mt-4 text-sm text-gray-600">
                        <strong>Resolution options:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Choose a different position in the garden bed</li>
                          <li>Adjust planting or harvest dates to avoid overlap</li>
                          <li>Move to a different garden bed</li>
                          <li>Override if you know these plants are compatible</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-800">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                        <span className="font-medium">
                          No conflicts detected - this position is available!
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!hasPosition && (
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              This event does not have a position assigned. Position tracking is optional for
              timeline-only planning.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            Edit Event
          </button>
        </div>
      </div>
    </div>
  );
};
