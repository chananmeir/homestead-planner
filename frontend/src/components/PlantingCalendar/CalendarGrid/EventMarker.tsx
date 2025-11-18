import React from 'react';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { EventMarkerType, getEventIcon, getEventLabel, getCategoryColor } from './utils';

interface EventMarkerProps {
  type: EventMarkerType;
  event: PlantingCalendar;
}

const EventMarker: React.FC<EventMarkerProps> = ({ type, event }) => {
  // Get plant details from database
  const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
  if (!plant) return null;

  // Get color based on plant category
  const colorClass = getCategoryColor(plant.category);
  const icon = getEventIcon(type);
  const label = getEventLabel(type);

  // Build tooltip text with variety if available
  const tooltipText = [
    label,
    plant.name,
    event.variety ? `(${event.variety})` : null,
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
      {/* Icon - hide on very small screens */}
      <span className="hidden sm:inline">{icon}</span>

      {/* Plant name - truncate if too long */}
      <span className="truncate max-w-[100px]">
        {plant.name}
        {event.variety && <span className="text-[10px] ml-1">({event.variety})</span>}
      </span>
    </div>
  );
};

export default EventMarker;
