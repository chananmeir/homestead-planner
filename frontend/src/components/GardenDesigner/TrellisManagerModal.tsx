import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { GardenBed, TrellisStructure, TrellisCapacity } from '../../types';
import { API_BASE_URL } from '../../config';
import { useToast } from '../common/Toast';
import {
  coordinateToGridLabel,
  gridLabelToCoordinate,
  isValidGridLabel,
  getMaxColumnLabel
} from './utils/gridCoordinates';

interface TrellisManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBed: GardenBed | null;
  onSuccess: () => void;
}

interface Property {
  id: number;
  name: string;
}

interface TrellisPreset {
  id: string;
  label: string;
  description: string;
  getGridCoordinates: (gridDims: { columns: number; rows: number }) => { startGrid: string; endGrid: string };
}

interface GridDimensions {
  columns: number;
  rows: number;
  gridSizeInches: number;
  maxCol: string;
  maxRow: number;
}

const TRELLIS_TYPES = [
  { value: 'post_wire', label: 'Post & Wire', description: 'Simple wire trellis between posts' },
  { value: 'fence', label: 'Fence', description: 'Existing fence or wall' },
  { value: 'arbor', label: 'Arbor', description: 'Overhead arch structure' },
  { value: 'a-frame', label: 'A-Frame', description: 'Freestanding A-frame trellis' },
  { value: 'espalier', label: 'Espalier', description: 'Flat wall-mounted trellis for training' },
];

const TRELLIS_PRESETS: TrellisPreset[] = [
  {
    id: 'north_wall',
    label: 'North Wall (full length)',
    description: 'Runs along the top row from left to right',
    getGridCoordinates: ({ columns, rows }) => ({
      startGrid: `A${rows}`,
      endGrid: coordinateToGridLabel(columns - 1, rows - 1)
    })
  },
  {
    id: 'south_wall',
    label: 'South Wall (full length)',
    description: 'Runs along the bottom row from left to right',
    getGridCoordinates: ({ columns }) => ({
      startGrid: 'A1',
      endGrid: coordinateToGridLabel(columns - 1, 0)
    })
  },
  {
    id: 'east_wall',
    label: 'East Wall (full height)',
    description: 'Runs along the right edge from bottom to top',
    getGridCoordinates: ({ columns, rows }) => ({
      startGrid: coordinateToGridLabel(columns - 1, 0),
      endGrid: coordinateToGridLabel(columns - 1, rows - 1)
    })
  },
  {
    id: 'west_wall',
    label: 'West Wall (full height)',
    description: 'Runs along the left edge from bottom to top',
    getGridCoordinates: ({ rows }) => ({
      startGrid: 'A1',
      endGrid: `A${rows}`
    })
  },
  {
    id: 'center_horizontal',
    label: 'Center Horizontal',
    description: 'Runs horizontally through the middle',
    getGridCoordinates: ({ columns, rows }) => {
      const midRow = Math.ceil(rows / 2);
      return {
        startGrid: `A${midRow}`,
        endGrid: coordinateToGridLabel(columns - 1, midRow - 1)
      };
    }
  },
  {
    id: 'center_vertical',
    label: 'Center Vertical',
    description: 'Runs vertically through the middle',
    getGridCoordinates: ({ columns, rows }) => {
      const midCol = Math.floor(columns / 2);
      return {
        startGrid: coordinateToGridLabel(midCol, 0),
        endGrid: coordinateToGridLabel(midCol, rows - 1)
      };
    }
  },
  {
    id: 'custom',
    label: 'Custom Position',
    description: 'Specify your own grid coordinates',
    getGridCoordinates: () => ({ startGrid: 'A1', endGrid: 'A1' })
  }
];

