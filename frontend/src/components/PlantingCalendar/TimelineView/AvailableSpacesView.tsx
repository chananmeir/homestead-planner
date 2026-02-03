import React, { useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';
import { GardenBed, PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { apiGet } from '../../../utils/api';
import { coordinateToGridLabel } from '../../GardenDesigner/utils/gridCoordinates';
import {
  getOccupiedCells,
  getAvailableCells,
  findContiguousSpaces,
  calculateSpaceRequirement,
  formatOccupiedCell,
  OccupiedCell,
  AvailableCell,
} from '../utils/spaceAvailability';

interface AvailableSpacesViewProps {
  isOpen: boolean;
  onClose: () => void;
  initialBedId?: string | number;
  initialDateRange?: { start: Date; end: Date };
  onPositionSelect?: (bedId: string | number, position: { x: number; y: number }) => void;
}

const AvailableSpacesView: React.FC<AvailableSpacesViewProps> = ({
  isOpen,
  onClose,
  initialBedId,
  initialDateRange,
  onPositionSelect,
}) => {
  // State
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([]);
  const [selectedBedId, setSelectedBedId] = useState<number | string>(initialBedId || '');
  const [startDate, setStartDate] = useState<Date>(
    initialDateRange?.start || new Date()
  );
  const [endDate, setEndDate] = useState<Date>(
    initialDateRange?.end || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
  );
  const [plantingEvents, setPlantingEvents] = useState<PlantingCalendar[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed values
  const selectedBed = gardenBeds.find((bed) => bed.id === selectedBedId);
  const selectedPlant = selectedPlantId
    ? PLANT_DATABASE.find((p) => p.id === selectedPlantId)
    : null;
  const spaceRequired = selectedPlant
    ? calculateSpaceRequirement(
        selectedPlant,
        selectedBed?.gridSize || 12,
        selectedBed?.planningMethod || 'row'
      )
    : 0;

  const occupiedCells: OccupiedCell[] = selectedBed
    ? getOccupiedCells(selectedBedId, { start: startDate, end: endDate }, plantingEvents, selectedBed)
    : [];

  const availableCells: AvailableCell[] = selectedBed
    ? getAvailableCells(selectedBed, occupiedCells)
    : [];

  const suitableCells: AvailableCell[] =
    spaceRequired > 0
      ? findContiguousSpaces(availableCells, spaceRequired)
      : availableCells;

  // Load garden beds
  useEffect(() => {
    const loadBeds = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGet('/api/garden-beds');
        if (response.ok) {
          const data = await response.json();
          setGardenBeds(data);
          if (!selectedBedId && data.length > 0) {
            setSelectedBedId(data[0].id);
          }
        } else {
          throw new Error('Failed to load garden beds');
        }
      } catch (err) {
        setError('Failed to load garden beds');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadBeds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load planting events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGet('/api/planting-events');
        if (response.ok) {
          const data = await response.json();
          // Parse date strings to Date objects
          const eventsWithDates = data.map((event: any) => ({
            ...event,
            seedStartDate: event.seedStartDate ? new Date(event.seedStartDate) : undefined,
            transplantDate: event.transplantDate ? new Date(event.transplantDate) : undefined,
            directSeedDate: event.directSeedDate ? new Date(event.directSeedDate) : undefined,
            expectedHarvestDate: new Date(event.expectedHarvestDate),
          }));
          setPlantingEvents(eventsWithDates);
        } else {
          throw new Error('Failed to load planting events');
        }
      } catch (err) {
        setError('Failed to load planting events');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  // Handlers
  const handleCellClick = (x: number, y: number) => {
    // Check if this cell is available
    const isAvailable = availableCells.some((cell) => cell.x === x && cell.y === y);
    if (!isAvailable) return;

    // Check if it's suitable (part of contiguous space if filter applied)
    if (spaceRequired > 0) {
      const isSuitable = suitableCells.some((cell) => cell.x === x && cell.y === y);
      if (!isSuitable) return;
    }

    setSelectedPosition({ x, y });
  };

  const handleConfirmSelection = () => {
    if (selectedPosition && onPositionSelect) {
      onPositionSelect(selectedBedId, selectedPosition);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Available Spaces Finder</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Garden Bed Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Garden Bed *
              </label>
              <select
                value={selectedBedId}
                onChange={(e) => {
                  const value = e.target.value;
                  const bedId = value === '' ? '' : Number(value);
                  setSelectedBedId(bedId);
                  setSelectedPosition(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={loading}
              >
                <option value="">Select a bed...</option>
                {gardenBeds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.name} ({bed.width}" × {bed.length}")
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  setStartDate(new Date(e.target.value));
                  setSelectedPosition(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date *
              </label>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  setEndDate(new Date(e.target.value));
                  setSelectedPosition(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Space Requirement Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Space Needed <span className="text-gray-500 font-normal">(optional filter)</span>
            </label>
            <select
              value={selectedPlantId}
              onChange={(e) => {
                setSelectedPlantId(e.target.value);
                setSelectedPosition(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Show all available cells</option>
              {PLANT_DATABASE.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.icon} {plant.name} ({plant.spacing}" spacing ≈{' '}
                  {calculateSpaceRequirement(plant, selectedBed?.gridSize || 12)} cells)
                </option>
              ))}
            </select>
            {selectedPlant && (
              <p className="mt-1 text-xs text-gray-600">
                Showing only positions where a {selectedPlant.spacing}" × {selectedPlant.spacing}" area fits
              </p>
            )}
          </div>

          {/* Grid Visualization */}
          {selectedBed ? (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {selectedBed.name} Grid
                </h3>
                <p className="text-xs text-gray-600">
                  Click a green or yellow cell to select it as a planting position
                </p>
              </div>

              {/* SVG Grid */}
              <div className="inline-block border border-gray-300 bg-white rounded">
                <svg
                  width={Math.min(600, Math.floor((selectedBed.width * 12) / (selectedBed.gridSize || 12)) * 40)}
                  height={Math.min(400, Math.floor((selectedBed.length * 12) / (selectedBed.gridSize || 12)) * 40)}
                  className="cursor-pointer"
                >
                  {Array.from(
                    { length: Math.floor((selectedBed.length * 12) / (selectedBed.gridSize || 12)) },
                    (_, y) =>
                      Array.from(
                        { length: Math.floor((selectedBed.width * 12) / (selectedBed.gridSize || 12)) },
                        (_, x) => {
                          const isOccupied = occupiedCells.some(
                            (cell) => cell.x === x && cell.y === y
                          );
                          const isAvailable = availableCells.some(
                            (cell) => cell.x === x && cell.y === y
                          );
                          const isSuitable =
                            spaceRequired > 0
                              ? suitableCells.some((cell) => cell.x === x && cell.y === y)
                              : isAvailable;
                          const isSelected =
                            selectedPosition?.x === x && selectedPosition?.y === y;

                          const occupiedCell = occupiedCells.find(
                            (cell) => cell.x === x && cell.y === y
                          );

                          let fill = '#f9fafb'; // Gray for unavailable
                          if (isOccupied) fill = '#ef4444'; // Red for occupied
                          else if (isSelected) fill = '#3b82f6'; // Blue for selected
                          else if (isSuitable) fill = '#22c55e'; // Green for suitable
                          else if (isAvailable) fill = '#fbbf24'; // Yellow for available but not suitable

                          return (
                            <rect
                              key={`${x}-${y}`}
                              x={x * 40}
                              y={y * 40}
                              width={40}
                              height={40}
                              fill={fill}
                              stroke="#d1d5db"
                              strokeWidth="1"
                              onClick={() => handleCellClick(x, y)}
                              className="hover:opacity-80 transition-opacity"
                            >
                              {occupiedCell && (
                                <title>{formatOccupiedCell(occupiedCell)}</title>
                              )}
                            </rect>
                          );
                        }
                      )
                  )}
                </svg>
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 border border-gray-300 rounded"></div>
                  <span className="text-gray-700">
                    {spaceRequired > 0 ? 'Suitable (fits requirement)' : 'Available'}
                  </span>
                </div>
                {spaceRequired > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-400 border border-gray-300 rounded"></div>
                    <span className="text-gray-700">Available (too small)</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 border border-gray-300 rounded"></div>
                  <span className="text-gray-700">Occupied (hover for details)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 border border-gray-300 rounded"></div>
                  <span className="text-gray-700">Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-50 border border-gray-300 rounded"></div>
                  <span className="text-gray-700">Unavailable</span>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Total cells:</span>{' '}
                    <span className="font-medium text-blue-900">
                      {Math.floor((selectedBed.width * 12) / (selectedBed.gridSize || 12)) *
                        Math.floor((selectedBed.length * 12) / (selectedBed.gridSize || 12))}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Available:</span>{' '}
                    <span className="font-medium text-blue-900">{availableCells.length}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Occupied:</span>{' '}
                    <span className="font-medium text-blue-900">{occupiedCells.length}</span>
                  </div>
                </div>
              </div>

              {/* Available Positions List */}
              {(spaceRequired > 0 ? suitableCells : availableCells).length > 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-green-900 mb-2">
                    Available Positions {spaceRequired > 0 && '(Suitable for Selected Plant)'}
                  </h4>
                  <div className="text-xs text-green-800 flex flex-wrap gap-1">
                    {(spaceRequired > 0 ? suitableCells : availableCells)
                      .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
                      .map((cell) => (
                        <span
                          key={`${cell.x}-${cell.y}`}
                          className="inline-block px-2 py-1 bg-white border border-green-300 rounded font-mono cursor-pointer hover:bg-green-100 transition-colors"
                          onClick={() => handleCellClick(cell.x, cell.y)}
                        >
                          {coordinateToGridLabel(cell.x, cell.y)}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-200">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Select a garden bed to view available spaces</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedPosition
              ? `Selected position: (${selectedPosition.x}, ${selectedPosition.y})`
              : 'Click a green cell to select a position'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {onPositionSelect && (
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedPosition}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Use This Position
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailableSpacesView;
