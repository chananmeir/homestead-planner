import React, { useState, useEffect, useCallback } from 'react';
import { Plant, ConflictCheck } from '../../../types';
import { apiGet, apiPost } from '../../../utils/api';

interface GardenBed {
  id: number;
  name: string;
  width: number;
  length: number;
  gridSize: number;
}

interface PositionSelectorProps {
  gardenBed: GardenBed;
  selectedPlant: Plant;
  startDate: Date;
  endDate: Date;
  onPositionSelect: (position: { x: number; y: number } | null) => void;
  onConflictDetected: (conflicts: ConflictCheck) => void;
}

interface OccupiedCell {
  x: number;
  y: number;
  plantName: string;
}

const PositionSelector: React.FC<PositionSelectorProps> = ({
  gardenBed,
  selectedPlant,
  startDate,
  endDate,
  onPositionSelect,
  onConflictDetected,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);
  const [occupiedCells, setOccupiedCells] = useState<OccupiedCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);

  // Grid configuration
  const cellSize = 40; // pixels per grid cell
  const gridWidth = Math.floor((gardenBed.width * 12) / gardenBed.gridSize);
  const gridHeight = Math.floor((gardenBed.length * 12) / gardenBed.gridSize);

  // Fetch occupied cells (plantings in this bed during the time range)
  useEffect(() => {
    const fetchOccupiedCells = async () => {
      try {
        setLoading(true);
        // Fetch planting events for this bed in the date range
        // Use planning_mode=true to check expected_harvest_date (not actual_harvest_date)
        // This allows planning future plantings in spaces that will be available
        const response = await apiGet(
          `/api/planting-events?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&planning_mode=true`
        );

        if (response.ok) {
          const events = await response.json();
          // Filter events for this bed that have position data
          const occupied: OccupiedCell[] = events
            .filter((e: any) =>
              e.gardenBedId === gardenBed.id &&
              e.positionX !== null &&
              e.positionY !== null
            )
            .map((e: any) => ({
              x: e.positionX,
              y: e.positionY,
              plantName: e.plantId, // Will need to resolve plant name from ID
            }));

          setOccupiedCells(occupied);
        }
      } catch (err) {
        console.error('Failed to fetch occupied cells:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOccupiedCells();
  }, [gardenBed.id, startDate, endDate]);

  // Debounced conflict check
  const checkConflict = useCallback(
    async (position: { x: number; y: number }) => {
      if (!position) return;

      try {
        setCheckingConflict(true);

        const response = await apiPost('/api/planting-events/check-conflict', {
          gardenBedId: gardenBed.id,
          positionX: position.x,
          positionY: position.y,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          plantId: selectedPlant.id,
        });

        if (response.ok) {
          const result: ConflictCheck = await response.json();
          onConflictDetected(result);
        }
      } catch (err) {
        console.error('Failed to check conflict:', err);
      } finally {
        setCheckingConflict(false);
      }
    },
    [gardenBed.id, startDate, endDate, selectedPlant.id, onConflictDetected]
  );

  // Debounce conflict check with 500ms delay
  useEffect(() => {
    if (!selectedPosition) return;

    const timer = setTimeout(() => {
      checkConflict(selectedPosition);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedPosition, checkConflict]);

  const handleCellClick = (x: number, y: number) => {
    // Check if cell is within bounds
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return;

    const newPosition = { x, y };
    setSelectedPosition(newPosition);
    onPositionSelect(newPosition);
  };

  const handleSkipPosition = () => {
    setSelectedPosition(null);
    onPositionSelect(null);
  };

  const isOccupied = (x: number, y: number): boolean => {
    return occupiedCells.some(cell => cell.x === x && cell.y === y);
  };

  const getCellColor = (x: number, y: number): string => {
    if (selectedPosition && selectedPosition.x === x && selectedPosition.y === y) {
      return '#3b82f6'; // Blue - selected
    }
    if (isOccupied(x, y)) {
      return '#ef4444'; // Red - occupied
    }
    return '#10b981'; // Green - available
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-700">
            Select Position in {gardenBed.name}
          </h4>
          <p className="text-xs text-gray-500">
            Click a grid cell to place {selectedPlant.name}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSkipPosition}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          Skip Position
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading grid...</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          {/* Grid visualization */}
          <div className="overflow-auto max-h-96">
            <div className="flex justify-center">
              <svg
                width={gridWidth * cellSize}
                height={gridHeight * cellSize}
                className="border-4 border-brown-600 rounded bg-brown-100"
              >
                {/* Grid cells */}
                {Array.from({ length: gridHeight }).map((_, y) =>
                  Array.from({ length: gridWidth }).map((_, x) => (
                    <g key={`cell-${x}-${y}`}>
                      {/* Cell background */}
                      <rect
                        x={x * cellSize}
                        y={y * cellSize}
                        width={cellSize}
                        height={cellSize}
                        fill={getCellColor(x, y)}
                        fillOpacity={0.2}
                        stroke="#d1d5db"
                        strokeWidth="1"
                        className="cursor-pointer hover:opacity-50 transition-opacity"
                        onClick={() => handleCellClick(x, y)}
                      />

                      {/* Cell label (development only) */}
                      {process.env.NODE_ENV === 'development' && (
                        <text
                          x={x * cellSize + cellSize / 2}
                          y={y * cellSize + cellSize / 2}
                          fontSize="10"
                          fill="#999"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          pointerEvents="none"
                          className="select-none"
                          style={{ opacity: 0.5 }}
                        >
                          {String.fromCharCode(65 + x)}{y + 1}
                        </text>
                      )}

                      {/* Occupied indicator */}
                      {isOccupied(x, y) && (
                        <circle
                          cx={x * cellSize + cellSize / 2}
                          cy={y * cellSize + cellSize / 2}
                          r={cellSize / 4}
                          fill="#ef4444"
                          opacity={0.6}
                          pointerEvents="none"
                        />
                      )}

                      {/* Selected position indicator */}
                      {selectedPosition && selectedPosition.x === x && selectedPosition.y === y && (
                        <g>
                          <circle
                            cx={x * cellSize + cellSize / 2}
                            cy={y * cellSize + cellSize / 2}
                            r={cellSize / 3}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                            strokeDasharray="5,5"
                            pointerEvents="none"
                            className="animate-pulse"
                          />
                          <text
                            x={x * cellSize + cellSize / 2}
                            y={y * cellSize + cellSize / 2}
                            fontSize={cellSize / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            pointerEvents="none"
                          >
                            {selectedPlant.icon || '🌱'}
                          </text>
                        </g>
                      )}
                    </g>
                  ))
                )}
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 bg-opacity-20 border border-gray-300 rounded"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 bg-opacity-20 border border-gray-300 rounded flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 bg-opacity-20 border border-blue-500 border-dashed rounded"></div>
              <span>Selected</span>
            </div>
          </div>

          {/* Status indicators */}
          {checkingConflict && (
            <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              <span>Checking for conflicts...</span>
            </div>
          )}

          {selectedPosition && (
            <div className="mt-3 text-sm text-gray-700">
              Selected position: <span className="font-medium">
                {String.fromCharCode(65 + selectedPosition.x)}{selectedPosition.y + 1}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Info message */}
      <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-200">
        <p>
          <strong>Position selection is optional.</strong> Skip if you only want timeline planning.
          Selecting a position enables space conflict detection and succession planning optimization.
        </p>
      </div>
    </div>
  );
};

export default PositionSelector;
