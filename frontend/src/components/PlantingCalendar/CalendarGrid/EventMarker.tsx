import React from 'react';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { DateMarkerOrGroup, isGroupedMarker, getEventIcon, getEventLabel, getCategoryColor } from './utils';

interface EventMarkerProps {
  marker: DateMarkerOrGroup;
}

const EventMarker: React.FC<EventMarkerProps> = ({ marker }) => {
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

  // Get color based on plant category
  const colorClass = getCategoryColor(plant.category);
  const icon = getEventIcon(marker.type);
  const label = getEventLabel(marker.type);

  // Build tooltip text with variety if available
  const tooltipText = [
    label,
    plant.name,
    variety ? `(${variety})` : null,
    count > 1 ? `${count} plantings` : null,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`
        ${colorClass} text-white text-xs px-2 py-1 rounded
        flex items-center gap-1 cursor-pointer
        hover:opacity-80 transition-opacity
      `}
      title={tooltipText}
    >
      {/* Event type icon - always visible */}
      <span className="flex-shrink-0">{icon}</span>

      {/* Plant name - truncate if too long */}
      <span className="truncate flex-1 min-w-0">
        {plant.name}
        {variety && <span className="text-[10px] ml-1">({variety})</span>}
        {count > 1 && <span className="text-[10px] ml-1 font-semibold">({count})</span>}
      </span>
    </div>
  );
};

export default EventMarker;
