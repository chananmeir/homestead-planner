import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { API_BASE_URL } from '../../config';
import { PlannedBedItem, Plant, PlanItemProgress, PlantingEvent, PlantedItem } from '../../types';
import PlantIcon from '../common/PlantIcon';
import { ChevronDown, ChevronUp, Package, AlertTriangle, Info, MapPin, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { extractCropName } from '../../utils/plantUtils';
import { coordinateToGridLabel } from './utils/gridCoordinates';
import { calculateSpaceRequirement } from '../../utils/gardenPlannerSpaceCalculator';

/**
 * Compute how many plants from a plan item are expected to be "in the ground"
 * on a given view date, based on succession schedule and days-to-maturity.
 *
 * For non-succession items, returns full quantityForBed if within the growing window.
 * For succession items, sums only the successions whose [start, start+DTM] window
 * overlaps the view date. Quantity per succession mirrors backend export logic
 * (floor division with remainder distributed to early successions).
 *
 * Returns quantityForBed as fallback when firstPlantDate is missing.
 */
function getDateAwarePlannedCount(
  item: PlannedBedItem,
  viewDateStr: string | undefined,
  resolvedDtm: number
): number {
  // No date filter or no first plant date → show full bed quantity
  if (!viewDateStr || !item.firstPlantDate) return item.quantityForBed;

  const viewDate = new Date(viewDateStr);
  viewDate.setHours(0, 0, 0, 0);

  const succCount = (item.successionCount && item.successionCount > 1) ? item.successionCount : 1;
  const intervalDays = item.successionIntervalDays || 0;
  const totalQty = item.quantityForBed;

  // Quantity per succession: floor divide, remainder to early successions (mirrors backend)
  const baseQty = Math.floor(totalQty / succCount);
  const remainder = totalQty - baseQty * succCount;

  let activeCount = 0;
  const firstDate = new Date(item.firstPlantDate);
  firstDate.setHours(0, 0, 0, 0);

  // Before planting season starts, show full bed quantity as denominator
  if (viewDate < firstDate) {
    return totalQty;
  }

  for (let i = 0; i < succCount; i++) {
    const startDate = new Date(firstDate);
    startDate.setDate(startDate.getDate() + i * intervalDays);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + resolvedDtm);

    if (startDate <= viewDate && viewDate <= endDate) {
      activeCount += baseQty + (i < remainder ? 1 : 0);
    }
  }

  return activeCount;
}

/** Format a date string as a short human-readable label (e.g., "Apr 15") */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Detail for a single succession planting within a planned item */
interface SuccessionDetail {
  index: number;
  plantDate: string;       // YYYY-MM-DD
  harvestDate: string;     // YYYY-MM-DD
  quantity: number;
  status: 'placed' | 'positioned' | 'exported' | 'planned';
  placedPositions: string[];   // Grid labels (e.g., "A1", "B3")
  placedCount: number;
  positionedCount: number;     // From PlantingEvents WITH grid positions
  exportedCount: number;       // From PlantingEvents WITHOUT grid positions
}

/**
 * Compute per-succession details for a planned item by cross-referencing
 * PlantedItems (placed on grid) and PlantingEvents (exported to calendar).
 *
 * Date matching uses a +/-7 day tolerance to handle rounding differences
 * between plan dates and actual placement/export dates.
 */
