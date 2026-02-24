import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';

import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { API_BASE_URL } from '../config';
import PlantPalette from './common/PlantPalette';
import PlantIcon, { PlantIconSVG } from './common/PlantIcon';
import { Plant, PlantedItem, PlantingEvent, GardenBed } from '../types';
import { ConfirmDialog } from './common/ConfirmDialog';
import { useToast } from './common/Toast';
import BedFormModal from './GardenDesigner/BedFormModal';
import PlantConfigModal, { PlantConfig } from './GardenDesigner/PlantConfigModal';
import PlacementPreview from './GardenDesigner/PlacementPreview';
import FuturePlantingsOverlay, { FuturePlantingPosition } from './GardenDesigner/FuturePlantingsOverlay';
import { DateFilter, DateFilterValue } from './common/DateFilter';
import { getDateFilterFromUrl, updateDateFilterUrl } from '../utils/urlParams';
import { extractCropName, findPlantByVariety } from '../utils/plantUtils';
import { coordinateToGridLabel, gridLabelToCoordinate, isValidGridLabel } from './GardenDesigner/utils/gridCoordinates';
import PlannedPlantsSection from './GardenDesigner/PlannedPlantsSection';
import { useActivePlan } from '../contexts/ActivePlanContext';
import { getMIGardenerSpacing } from '../utils/migardenerSpacing';
import { calculateSpacingBuffer } from './GardenDesigner/utils/footprintCalculator';
import CollectSeedsModal from './GardenDesigner/CollectSeedsModal';
import SetSeedDateModal from './GardenDesigner/SetSeedDateModal';
import WeatherAlertBanner from './GardenDesigner/WeatherAlertBanner';

