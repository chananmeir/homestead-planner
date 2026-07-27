import React from 'react';
import { format } from 'date-fns';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { getEventDetail, parseEventDetails } from '../../../utils/eventDetails';
import {
  DateMarkerOrGroup,
  isGroupedMarker,
  isMarkerSkipped,
  getEventIcon,
  getEventLabel,
  getCategoryColor,
  SuccessionInfo,
  SUCCESSION_PALETTE,
  MarkerAttention,
} from './utils';

interface EventMarkerProps {
  marker: DateMarkerOrGroup;
  coldWarnings?: Record<string, 'too_cold' | 'marginal' | 'too_hot'>;
  /** Simulation-aware "today" as yyyy-MM-dd; enables overdue styling when provided. */
  todayStr?: string;
  /** Set when the event belongs to a succession series (renders "k/N" + color bar). */
  successionInfo?: SuccessionInfo;
  /** Dashboard-parity state: harvest-ready glow or missed flag. */
  attention?: MarkerAttention;
}

const EventMarker: React.FC<EventMarkerProps> = ({ marker, coldWarnings, todayStr, successionInfo, attention }) => {
  const isGrouped = isGroupedMarker(marker);
  const isSkipped = isMarkerSkipped(marker);
  const markerDateStr = format(marker.date, 'yyyy-MM-dd');

  // Determine event type
  const eventType = isGrouped
    ? marker.events[0].eventType || 'planting'
    : marker.event.eventType || 'planting';

  // MULCH EVENT - Garden maintenance event for mulch application
  if (eventType === 'mulch') {
    // Parse event details to get mulch type
    const eventDetails = isGrouped
      ? marker.events[0].eventDetails
      : marker.event.eventDetails;

    const details = parseEventDetails(eventDetails);
    const mulchType = getEventDetail<string>(details, 'mulch_type', 'mulchType') || 'straw';

    const count = isGrouped ? marker.count : 1;

    // Map mulch types to labels
    const mulchLabels: Record<string, string> = {
      'none': 'Remove Mulch',
      'straw': 'Straw Mulch',
      'wood-chips': 'Wood Chips',
      'leaves': 'Leaf Mulch',
      'grass': 'Grass Clippings',
      'compost': 'Compost',
      'black-plastic': 'Black Plastic',
      'clear-plastic': 'Clear Plastic',
    };

    const mulchLabel = mulchLabels[mulchType] || mulchType;
    const tooltipText = `${isSkipped ? '[Skipped] ' : ''}Mulch Application: ${mulchLabel}${count > 1 ? ` (${count} events)` : ''}`;

    return (
      <div
        className={`bg-amber-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isSkipped ? 'opacity-40 grayscale' : ''}`}
        title={tooltipText}
      >
        <span className="flex-shrink-0">🛡️</span>
        <span className={`truncate flex-1 min-w-0 ${isSkipped ? 'line-through' : ''}`}>
          {mulchLabel}
          {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
        </span>
      </div>
    );
  }

  // MAPLE TAPPING EVENT - Homestead event for maple syrup production
  if (eventType === 'maple-tapping') {
    const eventDetails = isGrouped
      ? marker.events[0].eventDetails
      : marker.event.eventDetails;

    const details = parseEventDetails(eventDetails);
    const treeType = getEventDetail<string>(details, 'tree_type', 'treeType') || 'sugar';
    const tapCount = getEventDetail<number>(details, 'tap_count', 'tapCount') || 1;

    const count = isGrouped ? marker.count : 1;

    const treeLabels: Record<string, string> = {
      'sugar': 'Sugar Maple',
      'red': 'Red Maple',
      'black': 'Black Maple',
      'boxelder': 'Box Elder',
    };

    const label = `${treeLabels[treeType]} (${tapCount} tap${tapCount > 1 ? 's' : ''})`;
    const tooltipText = `${isSkipped ? '[Skipped] ' : ''}Maple Tapping: ${label}${count > 1 ? ` (${count} trees)` : ''}`;

    return (
      <div
        className={`bg-orange-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isSkipped ? 'opacity-40 grayscale' : ''}`}
        title={tooltipText}
      >
        <span className="flex-shrink-0">🍁</span>
        <span className={`truncate flex-1 min-w-0 ${isSkipped ? 'line-through' : ''}`}>
          {label}
          {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
        </span>
      </div>
    );
  }

  if (eventType === 'fertilizing') {
    const eventDetails = isGrouped
      ? marker.events[0].eventDetails
      : marker.event.eventDetails;
    const details = parseEventDetails(eventDetails);
    const fertilizerType = getEventDetail<string>(details, 'fertilizer_type', 'fertilizerType') || 'balanced-organic';
    const amount = getEventDetail<number | string>(details, 'amount');
    const unit = getEventDetail<string>(details, 'amount_unit', 'amountUnit');
    const count = isGrouped ? marker.count : 1;

    const fertilizerLabels: Record<string, string> = {
      'compost': 'Compost',
      'compost-tea': 'Compost Tea',
      'fish-emulsion': 'Fish Emulsion',
      'kelp': 'Kelp',
      'blood-meal': 'Blood Meal',
      'bone-meal': 'Bone Meal',
      'balanced-organic': 'Balanced Organic',
      'slow-release': 'Slow Release',
      'synthetic': 'Synthetic',
      'custom': 'Custom Fertilizer',
    };

    const label = [
      fertilizerLabels[fertilizerType] || fertilizerType,
      amount != null && unit ? `${amount} ${unit}` : null,
    ].filter(Boolean).join(' - ');
    const tooltipText = `${isSkipped ? '[Skipped] ' : ''}Fertilizing: ${label}${count > 1 ? ` (${count} events)` : ''}`;

    return (
      <div
        className={`bg-lime-700 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isSkipped ? 'opacity-40 grayscale' : ''}`}
        title={tooltipText}
      >
        <span className="flex-shrink-0">{'\u2697\uFE0F'}</span>
        <span className={`truncate flex-1 min-w-0 ${isSkipped ? 'line-through' : ''}`}>
          {label}
          {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
        </span>
      </div>
    );
  }

  if (eventType === 'irrigation') {
    const eventDetails = isGrouped
      ? marker.events[0].eventDetails
      : marker.event.eventDetails;
    const details = parseEventDetails(eventDetails);
    const method = getEventDetail<string>(details, 'method') || 'drip';
    const duration = getEventDetail<number | string>(details, 'duration_minutes', 'durationMinutes');
    const count = isGrouped ? marker.count : 1;

    const methodLabels: Record<string, string> = {
      'drip': 'Drip',
      'soaker-hose': 'Soaker Hose',
      'sprinkler': 'Sprinkler',
      'hand-water': 'Hand Water',
      'overhead': 'Overhead',
      'flood': 'Flood',
      'other': 'Watering',
    };

    const label = [
      methodLabels[method] || method,
      duration != null ? `${duration} min` : null,
    ].filter(Boolean).join(' - ');
    const tooltipText = `${isSkipped ? '[Skipped] ' : ''}Irrigation: ${label}${count > 1 ? ` (${count} events)` : ''}`;

    return (
      <div
        className={`bg-sky-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isSkipped ? 'opacity-40 grayscale' : ''}`}
        title={tooltipText}
      >
        <span className="flex-shrink-0">{'\uD83D\uDCA7'}</span>
        <span className={`truncate flex-1 min-w-0 ${isSkipped ? 'line-through' : ''}`}>
          {label}
          {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
        </span>
      </div>
    );
  }

  if (eventType === 'custom') {
    const eventDetails = isGrouped
      ? marker.events[0].eventDetails
      : marker.event.eventDetails;
    const details = parseEventDetails(eventDetails);
    const label = getEventDetail<string>(details, 'label', 'name', 'title') || 'Garden Event';
    const count = isGrouped ? marker.count : 1;
    const tooltipText = `${isSkipped ? '[Skipped] ' : ''}${label}${count > 1 ? ` (${count} events)` : ''}`;

    return (
      <div
        className={`bg-slate-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${isSkipped ? 'opacity-40 grayscale' : ''}`}
        title={tooltipText}
      >
        <span className="flex-shrink-0">{'\u2022'}</span>
        <span className={`truncate flex-1 min-w-0 ${isSkipped ? 'line-through' : ''}`}>
          {label}
          {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
        </span>
      </div>
    );
  }

  // PLANTING EVENT - existing logic for plant-based events
  // Get plant details from database
  const plantId = isGrouped ? marker.plantId : marker.event.plantId;
  const plant = PLANT_DATABASE.find(p => p.id === plantId);
  if (!plant) return null;

  // Get variety and count
  const variety = isGrouped ? marker.variety : marker.event.variety;
  const count = isGrouped ? marker.count : 1;

  // Phase-specific completion:
  // - 'seed-start': tracked via Indoor Seed Starts page status
  // - 'harvest': tracked via separate harvestCompleted flag
  // - other phases (direct-seed, transplant): use event.completed flag
  const isPhaseComplete = (event: { completed: boolean; harvestCompleted?: boolean; isComplete?: boolean; indoorSeedStartStatus?: string }) => {
    if (marker.type === 'seed-start') {
      // Use IndoorSeedStart.status -- anything beyond 'planned' means started
      return event.indoorSeedStartStatus != null && event.indoorSeedStartStatus !== 'planned';
    }
    if (marker.type === 'harvest') {
      return !!event.harvestCompleted;
    }
    return event.completed || event.isComplete;
  };

  const isCompleted = isGrouped
    ? marker.events.every(e => isPhaseComplete(e))
    : isPhaseComplete(marker.event);

  // Plan-only detection (seed-start markers only): event has a seedStartDate but
  // no linked IndoorSeedStart yet (indoorSeedStartStatus == null).
  const isPlanOnlySeedStart = (() => {
    if (marker.type !== 'seed-start') return false;
    const eventsList = isGrouped ? marker.events : [marker.event];
    return eventsList.every(e => e.indoorSeedStartStatus == null && e.seedStartDate != null);
  })();

  // Get color based on plant category
  const colorClass = getCategoryColor(plant.category);
  const icon = getEventIcon(marker.type);
  const label = getEventLabel(marker.type);

  // Check cold warning for this event
  const eventId = isGrouped ? marker.events[0].id : marker.event.id;
  const coldStatus = coldWarnings?.[`${eventId}`];
  const hasWeatherWarning = !isCompleted && !isSkipped && !!coldStatus;
  const isHot = coldStatus === 'too_hot';

  // Overdue: the marker's date has passed (vs. simulation-aware today) and this
  // phase isn't complete. Weather warnings keep ring precedence over overdue.
  const isOverdue = !!todayStr && !isCompleted && !isSkipped && markerDateStr < todayStr;

  // Dashboard parity: harvest-ready glow outranks the generic overdue ring on
  // harvest markers; "missed" refines the overdue tooltip on planting markers.
  const isHarvestReady = !isSkipped && !isCompleted && attention === 'harvest-ready';
  const isMissed = !isSkipped && !isCompleted && attention === 'missed';

  // Build tooltip text with variety if available
  const tooltipText = [
    isSkipped ? '[Skipped]' : null,
    isCompleted ? '[Done]' : null,
    isHarvestReady ? '[Ready to harvest]' : null,
    isMissed ? '[Missed]' : null,
    !hasWeatherWarning && isOverdue && !isHarvestReady && !isMissed ? '[OVERDUE]' : null,
    hasWeatherWarning ? (coldStatus === 'too_cold' ? '[TOO COLD]' : coldStatus === 'too_hot' ? '[TOO HOT]' : '[MARGINAL SOIL TEMP]') : null,
    isPlanOnlySeedStart ? '[Plan only]' : null,
    successionInfo ? `[Series ${successionInfo.index}/${successionInfo.total}]` : null,
    label,
    plant.name,
    variety ? `(${variety})` : null,
    count > 1 ? `${count} plantings` : null,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`
        ${isCompleted || isSkipped ? 'bg-gray-400' : colorClass} text-white text-xs px-2 py-1 rounded
        flex items-center gap-1 cursor-pointer
        hover:opacity-80 transition-opacity
        ${isSkipped ? 'opacity-40 grayscale' : ''}
        ${successionInfo ? `border-l-4 ${SUCCESSION_PALETTE[successionInfo.colorIdx]}` : ''}
        ${isPlanOnlySeedStart && !isCompleted && !hasWeatherWarning && !isSkipped ? 'border border-dashed border-amber-300' : ''}
        ${hasWeatherWarning ? 'ring-2 ring-offset-1 ' + (coldStatus === 'too_cold' ? 'ring-red-500' : coldStatus === 'too_hot' ? 'ring-orange-500' : 'ring-yellow-400') : ''}
        ${!hasWeatherWarning && isHarvestReady ? 'ring-2 ring-offset-1 ring-amber-400 animate-pulse' : ''}
        ${!hasWeatherWarning && !isHarvestReady && isOverdue ? 'ring-2 ring-offset-1 ring-red-400' : ''}
      `}
      title={tooltipText}
    >
      {/* Weather warning icon, completion checkmark, or event type icon */}
      <span className="flex-shrink-0">
        {isCompleted ? '\u2713' : hasWeatherWarning ? (isHot ? '\uD83C\uDF21\uFE0F' : '\u2744\uFE0F') : isHarvestReady ? '\uD83E\uDDFA' : isMissed ? '\u23F0' : isOverdue ? '\u26A0\uFE0F' : icon}
      </span>

      {/* Plant name - strikethrough if completed or skipped */}
      <span className={`truncate flex-1 min-w-0 ${isCompleted || isSkipped ? 'line-through' : ''}`}>
        {plant.name}
        {variety && <span className="text-[10px] ml-1">({variety})</span>}
        {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
      </span>

      {/* Succession position badge */}
      {successionInfo && (
        <span className="flex-shrink-0 text-[10px] font-semibold bg-black/20 rounded px-1">
          {'\u21BB'}{successionInfo.index}/{successionInfo.total}
        </span>
      )}
    </div>
  );
};

export default EventMarker;