function computeSuccessionDetails(
  item: PlannedBedItem,
  bedId: number,
  futurePlantingEvents: PlantingEvent[],
  activePlantedItems: PlantedItem[],
  allPlantedItems: PlantedItem[],
  resolvedDtm: number
): SuccessionDetail[] {
  if (!item.firstPlantDate) return [];

  const succCount = (item.successionCount && item.successionCount > 1) ? item.successionCount : 1;
  const intervalDays = item.successionIntervalDays || 0;
  const totalQty = item.quantityForBed;
  const baseQty = Math.floor(totalQty / succCount);
  const remainder = totalQty - baseQty * succCount;

  const firstDate = new Date(item.firstPlantDate + 'T00:00:00');

  // Pre-filter planted items for this plan item.
  // Primary: linked by sourcePlanItemId (placed from Planned section with succession awareness).
  // Fallback: match by plantId + variety (placed from Plant Palette without plan link).
  const linkedPlantedItems = allPlantedItems.filter(
    pi => pi.sourcePlanItemId === item.planItemId
  );
  const itemsAreLinked = linkedPlantedItems.length > 0;
  const matchingPlantedItems = itemsAreLinked
    ? linkedPlantedItems
    : allPlantedItems.filter(
        pi => pi.plantId === item.plantId &&
          (item.varietyName ? pi.variety === item.varietyName : true)
      );

  // Primary matching: events whose exportKey starts with "{planItemId}_" and belong to this bed
  const exportKeyPrefix = `${item.planItemId}_`;
  const exportKeyMatched = (futurePlantingEvents || []).filter(evt =>
    evt.eventType === 'planting' &&
    evt.exportKey?.startsWith(exportKeyPrefix) &&
    evt.gardenBedId === bedId
  );

  // Fallback: legacy matching by plant/variety/bed (for events without exportKey)
  const legacyMatched = (futurePlantingEvents || []).filter(evt =>
    evt.eventType === 'planting' &&
    !evt.exportKey &&
    evt.plantId === item.plantId &&
    evt.gardenBedId === bedId &&
    (item.varietyName ? evt.variety === item.varietyName : true)
  );

  // Use exportKey matches if any exist, otherwise fall back to legacy
  const matchingEvents = exportKeyMatched.length > 0 ? exportKeyMatched : legacyMatched;
  const useExportKey = exportKeyMatched.length > 0;

  const TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  const details: SuccessionDetail[] = [];

  for (let i = 0; i < succCount; i++) {
    const plantDate = new Date(firstDate);
    plantDate.setDate(plantDate.getDate() + i * intervalDays);
    const plantDateStr = `${plantDate.getFullYear()}-${String(plantDate.getMonth() + 1).padStart(2, '0')}-${String(plantDate.getDate()).padStart(2, '0')}`;

    const harvestDate = new Date(plantDate);
    harvestDate.setDate(harvestDate.getDate() + resolvedDtm);
    const harvestDateStr = `${harvestDate.getFullYear()}-${String(harvestDate.getMonth() + 1).padStart(2, '0')}-${String(harvestDate.getDate()).padStart(2, '0')}`;

    const qty = baseQty + (i < remainder ? 1 : 0);
    const plantDateMs = plantDate.getTime();

    // Find placed items (PlantedItems) with plantedDate near this succession's date.
    // Only date-match linked items (placed from Planned section with succession awareness).
    // Unlinked items (palette-placed) skip date matching — their dates don't correspond
    // to specific successions, so they're distributed chronologically by the fallback below.
    const placedForSuccession = itemsAreLinked
      ? matchingPlantedItems.filter(pi => {
          if (!pi.plantedDate) return false;
          const pd = new Date(pi.plantedDate);
          pd.setHours(0, 0, 0, 0);
          return Math.abs(pd.getTime() - plantDateMs) <= TOLERANCE_MS;
        })
      : [];

    const placedPositions = placedForSuccession.map(pi =>
      coordinateToGridLabel(pi.position.x, pi.position.y)
    );
    // Deduplicate positions (multiple items can share position in seed-density)
    const uniquePositions = Array.from(new Set(placedPositions));

    // Find matching PlantingEvents for this succession
    const eventsForSuccession = matchingEvents.filter(evt => {
      if (useExportKey && evt.exportKey) {
        // Parse succession index from last segment of exportKey
        const parts = evt.exportKey.split('_');
        const keyIndex = parseInt(parts[parts.length - 1], 10);
        return keyIndex === i;
      }
      // Legacy fallback: date proximity matching
      const evtDateStr = evt.directSeedDate || evt.transplantDate || evt.seedStartDate;
      if (!evtDateStr) return false;
      const evtDate = new Date(evtDateStr);
      evtDate.setHours(0, 0, 0, 0);
      return Math.abs(evtDate.getTime() - plantDateMs) <= TOLERANCE_MS;
    });

    let positionedCount = 0;
    let exportedCount = 0;
    for (const evt of eventsForSuccession) {
      const evtQty = evt.quantity ?? 1;
      if (evt.positionX != null && evt.positionY != null) {
        positionedCount += evtQty;
      } else {
        exportedCount += evtQty;
      }
    }

    // Determine overall status
    let status: SuccessionDetail['status'] = 'planned';
    if (placedForSuccession.length > 0) {
      status = 'placed';
    } else if (positionedCount > 0) {
      status = 'positioned';
    } else if (exportedCount > 0) {
      status = 'exported';
    }

    details.push({
      index: i,
      plantDate: plantDateStr,
      harvestDate: harvestDateStr,
      quantity: qty,
      status,
      placedPositions: uniquePositions,
      placedCount: placedForSuccession.reduce((sum, pi) => sum + (pi.quantity || 1), 0),
      positionedCount,
      exportedCount,
    });
  }

  // Fallback: if placed items exist for this plan item but none date-matched
  // any succession (all placedCount === 0), distribute total placed count
  // across successions chronologically (earliest first, capped at each qty).
  const totalPlacedInDetails = details.reduce((s, d) => s + d.placedCount, 0);
  const totalPlacedFromItems = matchingPlantedItems.reduce((s, pi) => s + (pi.quantity || 1), 0);

  if (totalPlacedInDetails === 0 && totalPlacedFromItems > 0) {
    let remaining = totalPlacedFromItems;
    for (const d of details) {
      if (remaining <= 0) break;
      const assign = Math.min(remaining, d.quantity);
      d.placedCount = assign;
      remaining -= assign;
      // Update status: fully or partially placed takes precedence over exported/planned
      if (assign > 0) {
        d.status = 'placed';
      }
    }
  }

  return details;
}