// Helper to get grid dimensions from bed
const getGridDimensions = (bed: GardenBed): GridDimensions => {
  const gridSizeInches = bed.gridSize || 12;
  const widthInches = bed.width * 12;
  const lengthInches = bed.length * 12;

  const columns = Math.floor(lengthInches / gridSizeInches);
  const rows = Math.floor(widthInches / gridSizeInches);

  return {
    columns,
    rows,
    gridSizeInches,
    maxCol: getMaxColumnLabel(columns),
    maxRow: rows
  };
};

// Helper to convert grid label to feet coordinates
const gridLabelToFeetCoordinates = (
  gridLabel: string,
  bed: GardenBed
): { x: number; y: number } | null => {
  const coord = gridLabelToCoordinate(gridLabel);
  if (!coord) return null;

  const gridSizeFeet = (bed.gridSize || 12) / 12;

  return {
    x: coord.x * gridSizeFeet,
    y: coord.y * gridSizeFeet
  };
};

// Helper to convert feet coordinates to grid label
const feetCoordinatesToGridLabel = (
  x: number,
  y: number,
  bed: GardenBed
): string => {
  const gridSizeFeet = (bed.gridSize || 12) / 12;
  const gridX = Math.round(x / gridSizeFeet);
  const gridY = Math.round(y / gridSizeFeet);
  return coordinateToGridLabel(gridX, gridY);
};

// Helper to get orientation label
const getOrientationLabel = (
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string => {
  const dx = endX - startX;
  const dy = endY - startY;

  // Perfectly horizontal (within 0.1 feet tolerance)
  if (Math.abs(dy) < 0.1) {
    if (Math.abs(dx) < 0.1) return 'Point (no length)';
    return dx > 0 ? 'Horizontal (West to East)' : 'Horizontal (East to West)';
  }

  // Perfectly vertical
  if (Math.abs(dx) < 0.1) {
    return dy > 0 ? 'Vertical (South to North)' : 'Vertical (North to South)';
  }

  // Diagonal - calculate angle
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle >= 45 && angle < 135) return 'Diagonal (Southwest to Northeast)';
  if (angle >= -45 && angle < 45) return 'Diagonal (West to East)';
  if (angle >= -135 && angle < -45) return 'Diagonal (Northeast to Southwest)';
  return 'Diagonal (East to West)';
};

