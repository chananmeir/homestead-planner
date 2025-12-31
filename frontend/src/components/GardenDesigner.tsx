import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';

import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import PlantPalette from './common/PlantPalette';
import { Plant, PlantedItem, PlantingEvent, GardenBed } from '../types';
import { ConfirmDialog } from './common/ConfirmDialog';
import { useToast } from './common/Toast';
import BedFormModal from './GardenDesigner/BedFormModal';
import PlantConfigModal, { PlantConfig } from './GardenDesigner/PlantConfigModal';
import PlacementPreview from './GardenDesigner/PlacementPreview';
import { DateFilter, DateFilterValue } from './common/DateFilter';
import { getDateFilterFromUrl, updateDateFilterUrl } from '../utils/urlParams';
import { extractCropName, findPlantByVariety } from '../utils/plantUtils';

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
  const [activeBed, setActiveBed] = useState<GardenBed | null>(null);
  const [visibleBeds, setVisibleBeds] = useState<GardenBed[]>([]);
  const [bedFilter, setBedFilter] = useState<'all' | number>('all');
  const [checkedBeds, setCheckedBeds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlant, setHoveredPlant] = useState<PlantedItem | null>(null);
  const [activePlant, setActivePlant] = useState<Plant | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 1.5 = 150%, etc.
  const [selectedPlant, setSelectedPlant] = useState<PlantedItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [editingBed, setEditingBed] = useState<GardenBed | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingPlant, setPendingPlant] = useState<{ cropName: string; position: { x: number; y: number }; bedId: number } | null>(null);
  const [previewPositions, setPreviewPositions] = useState<{ x: number; y: number }[]>([]);
  const [draggedPlantedItem, setDraggedPlantedItem] = useState<{ plantedItem: PlantedItem; sourceBed: GardenBed; isDuplication: boolean } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
  const [touchedSquares, setTouchedSquares] = useState<Set<string>>(new Set());
  const lastMousePositionRef = useRef<{x: number, y: number} | null>(null);
  const mouseMoveListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const { showSuccess, showError } = useToast();

  // Date filtering state - default to today
  const today = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ mode: 'single', date: today });
  const [plantingEvents, setPlantingEvents] = useState<PlantingEvent[]>([]);

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

  // Update isShiftPressed based on any mouse movement (more reliable than keyboard events)
  useEffect(() => {
    const updateShiftState = (e: MouseEvent) => {
      const shiftIsPressed = e.shiftKey;
      setIsShiftPressed(shiftIsPressed);

      // Clear drag if shift is released
      if (!shiftIsPressed && draggedPlantedItem) {
        setDraggedPlantedItem(null);
        setTouchedSquares(new Set());
      }
    };

    window.addEventListener('mousemove', updateShiftState);

    return () => {
      window.removeEventListener('mousemove', updateShiftState);
    };
  }, [draggedPlantedItem]);

  // Handle mouseup for duplication - duplicates to ALL touched squares
  useEffect(() => {
    const handleMouseUp = async (e: MouseEvent) => {
      console.log('🖱️ Mouse up detected, draggedPlantedItem:', draggedPlantedItem);
      console.log('📍 Touched squares:', Array.from(touchedSquares));

      if (!draggedPlantedItem || !draggedPlantedItem.isDuplication) return;

      const { plantedItem } = draggedPlantedItem;
      const plant = plants.find(p => p.id === plantedItem.plantId);

      if (!plant) {
        showError('Plant data not found');
        setDraggedPlantedItem(null);
        setTouchedSquares(new Set());
        return;
      }

      // Duplicate to ALL touched squares
      const successfulSquares: string[] = [];
      const failedSquares: { square: string; reason: string }[] = [];

      for (const squareKey of Array.from(touchedSquares)) {
        // Parse square key: "bedId:gridX,gridY"
        const [bedIdStr, coords] = squareKey.split(':');
        const [gridXStr, gridYStr] = coords.split(',');
        const bedId = parseInt(bedIdStr, 10);
        const gridX = parseInt(gridXStr, 10);
        const gridY = parseInt(gridYStr, 10);

        const targetBed = visibleBeds.find(b => b.id === bedId);
        if (!targetBed) {
          failedSquares.push({ square: `(${gridX},${gridY})`, reason: 'Invalid bed' });
          continue;
        }

        // Check if this is the source square - don't duplicate onto itself
        if (bedId === draggedPlantedItem.sourceBed.id &&
            gridX === plantedItem.position.x &&
            gridY === plantedItem.position.y) {
          console.log(`⏭️ Skipping source square: (${gridX},${gridY})`);
          continue;
        }

        // Validate bounds
        const gridWidth = Math.floor((targetBed.width * 12) / (targetBed.gridSize || 12));
        const gridHeight = Math.floor((targetBed.length * 12) / (targetBed.gridSize || 12));

        if (gridX < 0 || gridX >= gridWidth || gridY < 0 || gridY >= gridHeight) {
          failedSquares.push({ square: `(${gridX},${gridY})`, reason: 'Out of bounds' });
          continue;
        }

        // Check spacing conflicts
        const activePlants = getActivePlantedItems(targetBed);
        let hasConflict = false;

        for (const existing of activePlants) {
          const existingPlant = plants.find(p => p.id === existing.plantId);
          if (!existingPlant) continue;

          const requiredSpacing = Math.max(
            plant.spacing || 12,
            existingPlant.spacing || 12
          ) / (targetBed.gridSize || 12);

          const distance = Math.max(
            Math.abs(gridX - existing.position.x),
            Math.abs(gridY - existing.position.y)
          );

          if (distance < requiredSpacing) {
            failedSquares.push({
              square: `(${gridX},${gridY})`,
              reason: `Too close to ${existingPlant.name}`
            });
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) continue;

        // Create duplicate
        const duplicatePayload = {
          gardenBedId: bedId,
          plantId: plantedItem.plantId,
          variety: plantedItem.variety,
          position: { x: gridX, y: gridY },
          quantity: plantedItem.quantity,
          status: plantedItem.status,
          notes: plantedItem.notes,
          plantedDate: plantedItem.plantedDate
          // plantingMethod removed - let backend auto-detect based on weeksIndoors
        };

        try {
          const response = await apiPost('/api/planted-items', duplicatePayload);
          if (response.ok) {
            successfulSquares.push(`(${gridX},${gridY})`);
            console.log(`✅ Duplicated to (${gridX},${gridY})`);
          } else {
            const errorData = await response.json();
            failedSquares.push({
              square: `(${gridX},${gridY})`,
              reason: errorData.error || 'Unknown error'
            });
          }
        } catch (error) {
          failedSquares.push({ square: `(${gridX},${gridY})`, reason: 'Network error' });
        }
      }

      // Reload data once after all duplications
      if (successfulSquares.length > 0) {
        const freshBeds = await loadData();
        await fetchPlantingEvents();

        // Update visible beds with fresh data
        const freshVisibleBeds = visibleBeds.map(vb =>
          freshBeds.find(fb => fb.id === vb.id) || vb
        );
        setVisibleBeds(freshVisibleBeds);

        // Update active bed if applicable
        if (activeBed) {
          const updatedActiveBed = freshBeds.find(b => b.id === activeBed.id);
          if (updatedActiveBed) setActiveBed(updatedActiveBed);
        }

        showSuccess(`Duplicated ${plant.name} to ${successfulSquares.length} square${successfulSquares.length > 1 ? 's' : ''}`);
      }

      if (failedSquares.length > 0 && successfulSquares.length === 0) {
        showError(`Could not duplicate: ${failedSquares[0].reason}`);
      }

      // Cleanup
      setDraggedPlantedItem(null);
      setTouchedSquares(new Set());
      if (mouseMoveListenerRef.current) {
        document.removeEventListener('mousemove', mouseMoveListenerRef.current);
        mouseMoveListenerRef.current = null;
      }
    };

    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedPlantedItem, touchedSquares, visibleBeds, plants, zoomLevel, activeBed]);

  // Stable mouse move handler (useCallback prevents recreation on every drag)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read date filter from URL on mount
  useEffect(() => {
    const filterFromUrl = getDateFilterFromUrl();
    setDateFilter(filterFromUrl);
  }, []);

  // Extracted function to fetch planting events (reusable)
  const fetchPlantingEvents = useCallback(async () => {
    try {
      // Build query parameters for date filtering
      const params = new URLSearchParams();
      params.append('start_date', dateFilter.date);
      params.append('end_date', dateFilter.date);

      const response = await apiGet(`/api/planting-events?${params.toString()}`);
      if (response.ok) {
        const events = await response.json();
        setPlantingEvents(events);
      } else {
        console.error('Failed to fetch planting events');
        setPlantingEvents([]);
      }
    } catch (error) {
      console.error('Error fetching planting events:', error);
      setPlantingEvents([]);
    }
  }, [dateFilter]);

  // Fetch planting events when date filter changes
  useEffect(() => {
    fetchPlantingEvents();
  }, [fetchPlantingEvents]);

  const loadData = async (): Promise<GardenBed[]> => {
    try {
      setLoading(true);
      setError(null);

      // Load beds
      const bedResponse = await apiGet('/api/garden-beds');
      if (!bedResponse.ok) {
        throw new Error(`Failed to load garden beds: ${bedResponse.statusText}`);
      }
      const bedData = await bedResponse.json();
      setBeds(bedData);

      // Load plants
      const plantResponse = await apiGet('/api/plants');
      if (!plantResponse.ok) {
        throw new Error(`Failed to load plants: ${plantResponse.statusText}`);
      }
      const plantData = await plantResponse.json();
      setPlants(plantData);

      // Initialize visible beds and active bed (only on initial load)
      if (bedData.length > 0 && !activeBed) {
        setVisibleBeds(bedData);       // Show all beds initially
        setActiveBed(bedData[0]);      // Activate first bed
        setBedFilter('all');            // Set filter to "all"
        setCheckedBeds(new Set(bedData.map((b: GardenBed) => b.id))); // Check all beds initially
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

  // Handle date filter changes and update URL
  const handleDateFilterChange = (newFilter: DateFilterValue) => {
    setDateFilter(newFilter);
    updateDateFilterUrl(newFilter);
  };

  // Filter planted items based on active planting events
  const getActivePlantedItems = (bed: GardenBed): PlantedItem[] => {
    // Filter to only items with matching active PlantingEvents
    return (bed.plantedItems || []).filter(item => {
      // Find matching PlantingEvent by position
      const matchingEvent = plantingEvents.find(event =>
        event.gardenBedId === bed.id &&
        event.positionX === item.position.x &&
        event.positionY === item.position.y
      );

      // If no matching event, hide in date-filtered view
      // (Backend already filtered events by date, so if event exists, it's active)
      return matchingEvent !== undefined;
    });
  };

  const handleClearBed = async () => {
    if (!activeBed) return;

    try {
      const response = await apiDelete(
        `/api/garden-beds/${activeBed.id}/planted-items`
      );

      if (response.ok) {
        const data = await response.json();
        showSuccess(data.message || `Cleared ${activeBed.name}`);
        const freshBeds = await loadData(); // Refresh to show empty bed

        // Refresh planting events to update date-filtered views
        await fetchPlantingEvents();

        // Update activeBed and visibleBeds with fresh data
        const updatedBed = freshBeds.find(b => b.id === activeBed.id);
        if (updatedBed) {
          setActiveBed(updatedBed);
          setVisibleBeds(prev =>
            prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
          );
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
    seasonExtension?: {
      type: string;
      innerType?: string;
      layers: number;
      material?: string;
      notes?: string;
    };
  }) => {
    try {
      // Prepare season extension data (send null if type is 'none')
      const seasonExtData = bedData.seasonExtension?.type !== 'none'
        ? bedData.seasonExtension
        : null;

      const response = await apiPost('/api/garden-beds', {
        name: bedData.name || `${bedData.width}' x ${bedData.length}' Bed`,
        width: bedData.width,
        length: bedData.length,
        location: bedData.location || '',
        sunExposure: bedData.sunExposure,
        planningMethod: bedData.planningMethod,
        seasonExtension: seasonExtData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bed');
      }

      const newBed = await response.json();
      showSuccess(`Created ${newBed.name} successfully!`);

      // Reload beds and activate the new one
      const freshBeds = await loadData();
      const createdBed = freshBeds.find(b => b.id === newBed.id);
      if (createdBed) {
        setActiveBed(createdBed);
        // Add to visible beds if not showing all
        if (bedFilter !== 'all') {
          setVisibleBeds([...visibleBeds, createdBed]);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create bed';
      showError(errorMessage);
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleEditBed = async (bedData: {
    name: string;
    width: number;
    length: number;
    location: string;
    sunExposure: string;
    planningMethod: string;
    seasonExtension?: {
      type: string;
      innerType?: string;
      layers: number;
      material?: string;
      notes?: string;
    };
  }) => {
    if (!editingBed) return;

    try {
      // Prepare season extension data (send null if type is 'none' to remove it)
      const seasonExtData = bedData.seasonExtension?.type !== 'none'
        ? bedData.seasonExtension
        : null;

      const response = await apiPut(`/api/garden-beds/${editingBed.id}`, {
        name: bedData.name || `${bedData.width}' x ${bedData.length}' Bed`,
        width: bedData.width,
        length: bedData.length,
        location: bedData.location || '',
        sunExposure: bedData.sunExposure,
        planningMethod: bedData.planningMethod,
        seasonExtension: seasonExtData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update bed');
      }

      const updatedBed = await response.json();
      showSuccess(`Updated ${updatedBed.name} successfully!`);

      // Reload beds and update the active/visible beds
      const freshBeds = await loadData();
      const refreshedBed = freshBeds.find(b => b.id === updatedBed.id);
      if (refreshedBed) {
        setActiveBed(refreshedBed);
        setVisibleBeds(prev =>
          prev.map(bed => bed.id === refreshedBed.id ? refreshedBed : bed)
        );
      }

      // Clear editing state
      setEditingBed(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update bed';
      showError(errorMessage);
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleDeletePlant = async () => {
    if (!selectedPlant) return;

    try {
      const response = await apiDelete(
        `/api/planted-items/${selectedPlant.id}`
      );

      if (response.ok) {
        showSuccess(`Removed ${getPlantName(selectedPlant.plantId)} from bed`);
        setSelectedPlant(null);
        const freshBeds = await loadData();

        // Refresh planting events to update date-filtered views
        await fetchPlantingEvents();

        // Update activeBed and visibleBeds with fresh data
        if (activeBed) {
          const updatedBed = freshBeds.find(b => b.id === activeBed.id);
          if (updatedBed) {
            setActiveBed(updatedBed);
            setVisibleBeds(prev =>
              prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
            );
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
    if (!pendingPlant) {
      return;
    }

    const { cropName, position, bedId } = pendingPlant;
    const targetBed = beds.find(b => b.id === bedId);

    if (!targetBed) {
      showError('Unable to place plant - bed not found');
      return;
    }

    // If batch POST already created items, just reload data and close modal
    if (config.skipPost) {
      const freshBeds = await loadData();
      await fetchPlantingEvents();

      const updatedBed = freshBeds.find(b => b.id === bedId);
      if (updatedBed) {
        setActiveBed(updatedBed);
        setVisibleBeds(prev =>
          prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
        );
      }

      setShowConfigModal(false);
      setPendingPlant(null);
      return; // Exit early - items already created via batch POST
    }

    // Find the specific plant by variety (or generic if no variety selected)
    const plant = findPlantByVariety(cropName, config.variety, plants);

    if (!plant) {
      showError(`Unable to find plant: ${cropName}${config.variety ? ` (${config.variety})` : ''}`);
      return;
    }

    // Calculate default quantity based on planning method
    let defaultQuantity = config.quantity;
    if (targetBed.planningMethod === 'square-foot') {
      const spacing = plant.spacing || 12;
      if (spacing <= 12) {
        defaultQuantity = Math.floor(Math.pow(12 / spacing, 2));
      } else {
        defaultQuantity = -Math.floor(Math.pow(spacing / 12, 2));
      }
    }

    try {
      // Use edited position from config if provided, otherwise use original position
      const finalPosition = config.position || position;

      const payload = {
        gardenBedId: targetBed.id,
        plantId: plant.id,
        variety: config.variety || undefined,  // Include variety if specified
        position: finalPosition,
        quantity: config.quantity || defaultQuantity,
        status: 'planned',
        notes: config.notes || undefined,
        plantedDate: dateFilter.date,  // Use the current date filter date
        plantingMethod: config.plantingMethod,  // 'direct' or 'transplant'
      };

      const response = await apiPost('/api/planted-items', payload);

      if (response.ok) {
        // Reload bed data to show new plant
        const freshBeds = await loadData();

        // Refresh planting events so the new plant appears in date-filtered views
        await fetchPlantingEvents();

        // Update visible beds and active bed with fresh data
        const updatedBed = freshBeds.find(b => b.id === targetBed.id);
        if (updatedBed) {
          setActiveBed(updatedBed);
          // Update visible beds to include the refreshed bed with the new plant
          setVisibleBeds(prev =>
            prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
          );
        }

        showSuccess(`Placed ${cropName}${config.variety ? ` (${config.variety})` : ''} in garden`);
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
    setPreviewPositions([]); // Clear preview
  };

  // Handle duplication of planted items via Shift+drag
  const handleDragStart = (event: DragStartEvent) => {
    setActivePlant(event.active.data.current as Plant);
    // Track mouse position using native browser events (bypass @dnd-kit's broken delta)
    document.addEventListener('mousemove', handleMouseMove);
    mouseMoveListenerRef.current = handleMouseMove;
  };

  // Handle mouse down on planted items for Shift+drag duplication
  const handlePlantMouseDown = useCallback((
    e: React.MouseEvent,
    plant: PlantedItem,
    bed: GardenBed
  ) => {
    console.log('🖱️ Mouse down on plant:', plant.plantId, 'Shift pressed:', isShiftPressed);

    // Only allow dragging if Shift is held
    if (!isShiftPressed) return;

    e.stopPropagation(); // Prevent other handlers

    // Set dragged planted item
    setDraggedPlantedItem({
      plantedItem: plant,
      sourceBed: bed,
      isDuplication: true
    });

    // Initialize touched squares set
    setTouchedSquares(new Set());

    console.log('✅ Duplication mode started for:', plant.plantId);

    // Track mouse movement and collect touched grid squares
    const handleMove = (e: MouseEvent) => {
      lastMousePositionRef.current = { x: e.clientX, y: e.clientY };

      // Find which bed we're over
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const svgElement = elements.find(el => el.id && el.id.startsWith('garden-grid-svg-')) as Element;

      if (svgElement) {
        const bedIdMatch = svgElement.id.match(/garden-grid-svg-(\d+)/);
        if (bedIdMatch) {
          const bedId = parseInt(bedIdMatch[1], 10);
          const targetBed = visibleBeds.find(b => b.id === bedId);

          if (targetBed) {
            const rect = svgElement.getBoundingClientRect();
            const dropX = e.clientX - rect.left;
            const dropY = e.clientY - rect.top;
            const cellSize = 40 * zoomLevel;
            const gridX = Math.floor(dropX / cellSize);
            const gridY = Math.floor(dropY / cellSize);

            // Add this square to touched set
            const squareKey = `${bedId}:${gridX},${gridY}`;
            setTouchedSquares(prev => {
              const newSet = new Set(prev);
              newSet.add(squareKey);
              return newSet;
            });
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMove);
    mouseMoveListenerRef.current = handleMove;

    // Visual feedback - clear any palette drag
    setActivePlant(null);
  }, [isShiftPressed, visibleBeds, zoomLevel]);

  const handleDragEnd = async (event: DragEndEvent) => {
    // Clean up mouse listener
    if (mouseMoveListenerRef.current) {
      document.removeEventListener('mousemove', mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }
    const { active, over } = event;

    // Dragging from palette
    if (!over) {
      setActivePlant(null);
      setDraggedPlantedItem(null);
      return;
    }

    // Check if dropped over ANY garden grid
    const gridMatch = over.id.toString().match(/^garden-grid-(\d+)$/);
    if (gridMatch) {
      const bedId = parseInt(gridMatch[1]);
      console.log('🎯 Detected drop on bed ID:', bedId);
      const targetBed = visibleBeds.find(b => b.id === bedId);

      if (!targetBed) {
        console.error(`Target bed ${bedId} not found`);
        showError('Unable to place plant - bed not found');
        setActivePlant(null);
        return;
      }

      console.log('🌱 Target bed:', { name: targetBed.name, width: targetBed.width, length: targetBed.length, gridSize: targetBed.gridSize });

      const plant = active.data.current as Plant;

      // Get the specific SVG element for THIS bed
      const svgElement = document.querySelector(`#garden-grid-svg-${bedId}`) as SVGSVGElement;
      if (!svgElement) {
        console.error(`Garden grid SVG for bed ${bedId} not found`);
        showError('Unable to place plant - please try again');
        setActivePlant(null);
        return;
      }

      // Get bounding rectangle
      const rect = svgElement.getBoundingClientRect();
      console.log('🎯 SVG Bounding Rect:', { left: rect.left, top: rect.top, width: rect.width, height: rect.height });

      // Get drop coordinates from native browser MouseEvent (bypasses @dnd-kit delta bug)
      let clientX, clientY;
      if (lastMousePositionRef.current) {
        // Use native mouse position (most accurate - directly from browser)
        clientX = lastMousePositionRef.current.x;
        clientY = lastMousePositionRef.current.y;
        console.log('📍 Using lastMousePosition:', { clientX, clientY });
      } else {
        // Fallback: use activator event (initial click position)
        const activeEvent = event.activatorEvent as PointerEvent;
        clientX = activeEvent.clientX;
        clientY = activeEvent.clientY;
        console.log('📍 Using activator event position:', { clientX, clientY });
      }

      // Clear mouse position tracking
      lastMousePositionRef.current = null;

      // Calculate position relative to SVG element
      const dropX = clientX - rect.left;
      const dropY = clientY - rect.top;
      console.log('📐 Drop position relative to SVG:', { dropX, dropY, svgWidth: rect.width, svgHeight: rect.height });

      // Check if drop position is actually within the SVG bounds
      if (dropX < 0 || dropY < 0 || dropX > rect.width || dropY > rect.height) {
        console.warn('⚠️ Drop position is outside SVG bounds! Using center of SVG as fallback.');
        showError(`Your cursor was outside the grid when you released. Please drop directly on the grid squares. (Cursor was ${Math.round(dropX)}px from left, SVG is ${Math.round(rect.width)}px wide)`);
        setActivePlant(null);
        return;
      }

      // Convert to grid coordinates (must match cellSize in renderGrid)
      const cellSize = 40 * zoomLevel;
      const gridX = Math.floor(dropX / cellSize);
      const gridY = Math.floor(dropY / cellSize);
      console.log('🔢 Grid coordinates:', { gridX, gridY, cellSize, zoomLevel });

      // Calculate grid dimensions (same logic as renderGrid)
      const gridWidth = Math.floor((targetBed.width * 12) / targetBed.gridSize);
      const gridHeight = Math.floor((targetBed.length * 12) / targetBed.gridSize);
      console.log('📏 Grid dimensions:', { gridWidth, gridHeight, bedWidth: targetBed.width, bedLength: targetBed.length, gridSize: targetBed.gridSize });

      // Validate within bounds
      if (gridX < 0 || gridY < 0 || gridX >= gridWidth || gridY >= gridHeight) {
        console.error('❌ Position out of bounds!', { gridX, gridY, gridWidth, gridHeight });
        showError(`Cannot place plant outside the garden bed grid (position: ${gridX}, ${gridY}, max: ${gridWidth-1}, ${gridHeight-1})`);
        setActivePlant(null);
        return;
      }

      console.log('✅ Position valid, proceeding with placement');

      // Check for overlapping plants (spacing validation)
      // Use getActivePlantedItems to respect date filter
      const conflicts = getActivePlantedItems(targetBed).filter(item => {
        const existingPlant = getPlant(item.plantId);
        const spacing = Math.max(plant.spacing || 12, existingPlant?.spacing || 12);
        // Convert spacing (inches) to grid cells using the bed's gridSize (inches per cell)
        const requiredDistance = Math.ceil(spacing / targetBed.gridSize);

        const distance = Math.max(
          Math.abs(item.position.x - gridX),
          Math.abs(item.position.y - gridY)
        );

        return distance < requiredDistance;
      }).map(item => {
        const existingPlant = getPlant(item.plantId);
        return {
          plant: existingPlant,
          item: item,
          position: item.position
        };
      }) || [];

      if (conflicts.length > 0) {
        // Build detailed error message with conflicting plants
        const conflictDetails = conflicts.map(c => {
          const plantName = c.plant?.name || 'Unknown plant';
          const variety = c.item.variety ? ` (${c.item.variety})` : '';
          const position = `Position (${c.position.x}, ${c.position.y})`;

          // Add date information if available
          let dateInfo = '';
          if (c.item.plantedDate) {
            const plantedDate = new Date(c.item.plantedDate).toLocaleDateString();
            if (c.item.harvestDate) {
              const harvestDate = new Date(c.item.harvestDate).toLocaleDateString();
              dateInfo = ` - ${plantedDate} to ${harvestDate}`;
            } else if (c.plant?.daysToMaturity) {
              const estimatedHarvest = new Date(c.item.plantedDate);
              estimatedHarvest.setDate(estimatedHarvest.getDate() + c.plant.daysToMaturity);
              dateInfo = ` - ${plantedDate} to ${estimatedHarvest.toLocaleDateString()} (est.)`;
            } else {
              dateInfo = ` - Planted ${plantedDate}`;
            }
          }

          return `• ${plantName}${variety} - ${position}${dateInfo}`;
        }).join('\n');

        const errorMessage = `Cannot place ${plant.name} at this position.\n\n` +
          `${plant.name} needs ${plant.spacing}" spacing from other plants.\n\n` +
          `Conflicting plants:\n${conflictDetails}`;

        showError(errorMessage, null); // null = stays until user clicks to close
        setActivePlant(null);
        return;
      }

      // Set this bed as active after successful drop
      setActiveBed(targetBed);

      // Extract crop name from dragged plant
      const cropName = extractCropName(plant.name);

      // Show configuration modal to select variety and configure plant
      setPendingPlant({ cropName, position: { x: gridX, y: gridY }, bedId: targetBed.id });
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
      <DroppableGrid gridId={`garden-grid-${bed.id}`}>
        <svg id={`garden-grid-svg-${bed.id}`} width={gridWidth * cellSize} height={gridHeight * cellSize} className="cursor-crosshair">
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

          {/* Planted items - Rendered as emoji icons (filtered by date if active) */}
          {getActivePlantedItems(bed).map((item) => {
            const plant = getPlant(item.plantId);
            const iconSize = plant ? Math.max(cellSize * 0.6, cellSize * (plant.spacing / 12)) : cellSize * 0.6;

            return (
              <g
                key={item.id}
                onMouseEnter={() => setHoveredPlant(item)}
                onMouseLeave={() => setHoveredPlant(null)}
                onClick={(e) => {
                  if (!isShiftPressed) {
                    e.stopPropagation();
                    setSelectedPlant(item);
                  }
                }}
                onMouseDown={(e) => {
                  const shiftHeld = e.shiftKey;
                  console.log('🖱️ MOUSEDOWN on <g>, shiftKey:', shiftHeld);
                  if (shiftHeld) {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsShiftPressed(true);
                    handlePlantMouseDown(e, item, bed);
                  }
                }}
                className={isShiftPressed ? "cursor-copy" : "cursor-pointer"}
                style={{
                  opacity: draggedPlantedItem?.plantedItem.id === item.id ? 0.5 : 1,
                  cursor: isShiftPressed ? 'copy' : 'pointer'
                }}
              >
                {/* Invisible drag capture rect - for better hitbox */}
                <rect
                  x={item.position.x * cellSize}
                  y={item.position.y * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="transparent"
                  pointerEvents="all"
                />

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
                  style={{
                    opacity: draggedPlantedItem?.plantedItem.id === item.id ? 0.5 : 1,
                    cursor: isShiftPressed ? 'copy' : 'pointer'
                  }}
                  onMouseDown={(e) => {
                    const shiftHeld = e.shiftKey;
                    console.log('🖱️ MOUSEDOWN on <text>, shiftKey:', shiftHeld);
                    if (shiftHeld) {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsShiftPressed(true);
                      handlePlantMouseDown(e, item, bed);
                    }
                  }}
                  onClick={(e) => {
                    if (!isShiftPressed) {
                      e.stopPropagation();
                      setSelectedPlant(item);
                    }
                  }}
                >
                  {getPlantIcon(item.plantId)}
                </text>

                {/* Shift+Drag Indicator (Plus Icon) */}
                {isShiftPressed && (
                  <>
                    <circle
                      cx={item.position.x * cellSize + cellSize * 0.85}
                      cy={item.position.y * cellSize + cellSize * 0.15}
                      r="8"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x={item.position.x * cellSize + cellSize * 0.85}
                      y={item.position.y * cellSize + cellSize * 0.15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      +
                    </text>
                  </>
                )}

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

          {/* Placement Preview - show ghost outlines when previewing multi-plant placement */}
          {activeBed && bed.id === activeBed.id && (
            <PlacementPreview
              positions={previewPositions}
              plantIcon={pendingPlant ? getPlantIcon(plants.find(p => extractCropName(p.name) === pendingPlant.cropName)?.id || '') : '🌱'}
              cellSize={cellSize}
              showPreview={showConfigModal && previewPositions.length > 0}
            />
          )}
        </svg>
      </DroppableGrid>
    );
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="w-screen relative left-[50%] right-[50%] -mx-[50vw]">
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Plant Palette Sidebar */}
          <div className="flex-shrink-0">
            <PlantPalette plants={plants} plantingDate={dateFilter.date} />
          </div>

          {/* Main Designer Area */}
          <div className="flex-1 flex flex-col space-y-6 overflow-auto pr-4">
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

            {/* Shift Key Duplication Hint */}
            {isShiftPressed && (
              <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-6 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xl font-bold">+</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-900 font-semibold">Duplication Mode Active</div>
                    <div className="text-blue-700 text-sm">
                      Drag any placed plant to duplicate it with the same settings
                    </div>
                  </div>
                </div>
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

            {/* Date Filter */}
            <DateFilter
              value={dateFilter}
              onChange={handleDateFilterChange}
            />

            {/* Date Filter Status Indicator */}
            <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-800">
                  Showing garden on {dateFilter.date}
                </span>
                {activeBed && (
                  <span className="text-xs text-blue-600 ml-2">
                    ({getActivePlantedItems(activeBed).length} plants visible)
                  </span>
                )}
              </div>
            </div>

            {/* Bed Selector */}
            {beds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Beds:
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  <select
                    value={bedFilter === 'all' ? 'all' : bedFilter.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'all') {
                        setBedFilter('all');
                        setVisibleBeds(beds);
                        setCheckedBeds(new Set(beds.map(b => b.id))); // Check all beds
                        // Keep active bed if it exists, otherwise activate first bed
                        if (!activeBed || !beds.find(b => b.id === activeBed.id)) {
                          setActiveBed(beds[0]);
                        }
                      } else {
                        const bedId = parseInt(value);
                        setBedFilter(bedId);
                        const bed = beds.find(b => b.id === bedId);
                        if (bed) {
                          setVisibleBeds([bed]);
                          setActiveBed(bed);
                          setCheckedBeds(new Set([bedId])); // Check only this bed
                        }
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="all">All Beds ({beds.length})</option>
                    {beds.map(bed => {
                      const getProtectionIcon = () => {
                        if (!bed.seasonExtension || bed.seasonExtension.type === 'none') return '';
                        const icons: Record<string, string> = {
                          'row-cover': '🛡️',
                          'low-tunnel': '⛺',
                          'cold-frame': '📦',
                          'high-tunnel': '🏠',
                          'greenhouse': '🏛️'
                        };
                        return icons[bed.seasonExtension.type] + ' ' || '';
                      };
                      return (
                        <option key={bed.id} value={bed.id}>
                          {getProtectionIcon()}{bed.name} ({bed.width}' × {bed.length}')
                        </option>
                      );
                    })}
                  </select>

                  {/* Active Bed Indicator */}
                  {activeBed && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-sm font-medium text-green-700">Active:</span>
                      <span className="text-sm text-green-900">{activeBed.name}</span>

                      {/* Season Extension Indicator */}
                      {activeBed.seasonExtension && activeBed.seasonExtension.type !== 'none' && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs font-medium text-blue-800">
                          {(() => {
                            const getProtectionInfo = (type: string) => {
                              const protectionTypes: Record<string, { name: string; boost: string; icon: string }> = {
                                'row-cover': { name: 'Row Cover', boost: '+4°F', icon: '🛡️' },
                                'low-tunnel': { name: 'Low Tunnel', boost: '+6°F', icon: '⛺' },
                                'cold-frame': { name: 'Cold Frame', boost: '+10°F', icon: '📦' },
                                'high-tunnel': { name: 'High Tunnel', boost: '+8°F', icon: '🏠' },
                                'greenhouse': { name: 'Greenhouse', boost: '+10°F', icon: '🏛️' }
                              };
                              return protectionTypes[type] || { name: type, boost: '', icon: '🛡️' };
                            };

                            const outer = getProtectionInfo(activeBed.seasonExtension.type);
                            const hasInner = activeBed.seasonExtension.innerType && activeBed.seasonExtension.innerType !== 'none';

                            if (hasInner) {
                              const inner = getProtectionInfo(activeBed.seasonExtension.innerType!);
                              return `${outer.icon} ${outer.name} ${outer.boost} + ${inner.icon} ${inner.name} ${inner.boost}`;
                            }

                            return `${outer.icon} ${outer.name} ${outer.boost}`;
                          })()}
                        </span>
                      )}

                      <button
                        onClick={() => setEditingBed(activeBed)}
                        className="ml-2 text-green-700 hover:text-green-900 transition-colors"
                        title="Edit this bed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}

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
                  {activeBed && activeBed.plantedItems && activeBed.plantedItems.length > 0 && (
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Clear Active Bed ({activeBed.plantedItems.length} plants)
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

                {/* Bed Visibility Checkboxes */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Toggle Bed Visibility:
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {beds.map(bed => (
                      <label
                        key={bed.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checkedBeds.has(bed.id)}
                          onChange={(e) => {
                            const newCheckedBeds = new Set(checkedBeds);
                            if (e.target.checked) {
                              newCheckedBeds.add(bed.id);
                            } else {
                              newCheckedBeds.delete(bed.id);
                              // If unchecking the active bed, activate another visible bed
                              if (activeBed?.id === bed.id) {
                                const remainingBeds = beds.filter(b => newCheckedBeds.has(b.id));
                                if (remainingBeds.length > 0) {
                                  setActiveBed(remainingBeds[0]);
                                }
                              }
                            }
                            setCheckedBeds(newCheckedBeds);
                            // Update visible beds based on checked beds
                            const visibleBedList = beds.filter(b => newCheckedBeds.has(b.id));
                            setVisibleBeds(visibleBedList);
                            // Update filter to 'all' if all beds are checked, otherwise set to 'custom'
                            if (newCheckedBeds.size === beds.length) {
                              setBedFilter('all');
                            } else if (newCheckedBeds.size === 1) {
                              setBedFilter(Array.from(newCheckedBeds)[0]);
                            } else {
                              setBedFilter('all'); // Use 'all' for custom selections too
                            }
                          }}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {bed.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({bed.width}' × {bed.length}')
                        </span>
                        {bed.seasonExtension && bed.seasonExtension.type !== 'none' && (
                          <span className="text-xs text-blue-600" title={`Protected: ${bed.seasonExtension.type.replace('-', ' ')}`}>
                            {(() => {
                              const icons: Record<string, string> = {
                                'row-cover': '🛡️',
                                'low-tunnel': '⛺',
                                'cold-frame': '📦',
                                'high-tunnel': '🏠',
                                'greenhouse': '🏛️'
                              };
                              return icons[bed.seasonExtension.type] || '🛡️';
                            })()}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    {checkedBeds.size} of {beds.length} beds visible
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
            ) : visibleBeds.length > 0 ? (
              <div>
                {/* Horizontal Multi-Bed Layout */}
                <div className="overflow-x-auto overflow-y-auto pb-12" onClick={() => setSelectedPlant(null)}>
                  <div className="flex flex-row gap-8 items-start p-4">
                    {visibleBeds.map(bed => (
                      <div
                        key={bed.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBed(bed);
                        }}
                        className={`relative rounded-lg p-4 flex-shrink-0 cursor-pointer transition-all ${
                          activeBed?.id === bed.id
                            ? 'bg-brown-100 border-4 border-green-600 shadow-xl ring-4 ring-green-200'
                            : 'bg-brown-100 border-4 border-brown-600 hover:border-brown-700 opacity-75 hover:opacity-90'
                        }`}
                      >
                        {/* Bed Name Badge */}
                        <div className="absolute -top-3 left-4 bg-white px-3 py-1 rounded-full shadow-md border-2 border-gray-300 font-semibold text-sm z-10">
                          {bed.name}
                        </div>

                        {/* Active Indicator */}
                        {activeBed?.id === bed.id && (
                          <div className="absolute -top-3 right-4 bg-green-600 text-white px-3 py-1 rounded-full shadow-md text-xs font-bold z-10">
                            ACTIVE
                          </div>
                        )}

                        {/* Grid */}
                        {renderGrid(bed)}

                        {/* Dimensions Label */}
                        <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-gray-600">
                          {bed.width}' × {bed.length}' ({bed.planningMethod})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Bed Plants Legend (filtered by date) */}
                {activeBed && getActivePlantedItems(activeBed).length > 0 && (
                  <div className="mt-12 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">
                      Plants in {activeBed.name} on {dateFilter.date}:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getActivePlantedItems(activeBed).map((item) => (
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

                {/* Empty State for Date Filter */}
                {activeBed && getActivePlantedItems(activeBed).length === 0 && (
                  <div className="mt-12 pt-6 border-t border-gray-200">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                      <div className="text-4xl mb-2">🌱</div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">No plantings active on this date</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        No plants were growing on {dateFilter.date}.
                      </p>
                      <p className="text-sm text-gray-500">
                        Try selecting a different date to see plantings.
                      </p>
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
      </div>

      {/* Drag Overlay - Shows what you're dragging */}
      <DragOverlay dropAnimation={null}>
        {activePlant ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              position: 'relative',
              pointerEvents: 'none'
            }}
          >
            {/* Crosshair to show exact drop point */}
            <div style={{
              position: 'absolute',
              width: '2px',
              height: '20px',
              backgroundColor: '#ef4444',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1
            }} />
            <div style={{
              position: 'absolute',
              width: '20px',
              height: '2px',
              backgroundColor: '#ef4444',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1
            }} />
            {/* Plant emoji */}
            <div className="text-5xl" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.8
            }}>
              {activePlant.icon || '🌱'}
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Clear Bed Confirmation Dialog */}
      <ConfirmDialog
        isOpen={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={handleClearBed}
        title="Clear Garden Bed"
        message={`Are you sure you want to remove all ${activeBed?.plantedItems?.length || 0} plants from "${activeBed?.name}"? This action cannot be undone.`}
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
        isOpen={showBedModal || !!editingBed}
        onClose={() => {
          setShowBedModal(false);
          setEditingBed(null);
        }}
        onSubmit={editingBed ? handleEditBed : handleCreateBed}
        bed={editingBed || undefined}
      />

      {/* Plant Configuration Modal */}
      <PlantConfigModal
        isOpen={showConfigModal}
        cropName={pendingPlant?.cropName || ''}
        allPlants={plants}
        position={pendingPlant?.position || null}
        planningMethod={activeBed?.planningMethod}
        plantingDate={dateFilter.date}
        bedId={activeBed?.id}
        bed={activeBed || undefined}
        onDateChange={(newDate) => {
          const updatedFilter = { ...dateFilter, date: newDate };
          setDateFilter(updatedFilter);
          updateDateFilterUrl(updatedFilter);
        }}
        onPreviewChange={(positions) => setPreviewPositions(positions)}
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
