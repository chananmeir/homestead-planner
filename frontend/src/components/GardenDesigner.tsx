import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';

import { API_BASE_URL } from '../config';
import PlantPalette from './common/PlantPalette';
import { Plant, PlantedItem } from '../types';
import { ConfirmDialog } from './common/ConfirmDialog';
import { useToast } from './common/Toast';
import BedFormModal from './GardenDesigner/BedFormModal';
import PlantConfigModal, { PlantConfig } from './GardenDesigner/PlantConfigModal';

interface GardenBed {
  id: number;
  name: string;
  width: number;
  length: number;
  location?: string;
  sunExposure?: string;
  planningMethod: string;
  gridSize: number;
  plantedItems?: PlantedItem[];
}

// Badge positioning constants (percentage of cell size)
const BADGE_POSITION = {
  X_OFFSET: 0.78,      // Horizontal position (78% from left - top-right corner)
  Y_OFFSET: 0.08,      // Vertical position (8% from top)
  TEXT_X_OFFSET: 0.92, // Text horizontal center (92% from left)
  TEXT_Y_OFFSET: 0.155 // Text vertical center (15.5% from top)
} as const;

const BADGE_DIMENSIONS = {
  WIDTH_POSITIVE: 28,  // Width for positive quantity badges
  WIDTH_NEGATIVE: 42,  // Width for negative quantity ("Xsq") badges
  HEIGHT: 15,          // Badge height
  RADIUS: 7.5,         // Border radius (half of height for pill shape)
  STROKE_WIDTH: 2,     // Stroke width
  FONT_SIZE: 9         // Text font size
} as const;

const BADGE_COLORS = {
  POSITIVE_BG: '#059669',  // Tailwind emerald-600
  NEGATIVE_BG: '#dc2626',  // Tailwind red-600
  TEXT: '#1f2937',         // Tailwind gray-800
  STROKE: '#374151'        // Tailwind gray-700
} as const;