// Visual Grid Preview Component
const TrellisGridPreview: React.FC<{
  bed: GardenBed;
  startGrid: string;
  endGrid: string;
}> = ({ bed, startGrid, endGrid }) => {
  const gridDims = getGridDimensions(bed);
  const startCoord = gridLabelToCoordinate(startGrid);
  const endCoord = gridLabelToCoordinate(endGrid);

  // Calculate SVG dimensions
  const cellSize = 30;
  const padding = 40;
  const svgWidth = gridDims.columns * cellSize + padding * 2;
  const svgHeight = gridDims.rows * cellSize + padding * 2;

  return (
    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">Grid Preview</p>
      <svg width={svgWidth} height={svgHeight} className="mx-auto">
        {/* Draw grid cells */}
        {Array.from({ length: gridDims.rows }).map((_, rowIdx) =>
          Array.from({ length: gridDims.columns }).map((_, colIdx) => (
            <rect
              key={`cell-${colIdx}-${rowIdx}`}
              x={padding + colIdx * cellSize}
              y={padding + (gridDims.rows - 1 - rowIdx) * cellSize}
              width={cellSize}
              height={cellSize}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))
        )}

        {/* Column labels (A, B, C, etc.) */}
        {Array.from({ length: gridDims.columns }).map((_, colIdx) => {
          const colLabel = coordinateToGridLabel(colIdx, 0).replace(/\d+$/, '');
          return (
            <text
              key={`col-${colIdx}`}
              x={padding + colIdx * cellSize + cellSize / 2}
              y={padding - 10}
              fontSize="12"
              fill="#64748b"
              textAnchor="middle"
              fontWeight="bold"
            >
              {colLabel}
            </text>
          );
        })}

        {/* Row labels (1, 2, 3, etc.) */}
        {Array.from({ length: gridDims.rows }).map((_, rowIdx) => (
          <text
            key={`row-${rowIdx}`}
            x={padding - 10}
            y={padding + (gridDims.rows - 1 - rowIdx) * cellSize + cellSize / 2 + 5}
            fontSize="12"
            fill="#64748b"
            textAnchor="end"
            fontWeight="bold"
          >
            {rowIdx + 1}
          </text>
        ))}

        {/* Trellis line */}
        {startCoord && endCoord && (
          <>
            <line
              x1={padding + startCoord.x * cellSize + cellSize / 2}
              y1={padding + (gridDims.rows - 1 - startCoord.y) * cellSize + cellSize / 2}
              x2={padding + endCoord.x * cellSize + cellSize / 2}
              y2={padding + (gridDims.rows - 1 - endCoord.y) * cellSize + cellSize / 2}
              stroke="#059669"
              strokeWidth="3"
            />

            {/* Start point */}
            <circle
              cx={padding + startCoord.x * cellSize + cellSize / 2}
              cy={padding + (gridDims.rows - 1 - startCoord.y) * cellSize + cellSize / 2}
              r="6"
              fill="#059669"
            />
            <text
              x={padding + startCoord.x * cellSize + cellSize / 2}
              y={padding + (gridDims.rows - 1 - startCoord.y) * cellSize - 10}
              fontSize="11"
              fill="#059669"
              textAnchor="middle"
              fontWeight="bold"
            >
              {startGrid}
            </text>

            {/* End point */}
            <circle
              cx={padding + endCoord.x * cellSize + cellSize / 2}
              cy={padding + (gridDims.rows - 1 - endCoord.y) * cellSize + cellSize / 2}
              r="6"
              fill="#dc2626"
            />
            <text
              x={padding + endCoord.x * cellSize + cellSize / 2}
              y={padding + (gridDims.rows - 1 - endCoord.y) * cellSize - 10}
              fontSize="11"
              fill="#dc2626"
              textAnchor="middle"
              fontWeight="bold"
            >
              {endGrid}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

export const TrellisManagerModal: React.FC<TrellisManagerModalProps> = ({
  isOpen,
  onClose,
  activeBed,
  onSuccess
}) => {
  const [trellises, setTrellises] = useState<TrellisStructure[]>([]);
  const [capacities, setCapacities] = useState<Map<number, TrellisCapacity>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTrellis, setEditingTrellis] = useState<TrellisStructure | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('north_wall');
  const { showSuccess, showError } = useToast();

  // Form state - using grid labels instead of feet coordinates
  const [formData, setFormData] = useState({
    name: '',
    trellisType: 'post_wire',
    startGrid: 'A1',
    endGrid: 'A1',
    heightInches: 72,
    wireSpacingInches: 12,
    numWires: 5,
    notes: ''
  });

  // Fetch trellises when modal opens or bed changes
  useEffect(() => {
    if (isOpen && activeBed) {
      fetchBedTrellises();
    }
  }, [isOpen, activeBed]);

  const fetchBedTrellises = async () => {
    if (!activeBed) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/trellis-structures?gardenBedId=${activeBed.id}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data: TrellisStructure[] = await response.json();
        setTrellises(data);

        // Fetch capacity for each trellis
        for (const trellis of data) {
          await fetchTrellisCapacity(trellis.id);
        }
      } else {
        showError('Failed to load trellises');
      }
    } catch (error) {
      console.error('Failed to fetch trellises:', error);
      showError('Failed to load trellises');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrellisCapacity = async (trellisId: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/trellis-structures/${trellisId}/capacity`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const capacity: TrellisCapacity = await response.json();
        setCapacities(prev => new Map(prev).set(trellisId, capacity));
      }
    } catch (error) {
      console.error(`Failed to fetch capacity for trellis ${trellisId}:`, error);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);

    if (presetId === 'custom' || !activeBed) {
      return;
    }

    const preset = TRELLIS_PRESETS.find(p => p.id === presetId);
    if (preset) {
      const gridDims = getGridDimensions(activeBed);
      const { startGrid, endGrid } = preset.getGridCoordinates(gridDims);

      setFormData({
        ...formData,
        startGrid,
        endGrid
      });
    }
  };

  const handleCreateTrellis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBed) return;

    // Validate grid labels
    const gridDims = getGridDimensions(activeBed);
    const startValidation = isValidGridLabel(formData.startGrid, gridDims.columns, gridDims.rows);
    const endValidation = isValidGridLabel(formData.endGrid, gridDims.columns, gridDims.rows);

    if (!startValidation.valid || !endValidation.valid) {
      showError('Please enter valid grid coordinates');
      return;
    }

    // Check that start and end are not the same
    if (formData.startGrid === formData.endGrid) {
      showError('Start and end positions cannot be the same');
      return;
    }

    // Convert grid labels to feet coordinates for backend
    const startFeet = gridLabelToFeetCoordinates(formData.startGrid, activeBed);
    const endFeet = gridLabelToFeetCoordinates(formData.endGrid, activeBed);

    if (!startFeet || !endFeet) {
      showError('Failed to convert grid coordinates');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gardenBedId: activeBed.id,
          name: formData.name,
          trellisType: formData.trellisType,
          startX: startFeet.x,
          startY: startFeet.y,
          endX: endFeet.x,
          endY: endFeet.y,
          heightInches: formData.heightInches,
          wireSpacingInches: formData.wireSpacingInches,
          numWires: formData.numWires,
          notes: formData.notes
        })
      });

      if (response.ok) {
        showSuccess(`Created trellis: ${formData.name}`);
        resetForm();
        fetchBedTrellises();
        onSuccess();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to create trellis');
      }
    } catch (error) {
      console.error('Failed to create trellis:', error);
      showError('Failed to create trellis');
    }
  };

  const handleUpdateTrellis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrellis || !activeBed) return;

    // Validate grid labels
    const gridDims = getGridDimensions(activeBed);
    const startValidation = isValidGridLabel(formData.startGrid, gridDims.columns, gridDims.rows);
    const endValidation = isValidGridLabel(formData.endGrid, gridDims.columns, gridDims.rows);

    if (!startValidation.valid || !endValidation.valid) {
      showError('Please enter valid grid coordinates');
      return;
    }

    // Check that start and end are not the same
    if (formData.startGrid === formData.endGrid) {
      showError('Start and end positions cannot be the same');
      return;
    }

    // Convert grid labels to feet coordinates for backend
    const startFeet = gridLabelToFeetCoordinates(formData.startGrid, activeBed);
    const endFeet = gridLabelToFeetCoordinates(formData.endGrid, activeBed);

    if (!startFeet || !endFeet) {
      showError('Failed to convert grid coordinates');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures/${editingTrellis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gardenBedId: activeBed.id,
          name: formData.name,
          trellisType: formData.trellisType,
          startX: startFeet.x,
          startY: startFeet.y,
          endX: endFeet.x,
          endY: endFeet.y,
          heightInches: formData.heightInches,
          wireSpacingInches: formData.wireSpacingInches,
          numWires: formData.numWires,
          notes: formData.notes
        })
      });

      if (response.ok) {
        showSuccess(`Updated trellis: ${formData.name}`);
        resetForm();
        fetchBedTrellises();
        onSuccess();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update trellis');
      }
    } catch (error) {
      console.error('Failed to update trellis:', error);
      showError('Failed to update trellis');
    }
  };

  const handleDeleteTrellis = async (trellis: TrellisStructure) => {
    const capacity = capacities.get(trellis.id);
    if (capacity && capacity.allocatedFeet > 0) {
      showError(`Cannot delete trellis "${trellis.name}" - it has ${capacity.allocatedFeet}ft allocated to plants. Remove plants first.`);
      return;
    }

    if (!window.confirm(`Delete trellis "${trellis.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures/${trellis.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        showSuccess(`Deleted trellis: ${trellis.name}`);
        fetchBedTrellises();
        onSuccess();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete trellis');
      }
    } catch (error) {
      console.error('Failed to delete trellis:', error);
      showError('Failed to delete trellis');
    }
  };

  const startEdit = (trellis: TrellisStructure) => {
    setEditingTrellis(trellis);

    // Convert feet coordinates to grid labels for display
    const startGrid = activeBed ? feetCoordinatesToGridLabel(trellis.startX, trellis.startY, activeBed) : 'A1';
    const endGrid = activeBed ? feetCoordinatesToGridLabel(trellis.endX, trellis.endY, activeBed) : 'A1';

    setFormData({
      name: trellis.name,
      trellisType: trellis.trellisType,
      startGrid,
      endGrid,
      heightInches: trellis.heightInches,
      wireSpacingInches: trellis.wireSpacingInches || 12,
      numWires: trellis.numWires || 5,
      notes: trellis.notes || ''
    });
    setSelectedPreset('custom');
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      trellisType: 'post_wire',
      startGrid: 'A1',
      endGrid: 'A1',
      heightInches: 72,
      wireSpacingInches: 12,
      numWires: 5,
      notes: ''
    });
    setEditingTrellis(null);
    setSelectedPreset('north_wall');
    setShowForm(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Trellises for ${activeBed?.name || 'Bed'}`}>
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading trellises...</div>
          </div>
        ) : showForm ? (
          <form onSubmit={editingTrellis ? handleUpdateTrellis : handleCreateTrellis} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trellis Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., North Wall Trellis"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trellis Type *
              </label>
              <select
                value={formData.trellisType}
                onChange={(e) => setFormData({ ...formData, trellisType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {TRELLIS_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Position Preset Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position Preset
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {TRELLIS_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} - {preset.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid Coordinate Reference */}
            {activeBed && (() => {
              const gridDims = getGridDimensions(activeBed);

              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Grid System:</strong> This bed has <strong>{gridDims.columns} columns (A-{gridDims.maxCol})</strong> and <strong>{gridDims.rows} rows (1-{gridDims.rows})</strong>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Same grid you use for plant placement: Column Letter + Row Number (e.g., A1, B2, {gridDims.maxCol}{gridDims.rows})
                  </p>
                </div>
              );
            })()}

            {/* Grid Coordinate Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Position
                  <span className="block text-xs text-gray-500">
                    Grid cell (e.g., A1, B2)
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.startGrid}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setFormData({ ...formData, startGrid: value });
                    setSelectedPreset('custom');
                  }}
                  placeholder="A1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
                {activeBed && (() => {
                  const gridDims = getGridDimensions(activeBed);
                  const validation = isValidGridLabel(formData.startGrid, gridDims.columns, gridDims.rows);
                  if (!validation.valid) {
                    return <p className="text-xs text-red-600 mt-1">{validation.error}</p>;
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Position
                  <span className="block text-xs text-gray-500">
                    Grid cell (e.g., D1, H4)
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.endGrid}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setFormData({ ...formData, endGrid: value });
                    setSelectedPreset('custom');
                  }}
                  placeholder="H1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
                {activeBed && (() => {
                  const gridDims = getGridDimensions(activeBed);
                  const validation = isValidGridLabel(formData.endGrid, gridDims.columns, gridDims.rows);
                  if (!validation.valid) {
                    return <p className="text-xs text-red-600 mt-1">{validation.error}</p>;
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Visual Preview Diagram */}
            {activeBed && (
              <TrellisGridPreview
                bed={activeBed}
                startGrid={formData.startGrid}
                endGrid={formData.endGrid}
              />
            )}

            {/* Enhanced calculated preview */}
            {(() => {
              if (!activeBed) return null;

              const startCoord = gridLabelToCoordinate(formData.startGrid);
              const endCoord = gridLabelToCoordinate(formData.endGrid);

              if (!startCoord || !endCoord) return null;

              const startFeet = gridLabelToFeetCoordinates(formData.startGrid, activeBed);
              const endFeet = gridLabelToFeetCoordinates(formData.endGrid, activeBed);

              if (!startFeet || !endFeet) return null;

              const dx = endFeet.x - startFeet.x;
              const dy = endFeet.y - startFeet.y;
              const lengthFeet = Math.sqrt(dx * dx + dy * dy);

              if (lengthFeet === 0) return null;

              const cellDistance = Math.abs(endCoord.x - startCoord.x) + Math.abs(endCoord.y - startCoord.y);

              return (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 mb-1">Calculated Trellis:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-green-700">Length:</span>{' '}
                      <strong className="text-green-900">{lengthFeet.toFixed(1)} feet</strong>
                    </div>
                    <div>
                      <span className="text-green-700">Grid Distance:</span>{' '}
                      <strong className="text-green-900">{cellDistance} cells</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-green-700">From:</span>{' '}
                      <strong className="text-green-900">{formData.startGrid}</strong>
                      {' to '}
                      <strong className="text-green-900">{formData.endGrid}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-green-700">Orientation:</span>{' '}
                      <strong className="text-green-900">
                        {getOrientationLabel(startFeet.x, startFeet.y, endFeet.x, endFeet.y)}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (inches)
                </label>
                <input
                  type="number"
                  value={formData.heightInches}
                  onChange={(e) => setFormData({ ...formData, heightInches: parseInt(e.target.value) || 72 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wire Spacing (in)
                </label>
                <input
                  type="number"
                  value={formData.wireSpacingInches}
                  onChange={(e) => setFormData({ ...formData, wireSpacingInches: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Wires
                </label>
                <input
                  type="number"
                  value={formData.numWires}
                  onChange={(e) => setFormData({ ...formData, numWires: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Additional notes about this trellis..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                {editingTrellis ? 'Update Trellis' : 'Create Trellis'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {trellises.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <p className="text-gray-600 mb-4">No trellises in this bed yet</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Add First Trellis
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {trellises.map(trellis => {
                    const capacity = capacities.get(trellis.id);
                    const percentOccupied = capacity ? (capacity.allocatedFeet / capacity.totalLengthFeet) * 100 : 0;

                    return (
                      <div key={trellis.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{trellis.name}</h3>
                            <p className="text-sm text-gray-600">
                              {TRELLIS_TYPES.find(t => t.value === trellis.trellisType)?.label || trellis.trellisType}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(trellis)}
                              className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTrellis(trellis)}
                              className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Length:</span>{' '}
                            <span className="font-medium">{trellis.totalLengthFeet}ft</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Height:</span>{' '}
                            <span className="font-medium">{trellis.heightInches}"</span>
                          </div>
                        </div>

                        {capacity && (
                          <>
                            {/* Capacity Bar */}
                            <div className="mb-2">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Capacity</span>
                                <span>{capacity.allocatedFeet.toFixed(1)} / {capacity.totalLengthFeet}ft ({percentOccupied.toFixed(0)}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    percentOccupied > 90 ? 'bg-red-500' :
                                    percentOccupied > 70 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(percentOccupied, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Occupied by plants */}
                            {capacity.occupiedSegments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs font-medium text-gray-700 mb-1">Occupied by:</p>
                                <div className="space-y-1">
                                  {capacity.occupiedSegments.map(segment => (
                                    <div key={segment.id} className="text-xs text-gray-600 flex justify-between">
                                      <span>
                                        {segment.plantId}
                                        {segment.variety && ` (${segment.variety})`}
                                      </span>
                                      <span className="font-medium">{segment.linearFeet}ft</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {trellis.notes && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-600">{trellis.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Another Trellis
                </button>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
