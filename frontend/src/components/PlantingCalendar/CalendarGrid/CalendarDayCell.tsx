import React, { useState } from 'react';
import { format } from 'date-fns';
import EventMarker from './EventMarker';
import GroupedEventsModal from './GroupedEventsModal';
import { DateMarkerOrGroup, GroupedDateMarker, isGroupedMarker } from './utils';
import { PlantingCalendar } from '../../../types';

interface CalendarDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  markers: DateMarkerOrGroup[];
  onClick: () => void;
  onEventClick?: (event: PlantingCalendar) => void;
}

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  date,
  isCurrentMonth,
  isToday,
  markers,
  onClick,
  onEventClick
}) => {
  const [selectedGroup, setSelectedGroup] = useState<GroupedDateMarker | null>(null);

  // Show up to 5 markers, with "+X more" indicator if there are more
  const visibleMarkers = markers.slice(0, 5);
  const remainingCount = markers.length - 5;

  const handleMarkerClick = (e: React.MouseEvent, marker: DateMarkerOrGroup) => {
    e.stopPropagation(); // Prevent day click

    if (isGroupedMarker(marker)) {
      // Show grouped events modal
      setSelectedGroup(marker);
    } else if (onEventClick) {
      // Show single event edit
      onEventClick(marker.event);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        min-h-[80px] md:min-h-[100px] p-2 border rounded-lg cursor-pointer
        transition-all hover:bg-gray-50 hover:shadow-md
        ${!isCurrentMonth ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800'}
        ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}
      `}
    >
      {/* Date number */}
      <div className="flex justify-between items-start mb-1">
        <span
          className={`
            text-sm md:text-base font-semibold
            ${isToday ? 'text-blue-600' : ''}
            ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
          `}
        >
          {format(date, 'd')}
        </span>
        {isToday && (
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        )}
      </div>

      {/* Event markers container */}
      <div className="flex flex-col gap-1">
        {visibleMarkers.map((marker, index) => (
          <div key={index} onClick={(e) => handleMarkerClick(e, marker)}>
            <EventMarker marker={marker} />
          </div>
        ))}

        {/* "+X more" indicator */}
        {remainingCount > 0 && (
          <div className="text-xs text-gray-500 text-center">
            +{remainingCount} more
          </div>
        )}
      </div>

      {/* Grouped Events Modal */}
      <GroupedEventsModal
        isOpen={!!selectedGroup}
        marker={selectedGroup}
        onClose={() => setSelectedGroup(null)}
        onEditEvent={(event) => {
          if (onEventClick) {
            onEventClick(event);
          }
        }}
      />
    </div>
  );
};

export default CalendarDayCell;