/** Format a conflict error response from the batch/single planted-items API into a readable message */
function formatConflictError(errorData: {
  error?: string;
  message?: string;
  conflicts?: { plantName?: string; variety?: string; position?: { x: number; y: number }; dates?: string }[];
  failed_position?: { x: number; y: number };
}): string {
  if (errorData.conflicts && errorData.conflicts.length > 0) {
    const failedPos = errorData.failed_position;
    const posLabel = failedPos
      ? ` at ${coordinateToGridLabel(failedPos.x, failedPos.y)}`
      : '';
    const conflictList = errorData.conflicts.map(c => {
      const name = c.plantName || 'Unknown';
      const v = c.variety ? ` (${c.variety})` : '';
      const pos = c.position ? ` at ${coordinateToGridLabel(c.position.x, c.position.y)}` : '';
      const dates = c.dates ? ` [${c.dates}]` : '';
      return `• ${name}${v}${pos}${dates}`;
    }).join('\n');
    return `Planting conflict${posLabel} — overlaps with:\n${conflictList}`;
  }
  return errorData.message || errorData.error || 'Failed to place plants';
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

/** Parse a YYYY-MM-DD string as local midnight (avoids JS UTC-parsing quirk) */
const parseLocalDate = (dateStr: string) => new Date(dateStr + 'T00:00:00');

/** Format a Date as YYYY-MM-DD using local date components */
const formatLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const GardenDesigner: React.FC = () => {
  const { activePlanId, planRefreshKey, bumpPlanRefresh, ensureActivePlan } = useActivePlan();
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
  const [selectedPlantedCell, setSelectedPlantedCell] = useState<{
    item: PlantedItem;
    bed: GardenBed;
    plant: Plant | undefined;
    futureEvents: PlantingEvent[];
    clickX: number;
    clickY: number;
  } | null>(null);
  const [selectedFutureCell, setSelectedFutureCell] = useState<{
    position: FuturePlantingPosition;
    bed: GardenBed;
    futurePlantedItems: PlantedItem[];
    clickX: number;
    clickY: number;
  } | null>(null);
  const [panelDragOffset, setPanelDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [removeAllByPlantConfirm, setRemoveAllByPlantConfirm] = useState<{
    plantId: string; variety?: string; count: number; plantName: string;
  } | null>(null);
  const [deleteFutureEventConfirm, setDeleteFutureEventConfirm] = useState<{
    eventId: number; plantName: string;
  } | null>(null);
  const [editingEventDate, setEditingEventDate] = useState<{
    itemId: number; currentDate: string;
  } | null>(null);
  const [movingFutureItemId, setMovingFutureItemId] = useState<number | null>(null);
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [moveTargetLabel, setMoveTargetLabel] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [showBedModal, setShowBedModal] = useState(false);
  const [editingBed, setEditingBed] = useState<GardenBed | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingPlant, setPendingPlant] = useState<{
    cropName: string;
    position: { x: number; y: number };
    bedId: number;
    sourcePlanItemId?: number;
    initialVariety?: string;
  } | null>(null);
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
  const [futurePlantingEvents, setFuturePlantingEvents] = useState<PlantingEvent[]>([]);
  const [showFuturePlantings, setShowFuturePlantings] = useState<boolean>(() => localStorage.getItem('showFuturePlantings') === 'true');
  const [quickHarvestDays, setQuickHarvestDays] = useState<number | null>(null); // Days to harvest filter from PlantPalette

  // Seed saving modal state
  const [collectSeedsItem, setCollectSeedsItem] = useState<PlantedItem | null>(null);
  const [seedDateItem, setSeedDateItem] = useState<PlantedItem | null>(null);

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
        await fetchFuturePlantingEvents();

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

  // Fetch FUTURE planting events (scheduled after current date)
  const fetchFuturePlantingEvents = useCallback(async () => {
    try {
      // Get events from tomorrow onwards (1 year into the future)
      const tomorrow = parseLocalDate(dateFilter.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const oneYearLater = parseLocalDate(dateFilter.date);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      const params = new URLSearchParams();
      params.append('start_date', formatLocalDate(tomorrow));
      params.append('end_date', formatLocalDate(oneYearLater));

      const response = await apiGet(`/api/planting-events?${params.toString()}`);
      if (response.ok) {
        const events = await response.json();
        setFuturePlantingEvents(events);
      } else {
        console.error('Failed to fetch future planting events');
        setFuturePlantingEvents([]);
      }
    } catch (error) {
      console.error('Error fetching future planting events:', error);
      setFuturePlantingEvents([]);
    }
  }, [dateFilter.date]);

  // Fetch future events when date filter changes
  useEffect(() => {
    fetchFuturePlantingEvents();
  }, [fetchFuturePlantingEvents]);

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
        // Restore checked beds from localStorage, fallback to all beds
        const saved = localStorage.getItem('checkedBedIds');
        let restoredIds: Set<number>;
        if (saved) {
          try {
            const parsed: number[] = JSON.parse(saved);
            const validIds = new Set<number>(bedData.map((b: GardenBed) => b.id));
            restoredIds = new Set<number>(parsed.filter((id: number) => validIds.has(id)));
            // If none of the saved IDs are valid anymore, show all
            if (restoredIds.size === 0) restoredIds = validIds;
          } catch { restoredIds = new Set(bedData.map((b: GardenBed) => b.id)); }
        } else {
          restoredIds = new Set(bedData.map((b: GardenBed) => b.id));
        }
        const visibleBedList = bedData.filter((b: GardenBed) => restoredIds.has(b.id));
        setCheckedBeds(restoredIds);
        setVisibleBeds(visibleBedList);
        setActiveBed(visibleBedList[0] || bedData[0]);
        setBedFilter(restoredIds.size === bedData.length ? 'all' : 'all');
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

  // Filter planted items based on their own date fields (plantedDate, harvestDate)
  // instead of requiring a matching PlantingEvent. This prevents "ghost" plants —
  // items that exist (and block placement) but are invisible due to missing events.
  const getActivePlantedItems = (bed: GardenBed): PlantedItem[] => {
    if (!dateFilter.date) return bed.plantedItems || [];
    // Append T00:00:00 so date-only strings parse as local time, not UTC.
    // Without this, "2026-02-23" → UTC midnight → previous day in UTC-negative timezones.
    const viewDate = new Date(dateFilter.date + 'T00:00:00');
    viewDate.setHours(0, 0, 0, 0);

    return (bed.plantedItems || []).filter(item => {
      // Must have a planted date
      if (!item.plantedDate) return false;
      const planted = new Date(item.plantedDate);
      if (isNaN(planted.getTime())) return false;

      // Not yet planted on view date
      planted.setHours(0, 0, 0, 0);
      if (planted > viewDate) return false;

      // Already harvested before view date
      if (item.status === 'harvested') {
        if (item.harvestDate) {
          const harvest = new Date(item.harvestDate);
          harvest.setHours(0, 0, 0, 0);
          return harvest >= viewDate;
        }
        return false; // Harvested but no date → hide
      }

      // For non-harvested items: check harvestDate or estimate from DTM
      if (item.harvestDate) {
        const harvest = new Date(item.harvestDate);
        harvest.setHours(0, 0, 0, 0);
        if (harvest < viewDate) return false;
      } else {
        // No harvest date stored — estimate from days to maturity
        const plant = getPlant(item.plantId);
        if (plant?.daysToMaturity) {
          const estHarvest = new Date(planted);
          estHarvest.setDate(estHarvest.getDate() + plant.daysToMaturity);
          estHarvest.setHours(0, 0, 0, 0);
          if (estHarvest < viewDate) return false;
        }
        // No DTM data → show (safe: assume still growing)
      }

      return true;
    });
  };

  // Get future-dated PlantedItems as FuturePlantingPosition[] for the overlay.
  // These are items placed on the grid with a plantedDate after the current view date.
  const getFuturePlantedItemPositions = (bed: GardenBed): FuturePlantingPosition[] => {
    if (!dateFilter.date) return [];
    // Append T00:00:00 so date-only strings parse as local time, not UTC.
    // Without this, "2026-02-23" → UTC midnight → previous day in UTC-negative timezones.
    const viewDate = new Date(dateFilter.date + 'T00:00:00');
    viewDate.setHours(0, 0, 0, 0);
    const positions: FuturePlantingPosition[] = [];
    const occupiedCells = new Set<string>();
    const gridSize = 12;

    for (const item of (bed.plantedItems || [])) {
      if (!item.plantedDate) continue;
      const planted = new Date(item.plantedDate);
      if (isNaN(planted.getTime())) continue;
      planted.setHours(0, 0, 0, 0);
      if (planted <= viewDate) continue; // Only future items

      const originX = item.position.x;
      const originY = item.position.y;
      const dateStr = typeof item.plantedDate === 'string'
        ? item.plantedDate
        : new Date(item.plantedDate).toISOString().split('T')[0];

      let spacingInches = 12;
      const plant = plants.find(p => p.id === item.plantId);
      if (item.spacing) {
        spacingInches = item.spacing;
      } else if (plant?.spacing) {
        spacingInches = plant.spacing;
      }

      const bufferCells = calculateSpacingBuffer(originX, originY, spacingInches, gridSize);
      for (const cell of bufferCells) {
        const key = `${cell.x},${cell.y}`;
        if (occupiedCells.has(key)) continue;
        occupiedCells.add(key);
        positions.push({
          x: cell.x,
          y: cell.y,
          plantId: item.plantId,
          plantIcon: getPlantIcon(item.plantId),
          variety: item.variety,
          plantingDate: dateStr,
          isOrigin: cell.x === originX && cell.y === originY,
          spaceRequired: Math.ceil(spacingInches / gridSize),
        });
      }
    }
    return positions;
  };

  /** Get PlantedItems in a bed whose plantedDate is after the view date (future placed plants) */
  const getFuturePlantedItems = (bed: GardenBed): PlantedItem[] => {
    if (!dateFilter.date) return [];
    // Append T00:00:00 so date-only strings parse as local time, not UTC.
    // Without this, "2026-02-23" → UTC midnight → previous day in UTC-negative timezones.
    const viewDate = new Date(dateFilter.date + 'T00:00:00');
    viewDate.setHours(0, 0, 0, 0);
    return (bed.plantedItems || []).filter(item => {
      if (!item.plantedDate) return false;
      const planted = new Date(item.plantedDate);
      if (isNaN(planted.getTime())) return false;
      planted.setHours(0, 0, 0, 0);
      return planted > viewDate;
    });
  };

  const handleClearBed = async () => {
    if (!activeBed) return;
    const visibleItems = getActivePlantedItems(activeBed);
    if (visibleItems.length === 0) return;

    try {
      let succeeded = 0;
      let failed = 0;
      for (const item of visibleItems) {
        try {
          const response = await apiDelete(`/api/planted-items/${item.id}`);
          if (response.ok) succeeded++;
          else failed++;
        } catch {
          failed++;
        }
      }

      if (failed === 0) {
        showSuccess(`Cleared ${succeeded} plants from ${activeBed.name}`);
      } else {
        showError(`Cleared ${succeeded} plants, ${failed} failed`);
      }

      setSelectedPlant(null);
      setSelectedPlantedCell(null);
      const freshBeds = await loadData();
      await fetchPlantingEvents();
      await fetchFuturePlantingEvents();

      const updatedBed = freshBeds.find(b => b.id === activeBed.id);
      if (updatedBed) {
        setActiveBed(updatedBed);
        setVisibleBeds(prev =>
          prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
        );
      }

      bumpPlanRefresh();
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
    zone?: string;
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
        zone: bedData.zone,
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
    zone?: string;
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
        zone: bedData.zone,
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
        setSelectedPlantedCell(null);
        const freshBeds = await loadData();

        // Refresh planting events to update date-filtered views
        await fetchPlantingEvents();
        await fetchFuturePlantingEvents();

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

        bumpPlanRefresh();
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

  const handleRemoveAllByPlant = async () => {
    if (!removeAllByPlantConfirm || !activeBed) return;
    const { plantId, variety } = removeAllByPlantConfirm;

    try {
      const visibleItems = getActivePlantedItems(activeBed).filter(item => {
        if (item.plantId !== plantId) return false;
        if (variety && item.variety !== variety) return false;
        return true;
      });

      if (visibleItems.length === 0) {
        showError('No matching plants visible on this date');
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const item of visibleItems) {
        try {
          const response = await apiDelete(`/api/planted-items/${item.id}`);
          if (response.ok) succeeded++;
          else failed++;
        } catch {
          failed++;
        }
      }

      if (failed === 0) {
        showSuccess(`Removed ${succeeded} ${removeAllByPlantConfirm.plantName} from bed`);
      } else {
        showError(`Removed ${succeeded} plants, ${failed} failed`);
      }

      setSelectedPlant(null);
      setSelectedPlantedCell(null);
      const freshBeds = await loadData();

      await fetchPlantingEvents();
      await fetchFuturePlantingEvents();

      const updatedBed = freshBeds.find(b => b.id === activeBed.id);
      if (updatedBed) {
        setActiveBed(updatedBed);
        setVisibleBeds(prev =>
          prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
        );
      }

      bumpPlanRefresh();
    } catch (error) {
      console.error('Error removing plants by type:', error);
      showError('Network error occurred');
    } finally {
      setRemoveAllByPlantConfirm(null);
    }
  };

  const handleDeleteFutureEvent = async () => {
    if (!deleteFutureEventConfirm || !selectedFutureCell) return;
    try {
      const response = await apiDelete(`/api/planted-items/${deleteFutureEventConfirm.eventId}`);
      if (response.ok) {
        showSuccess(`Removed ${deleteFutureEventConfirm.plantName}`);
        await loadData();
        const remaining = selectedFutureCell.futurePlantedItems.filter(
          item => item.id !== deleteFutureEventConfirm.eventId
        );
        if (remaining.length === 0) {
          setSelectedFutureCell(null);
          setMovingFutureItemId(null);
        } else {
          setSelectedFutureCell({ ...selectedFutureCell, futurePlantedItems: remaining });
        }
      } else {
        const err = await response.json().catch(() => ({ error: 'Failed to delete' }));
        showError(err.error || 'Failed to delete plant');
      }
    } catch {
      showError('Network error');
    }
    setDeleteFutureEventConfirm(null);
  };

  const handleSaveEventDate = async (itemId: number, newDate: string) => {
    if (!newDate) { showError('Please select a date'); return; }
    try {
      const response = await apiPut(`/api/planted-items/${itemId}`, {
        plantedDate: new Date(newDate + 'T00:00:00').toISOString()
      });
      if (response.ok) {
        showSuccess('Planted date updated');
        setEditingEventDate(null);
        await loadData();
        setSelectedFutureCell(null);
        setMovingFutureItemId(null);
      } else {
        const err = await response.json().catch(() => ({ error: 'Failed to update' }));
        showError(err.error || 'Failed to update date');
      }
    } catch {
      showError('Network error');
    }
  };

  // Handle moving a planted item to a new grid position via label (e.g., "A1", "B3")
  const handleToggleSeedSaving = async (item: PlantedItem, saveForSeed: boolean) => {
    try {
      const response = await apiPut(`/api/planted-items/${item.id}`, { saveForSeed });
      if (!response.ok) {
        const errData = await response.json();
        showError(errData.error || 'Failed to update seed saving');
        return;
      }
      const updated = await response.json();
      // Check if we need to prompt for manual seed date
      if (saveForSeed && !updated.seedMaturityDate) {
        setSeedDateItem(updated);
      }
      showSuccess(saveForSeed ? 'Marked for seed saving' : 'Seed saving removed');
      // Update the selected cell snapshot so the panel reflects the change immediately
      setSelectedPlantedCell(prev => prev ? { ...prev, item: { ...prev.item, ...updated } } : null);
      loadData();
    } catch {
      showError('Failed to update seed saving');
    }
  };

  const handleSeedDateSuccess = () => {
    loadData();
  };

  const handleCollectSeedsSuccess = () => {
    showSuccess('Seeds collected! Check your Seed Inventory.');
    loadData();
  };

  const handleMovePlant = async () => {
    if (!selectedPlantedCell || !moveTargetLabel.trim()) return;
    const { item, bed } = selectedPlantedCell;

    // Validate the label format
    const gridWidth = Math.floor((bed.width * 12) / bed.gridSize);
    const gridHeight = Math.floor((bed.length * 12) / bed.gridSize);
    const validation = isValidGridLabel(moveTargetLabel, gridWidth, gridHeight);

    if (!validation.valid) {
      setMoveError(validation.error || 'Invalid position');
      return;
    }

    const coord = gridLabelToCoordinate(moveTargetLabel);
    if (!coord) {
      setMoveError('Invalid position format. Use letter + number (e.g., A1, B3).');
      return;
    }

    // Don't move to the same position
    if (coord.x === item.position.x && coord.y === item.position.y) {
      setMoveError('That is the current position.');
      return;
    }

    try {
      const response = await apiPut(`/api/planted-items/${item.id}`, {
        position: { x: coord.x, y: coord.y }
      });

      if (response.ok) {
        const plantName = getPlantName(item.plantId);
        const newLabel = coordinateToGridLabel(coord.x, coord.y);
        showSuccess(`Moved ${plantName} to ${newLabel}`);
        setShowMoveInput(false);
        setMoveTargetLabel('');
        setMoveError(null);
        setSelectedPlant(null);
        setSelectedPlantedCell(null);

        const freshBeds = await loadData();
        await fetchPlantingEvents();
        await fetchFuturePlantingEvents();

        if (activeBed) {
          const updatedBed = freshBeds.find(b => b.id === activeBed.id);
          if (updatedBed) {
            setActiveBed(updatedBed);
            setVisibleBeds(prev =>
              prev.map(b => b.id === updatedBed.id ? updatedBed : b)
            );
          }
        }
      } else {
        const errorData = await response.json();
        setMoveError(formatConflictError(errorData));
      }
    } catch (error) {
      console.error('Error moving plant:', error);
      setMoveError('Network error occurred while moving plant');
    }
  };

  const handleMoveFuturePlant = async () => {
    if (!selectedFutureCell || !movingFutureItemId || !moveTargetLabel.trim()) return;
    const { bed, futurePlantedItems } = selectedFutureCell;
    const item = futurePlantedItems.find(i => i.id === movingFutureItemId);
    if (!item) return;

    const gridWidth = Math.floor((bed.width * 12) / bed.gridSize);
    const gridHeight = Math.floor((bed.length * 12) / bed.gridSize);
    const validation = isValidGridLabel(moveTargetLabel, gridWidth, gridHeight);

    if (!validation.valid) {
      setMoveError(validation.error || 'Invalid position');
      return;
    }

    const coord = gridLabelToCoordinate(moveTargetLabel);
    if (!coord) {
      setMoveError('Invalid position format. Use letter + number (e.g., A1, B3).');
      return;
    }

    if (coord.x === item.position.x && coord.y === item.position.y) {
      setMoveError('That is the current position.');
      return;
    }

    try {
      const response = await apiPut(`/api/planted-items/${item.id}`, {
        position: { x: coord.x, y: coord.y }
      });

      if (response.ok) {
        const plantName = getPlantName(item.plantId);
        const newLabel = coordinateToGridLabel(coord.x, coord.y);
        showSuccess(`Moved ${plantName} to ${newLabel}`);
        setMovingFutureItemId(null);
        setMoveTargetLabel('');
        setMoveError(null);

        const freshBeds = await loadData();
        await fetchPlantingEvents();
        await fetchFuturePlantingEvents();

        // Update the popup's item list with new position
        const updatedItems = futurePlantedItems.map(i =>
          i.id === item.id ? { ...i, position: { x: coord.x, y: coord.y } } : i
        );
        setSelectedFutureCell({ ...selectedFutureCell, futurePlantedItems: updatedItems });

        if (activeBed) {
          const updatedBed = freshBeds.find(b => b.id === activeBed.id);
          if (updatedBed) {
            setActiveBed(updatedBed);
            setVisibleBeds(prev =>
              prev.map(b => b.id === updatedBed.id ? updatedBed : b)
            );
          }
        }
      } else {
        const errorData = await response.json();
        setMoveError(formatConflictError(errorData));
      }
    } catch (error) {
      console.error('Error moving future plant:', error);
      setMoveError('Network error occurred while moving plant');
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

  // Safe date formatter - returns "Date TBD" for invalid/missing dates
  const formatDateSafe = (dateValue: Date | string | null | undefined): string => {
    if (!dateValue) return 'Date TBD';
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      if (isNaN(date.getTime())) return 'Date TBD';
      return date.toLocaleDateString();
    } catch {
      return 'Date TBD';
    }
  };

  // Calculate expected harvest date for a planted item
  const calculateHarvestDate = (item: PlantedItem, plant: Plant | undefined): Date | null => {
    // Use stored harvest date if available
    if (item.harvestDate) {
      const harvest = new Date(item.harvestDate);
      return isNaN(harvest.getTime()) ? null : harvest;
    }
    // Need DTM to calculate
    if (!plant?.daysToMaturity) return null;
    // Need a base date (transplant or planted)
    const baseDateStr = item.transplantDate || item.plantedDate;
    if (!baseDateStr) return null;
    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) return null;
    const harvestDate = new Date(baseDate);
    harvestDate.setDate(harvestDate.getDate() + plant.daysToMaturity);
    return harvestDate;
  };

  // Get future planting events at a specific position (scheduled after current view date)
  const getFuturePlantingsAtPosition = (
    bed: GardenBed,
    posX: number,
    posY: number,
    currentDate: string
  ): PlantingEvent[] => {
    const current = new Date(currentDate);
    return plantingEvents.filter(event => {
      // Must be in same bed and position
      if (event.gardenBedId !== bed.id) return false;
      if (event.positionX !== posX || event.positionY !== posY) return false;

      // Get the relevant planting date
      const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
      if (!plantingDateStr) return false;

      const plantingDate = new Date(plantingDateStr);
      // Only include future events (after current view date)
      return plantingDate > current;
    }).sort((a, b) => {
      // Sort by planting date ascending
      const dateA = new Date(a.directSeedDate || a.transplantDate || a.seedStartDate || '');
      const dateB = new Date(b.directSeedDate || b.transplantDate || b.seedStartDate || '');
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Calculate tooltip position to keep it within viewport
  const calculateTooltipPosition = (clickX: number, clickY: number) => {
    const panelWidth = 300;
    const panelHeight = 500;
    const padding = 16;

    let left = clickX + 10;
    let top = clickY + 10;

    // Keep within viewport horizontally
    if (left + panelWidth > window.innerWidth - padding) {
      left = clickX - panelWidth - 10;
    }
    if (left < padding) {
      left = padding;
    }

    // Keep within viewport vertically
    if (top + panelHeight > window.innerHeight - padding) {
      top = Math.max(60, window.innerHeight - panelHeight - padding);
    }

    return { left, top };
  };

  // Drag handler for detail panels (drag by header bar)
  const handlePanelDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startDx = panelDragOffset.dx;
    const startDy = panelDragOffset.dy;

    const onPointerMove = (ev: PointerEvent) => {
      setPanelDragOffset({
        dx: startDx + (ev.clientX - startX),
        dy: startDy + (ev.clientY - startY),
      });
    };
    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  // Handle clicking on a planted item to show details panel
  const handlePlantedItemClick = (item: PlantedItem, bed: GardenBed, e: React.MouseEvent) => {
    e.stopPropagation();
    const plant = plants.find(p => p.id === item.plantId);
    const currentDate = dateFilter.date || new Date().toISOString().split('T')[0];
    const futureEvents = getFuturePlantingsAtPosition(bed, item.position.x, item.position.y, currentDate);
    setSelectedPlantedCell({ item, bed, plant, futureEvents, clickX: e.clientX, clickY: e.clientY });
    setPanelDragOffset({ dx: 0, dy: 0 });
    setSelectedPlant(item);  // Required for Edit/Delete handlers
    setSelectedFutureCell(null); // Close future cell panel if open
    setMovingFutureItemId(null);
    setShowMoveInput(false); // Reset move input when selecting a different plant
    setMoveTargetLabel('');
    setMoveError(null);
  };

  // Handle clicking on a future planting indicator to show details
  const handleFutureCellClick = (bed: GardenBed, position: FuturePlantingPosition, clickX: number, clickY: number) => {
    const futurePlantedItems = getFuturePlantedItems(bed).filter(item => {
      // Check if clicked position is within this item's spacing buffer
      const spacingInches = item.spacing || plants.find(p => p.id === item.plantId)?.spacing || 12;
      const gridSize = 12;
      const dx = position.x - item.position.x;
      const dy = position.y - item.position.y;
      const distanceInches = Math.sqrt(Math.pow(dx * gridSize, 2) + Math.pow(dy * gridSize, 2));
      return distanceInches < spacingInches;
    });
    setSelectedFutureCell({ position, bed, futurePlantedItems, clickX, clickY });
    setPanelDragOffset({ dx: 0, dy: 0 });
    setSelectedPlantedCell(null); // Close planted item panel if open
    setSelectedPlant(null);
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
      await fetchFuturePlantingEvents();

      const updatedBed = freshBeds.find(b => b.id === bedId);
      if (updatedBed) {
        setActiveBed(updatedBed);
        setVisibleBeds(prev =>
          prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
        );
      }

      bumpPlanRefresh();
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

    try {
      // Use edited position from config if provided, otherwise use original position
      const finalPosition = config.position || position;

      // Calculate plants per square based on spacing (method-aware)
      const gridSize = targetBed.gridSize || 12;
      let plantsPerSquare: number;

      if (targetBed.planningMethod === 'migardener') {
        // MIGardener: use seed density from migardener data or spacing overrides
        if (plant.migardener?.seedDensityPerInch && plant.migardener?.plantingStyle === 'row_based') {
          plantsPerSquare = Math.round(gridSize * plant.migardener.seedDensityPerInch);
        } else if (plant.migardener?.seedDensityPerSqFt && (plant.migardener?.plantingStyle === 'broadcast' || plant.migardener?.plantingStyle === 'dense_patch')) {
          const seedsPerSqInch = plant.migardener.seedDensityPerSqFt / 144;
          plantsPerSquare = Math.round(gridSize * gridSize * seedsPerSqInch);
        } else {
          // Fallback: use MIGardener spacing overrides
          const mgSpacing = getMIGardenerSpacing(plant.id, plant.spacing || 12, plant.rowSpacing);
          const rowsPerCell = mgSpacing.rowSpacing ? gridSize / mgSpacing.rowSpacing : gridSize / mgSpacing.plantSpacing;
          const plantsPerRow = gridSize / mgSpacing.plantSpacing;
          plantsPerSquare = Math.max(1, Math.floor(rowsPerCell * plantsPerRow));
        }
      } else {
        const spacing = plant.spacing || 12;
        plantsPerSquare = spacing <= gridSize ? Math.floor(Math.pow(gridSize / spacing, 2)) : 1;
      }

      // Calculate how many squares are needed
      const totalQuantity = config.quantity;
      const squaresNeeded = Math.ceil(totalQuantity / plantsPerSquare);

      console.log('🌱 Multi-square placement logic:', {
        cropName,
        spacing: plant.spacing,
        plantsPerSquare,
        totalQuantity,
        squaresNeeded,
        planningMethod: targetBed.planningMethod
      });

      // Resolve sourcePlanItemId: use from drag or sync with planner
      let sourcePlanItemId = pendingPlant.sourcePlanItemId;

      if (!sourcePlanItemId) {
        // Placing from PlantPalette - ensure an active plan exists, then sync
        const planId = activePlanId || await ensureActivePlan();
        if (planId) {
          try {
            const syncResponse = await apiPost(
              `/api/garden-plans/${planId}/designer-sync`,
              {
                action: 'add',
                plantId: plant.id,
                variety: config.variety || undefined,
                bedId: targetBed.id,
                quantity: totalQuantity,
                seedInventoryId: config.seedInventoryId || undefined,
              }
            );
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              sourcePlanItemId = syncData.planItemId;
            }
          } catch (err) {
            console.warn('[GardenDesigner] Sync with planner failed, placing without link:', err);
          }
        }
      }

      // When modal provided approved preview positions, use them directly.
      // This bypasses the squaresNeeded gate which can misroute to single-position
      // path when targetBed.planningMethod is missing or plantsPerSquare formula
      // doesn't match the modal's row-based calculation.
      if (config.previewPositions && config.previewPositions.length > 1) {
        const dateLookup = new Map<string, string>();
        if (config.positionDates) {
          for (const pd of config.positionDates) {
            dateLookup.set(`${pd.x},${pd.y}`, pd.date);
          }
        }

        const perPositionQty = Math.ceil(totalQuantity / config.previewPositions.length);
        let remaining = totalQuantity;
        const positions = config.previewPositions.map(pos => {
          const qty = Math.min(perPositionQty, remaining);
          remaining -= qty;
          const entry: { x: number; y: number; quantity: number; plantedDate?: string } = {
            x: pos.x, y: pos.y, quantity: qty
          };
          const staggeredDate = dateLookup.get(`${pos.x},${pos.y}`);
          if (staggeredDate) entry.plantedDate = staggeredDate;
          return entry;
        }).filter(p => p.quantity > 0);

        const response = await fetch(`${API_BASE_URL}/api/planted-items/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            gardenBedId: targetBed.id,
            plantId: plant.id,
            variety: config.variety || undefined,
            plantedDate: dateFilter.date,
            plantingMethod: config.plantingMethod,
            status: 'planned',
            notes: config.notes || undefined,
            positions,
            sourcePlanItemId: sourcePlanItemId || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const totalPlaced = positions.reduce((sum, p) => sum + p.quantity, 0);
          const freshBeds = await loadData();
          await fetchPlantingEvents();
          await fetchFuturePlantingEvents();
          const updatedBed = freshBeds.find(b => b.id === targetBed.id);
          if (updatedBed) {
            setActiveBed(updatedBed);
            setVisibleBeds(prev => prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed));
          }
          bumpPlanRefresh();
          showSuccess(`Placed ${totalPlaced} ${cropName}${config.variety ? ` (${config.variety})` : ''} across ${data.created} positions`);
        } else {
          const errorData = await response.json();
          showError(formatConflictError(errorData));
        }
        setShowConfigModal(false);
        setPendingPlant(null);
        return;
      }

      // If only 1 square needed OR not using SFG/MIgardener, create single PlantedItem
      if (squaresNeeded === 1 || (targetBed.planningMethod !== 'square-foot' && targetBed.planningMethod !== 'migardener' && targetBed.planningMethod !== 'intensive' && targetBed.planningMethod !== 'permaculture')) {
        const payload = {
          gardenBedId: targetBed.id,
          plantId: plant.id,
          variety: config.variety || undefined,
          position: finalPosition,
          quantity: totalQuantity,
          status: 'planned',
          notes: config.notes || undefined,
          plantedDate: dateFilter.date,
          plantingMethod: config.plantingMethod,
          sourcePlanItemId: sourcePlanItemId || undefined,
        };

        const response = await apiPost('/api/planted-items', payload);

        if (response.ok) {
          const freshBeds = await loadData();
          await fetchPlantingEvents();
          await fetchFuturePlantingEvents();

          const updatedBed = freshBeds.find(b => b.id === targetBed.id);
          if (updatedBed) {
            setActiveBed(updatedBed);
            setVisibleBeds(prev =>
              prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
            );
          }

          bumpPlanRefresh();
          showSuccess(`Placed ${totalQuantity} ${cropName}${config.variety ? ` (${config.variety})` : ''} in 1 square`);
        } else {
          const errorText = await response.text();
          console.error('Failed to create planted item:', response.status, errorText);
          let errorMessage = 'Failed to place plant in garden';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = formatConflictError(errorData);
          } catch {
            // If error is not JSON, use default message
          }
          showError(errorMessage);
        }
      } else {
        // Multiple squares needed - create PlantedItems spread across adjacent squares
        console.log('✨ Creating multiple PlantedItems for multi-square placement');

        let positions: { x: number; y: number; quantity: number; plantedDate?: string }[];

        // Build date lookup from positionDates (for date-staggered planting)
        const dateLookup = new Map<string, string>();
        if (config.positionDates) {
          for (const pd of config.positionDates) {
            dateLookup.set(`${pd.x},${pd.y}`, pd.date);
          }
        }

        if (config.previewPositions && config.previewPositions.length > 0) {
          // Use positions from modal's preview (user already approved these)
          // Distribute total evenly across positions (not capped at plantsPerSquare,
          // which is wrong for rows where each position holds more than one SFG cell)
          const perPositionQty = Math.ceil(totalQuantity / config.previewPositions.length);
          let remaining = totalQuantity;
          positions = config.previewPositions.map(pos => {
            const qty = Math.min(perPositionQty, remaining);
            remaining -= qty;
            const entry: { x: number; y: number; quantity: number; plantedDate?: string } = { x: pos.x, y: pos.y, quantity: qty };
            const staggeredDate = dateLookup.get(`${pos.x},${pos.y}`);
            if (staggeredDate) entry.plantedDate = staggeredDate;
            return entry;
          }).filter(p => p.quantity > 0);
        } else {
          // Fallback: generate positions in a compact grid pattern starting from finalPosition
          const gridWidth = Math.floor((targetBed.width * 12) / (targetBed.gridSize || 12));
          const gridHeight = Math.floor((targetBed.length * 12) / (targetBed.gridSize || 12));

          positions = [];
          let remainingPlants = totalQuantity;
          let squareIndex = 0;

          const gridSide = Math.ceil(Math.sqrt(squaresNeeded));

          for (let row = 0; row < gridSide && squareIndex < squaresNeeded; row++) {
            for (let col = 0; col < gridSide && squareIndex < squaresNeeded; col++) {
              const x = finalPosition.x + col;
              const y = finalPosition.y + row;

              if (x >= gridWidth || y >= gridHeight) {
                console.warn(`⚠️ Position (${x}, ${y}) out of bounds, skipping`);
                continue;
              }

              const quantityForSquare = Math.min(plantsPerSquare, remainingPlants);
              positions.push({ x, y, quantity: quantityForSquare });

              remainingPlants -= quantityForSquare;
              squareIndex++;
            }
          }
        }

        console.log('📍 Generated positions:', positions);

        // Create PlantedItems via batch POST
        const response = await fetch(`${API_BASE_URL}/api/planted-items/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            gardenBedId: targetBed.id,
            plantId: plant.id,
            variety: config.variety || undefined,
            plantedDate: dateFilter.date,
            plantingMethod: config.plantingMethod,
            status: 'planned',
            notes: config.notes || undefined,
            positions: positions,
            sourcePlanItemId: sourcePlanItemId || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const totalPlantsPlaced = positions.reduce((sum, p) => sum + p.quantity, 0);

          const freshBeds = await loadData();
          await fetchPlantingEvents();
          await fetchFuturePlantingEvents();

          const updatedBed = freshBeds.find(b => b.id === targetBed.id);
          if (updatedBed) {
            setActiveBed(updatedBed);
            setVisibleBeds(prev =>
              prev.map(bed => bed.id === updatedBed.id ? updatedBed : bed)
            );
          }

          bumpPlanRefresh();
          showSuccess(
            `Placed ${totalPlantsPlaced} ${cropName}${config.variety ? ` (${config.variety})` : ''} across ${data.created} squares`
          );
        } else {
          const errorData = await response.json();
          showError(formatConflictError(errorData));
        }
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

        showError(errorMessage);
        setActivePlant(null);
        return;
      }

      // Set this bed as active after successful drop
      setActiveBed(targetBed);

      // Extract crop name from dragged plant
      const cropName = extractCropName(plant.name);

      // Detect plan-sourced drags: ID format plant-{plantId}-planned-{planItemId}
      const planMatch = active.id.toString().match(/^plant-.+-planned-(\d+)$/);
      const sourcePlanItemId = planMatch ? parseInt(planMatch[1], 10) : undefined;
      const initialVariety = active.data.current?.varietyName as string | undefined;

      // Show configuration modal to select variety and configure plant
      setPendingPlant({ cropName, position: { x: gridX, y: gridY }, bedId: targetBed.id, sourcePlanItemId, initialVariety });
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

            // Determine if this is dense planting (multiple plants in one cell)
            const isDensePlanting = plant && plant.spacing && plant.spacing <= 12;
            const quantity = item.quantity > 0 ? item.quantity : 1;

            // Calculate sub-grid positions for dense planting
            const subPositions: { offsetX: number; offsetY: number }[] = [];
            if (isDensePlanting && quantity > 1) {
              // Calculate grid layout: for 4 plants, use 2x2 grid; for 9 plants, use 3x3 grid
              const gridSide = Math.ceil(Math.sqrt(quantity));
              const cellFraction = 1 / gridSide;

              for (let i = 0; i < quantity; i++) {
                const row = Math.floor(i / gridSide);
                const col = i % gridSide;
                // Center each plant within its sub-cell
                subPositions.push({
                  offsetX: (col + 0.5) * cellFraction,
                  offsetY: (row + 0.5) * cellFraction
                });
              }
            } else {
              // Single plant or spread planting - center in cell
              subPositions.push({ offsetX: 0.5, offsetY: 0.5 });
            }

            return (
              <g
                key={item.id}
                data-testid={`planted-item-${item.id}`}
                onMouseEnter={() => setHoveredPlant(item)}
                onMouseLeave={() => setHoveredPlant(null)}
                onClick={(e) => {
                  if (!isShiftPressed) {
                    handlePlantedItemClick(item, bed, e);
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

                {/* Seed Saving Ring (amber outline) */}
                {item.saveForSeed && !item.seedsCollected && (
                  <rect
                    x={item.position.x * cellSize + 1}
                    y={item.position.y * cellSize + 1}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    rx="2"
                  >
                    <title>Saving for seed</title>
                  </rect>
                )}

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

                {/* Render plant icons at sub-grid positions */}
                {subPositions.map((subPos, subIdx) => {
                  const plantX = item.position.x * cellSize + subPos.offsetX * cellSize;
                  const plantY = item.position.y * cellSize + subPos.offsetY * cellSize;
                  const subIconSize = isDensePlanting && quantity > 1 ? iconSize * 0.7 : iconSize;

                  return (
                    <g
                      key={`${item.id}-${subIdx}`}
                      className="select-none"
                      style={{
                        opacity: draggedPlantedItem?.plantedItem.id === item.id ? 0.5 : 1,
                        cursor: isShiftPressed ? 'copy' : 'pointer'
                      }}
                      onMouseDown={(e) => {
                        const shiftHeld = e.shiftKey;
                        console.log('🖱️ MOUSEDOWN on plant icon, shiftKey:', shiftHeld);
                        if (shiftHeld) {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsShiftPressed(true);
                          handlePlantMouseDown(e, item, bed);
                        }
                      }}
                      onClick={(e) => {
                        if (!isShiftPressed) {
                          handlePlantedItemClick(item, bed, e);
                        }
                      }}
                    >
                      <PlantIconSVG
                        plantId={item.plantId}
                        plantIcon={getPlantIcon(item.plantId)}
                        x={plantX - subIconSize / 2}
                        y={plantY - subIconSize / 2}
                        width={subIconSize}
                        height={subIconSize}
                      />
                    </g>
                  );
                })}

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

                {/* Quantity Number - Only show for spread planting or negative quantities (large plants) */}
                {item.quantity !== 0 && !(isDensePlanting && quantity > 1) && (
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

          {/* Future Plantings Overlay - show where future plantings are scheduled */}
          {/* Shows when: toggle is on AND (dragging OR clicking a plant OR just viewing with future events) */}
          <FuturePlantingsOverlay
            positions={getFuturePlantedItemPositions(bed)}
            cellSize={cellSize}
            showOverlay={showFuturePlantings}
            onCellClick={(position, clickX, clickY) => handleFutureCellClick(bed, position, clickX, clickY)}
          />

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
          <div className="flex-shrink-0 flex flex-col gap-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            <PlantPalette
              plants={plants}
              plantingDate={dateFilter.date}
              onQuickHarvestChange={(days) => {
                setQuickHarvestDays(days);
                // Auto-enable future plantings when quick harvest filter is active
                if (days !== null && beds.some(bed => getFuturePlantedItems(bed).length > 0)) {
                  setShowFuturePlantings(true);
                }
              }}
            />
            {activePlanId && activeBed && (
              <PlannedPlantsSection
                planId={activePlanId}
                bedId={activeBed.id}
                bedName={activeBed.name}
                plants={plants}
                dateFilter={dateFilter}
                refreshKey={planRefreshKey}
                futurePlantingEvents={futurePlantingEvents}
                activePlantedItems={getActivePlantedItems(activeBed)}
                allPlantedItems={activeBed.plantedItems || []}
                onDateClick={(dateStr) => handleDateFilterChange({ mode: 'single', date: dateStr })}
                bedWidth={activeBed.width}
                bedLength={activeBed.length}
                bedGridSize={activeBed.gridSize}
                bedPlanningMethod={activeBed.planningMethod}
              />
            )}
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
                  {beds.reduce((sum, bed) => sum + getActivePlantedItems(bed).length, 0)}
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

            {/* Weather Alert Banner */}
            <WeatherAlertBanner
              date={dateFilter.date}
              plantingEvents={plantingEvents}
              plants={plants}
              beds={beds}
              zipCode={localStorage.getItem('weatherZipCode') || ''}
            />

            {/* Future Plantings Toggle - Prominent Button */}
            {(() => {
              const futurePlacedCount = beds.reduce((sum, bed) => sum + getFuturePlantedItems(bed).length, 0);
              if (futurePlacedCount === 0) return null;
              return (
                <div className="mb-4">
                  <button
                    data-testid="future-plantings-toggle"
                    onClick={() => { const next = !showFuturePlantings; localStorage.setItem('showFuturePlantings', String(next)); setShowFuturePlantings(next); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
                      showFuturePlantings
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:border-green-300 hover:bg-green-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        showFuturePlantings ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="font-medium">
                          {showFuturePlantings ? 'Future Plantings Visible' : 'Show Future Plantings'}
                        </div>
                        <div className="text-xs opacity-75">
                          {futurePlacedCount} placed plant{futurePlacedCount !== 1 ? 's' : ''} with future dates
                        </div>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      showFuturePlantings
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {showFuturePlantings ? 'ON' : 'OFF'}
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Bed Selector */}
            {beds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Beds:
                </label>
                <div className="flex items-center gap-4 flex-wrap">
                  <select
                    data-testid="bed-selector"
                    value={bedFilter === 'all' ? 'all' : bedFilter.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'all') {
                        setBedFilter('all');
                        setVisibleBeds(beds);
                        const allIds = new Set(beds.map(b => b.id));
                        setCheckedBeds(allIds);
                        localStorage.setItem('checkedBedIds', JSON.stringify(Array.from(allIds)));
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
                          const singleId = new Set([bedId]);
                          setCheckedBeds(singleId);
                          localStorage.setItem('checkedBedIds', JSON.stringify([bedId]));
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
                    <div data-testid="active-bed-indicator" className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
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
                        data-testid="edit-bed-btn"
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
                    data-testid="add-bed-btn"
                    onClick={() => setShowBedModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Bed
                  </button>

                  {/* Clear Bed Button */}
                  {activeBed && getActivePlantedItems(activeBed).length > 0 && (
                    <button
                      data-testid="clear-bed-btn"
                      onClick={() => setClearConfirm(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Clear Active Bed ({getActivePlantedItems(activeBed).length} plants)
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
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Toggle Bed Visibility:
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Select all beds
                          const allBedIds = new Set(beds.map(b => b.id));
                          setCheckedBeds(allBedIds);
                          setVisibleBeds(beds);
                          setBedFilter('all');
                          localStorage.setItem('checkedBedIds', JSON.stringify(Array.from(allBedIds)));
                          if (!activeBed && beds.length > 0) {
                            setActiveBed(beds[0]);
                          }
                        }}
                        className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => {
                          // Deselect all beds
                          setCheckedBeds(new Set());
                          setVisibleBeds([]);
                          localStorage.setItem('checkedBedIds', JSON.stringify([]));
                          // Don't clear activeBed - keep it for reference
                        }}
                        className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
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
                            localStorage.setItem('checkedBedIds', JSON.stringify(Array.from(newCheckedBeds)));
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
                  data-testid="add-bed-btn-empty"
                  onClick={() => setShowBedModal(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  Create Your First Bed
                </button>
              </div>
            ) : visibleBeds.length > 0 ? (
              <div>
                {/* Horizontal Multi-Bed Layout */}
                <div className="overflow-x-auto overflow-y-auto pb-12" onClick={() => { setSelectedPlant(null); setSelectedPlantedCell(null); setShowMoveInput(false); setMoveTargetLabel(''); setMoveError(null); }}>
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
                          <PlantIcon
                            plantId={item.plantId}
                            plantIcon={getPlantIcon(item.plantId)}
                            size={32}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{getPlantName(item.plantId)}</div>
                            <div className="text-xs text-gray-600">
                              Position: {coordinateToGridLabel(item.position.x, item.position.y)} •
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
            {/* Plant icon */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.8
            }}>
              <PlantIcon
                plantId={activePlant.id}
                plantIcon={activePlant.icon || '🌱'}
                size={48}
              />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Planted Item Details Panel */}
      {selectedPlantedCell && (() => {
        const { left, top } = calculateTooltipPosition(
          selectedPlantedCell.clickX,
          selectedPlantedCell.clickY
        );
        const { item, plant, futureEvents } = selectedPlantedCell;
        const harvestDate = calculateHarvestDate(item, plant);
        const isEstimatedHarvest = item.status !== 'harvested' && harvestDate;
        // Use filter date for "now"
        const asOf = dateFilter.date ? new Date(dateFilter.date) : new Date();
        const daysUntilHarvest = harvestDate
          ? Math.ceil((harvestDate.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return (
          <div
            data-testid="plant-detail-panel"
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-300 p-4 min-w-[280px] max-w-[320px] max-h-[80vh] overflow-y-auto"
            style={{ left: `${left + panelDragOffset.dx}px`, top: `${top + panelDragOffset.dy}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with X close button — drag handle */}
            <div
              className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 select-none"
              onPointerDown={handlePanelDragStart}
              style={{ cursor: 'grab' }}
            >
              <div className="flex items-center gap-2">
                <PlantIcon
                  plantId={item.plantId}
                  plantIcon={getPlantIcon(item.plantId)}
                  size={32}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {getPlantName(item.plantId)}{item.variety ? ` (${item.variety})` : ''}
                  </p>
                  <span className="text-xs text-gray-500">
                    Position {coordinateToGridLabel(item.position.x, item.position.y)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedPlantedCell(null); setShowMoveInput(false); setMoveTargetLabel(''); setMoveError(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Planting Info */}
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span data-testid="plant-status-badge" className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    item.status === 'harvested' ? 'bg-amber-100 text-amber-800' :
                    item.status === 'growing' ? 'bg-green-100 text-green-800' :
                    item.status === 'transplanted' ? 'bg-blue-100 text-blue-800' :
                    item.status === 'seeded' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                  {item.quantity > 1 && <span className="text-xs text-gray-600">Qty: {item.quantity}</span>}
                </div>

                {/* Timeline */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Planted:</span>
                    <span className="font-medium text-green-700">
                      {formatDateSafe(item.plantedDate)}
                    </span>
                  </div>
                  {item.transplantDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Transplanted:</span>
                      <span className="font-medium text-blue-700">
                        {formatDateSafe(item.transplantDate)}
                      </span>
                    </div>
                  )}
                  {harvestDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{isEstimatedHarvest ? 'Est. Harvest:' : 'Harvest:'}</span>
                      <span className="font-medium text-amber-700">
                        {harvestDate.toLocaleDateString()}{isEstimatedHarvest && ' (est.)'}
                      </span>
                    </div>
                  )}
                  {daysUntilHarvest !== null && daysUntilHarvest > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days to harvest:</span>
                      <span className="font-medium text-amber-600">{daysUntilHarvest} days</span>
                    </div>
                  )}
                  {plant?.daysToMaturity && (
                    <div className="flex justify-between text-gray-500">
                      <span>Days to maturity:</span>
                      <span>{plant.daysToMaturity} days</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Save for Seed Section */}
              {(() => {
                const isSaving = item.saveForSeed && !item.seedsCollected;
                const seedMatDate = item.seedMaturityDate ? new Date(item.seedMaturityDate) : null;
                const now = new Date();
                const daysUntilSeedReady = seedMatDate ? Math.ceil((seedMatDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const seedsReady = seedMatDate && daysUntilSeedReady !== null && daysUntilSeedReady <= 0;

                return (
                  <div className={`border rounded-lg p-3 ${isSaving ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 uppercase">Save for Seed</span>
                      <button
                        data-testid="seed-saving-toggle"
                        onClick={() => handleToggleSeedSaving(item, !item.saveForSeed)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          item.saveForSeed ? 'bg-amber-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          item.saveForSeed ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`} style={{ transform: item.saveForSeed ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </button>
                    </div>

                    {isSaving && (
                      <div className="space-y-1.5 mt-2">
                        {seedMatDate && daysUntilSeedReady !== null && daysUntilSeedReady > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-700">Seeds ready:</span>
                            <span className="font-medium text-amber-800">
                              {seedMatDate.toLocaleDateString()} ({daysUntilSeedReady} days)
                            </span>
                          </div>
                        )}
                        {!seedMatDate && (
                          <button
                            onClick={() => setSeedDateItem(item)}
                            className="w-full text-xs px-2 py-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded hover:bg-amber-200"
                          >
                            Set seed maturity date
                          </button>
                        )}
                        {seedsReady && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-green-700">Seeds ready to collect!</p>
                            <button
                              data-testid="collect-seeds-btn"
                              onClick={() => setCollectSeedsItem(item)}
                              className="w-full text-xs px-2 py-1.5 bg-green-100 text-green-800 border border-green-300 rounded hover:bg-green-200 font-medium"
                            >
                              Collect Seeds
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {item.seedsCollected && (
                      <p className="text-xs text-green-700 mt-1">
                        Seeds collected{item.seedsCollectedDate ? ` on ${new Date(item.seedsCollectedDate).toLocaleDateString()}` : ''}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Future Plantings */}
              {futureEvents.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase mb-2">
                    Future Plantings ({futureEvents.length})
                  </p>
                  {futureEvents.slice(0, 3).map((event, index) => {
                    const futurePlant = plants.find(p => p.id === event.plantId);
                    const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
                    return (
                      <div key={event.id || `future-${index}`} className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                        <div className="flex items-center gap-2">
                          {futurePlant && (
                            <PlantIcon
                              plantId={futurePlant.id}
                              plantIcon={futurePlant.icon || '🌱'}
                              size={24}
                            />
                          )}
                          {!futurePlant && <span className="text-lg">🌱</span>}
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-800">
                              {futurePlant?.name || event.plantId}{event.variety ? ` (${event.variety})` : ''}
                            </p>
                            <p className="text-xs text-gray-500">{formatDateSafe(plantingDateStr)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {futureEvents.length > 3 && (
                    <p className="text-xs text-gray-500 text-center">+{futureEvents.length - 3} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-3 pt-2 border-t border-gray-200">
              {showMoveInput ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700">
                    Move to position (e.g., A1, B3, {(() => {
                      const gw = Math.floor((selectedPlantedCell.bed.width * 12) / selectedPlantedCell.bed.gridSize);
                      const gh = Math.floor((selectedPlantedCell.bed.length * 12) / selectedPlantedCell.bed.gridSize);
                      return `A1-${coordinateToGridLabel(gw - 1, gh - 1)}`;
                    })()}):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={moveTargetLabel}
                      onChange={(e) => {
                        setMoveTargetLabel(e.target.value.toUpperCase());
                        setMoveError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleMovePlant();
                        if (e.key === 'Escape') {
                          setShowMoveInput(false);
                          setMoveTargetLabel('');
                          setMoveError(null);
                        }
                      }}
                      placeholder="e.g. B2"
                      autoFocus
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 uppercase"
                    />
                    <button
                      onClick={handleMovePlant}
                      disabled={!moveTargetLabel.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => {
                        setShowMoveInput(false);
                        setMoveTargetLabel('');
                        setMoveError(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                  {moveError && (
                    <p className="text-xs text-red-600 whitespace-pre-line">{moveError}</p>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowMoveInput(true);
                      setMoveTargetLabel('');
                      setMoveError(null);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded hover:bg-amber-100"
                  >
                    Move
                  </button>
                  <button
                    data-testid="delete-plant-btn"
                    onClick={() => setDeleteConfirm(true)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              )}
              {/* Remove All [Plant Type] buttons */}
              {(() => {
                const bedItems = getActivePlantedItems(selectedPlantedCell.bed);
                const sameTypeCount = bedItems.filter(i => i.plantId === item.plantId).length;
                if (sameTypeCount <= 1) return null;

                const hasVariety = !!item.variety;
                const sameVarietyCount = hasVariety
                  ? bedItems.filter(i => i.plantId === item.plantId && i.variety === item.variety).length
                  : 0;
                const hasMultipleVarieties = hasVariety && sameVarietyCount < sameTypeCount;
                const plantName = getPlantName(item.plantId);

                return (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {hasMultipleVarieties && sameVarietyCount > 0 && (
                      <button
                        onClick={() => setRemoveAllByPlantConfirm({
                          plantId: item.plantId,
                          variety: item.variety,
                          count: sameVarietyCount,
                          plantName: `${item.variety} ${plantName}`
                        })}
                        className="w-full px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100"
                      >
                        Remove All {item.variety} {plantName} ({sameVarietyCount})
                      </button>
                    )}
                    <button
                      onClick={() => setRemoveAllByPlantConfirm({
                        plantId: item.plantId,
                        count: sameTypeCount,
                        plantName
                      })}
                      className="w-full px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100"
                    >
                      Remove All {plantName} ({sameTypeCount})
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Future Cell Details Panel */}
      {selectedFutureCell && (() => {
        const { left, top } = calculateTooltipPosition(
          selectedFutureCell.clickX,
          selectedFutureCell.clickY
        );
        const { position, bed, futurePlantedItems } = selectedFutureCell;

        return (
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-green-300 p-4 min-w-[280px] max-w-[320px] max-h-[80vh] overflow-y-auto"
            style={{ left: `${left + panelDragOffset.dx}px`, top: `${top + panelDragOffset.dy}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with X close button - drag handle */}
            <div
              className="flex items-center justify-between mb-3 pb-2 border-b border-green-200 select-none"
              onPointerDown={handlePanelDragStart}
              style={{ cursor: 'grab' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Future Planting</p>
                  <span className="text-xs text-gray-500">
                    {position.x >= 0
                      ? `Position ${coordinateToGridLabel(position.x, position.y)} in ${bed.name}`
                      : bed.name
                    }
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedFutureCell(null); setEditingEventDate(null); setMovingFutureItemId(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Future Placed Plants List */}
            <div className="space-y-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-medium text-green-800 uppercase mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Future Placed Plants ({futurePlantedItems.length})
                </p>

                {futurePlantedItems.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No future plants placed here</p>
                ) : (
                  futurePlantedItems.map((item, index) => {
                    const futurePlant = plants.find(p => p.id === item.plantId);
                    const plantingDate = item.plantedDate ? new Date(item.plantedDate) : null;
                    const daysUntil = plantingDate
                      ? Math.ceil((plantingDate.getTime() - new Date(dateFilter.date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    const plantedDateStr = item.plantedDate
                      ? (typeof item.plantedDate === 'string' ? (item.plantedDate as string).split('T')[0] : new Date(item.plantedDate).toISOString().split('T')[0])
                      : '';

                    return (
                      <div
                        key={item.id || `future-item-${index}`}
                        className="bg-white border border-green-100 rounded-lg p-3 mb-2 last:mb-0"
                      >
                        <div className="flex items-start gap-2">
                          {futurePlant && (
                            <PlantIcon
                              plantId={futurePlant.id}
                              plantIcon={futurePlant.icon || ''}
                              size={32}
                            />
                          )}
                          {!futurePlant && <span className="text-2xl">?</span>}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {futurePlant?.name || item.plantId}
                              {item.variety ? ` (${item.variety})` : ''}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                {coordinateToGridLabel(item.position.x, item.position.y)}
                              </span>
                            </div>
                          </div>
                          {/* Move, Edit & Delete action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (movingFutureItemId === item.id) {
                                  setMovingFutureItemId(null);
                                  setMoveTargetLabel('');
                                  setMoveError(null);
                                } else {
                                  setMovingFutureItemId(item.id);
                                  setMoveTargetLabel('');
                                  setMoveError(null);
                                  setEditingEventDate(null);
                                }
                              }}
                              className={`p-1 rounded transition-colors ${movingFutureItemId === item.id ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                              title="Move plant"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEventDate(
                                  editingEventDate?.itemId === item.id
                                    ? null
                                    : { itemId: item.id, currentDate: plantedDateStr }
                                );
                                setMovingFutureItemId(null);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit planted date"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteFutureEventConfirm({
                                  eventId: item.id,
                                  plantName: futurePlant?.name || item.plantId || 'this plant'
                                });
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete plant"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Inline move input */}
                        {movingFutureItemId === item.id && (
                          <div className="mt-2 pt-2 border-t border-green-100 space-y-2">
                            <label className="text-xs font-medium text-gray-700">
                              Move to position ({(() => {
                                const gw = Math.floor((bed.width * 12) / bed.gridSize);
                                const gh = Math.floor((bed.length * 12) / bed.gridSize);
                                return `A1-${coordinateToGridLabel(gw - 1, gh - 1)}`;
                              })()}):
                            </label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={moveTargetLabel}
                                onChange={(e) => {
                                  setMoveTargetLabel(e.target.value.toUpperCase());
                                  setMoveError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleMoveFuturePlant();
                                  if (e.key === 'Escape') {
                                    setMovingFutureItemId(null);
                                    setMoveTargetLabel('');
                                    setMoveError(null);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="e.g. B2"
                                autoFocus
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 uppercase"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMoveFuturePlant(); }}
                                disabled={!moveTargetLabel.trim()}
                                className="px-2 py-1 text-xs font-medium text-white bg-amber-500 rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Move
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovingFutureItemId(null);
                                  setMoveTargetLabel('');
                                  setMoveError(null);
                                }}
                                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                            {moveError && (
                              <p className="text-xs text-red-600 whitespace-pre-line">{moveError}</p>
                            )}
                          </div>
                        )}

                        {/* Date details */}
                        <div className="mt-2 pt-2 border-t border-green-100 space-y-1">
                          {editingEventDate?.itemId === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                defaultValue={editingEventDate.currentDate}
                                className="flex-1 text-xs border border-green-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditingEventDate(null);
                                }}
                                id={`edit-date-${item.id}`}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const input = document.getElementById(`edit-date-${item.id}`) as HTMLInputElement;
                                  if (input?.value) handleSaveEventDate(item.id, input.value);
                                }}
                                className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                title="Save date"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingEventDate(null); }}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                title="Cancel"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Planted Date:</span>
                              <span className="font-medium text-green-700">{formatDateSafe(item.plantedDate)}</span>
                            </div>
                          )}
                          {daysUntil !== null && daysUntil > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Days from now:</span>
                              <span className="font-medium text-green-600">{daysUntil} days</span>
                            </div>
                          )}
                          {item.quantity && item.quantity > 1 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Quantity:</span>
                              <span className="font-medium">{item.quantity}</span>
                            </div>
                          )}
                          {item.harvestDate && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Expected Harvest:</span>
                              <span className="font-medium text-amber-600">{formatDateSafe(item.harvestDate)}</span>
                            </div>
                          )}
                          {futurePlant?.daysToMaturity && (
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Days to maturity:</span>
                              <span>{futurePlant.daysToMaturity} days</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Info note */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-2">
                <p className="text-xs text-yellow-800 flex items-start gap-1">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>This space is reserved for future plantings. Avoid placing new plants here unless you want to override the schedule.</span>
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clear Bed Confirmation Dialog */}
      <ConfirmDialog
        isOpen={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={handleClearBed}
        title="Clear Garden Bed"
        message={`Are you sure you want to remove all ${activeBed ? getActivePlantedItems(activeBed).length : 0} plants from "${activeBed?.name}"? This action cannot be undone.`}
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

      {/* Remove All By Plant Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!removeAllByPlantConfirm}
        onClose={() => setRemoveAllByPlantConfirm(null)}
        onConfirm={handleRemoveAllByPlant}
        title={`Remove All ${removeAllByPlantConfirm?.plantName || 'Plants'}`}
        message={`Are you sure you want to remove all ${removeAllByPlantConfirm?.count || 0} ${removeAllByPlantConfirm?.plantName || 'plants'} from "${activeBed?.name}"? This action cannot be undone.`}
        confirmText={`Remove All (${removeAllByPlantConfirm?.count || 0})`}
        variant="danger"
      />

      {/* Delete Future Event Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteFutureEventConfirm}
        onClose={() => setDeleteFutureEventConfirm(null)}
        onConfirm={handleDeleteFutureEvent}
        title="Delete Future Plant"
        message={`Remove ${deleteFutureEventConfirm?.plantName || 'this plant'} from the bed? This action cannot be undone.`}
        confirmText="Delete"
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
        sourcePlanItemId={pendingPlant?.sourcePlanItemId}
        initialVariety={pendingPlant?.initialVariety}
        activePlanId={activePlanId ?? undefined}
        onDateChange={(newDate) => {
          const updatedFilter = { ...dateFilter, date: newDate };
          setDateFilter(updatedFilter);
          updateDateFilterUrl(updatedFilter);
        }}
        onPreviewChange={(positions) => setPreviewPositions(positions)}
        onSave={handlePlantConfig}
        onCancel={handleConfigCancel}
      />

      {/* Seed Saving Modals */}
      {collectSeedsItem && (
        <CollectSeedsModal
          isOpen={true}
          onClose={() => setCollectSeedsItem(null)}
          plantedItem={collectSeedsItem}
          plant={plants.find(p => p.id === collectSeedsItem.plantId)}
          onSuccess={handleCollectSeedsSuccess}
        />
      )}
      {seedDateItem && (
        <SetSeedDateModal
          isOpen={true}
          onClose={() => setSeedDateItem(null)}
          plantedItem={seedDateItem}
          plant={plants.find(p => p.id === seedDateItem.plantId)}
          onSuccess={handleSeedDateSuccess}
        />
      )}
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