const GardenDesigner: React.FC = () => {
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedBed, setSelectedBed] = useState<GardenBed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlant, setHoveredPlant] = useState<PlantedItem | null>(null);
  const [activePlant, setActivePlant] = useState<Plant | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 1.5 = 150%, etc.
  const [selectedPlant, setSelectedPlant] = useState<PlantedItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingPlant, setPendingPlant] = useState<{ plant: Plant; position: { x: number; y: number } } | null>(null);
  const lastMousePositionRef = useRef<{x: number, y: number} | null>(null);
  const mouseMoveListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const { showSuccess, showError } = useToast();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Cleanup mouse listener on component unmount (prevents memory leak)
  useEffect(() => {
    return () => {
      if (mouseMoveListenerRef.current) {
        document.removeEventListener('mousemove', mouseMoveListenerRef.current);
        mouseMoveListenerRef.current = null;
      }
    };
  }, []);

  // Stable mouse move handler (useCallback prevents recreation on every drag)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (): Promise<GardenBed[]> => {
    try {
      setLoading(true);
      setError(null);

      // Load beds
      const bedResponse = await fetch(`${API_BASE_URL}/api/garden-beds`);
      if (!bedResponse.ok) {
        throw new Error(`Failed to load garden beds: ${bedResponse.statusText}`);
      }
      const bedData = await bedResponse.json();
      setBeds(bedData);

      // Load plants
      const plantResponse = await fetch(`${API_BASE_URL}/api/plants`);
      if (!plantResponse.ok) {
        throw new Error(`Failed to load plants: ${plantResponse.statusText}`);
      }
      const plantData = await plantResponse.json();
      setPlants(plantData);

      // Select first bed by default (only on initial load)
      if (bedData.length > 0 && !selectedBed) {
        setSelectedBed(bedData[0]);
      }

      return bedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load garden data';
      setError(errorMessage);
      console.error('Error loading garden data:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleClearBed = async () => {
    if (!selectedBed) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/garden-beds/${selectedBed.id}/planted-items`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const data = await response.json();
        showSuccess(data.message || `Cleared ${selectedBed.name}`);
        const freshBeds = await loadData(); // Refresh to show empty bed

        // Update selectedBed with fresh data
        const updatedBed = freshBeds.find(b => b.id === selectedBed.id);
        if (updatedBed) {
          setSelectedBed(updatedBed);
        }
      } else {
        showError('Failed to clear bed');
      }
    } catch (error) {
      console.error('Error clearing bed:', error);
      showError('Network error occurred');
    } finally {
      setClearConfirm(false);
    }
  };

  const handleCreateBed = async (bedData: {
    name: string;
    width: number;
    length: number;
    location: string;
    sunExposure: string;
    planningMethod: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-beds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: bedData.name || `${bedData.width}' x ${bedData.length}' Bed`,
          width: bedData.width,
          length: bedData.length,
          location: bedData.location || '',
          sunExposure: bedData.sunExposure,
          planningMethod: bedData.planningMethod,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bed');
      }

      const newBed = await response.json();
      showSuccess(`Created ${newBed.name} successfully!`);

      // Reload beds and select the new one
      const freshBeds = await loadData();
      const createdBed = freshBeds.find(b => b.id === newBed.id);
      if (createdBed) {
        setSelectedBed(createdBed);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create bed';
      showError(errorMessage);
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleDeletePlant = async () => {
    if (!selectedPlant) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/planted-items/${selectedPlant.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        showSuccess(`Removed ${getPlantName(selectedPlant.plantId)} from bed`);
        setSelectedPlant(null);
        const freshBeds = await loadData();

        // Update selectedBed with fresh data
        if (selectedBed) {
          const updatedBed = freshBeds.find(b => b.id === selectedBed.id);
          if (updatedBed) {
            setSelectedBed(updatedBed);
          }
        }
      } else {
        showError('Failed to delete plant');
      }
    } catch (error) {
      console.error('Error deleting plant:', error);
      showError('Network error occurred');
    } finally {
      setDeleteConfirm(false);
    }
  };

  const getPlant = (plantId: string): Plant | undefined => {
    return plants.find(p => p.id === plantId);
  };

  const getPlantName = (plantId: string): string => {
    const plant = getPlant(plantId);
    return plant?.name || plantId;
  };

  const getPlantIcon = (plantId: string): string => {
    const plant = getPlant(plantId);
    return plant?.icon || '🌱';
  };

  const handlePlantConfig = async (config: PlantConfig) => {
    if (!pendingPlant || !selectedBed) {
      return;
    }

    const { plant, position } = pendingPlant;

    // Calculate default quantity based on planning method
    let defaultQuantity = config.quantity;
    if (selectedBed.planningMethod === 'square-foot') {
      const spacing = plant.spacing || 12;
      if (spacing <= 12) {
        defaultQuantity = Math.floor(Math.pow(12 / spacing, 2));
      } else {
        defaultQuantity = -Math.floor(Math.pow(spacing / 12, 2));
      }
    }

    try {
      const payload = {
        gardenBedId: selectedBed.id,
        plantId: plant.id,
        variety: config.variety || undefined,  // Include variety if specified
        position: position,
        quantity: config.quantity || defaultQuantity,
        status: 'planned',
        notes: config.notes || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/planted-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Reload bed data to show new plant
        const freshBeds = await loadData();
        const updatedBed = freshBeds.find(b => b.id === selectedBed.id);
        if (updatedBed) {
          setSelectedBed(updatedBed);
        }
        showSuccess(`Placed ${plant.name}${config.variety ? ` (${config.variety})` : ''} in garden`);
      } else {
        const errorText = await response.text();
        console.error('Failed to create planted item:', response.status, errorText);
        let errorMessage = 'Failed to place plant in garden';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If error is not JSON, use default message
        }
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Error creating planted item:', error);
      showError('Network error while placing plant');
    } finally {
      setShowConfigModal(false);
      setPendingPlant(null);
    }
  };

  const handleConfigCancel = () => {
    setShowConfigModal(false);
    setPendingPlant(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActivePlant(event.active.data.current as Plant);
    // Track mouse position using native browser events (bypass @dnd-kit's broken delta)
    document.addEventListener('mousemove', handleMouseMove);
    mouseMoveListenerRef.current = handleMouseMove;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    // Clean up mouse listener
    if (mouseMoveListenerRef.current) {
      document.removeEventListener('mousemove', mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }
    const { active, over } = event;

    if (!over || !selectedBed) {
      setActivePlant(null);
      return;
    }

    // Check if dropped over the grid
    if (over.id === 'garden-grid') {
      const plant = active.data.current as Plant;

      // Get the SVG element to calculate coordinates
      const svgElement = document.querySelector('#garden-grid-svg') as SVGSVGElement;
      if (!svgElement) {
        console.error('Garden grid SVG not found');
        showError('Unable to place plant - please try again');
        setActivePlant(null);
        return;
      }

      // Get bounding rectangle
      const rect = svgElement.getBoundingClientRect();

      // Get drop coordinates from native browser MouseEvent (bypasses @dnd-kit delta bug)
      let clientX, clientY;
      if (lastMousePositionRef.current) {
        // Use native mouse position (most accurate - directly from browser)
        clientX = lastMousePositionRef.current.x;
        clientY = lastMousePositionRef.current.y;
      } else {
        // Fallback: use activator event (initial click position)
        const activeEvent = event.activatorEvent as PointerEvent;
        clientX = activeEvent.clientX;
        clientY = activeEvent.clientY;
      }

      // Clear mouse position tracking
      lastMousePositionRef.current = null;

      // Calculate position relative to SVG element
      const dropX = clientX - rect.left;
      const dropY = clientY - rect.top;

      // Convert to grid coordinates (must match cellSize in renderGrid)
      const cellSize = 40 * zoomLevel;
      const gridX = Math.floor(dropX / cellSize);
      const gridY = Math.floor(dropY / cellSize);

      // Calculate grid dimensions (same logic as renderGrid)
      const gridWidth = Math.floor((selectedBed.width * 12) / selectedBed.gridSize);
      const gridHeight = Math.floor((selectedBed.length * 12) / selectedBed.gridSize);

      // Validate within bounds
      if (gridX < 0 || gridY < 0 || gridX >= gridWidth || gridY >= gridHeight) {
        showError(`Cannot place plant outside the garden bed grid (position: ${gridX}, ${gridY})`);
        setActivePlant(null);
        return;
      }

      // Check for overlapping plants (spacing validation)
      const hasOverlap = selectedBed.plantedItems?.some(item => {
        const existingPlant = getPlant(item.plantId);
        const spacing = Math.max(plant.spacing || 12, existingPlant?.spacing || 12);
        // Convert spacing (inches) to grid cells using the bed's gridSize (inches per cell)
        const requiredDistance = Math.ceil(spacing / selectedBed.gridSize);

        const distance = Math.max(
          Math.abs(item.position.x - gridX),
          Math.abs(item.position.y - gridY)
        );

        return distance < requiredDistance;
      });

      if (hasOverlap) {
        showError(`Not enough space! ${plant.name} needs ${plant.spacing}" spacing from other plants.`);
        setActivePlant(null);
        return;
      }

      // Show configuration modal to select variety and configure plant
      setPendingPlant({ plant, position: { x: gridX, y: gridY } });
      setShowConfigModal(true);
    }

    setActivePlant(null);
  };

  const renderGrid = (bed: GardenBed) => {
    const cellSize = 40 * zoomLevel; // pixels per grid square (adjusted by zoom)
    // Calculate grid dimensions from bed size and gridSize (inches per cell)
    // Example: 4' bed with 12" gridSize = (4 * 12) / 12 = 4 cells
    const gridWidth = Math.floor((bed.width * 12) / bed.gridSize);
    const gridHeight = Math.floor((bed.length * 12) / bed.gridSize);

    return (
      <DroppableGrid gridId="garden-grid">
        <svg id="garden-grid-svg" width={gridWidth * cellSize} height={gridHeight * cellSize} className="cursor-crosshair">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
              <path
                d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                fill="none"
                stroke="#d1d5db"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Cell Labels (development only) */}
          {process.env.NODE_ENV === 'development' && Array.from({ length: gridHeight }).map((_, y) =>
            Array.from({ length: gridWidth }).map((_, x) => {
              const colLabel = String.fromCharCode(65 + x); // A, B, C, D...
              const rowLabel = (y + 1).toString(); // 1, 2, 3, 4...
              const cellLabel = colLabel + rowLabel; // A1, B2, C3...

              return (
                <text
                  key={`label-${x}-${y}`}
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
                  {cellLabel}
                </text>
              );
            })
          )}

          {/* Planted items - Rendered as emoji icons */}
          {bed.plantedItems?.map((item) => {
            const plant = getPlant(item.plantId);
            const iconSize = plant ? Math.max(cellSize * 0.6, cellSize * (plant.spacing / 12)) : cellSize * 0.6;

            return (
              <g
                key={item.id}
                onMouseEnter={() => setHoveredPlant(item)}
                onMouseLeave={() => setHoveredPlant(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlant(item);
                }}
                className="cursor-pointer"
              >
                {/* Selection Ring */}
                {selectedPlant?.id === item.id && (
                  <circle
                    cx={item.position.x * cellSize + cellSize / 2}
                    cy={item.position.y * cellSize + cellSize / 2}
                    r={iconSize / 2 + 8}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray="5,5"
                    className="animate-pulse"
                  />
                )}

                {/* Emoji Icon */}
                <text
                  x={item.position.x * cellSize + cellSize / 2}
                  y={item.position.y * cellSize + cellSize / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={iconSize}
                  className="select-none"
                >
                  {getPlantIcon(item.plantId)}
                </text>

                {/* Quantity Number */}
                {item.quantity !== 0 && (
                  <text
                    x={item.position.x * cellSize + cellSize * BADGE_POSITION.TEXT_X_OFFSET}
                    y={item.position.y * cellSize + cellSize * BADGE_POSITION.TEXT_Y_OFFSET}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={BADGE_COLORS.TEXT}
                    fontSize={BADGE_DIMENSIONS.FONT_SIZE}
                    fontWeight="bold"
                  >
                    {item.quantity > 0
                      ? item.quantity  // Positive: show number of plants
                      : `${Math.abs(item.quantity)}sq`  // Negative: show squares needed
                    }
                  </text>
                )}

                {/* Hover Tooltip */}
                {hoveredPlant?.id === item.id && (
                  <g>
                    <rect
                      x={item.position.x * cellSize + cellSize + 5}
                      y={item.position.y * cellSize}
                      width={150}
                      height={50}
                      fill="rgba(0, 0, 0, 0.9)"
                      rx="4"
                    />
                    <text
                      x={item.position.x * cellSize + cellSize + 10}
                      y={item.position.y * cellSize + 18}
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {getPlantName(item.plantId)}
                    </text>
                    <text
                      x={item.position.x * cellSize + cellSize + 10}
                      y={item.position.y * cellSize + 35}
                      fill="#d1d5db"
                      fontSize="10"
                    >
                      {plant?.spacing}" spacing • {item.status}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </DroppableGrid>
    );
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Plant Palette Sidebar */}
        <div className="flex-shrink-0">
          <PlantPalette plants={plants} />
        </div>

        {/* Main Designer Area */}
        <div className="flex-1 flex flex-col space-y-6 overflow-auto">
          {/* Header Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Garden Designer</h2>
            <p className="text-gray-600 mb-6">
              Drag plants from the palette onto your garden bed grid to start designing your garden.
            </p>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-medium">Error:</span>
                  <span className="text-red-700">{error}</span>
                </div>
                <button
                  onClick={() => loadData()}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <div className="text-3xl font-bold text-green-700 mb-2">{beds.length}</div>
                <div className="text-sm text-green-600 font-medium">Garden Beds</div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <div className="text-3xl font-bold text-blue-700 mb-2">
                  {beds.reduce((sum, bed) => sum + (bed.plantedItems?.length || 0), 0)}
                </div>
                <div className="text-sm text-blue-600 font-medium">Plants Placed</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                <div className="text-3xl font-bold text-purple-700 mb-2">
                  {beds.reduce((sum, bed) => sum + (bed.width * bed.length), 0)}
                </div>
                <div className="text-sm text-purple-600 font-medium">Total Sq Ft</div>
              </div>
            </div>

            {/* Bed Selector */}
            {beds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Garden Bed:
                </label>
                <div className="flex items-center gap-4">
                  <select
                    value={selectedBed?.id || ''}
                    onChange={(e) => {
                      const bed = beds.find(b => b.id === parseInt(e.target.value));
                      setSelectedBed(bed || null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {beds.map(bed => (
                      <option key={bed.id} value={bed.id}>
                        {bed.name} ({bed.width}' × {bed.length}')
                      </option>
                    ))}
                  </select>

                  {/* Add Bed Button */}
                  <button
                    onClick={() => setShowBedModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Bed
                  </button>

                  {/* Clear Bed Button */}
                  {selectedBed && selectedBed.plantedItems && selectedBed.plantedItems.length > 0 && (
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Clear Bed ({selectedBed.plantedItems.length} plants)
                    </button>
                  )}

                  {/* Delete Selected Plant Button */}
                  {selectedPlant && (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Selected Plant
                    </button>
                  )}

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm font-medium text-gray-700">Zoom:</span>
                    <button
                      onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                      className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded transition-colors flex items-center justify-center"
                      title="Zoom out"
                    >
                      -
                    </button>
                    <span className="text-sm font-medium text-gray-600 w-12 text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
                      className="w-8 h-8 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded transition-colors flex items-center justify-center"
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Designer Canvas */}
          <div className="bg-white rounded-lg shadow-md p-6 flex-1">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                <p className="mt-4 text-gray-600">Loading garden designer...</p>
              </div>
            ) : beds.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">🎨</div>
                <p className="text-lg mb-4">No garden beds created yet.</p>
                <button
                  onClick={() => setShowBedModal(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  Create Your First Bed
                </button>
              </div>
            ) : selectedBed ? (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{selectedBed.name}</h3>
                    <p className="text-sm text-gray-600">
                      {selectedBed.location && `Location: ${selectedBed.location} • `}
                      Sun: {selectedBed.sunExposure || 'full'} •
                      Method: {selectedBed.planningMethod}
                    </p>
                  </div>
                </div>

                {/* Grid Canvas */}
                <div className="overflow-auto pb-12" onClick={() => setSelectedPlant(null)}>
                  <div className="flex justify-center">
                    <div className="relative bg-brown-100 border-4 border-brown-600 rounded-lg p-4 inline-block">
                      {renderGrid(selectedBed)}
                      {/* Dimensions label */}
                      <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-gray-600">
                        {selectedBed.width}' × {selectedBed.length}' ({selectedBed.planningMethod})
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                {selectedBed.plantedItems && selectedBed.plantedItems.length > 0 && (
                  <div className="mt-12 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Plants in this Bed:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedBed.plantedItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                          <div className="text-2xl">
                            {getPlantIcon(item.plantId)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{getPlantName(item.plantId)}</div>
                            <div className="text-xs text-gray-600">
                              Position: ({item.position.x}, {item.position.y}) •
                              {item.quantity > 1 && ` Qty: ${item.quantity} • `}
                              Status: {item.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Info Card */}
          <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
            <h3 className="text-lg font-semibold text-indigo-900 mb-2">Garden Design Features</h3>
            <ul className="space-y-2 text-sm text-indigo-800">
              <li>✓ Visual emoji-based plant icons for easy identification</li>
              <li>✓ Drag-and-drop interface for intuitive garden design</li>
              <li>✓ Support for multiple planning methods (Square Foot, Row, Intensive)</li>
              <li>✓ Hover tooltips showing plant details</li>
              <li>✓ Filterable plant palette by category</li>
              <li>✓ Real-time garden bed visualization</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Drag Overlay - Shows what you're dragging */}
      <DragOverlay>
        {activePlant ? (
          <div className="text-5xl" style={{ transform: 'translate(-50%, -50%)' }}>
            {activePlant.icon || '🌱'}
          </div>
        ) : null}
      </DragOverlay>

      {/* Clear Bed Confirmation Dialog */}
      <ConfirmDialog
        isOpen={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={handleClearBed}
        title="Clear Garden Bed"
        message={`Are you sure you want to remove all ${selectedBed?.plantedItems?.length || 0} plants from "${selectedBed?.name}"? This action cannot be undone.`}
        confirmText="Clear Bed"
        variant="danger"
      />

      {/* Delete Plant Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeletePlant}
        title="Delete Plant"
        message={`Are you sure you want to remove ${selectedPlant ? getPlantName(selectedPlant.plantId) : 'this plant'} from the garden bed? This action cannot be undone.`}
        confirmText="Delete Plant"
        variant="danger"
      />

      {/* Bed Form Modal */}
      <BedFormModal
        isOpen={showBedModal}
        onClose={() => setShowBedModal(false)}
        onSubmit={handleCreateBed}
      />

      {/* Plant Configuration Modal */}
      <PlantConfigModal
        isOpen={showConfigModal}
        plant={pendingPlant?.plant || null}
        position={pendingPlant?.position || null}
        planningMethod={selectedBed?.planningMethod}
        onSave={handlePlantConfig}
        onCancel={handleConfigCancel}
      />
    </DndContext>
  );
};

// Droppable Grid Component
interface DroppableGridProps {
  gridId: string;
  children: React.ReactNode;
}

const DroppableGrid: React.FC<DroppableGridProps> = ({ gridId, children }) => {
  const { setNodeRef } = useDroppable({
    id: gridId,
  });

  return (
    <div ref={setNodeRef} className="inline-block">
      {children}
    </div>
  );
};

export default GardenDesigner;
