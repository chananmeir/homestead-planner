import React from 'react';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { DateMarkerOrGroup, isGroupedMarker, getEventIcon, getEventLabel, getCategoryColor } from './utils';

interface EventMarkerProps {
  marker: DateMarkerOrGroup;
  coldWarnings?: Record<string, 'too_cold' | 'marginal' | 'too_hot'>;
}

const EventMarker: React.FC<EventMarkerProps> = ({ marker, coldWarnings }) => {
  const isGrouped = isGroupedMarker(marker);

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

    let mulchType = 'straw';
    try {
      if (typeof eventDetails === 'string') {
        const details = JSON.parse(eventDetails);
        mulchType = details.mulch_type || 'straw';
      } else if (eventDetails && typeof eventDetails === 'object') {
        mulchType = eventDetails.mulchType || 'straw';
      }
    } catch {
      // Use default
    }

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
    const tooltipText = `Mulch Application: ${mulchLabel}${count > 1 ? ` (${count} events)` : ''}`;

    return (
      <div
        className="bg-amber-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
        title={tooltipText}
      >
        <span className="flex-shrink-0">🛡️</span>
        <span className="truncate flex-1 min-w-0">
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

    let treeType = 'sugar';
    let tapCount = 1;

    try {
      if (typeof eventDetails === 'string') {
        const details = JSON.parse(eventDetails);
        treeType = details.tree_type || 'sugar';
        tapCount = details.tap_count || 1;
      } else if (eventDetails && typeof eventDetails === 'object') {
        treeType = eventDetails.treeType || 'sugar';
        tapCount = eventDetails.tapCount || 1;
      }
    } catch {
      // Use defaults
    }

    const count = isGrouped ? marker.count : 1;

    const treeLabels: Record<string, string> = {
      'sugar': 'Sugar Maple',
      'red': 'Red Maple',
      'black': 'Black Maple',
      'boxelder': 'Box Elder',
    };

    const label = `${treeLabels[treeType]} (${tapCount} tap${tapCount > 1 ? 's' : ''})`;
    const tooltipText = `Maple Tapping: ${label}${count > 1 ? ` (${count} trees)` : ''}`;

    return (
      <div
        className="bg-orange-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
        title={tooltipText}
      >
        <span className="flex-shrink-0">🍁</span>
        <span className="truncate flex-1 min-w-0">
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

  // Get color based on plant category
  const colorClass = getCategoryColor(plant.category);
  const icon = getEventIcon(marker.type);
  const label = getEventLabel(marker.type);

  // Check cold warning for this event
  const eventId = isGrouped ? marker.events[0].id : marker.event.id;
  const coldStatus = coldWarnings?.[`${eventId}`];
  const hasWeatherWarning = !isCompleted && !!coldStatus;
  const isHot = coldStatus === 'too_hot';

  // Build tooltip text with variety if available
  const tooltipText = [
    isCompleted ? '[Done]' : null,
    hasWeatherWarning ? (coldStatus === 'too_cold' ? '[TOO COLD]' : coldStatus === 'too_hot' ? '[TOO HOT]' : '[MARGINAL SOIL TEMP]') : null,
    label,
    plant.name,
    variety ? `(${variety})` : null,
    count > 1 ? `${count} plantings` : null,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`
        ${isCompleted ? 'bg-gray-400' : colorClass} text-white text-xs px-2 py-1 rounded
        flex items-center gap-1 cursor-pointer
        hover:opacity-80 transition-opacity
        ${hasWeatherWarning ? 'ring-2 ring-offset-1 ' + (coldStatus === 'too_cold' ? 'ring-red-500' : coldStatus === 'too_hot' ? 'ring-orange-500' : 'ring-yellow-400') : ''}
      `}
      title={tooltipText}
    >
      {/* Weather warning icon, completion checkmark, or event type icon */}
      <span className="flex-shrink-0">
        {isCompleted ? '\u2713' : hasWeatherWarning ? (isHot ? '\uD83C\uDF21\uFE0F' : '\u2744\uFE0F') : icon}
      </span>

      {/* Plant name - strikethrough if completed */}
      <span className={`truncate flex-1 min-w-0 ${isCompleted ? 'line-through' : ''}`}>
        {plant.name}
        {variety && <span className="text-[10px] ml-1">({variety})</span>}
        {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
      </span>
    </div>
  );
};

export default EventMarker;
