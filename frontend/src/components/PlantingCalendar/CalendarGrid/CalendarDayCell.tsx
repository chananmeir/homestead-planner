import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import EventMarker from './EventMarker';
import GroupedEventsModal from './GroupedEventsModal';
import {
  DateMarkerOrGroup,
  GroupedDateMarker,
  isGroupedMarker,
  isMarkerSkipped,
  getMarkerEvents,
} from './utils';
import { PlantingCalendar } from '../../../types';

export interface MarkerQuickActions {
  onComplete: (marker: DateMarkerOrGroup) => void;
  onSkip: (marker: DateMarkerOrGroup) => void;
  onUndoSkip: (marker: DateMarkerOrGroup) => void;
  onReschedule: (marker: DateMarkerOrGroup, newDate: string) => void;
}

interface CalendarDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  markers: DateMarkerOrGroup[];
  coldWarnings?: Record<string, 'too_cold' | 'marginal' | 'too_hot'>;
  todayStr?: string;
  quickActions?: MarkerQuickActions;
  onClick: () => void;
  onEventClick?: (event: PlantingCalendar) => void;
  onEventUpdated?: () => void;
}

/**
 * Phase-completion quick-toggle only makes sense for phases whose completion
 * lives on the PlantingEvent itself: transplant/direct-seed (completed) and
 * harvest (harvestCompleted). Seed-start completion is tracked on the linked
 * IndoorSeedStart, and mulch/maple events have no completion tracking.
 */
const canQuickComplete = (marker: DateMarkerOrGroup): boolean => {
  const events = getMarkerEvents(marker);
  const eventType = events[0]?.eventType || 'planting';
  if (eventType !== 'planting') return false;
  return marker.type === 'transplant' || marker.type === 'direct-seed' || marker.type === 'harvest';
};

const isMarkerPhaseComplete = (marker: DateMarkerOrGroup): boolean => {
  const checkPhase = (event: PlantingCalendar, type: string) => {
    if (type === 'seed-start') {
      return event.indoorSeedStartStatus != null && event.indoorSeedStartStatus !== 'planned';
    }
    if (type === 'harvest') {
      return !!event.harvestCompleted;
    }
    return !!(event.completed || event.isComplete);
  };
  const events = getMarkerEvents(marker);
  const eventType = events[0]?.eventType || 'planting';
  if (eventType !== 'planting') return false;
  return events.every(e => checkPhase(e, marker.type));
};

/**
 * One draggable marker row with a hover quick-action bar.
 * Drag-and-drop reschedules the marker's date field onto the drop-target day;
 * the action bar offers complete / skip / reschedule (or undo for skipped rows).
 */
const DraggableMarker: React.FC<{
  marker: DateMarkerOrGroup;
  dragId: string;
  coldWarnings?: Record<string, 'too_cold' | 'marginal' | 'too_hot'>;
  todayStr?: string;
  quickActions?: MarkerQuickActions;
  onMarkerClick: (e: React.MouseEvent) => void;
}> = ({ marker, dragId, coldWarnings, todayStr, quickActions, onMarkerClick }) => {
  const skipped = isMarkerSkipped(marker);
  const phaseComplete = isMarkerPhaseComplete(marker);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => format(marker.date, 'yyyy-MM-dd'));

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { marker },
    disabled: skipped, // skipped rows are restore-only; no rescheduling while skipped
  });

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
        position: 'relative',
        opacity: 0.85,
      }
    : {};

  const actionButton = (label: string, title: string, onAct: () => void) => (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onAct();
      }}
      className="px-1 py-0.5 text-[10px] leading-none bg-white text-gray-700 border border-gray-300 rounded shadow-sm hover:bg-gray-100"
    >
      {label}
    </button>
  );

  return (
    <div className="relative group" style={style} ref={setNodeRef}>
      <div
        onClick={onMarkerClick}
        className={isDragging ? 'pointer-events-none' : ''}
        {...listeners}
        {...attributes}
      >
        <EventMarker marker={marker} coldWarnings={coldWarnings} todayStr={todayStr} />
      </div>

      {/* Hover quick-action bar */}
      {quickActions && !isDragging && (
        <div
          className="absolute -top-2 right-0 hidden group-hover:flex gap-0.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {skipped ? (
            actionButton('↩', 'Undo skip', () => quickActions.onUndoSkip(marker))
          ) : (
            <>
              {canQuickComplete(marker) && !phaseComplete &&
                actionButton('✓', 'Mark complete', () => quickActions.onComplete(marker))}
              {actionButton('⏭', 'Skip (can be undone via "Show skipped")', () => quickActions.onSkip(marker))}
              {actionButton('📅', 'Reschedule…', () => {
                setRescheduleDate(format(marker.date, 'yyyy-MM-dd'));
                setShowReschedule(true);
              })}
            </>
          )}
        </div>
      )}

      {/* Inline reschedule popover (also covers moves outside the visible month) */}
      {showReschedule && (
        <div
          className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-300 rounded-lg shadow-lg p-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1 py-0.5"
          />
          <button
            type="button"
            className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={(e) => {
              e.stopPropagation();
              if (rescheduleDate) {
                quickActions?.onReschedule(marker, rescheduleDate);
              }
              setShowReschedule(false);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              setShowReschedule(false);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  date,
  isCurrentMonth,
  isToday,
  markers,
  coldWarnings,
  todayStr,
  quickActions,
  onClick,
  onEventClick,
  onEventUpdated
}) => {
  const [selectedGroup, setSelectedGroup] = useState<GroupedDateMarker | null>(null);
  const dateKey = format(date, 'yyyy-MM-dd');

  // Drop target for drag-to-reschedule
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dateKey });

  // Sort markers so incomplete items appear first (don't get hidden in "+X more");
  // skipped rows sink below completed ones.
  const sortedMarkers = useMemo(() => {
    const rank = (marker: DateMarkerOrGroup): number => {
      if (isMarkerSkipped(marker)) return 2;
      return isMarkerPhaseComplete(marker) ? 1 : 0;
    };
    return [...markers].sort((a, b) => rank(a) - rank(b));
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
      ref={setDropRef}
      onClick={onClick}
      className={`
        min-h-[80px] md:min-h-[100px] p-2 border rounded-lg cursor-pointer
        transition-all hover:bg-gray-50 hover:shadow-md
        ${!isCurrentMonth ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800'}
        ${isToday ? 'border-blue-500 border-2 bg-blue-50/50' : 'border-gray-200'}
        ${isOver ? 'ring-2 ring-green-500 bg-green-50' : ''}
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
        {visibleMarkers.map((marker, index) => {
          const ids = getMarkerEvents(marker).map(e => e.id).join('_');
          return (
            <DraggableMarker
              key={`${marker.type}-${ids}`}
              marker={marker}
              dragId={`marker|${dateKey}|${marker.type}|${ids}`}
              coldWarnings={coldWarnings}
              todayStr={todayStr}
              quickActions={quickActions}
              onMarkerClick={(e) => handleMarkerClick(e, marker)}
            />
          );
        })}

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
