import React from 'react';
import { X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import PlantIcon from '../../common/PlantIcon';

interface DayDetailModalProps {
  isOpen: boolean;
  date: Date | null;
  events: PlantingCalendar[];
  onClose: () => void;
  onEventClick: (event: PlantingCalendar) => void;
  onAddEvent: () => void;
  gardenBeds?: Array<{ id: number; name: string }>;
}

const getEventTypeInfo = (event: PlantingCalendar) => {
  if (event.seedStartDate) return { icon: '\u{1F331}', label: 'Start Seeds (Indoor)', color: 'bg-green-100 text-green-700' };
  if (event.directSeedDate) return { icon: '\u{1F955}', label: 'Direct Seed', color: 'bg-orange-100 text-orange-700' };
  if (event.transplantDate && !event.seedStartDate) return { icon: '\u{1F33F}', label: 'Transplant', color: 'bg-blue-100 text-blue-700' };
  if (event.expectedHarvestDate) return { icon: '\u{1F389}', label: 'Harvest', color: 'bg-yellow-100 text-yellow-700' };
  return { icon: '\u{1F331}', label: 'Planting', color: 'bg-gray-100 text-gray-700' };
};

const DayDetailModal: React.FC<DayDetailModalProps> = ({
  isOpen,
  date,
  events,
  onClose,
  onEventClick,
  onAddEvent,
  gardenBeds,
}) => {
  if (!isOpen || !date) return null;

  const dayEvents = events.filter(e => {
    const checkDate = (d?: Date) => {
      if (!d) return false;
      const eventDate = new Date(d);
      return eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate();
    };
    return checkDate(e.seedStartDate) || checkDate(e.directSeedDate) ||
      checkDate(e.transplantDate) || checkDate(e.expectedHarvestDate);
  });

  // Group events by type for better organization
  const groupedByType: Record<string, { info: ReturnType<typeof getEventTypeInfo>; events: PlantingCalendar[] }> = {};
  dayEvents.forEach(event => {
    const info = getEventTypeInfo(event);
    if (!groupedByType[info.label]) {
      groupedByType[info.label] = { info, events: [] };
    }
    groupedByType[info.label].events.push(event);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h3>
            <p className="text-sm text-gray-500">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto p-4">
          {dayEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No events scheduled for this day.</p>
              <button
                onClick={onAddEvent}
                className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <Plus size={16} />
                Add Event
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByType).map(([label, group]) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{group.info.icon}</span>
                    <span className="text-sm font-medium text-gray-600">{label}</span>
                    <span className="text-xs text-gray-400">({group.events.length})</span>
                  </div>
                  <div className="space-y-2">
                    {group.events.map(event => {
                      const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
                      const bedName = gardenBeds?.find(b => b.id === event.gardenBedId)?.name;
                      // Seed starts don't auto-complete (tracked via Indoor Seed Starts page)
                      // Other phases use the event's completed flag
                      const isSeedStartPhase = group.info.label === 'Start Seeds (Indoor)';
                      const isCompleted = isSeedStartPhase
                        ? false
                        : (event.completed || event.isComplete);

                      return (
                        <div
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                            isCompleted ? 'border-gray-200 bg-gray-50' : 'border-gray-200'
                          }`}
                        >
                          {plant && (
                            <PlantIcon plantId={plant.id} plantIcon={plant.icon || ''} size={32} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-gray-800 ${isCompleted ? 'line-through opacity-60' : ''}`}>
                              {plant?.name || event.plantId}
                              {event.variety && <span className="text-gray-500 font-normal ml-1">({event.variety})</span>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {event.quantity != null && <span>{event.quantity} plants</span>}
                              {bedName && <span className="text-green-600">{bedName}</span>}
                            </div>
                          </div>
                          {isCompleted && (
                            <span className="text-green-600 text-sm font-medium">{'\u2713'}</span>
                          )}
                          <span className="text-gray-400 text-xs">{'\u203A'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {dayEvents.length > 0 && (
          <div className="p-4 border-t flex gap-2">
            <button
              onClick={onAddEvent}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1"
            >
              <Plus size={16} />
              Add Event
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayDetailModal;