/** Status badge colors and labels */
const STATUS_CONFIG: Record<SuccessionDetail['status'], { label: string; bg: string; text: string }> = {
  placed: { label: 'Placed', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  positioned: { label: 'On Grid', bg: 'bg-blue-100', text: 'text-blue-700' },
  exported: { label: 'Scheduled', bg: 'bg-purple-100', text: 'text-purple-700' },
  planned: { label: 'Planned', bg: 'bg-gray-100', text: 'text-gray-600' },
};

/** Bar color per status for the timeline */
const TIMELINE_BAR_COLORS: Record<SuccessionDetail['status'], string> = {
  placed: 'bg-emerald-400',
  positioned: 'bg-blue-400',
  exported: 'bg-purple-400',
  planned: 'bg-gray-300',
};

/** Compact horizontal timeline showing succession periods as colored segments */
const SuccessionTimeline: React.FC<{ details: SuccessionDetail[] }> = ({ details }) => {
  if (details.length < 2) return null;

  // Compute the full date range across all successions
  const allDates = details.flatMap(d => [new Date(d.plantDate + 'T00:00:00'), new Date(d.harvestDate + 'T00:00:00')]);
  const minMs = Math.min(...allDates.map(d => d.getTime()));
  const maxMs = Math.max(...allDates.map(d => d.getTime()));
  const rangeMs = maxMs - minMs;
  if (rangeMs <= 0) return null;

  return (
    <div className="mb-2">
      {/* Date labels */}
      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
        <span>{formatShortDate(new Date(minMs).toISOString().slice(0, 10))}</span>
        <span>{formatShortDate(new Date(maxMs).toISOString().slice(0, 10))}</span>
      </div>
      {/* Timeline bar */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        {details.map((d) => {
          const startMs = new Date(d.plantDate + 'T00:00:00').getTime();
          const endMs = new Date(d.harvestDate + 'T00:00:00').getTime();
          const leftPct = ((startMs - minMs) / rangeMs) * 100;
          const widthPct = Math.max(((endMs - startMs) / rangeMs) * 100, 1); // min 1% visible

          return (
            <div
              key={d.index}
              className={`absolute top-0 h-full ${TIMELINE_BAR_COLORS[d.status]} opacity-80 hover:opacity-100 transition-opacity`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`#${d.index + 1}: ${formatShortDate(d.plantDate)} — ${formatShortDate(d.harvestDate)} (${STATUS_CONFIG[d.status].label})`}
            />
          );
        })}
      </div>
    </div>
  );
};

interface PlannedPlantsSectionProps {
  /** The plan currently being edited - passed from parent context */
  planId: number;
  /** ID of the active/selected bed */
  bedId: number;
  /** Display name for the bed */
  bedName: string;
  /** Plants array from designer to resolve plantId -> Plant object */
  plants: Plant[];
  /** Date filter from GardenDesigner (used to derive year for progress) */
  dateFilter?: { date: string };
  /** Callback when user clicks a planned item (fallback if not dragging) */
  onPlantSelect?: (plant: Plant) => void;
  /** Callback for click-to-place: opens config modal with plan item metadata */
  onClickToPlace?: (plant: Plant, planItemId: number, varietyName?: string) => void;
  /** Key that triggers progress refetch when changed (e.g., after bed reset or plant placement) */
  refreshKey?: number;
  /** Future planting events from the designer — used to show scheduled (exported) counts */
  futurePlantingEvents?: PlantingEvent[];
  /** Active (date-filtered) planted items in the current bed — for date-aware placed counts */
  activePlantedItems?: PlantedItem[];
  /** All planted items in the bed (unfiltered by date) — for succession detail status */
  allPlantedItems?: PlantedItem[];
  /** Callback when user clicks a succession date — receives YYYY-MM-DD string to navigate the view date */
  onDateClick?: (dateStr: string) => void;
  /** Bed width in feet — for capacity indicator */
  bedWidth?: number;
  /** Bed length in feet — for capacity indicator */
  bedLength?: number;
  /** Bed grid size in inches — for space calculation */
  bedGridSize?: number;
  /** Bed planning method — for space calculation */
  bedPlanningMethod?: string;
}

interface DraggablePlannedItemProps {
  item: PlannedBedItem;
  plant: Plant | null;
  bedId: number;
  progress?: PlanItemProgress;
  /** Date-aware planned count (how many expected in-ground on view date) */
  dateAwarePlannedCount: number;
  /** Date-aware placed count (how many are actually in the ground on view date) */
  dateAwarePlacedCount: number;
  /** PlantingEvents with grid positions (positionX/Y set) — counts as "placed" */
  positionedEventCount?: number;
  /** PlantingEvents without grid positions — shown as "scheduled" */
  unpositionedEventCount?: number;
  /** Pre-computed succession details for the expandable panel */
  successionDetails: SuccessionDetail[];
  onSelect?: (plant: Plant) => void;
  /** Callback for click-to-place with plan item metadata */
  onClickToPlace?: (plant: Plant, planItemId: number, varietyName?: string) => void;
  /** Callback when user clicks a succession date — receives YYYY-MM-DD string */
  onDateClick?: (dateStr: string) => void;
}

/**
 * Individual draggable item in the Planned Plants section.
 * Emits the same drag payload as PlantPalette for drop-zone compatibility.
 * Includes an expandable succession details panel.
 *
 * Drag ID format: plant-${plant.id}-planned-${item.planItemId}
 * - Starts with 'plant-' to match palette convention
 * - Includes planItemId to avoid collision with PlantPalette's plant-${id}
 */
const DraggablePlannedItem: React.FC<DraggablePlannedItemProps> = ({
  item,
  plant,
  bedId,
  progress,
  dateAwarePlannedCount,
  dateAwarePlacedCount,
  positionedEventCount,
  unpositionedEventCount,
  successionDetails,
  onSelect,
  onClickToPlace,
  onDateClick
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const canDrag = plant !== null;
  const hasDetails = successionDetails.length > 0;

  // ID must be unique and plant-prefixed
  // PlantPalette uses: plant-${plant.id}
  // We use: plant-${plant.id}-planned-${item.planItemId}
  const dragId = plant ? `plant-${plant.id}-planned-${item.planItemId}` : `planned-orphan-${item.planItemId}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: plant ? {
      ...plant,
      cropName: extractCropName(plant.name),
      // Include variety from the plan item so modal can prefill it
      varietyName: item.varietyName || undefined,
    } : undefined,
    disabled: !canDrag,
  });

  const handleClick = () => {
    if (!isDragging && plant) {
      if (onClickToPlace) {
        onClickToPlace(plant, item.planItemId, item.varietyName || undefined);
      } else if (onSelect) {
        onSelect(plant);
      }
    }
  };

  /** Toggle details; must stop propagation to prevent @dnd-kit from capturing */
  const handleDetailsToggle = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDetailsOpen(prev => !prev);
  };

  return (
    <div>
      <div
        ref={setNodeRef}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
        onClick={handleClick}
        className={`flex items-center gap-2 p-2 rounded transition-colors ${
          isDragging ? 'opacity-50' : ''
        } ${canDrag
          ? 'cursor-grab active:cursor-grabbing hover:bg-green-100'
          : 'cursor-not-allowed opacity-60'
        }`}
        title={canDrag
          ? `Drag or click to place ${item.plantName}${item.varietyName ? ` (${item.varietyName})` : ''}`
          : `${item.plantName} not found in plant database`
        }
      >
        <PlantIcon
          plantId={item.plantId || 'unknown'}
          plantIcon={plant?.icon || '🌱'}
          size={24}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
            <span className="truncate">
              {item.plantName}
              {item.varietyName && (
                <span className="text-gray-500 font-normal"> ({item.varietyName})</span>
              )}
            </span>
            {!canDrag && (
              <span title="Not in palette database">
                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600">
            {progress ? (
              <>
                <span className="font-medium text-blue-600">
                  {dateAwarePlacedCount + (positionedEventCount || 0)}/{Math.max(dateAwarePlannedCount, dateAwarePlacedCount + (positionedEventCount || 0))}
                </span>
                {unpositionedEventCount != null && unpositionedEventCount > 0 && (() => {
                  const remaining = Math.max(0, unpositionedEventCount - dateAwarePlacedCount);
                  if (remaining === 0) return null;
                  return (
                    <span className="text-purple-600 ml-1" title={`${unpositionedEventCount} exported to calendar, ${dateAwarePlacedCount} already placed — ${remaining} still to place`}>
                      ({remaining} to place)
                    </span>
                  );
                })()}
                <span className="text-gray-400 ml-1">
                  (Season: {progress.placedSeason}/{progress.plannedSeason})
                </span>
              </>
            ) : (
              <span>{dateAwarePlannedCount} of {item.totalQuantity} plants</span>
            )}
            {item.successionCount && item.successionCount > 1 && (
              <span className="ml-1 text-green-600">
                ({item.successionCount} successions)
              </span>
            )}
          </div>
        </div>
        {/* Details toggle button - must prevent drag capture */}
        {hasDetails && (
          <button
            onPointerDown={handleDetailsToggle}
            onClick={(e) => e.stopPropagation()}
            className={`flex-shrink-0 p-1 rounded transition-colors ${
              isDetailsOpen
                ? 'bg-green-200 text-green-800'
                : 'text-green-500 hover:text-green-700 hover:bg-green-100'
            }`}
            title={isDetailsOpen ? 'Hide schedule details' : 'Show schedule details'}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expandable Succession Details Panel */}
      {isDetailsOpen && hasDetails && (
        <div className="ml-8 mr-1 mb-2 border-l-2 border-green-300 pl-2 space-y-1.5">
          <SuccessionTimeline details={successionDetails} />
          {successionDetails.map((detail) => {
            const cfg = STATUS_CONFIG[detail.status];
            const succLabel = successionDetails.length > 1
              ? `#${detail.index + 1}`
              : '';
            const MAX_POSITIONS_SHOWN = 5;
            const showPositions = detail.placedPositions.length > 0;
            const truncatedPositions = detail.placedPositions.slice(0, MAX_POSITIONS_SHOWN);
            const extraCount = detail.placedPositions.length - MAX_POSITIONS_SHOWN;

            return (
              <div
                key={detail.index}
                className="text-xs rounded p-1.5 bg-white/60"
              >
                {/* Date range row */}
                <div className="flex items-center gap-1 text-gray-700">
                  <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  {succLabel && (
                    <span className="font-semibold text-gray-600">{succLabel}</span>
                  )}
                  <span>
                    {onDateClick ? (
                      <>
                        <button
                          type="button"
                          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onDateClick(detail.plantDate); }}
                          onClick={(e) => e.stopPropagation()}
                          className="underline decoration-dotted underline-offset-2 hover:text-green-700 hover:decoration-solid cursor-pointer"
                          title={`View garden on ${detail.plantDate}`}
                        >
                          {formatShortDate(detail.plantDate)}
                        </button>
                        {' — '}
                        <button
                          type="button"
                          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onDateClick(detail.harvestDate); }}
                          onClick={(e) => e.stopPropagation()}
                          className="underline decoration-dotted underline-offset-2 hover:text-green-700 hover:decoration-solid cursor-pointer"
                          title={`View garden on ${detail.harvestDate}`}
                        >
                          {formatShortDate(detail.harvestDate)}
                        </button>
                      </>
                    ) : (
                      <>{formatShortDate(detail.plantDate)} — {formatShortDate(detail.harvestDate)}</>
                    )}
                  </span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Quantity and position info */}
                <div className="mt-0.5 flex items-start gap-1 text-gray-500">
                  {detail.status === 'placed' && (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-px" />
                      <span>
                        {detail.placedCount < detail.quantity ? (
                          <>
                            {detail.placedCount}/{detail.quantity} placed, {detail.quantity - detail.placedCount} to place
                          </>
                        ) : (
                          <>
                            {detail.placedCount} placed
                          </>
                        )}
                        {showPositions && (
                          <span className="text-gray-400">
                            {' '}at{' '}
                            <span className="font-mono">
                              {truncatedPositions.join(', ')}
                              {extraCount > 0 && ` +${extraCount} more`}
                            </span>
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {detail.status === 'positioned' && (
                    <>
                      <MapPin className="w-3 h-3 text-blue-500 flex-shrink-0 mt-px" />
                      <span>{detail.positionedCount} positioned on grid</span>
                    </>
                  )}
                  {detail.status === 'exported' && (
                    <>
                      <Clock className="w-3 h-3 text-purple-500 flex-shrink-0 mt-px" />
                      <span>{detail.quantity} to place</span>
                    </>
                  )}
                  {detail.status === 'planned' && (
                    <>
                      <Info className="w-3 h-3 text-gray-400 flex-shrink-0 mt-px" />
                      <span>{detail.quantity} plants (not yet exported)</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Shows plants planned for the active bed from the current Season Plan being edited.
 * Items are draggable with the same payload as PlantPalette for drop-zone compatibility.
 */
const PlannedPlantsSection: React.FC<PlannedPlantsSectionProps> = ({
  planId,
  bedId,
  bedName,
  plants,
  dateFilter,
  onPlantSelect,
  onClickToPlace,
  refreshKey,
  futurePlantingEvents,
  activePlantedItems,
  allPlantedItems,
  onDateClick,
  bedWidth,
  bedLength,
  bedGridSize,
  bedPlanningMethod
}) => {
  const [plannedItems, setPlannedItems] = useState<PlannedBedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [seasonProgress, setSeasonProgress] = useState<Record<string, PlanItemProgress>>({});
  // All planting events for the current bed (no date filtering) — used for succession status matching
  const [allBedPlantingEvents, setAllBedPlantingEvents] = useState<PlantingEvent[]>([]);

  // Fetch planned items when bed or plan changes
  useEffect(() => {
    if (!planId || !bedId) {
      setPlannedItems([]);
      return;
    }

    const fetchPlannedItems = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/garden-plans/${planId}/beds/${bedId}/items`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setPlannedItems(data);
        } else if (response.status === 404) {
          setPlannedItems([]);
          setError(null);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('[PlannedPlantsSection] API error:', errData);
          setError(errData.error || 'Failed to load');
        }
      } catch (err) {
        console.warn('[PlannedPlantsSection] Network error:', err);
        setPlannedItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlannedItems();
  }, [planId, bedId]);

  // Fetch season progress for progress display
  useEffect(() => {
    if (!planId) {
      setSeasonProgress({});
      return;
    }

    const fetchProgress = async () => {
      try {
        // Derive year from dateFilter or default to current year
        const year = dateFilter?.date
          ? new Date(dateFilter.date).getFullYear()
          : new Date().getFullYear();

        const response = await fetch(
          `${API_BASE_URL}/api/garden-planner/season-progress?year=${year}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setSeasonProgress(data.byPlanItemId || {});
        }
      } catch (err) {
        console.warn('[PlannedPlantsSection] Failed to fetch progress:', err);
        // Keep existing progress on error (or empty if first load)
      }
    };

    fetchProgress();
  }, [planId, dateFilter?.date, refreshKey]);

  // Fetch ALL planting events for the bed (no date range filtering).
  // This ensures succession status matching sees events whose harvest window
  // has already passed, avoiding false "Planned" status on exported items.
  useEffect(() => {
    if (!bedId) {
      setAllBedPlantingEvents([]);
      return;
    }

    const fetchAllBedEvents = async () => {
      try {
        // No start_date/end_date params → backend returns all events for the user
        const response = await fetch(
          `${API_BASE_URL}/api/planting-events`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const allEvents: PlantingEvent[] = await response.json();
          // Filter client-side to only events for this bed
          const bedEvents = allEvents.filter(
            evt => evt.gardenBedId === bedId
          );
          setAllBedPlantingEvents(bedEvents);
        } else {
          console.warn('[PlannedPlantsSection] Failed to fetch all planting events');
          setAllBedPlantingEvents([]);
        }
      } catch (err) {
        console.warn('[PlannedPlantsSection] Error fetching all planting events:', err);
        setAllBedPlantingEvents([]);
      }
    };

    fetchAllBedEvents();
  }, [bedId, refreshKey]);

  // Resolve PlannedBedItem -> Plant from the plants array
  const resolvePlant = (item: PlannedBedItem): Plant | null => {
    if (!item.plantId) return null;
    return plants.find(p => p.id === item.plantId) || null;
  };

  // Compute event counts per planned item from ALL bed planting events, split by position status.
  // "Positioned" events have grid coordinates (positionX/Y set) and count as placed.
  // "Unpositioned" events lack coordinates and are shown as "scheduled".
  // Uses allBedPlantingEvents (no date filter) so past-harvest events are still counted.
  const getEventCounts = (item: PlannedBedItem): { positioned: number; unpositioned: number } => {
    if (!item.plantId) return { positioned: 0, unpositioned: 0 };

    // Primary: match by exportKey prefix (bedId filter is redundant here since
    // allBedPlantingEvents is already bed-filtered, but included for consistency)
    const exportKeyPrefix = `${item.planItemId}_`;
    const exportKeyMatched = allBedPlantingEvents.filter(evt =>
      evt.eventType === 'planting' &&
      evt.exportKey?.startsWith(exportKeyPrefix) &&
      evt.gardenBedId === bedId
    );

    // Fallback: legacy matching for events without exportKey
    const legacyMatched = allBedPlantingEvents.filter(evt =>
      evt.eventType === 'planting' &&
      !evt.exportKey &&
      evt.plantId === item.plantId &&
      evt.gardenBedId === bedId &&
      (item.varietyName ? evt.variety === item.varietyName : true)
    );

    const matchingEvents = exportKeyMatched.length > 0 ? exportKeyMatched : legacyMatched;
    let positioned = 0;
    let unpositioned = 0;
    for (const evt of matchingEvents) {
      const qty = evt.quantity ?? 1;
      if (evt.positionX != null && evt.positionY != null) {
        positioned += qty;
      } else {
        unpositioned += qty;
      }
    }
    return { positioned, unpositioned };
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg mb-4">
      {/* Header */}
      <div className="p-3 border-b border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800 text-sm">
              Planned for {bedName}
            </span>
            {plannedItems.length > 0 && (
              <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                {plannedItems.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-green-600 hover:text-green-800 p-1"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Space Capacity Bar */}
        {bedWidth != null && bedLength != null && bedGridSize != null && bedPlanningMethod && plannedItems.length > 0 && (() => {
          const bedCapacitySqFt = bedWidth * bedLength;
          // Calculate grid cells per sq ft for method-aware conversion
          const cellSqFt = (bedGridSize / 12) * (bedGridSize / 12); // grid cell area in sq ft

          let allocatedCells = 0;
          for (const pItem of plannedItems) {
            const pl = plants.find(p => p.id === pItem.plantId);
            if (!pl) continue;
            const cellsPerPlant = calculateSpaceRequirement(pl, bedGridSize, bedPlanningMethod);
            // Peak concurrent = what's in-ground at once (divide by succession count)
            const succCount = (pItem.successionCount && pItem.successionCount > 1) ? pItem.successionCount : 1;
            const peakQty = Math.ceil(pItem.quantityForBed / succCount);
            allocatedCells += cellsPerPlant * peakQty;
          }
          const allocatedSqFt = allocatedCells * cellSqFt;
          const pct = bedCapacitySqFt > 0 ? Math.round((allocatedSqFt / bedCapacitySqFt) * 100) : 0;
          const barColor = pct > 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400';
          const textColor = pct > 100 ? 'text-red-700' : pct >= 80 ? 'text-amber-700' : 'text-green-700';

          return (
            <div className="px-3 py-1.5 border-b border-green-200">
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className={`font-medium ${textColor}`}>
                  {allocatedSqFt.toFixed(1)} / {bedCapacitySqFt} sq ft ({pct}%)
                </span>
                {pct > 100 && (
                  <span className="text-red-600 font-medium">Over capacity</span>
                )}
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-2 max-h-72 overflow-y-auto">
          {loading && (
            <div className="text-center py-3 text-green-600 text-sm">
              Loading...
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-3 text-amber-600 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && plannedItems.length === 0 && (
            <div className="text-center py-3 text-gray-500 text-sm">
              No plants planned for this bed
            </div>
          )}

          {!loading && !error && plannedItems.length > 0 && (
            <div className="space-y-1">
              {plannedItems.map(item => {
                const counts = getEventCounts(item);
                const plant = resolvePlant(item);

                // Resolve DTM: backend-provided (seed override or plant DB) → frontend plant → fallback 60
                const resolvedDtm = item.daysToMaturity ?? plant?.daysToMaturity ?? 60;

                // Date-aware planned count: how many expected in-ground on view date
                const dateAwarePlanned = getDateAwarePlannedCount(item, dateFilter?.date, resolvedDtm);

                // Placed count: ALL PlantedItems matching this plan item in the bed,
                // regardless of planted date vs view date. This ensures that future-dated
                // placements (e.g., succession plantings scheduled months ahead) still
                // count toward plan progress. Uses allPlantedItems (unfiltered by date)
                // rather than activePlantedItems (filtered to items currently in-ground).
                let dateAwarePlaced = 0;
                if (allPlantedItems && allPlantedItems.length > 0) {
                  // Primary: match by sourcePlanItemId (set when dragged from planned section)
                  const linkedItems = allPlantedItems.filter(
                    pi => pi.sourcePlanItemId === item.planItemId
                  );
                  if (linkedItems.length > 0) {
                    // Sum quantity per cell (e.g., 16 carrots per SFG cell), not just cell count
                    dateAwarePlaced = linkedItems.reduce((sum, pi) => sum + (pi.quantity || 1), 0);
                  } else {
                    // Fallback: match by plantId + variety (for items placed from PlantPalette
                    // without a source plan item link, or when plan was recalculated)
                    dateAwarePlaced = allPlantedItems.filter(
                      pi => pi.plantId === item.plantId &&
                        (item.varietyName ? pi.variety === item.varietyName : true)
                    ).reduce((sum, pi) => sum + (pi.quantity || 1), 0);
                  }
                } else if (activePlantedItems && activePlantedItems.length > 0) {
                  // Fallback to date-filtered items if allPlantedItems not available
                  dateAwarePlaced = activePlantedItems.filter(
                    pi => pi.sourcePlanItemId === item.planItemId
                  ).reduce((sum, pi) => sum + (pi.quantity || 1), 0);
                } else {
                  // Fallback to full-season placed count from backend progress
                  const progress = seasonProgress[String(item.planItemId)];
                  dateAwarePlaced = progress ? (progress.placedByBed[String(bedId)] || 0) : 0;
                }

                // Compute per-succession details for the expandable panel
                // Uses allBedPlantingEvents (no date filter) so past-harvest successions
                // correctly show as "exported" rather than "planned".
                const details = computeSuccessionDetails(
                  item,
                  bedId,
                  allBedPlantingEvents,
                  activePlantedItems || [],
                  allPlantedItems || [],
                  resolvedDtm
                );

                return (
                  <DraggablePlannedItem
                    key={item.planItemId}
                    item={item}
                    plant={plant}
                    bedId={bedId}
                    progress={seasonProgress[String(item.planItemId)]}
                    dateAwarePlannedCount={dateAwarePlanned}
                    dateAwarePlacedCount={dateAwarePlaced}
                    positionedEventCount={counts.positioned}
                    unpositionedEventCount={counts.unpositioned}
                    successionDetails={details}
                    onSelect={onPlantSelect}
                    onClickToPlace={onClickToPlace}
                    onDateClick={onDateClick}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlannedPlantsSection;
