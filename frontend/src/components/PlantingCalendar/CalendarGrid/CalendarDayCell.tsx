import React, { useMemo, useState } from 'react';
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
  coldWarnings?: Record<string, 'too_cold' | 'marginal' | 'too_hot'>;
  onClick: () => void;
  onEventClick?: (event: PlantingCalendar) => void;
  onEventUpdated?: () => void;
}

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  date,
  isCurrentMonth,
  isToday,
  markers,
  coldWarnings,
  onClick,
  onEventClick,
  onEventUpdated
}) => {
  const [selectedGroup, setSelectedGroup] = useState<GroupedDateMarker | null>(null);

  // Sort markers so incomplete items appear first (don't get hidden in "+X more")
  const sortedMarkers = useMemo(() => {
    const isMarkerComplete = (marker: DateMarkerOrGroup): boolean => {
      const checkPhase = (event: PlantingCalendar, type: string) => {
        if (type === 'seed-start') {
          return event.indoorSeedStartStatus != null && event.indoorSeedStartStatus !== 'planned';
        }
        if (type === 'harvest') {
          return !!event.harvestCompleted;
        }
        return !!(event.completed || event.isComplete);
      };

      // Non-planting events (mulch, maple-tapping) don't have completion tracking
      if (isGroupedMarker(marker)) {
        const eventType = marker.events[0]?.eventType || 'planting';
        if (eventType !== 'planting') return false;
        return marker.events.every(e => checkPhase(e, marker.type));
      } else {
        const eventType = marker.event.eventType || 'planting';
        if (eventType !== 'planting') return false;
        return checkPhase(marker.event, marker.type);
      }
    };

    return [...markers].sort((a, b) => {
      const aComplete = isMarkerComplete(a) ? 1 : 0;
      const bComplete = isMarkerComplete(b) ? 1 : 0;
      return aComplete - bComplete;
    });
  }, [markers]);

  // Show up to 5 markers, with "+X more" indicator if there are more
  const visibleMarkers = sortedMarkers.slice(0, 5);
  const remainingCount = sortedMarkers.length - 5;

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
            <EventMarker marker={marker} coldWarnings={coldWarnings} />
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
        onEventUpdated={onEventUpdated}
      />
    </div>
  );
};

export default CalendarDayCell;
