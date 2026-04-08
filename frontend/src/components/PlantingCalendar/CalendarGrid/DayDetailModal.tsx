import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import PlantIcon from '../../common/PlantIcon';
import { apiPatch, apiDelete } from '../../../utils/api';

interface DayDetailModalProps {
  isOpen: boolean;
  date: Date | null;
  events: PlantingCalendar[];
  onClose: () => void;
  onEventClick: (event: PlantingCalendar) => void;
  onAddEvent: () => void;
  gardenBeds?: Array<{ id: number; name: string }>;
  onEventUpdated?: () => void;
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
  onEventUpdated,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSwitching, setBulkSwitching] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Reset selection when modal closes or a different day is opened
  useEffect(() => {
    setSelectedIds(new Set());
  }, [isOpen, date]);

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

  // Indoor starts that haven't been completed (eligible for bulk switch)
  const indoorStartEvents = dayEvents.filter(e =>
    !!e.seedStartDate && !e.completed && !e.isComplete
  );
  const hasIndoorStarts = indoorStartEvents.length > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === indoorStartEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(indoorStartEvents.map(e => e.id)));
    }
  };

  const handleBulkSwitch = async () => {
    if (selectedIds.size === 0) return;
    const ok = window.confirm(
      `Switch ${selectedIds.size} indoor start event${selectedIds.size > 1 ? 's' : ''} to direct seed? Transplant dates will become direct seed dates and linked seed start records will be removed.`
    );
    if (!ok) return;
    setBulkSwitching(true);
    try {
      const response = await apiPatch('/api/planting-events/bulk-switch-to-direct-seed', {
        eventIds: Array.from(selectedIds),
      });
      if (response.ok) {
        setSelectedIds(new Set());
        if (onEventUpdated) onEventUpdated();
      }
    } catch (err) {
      console.error('Bulk switch to direct seed failed:', err);
    } finally {
      setBulkSwitching(false);
    }
  };

  const handleDeleteEvent = async (event: PlantingCalendar) => {
    const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
    const name = plant?.name || event.plantId || 'this event';
    const ok = window.confirm(`Delete "${name}${event.variety ? ` (${event.variety})` : ''}"? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(event.id);
    try {
      const response = await apiDelete(`/api/planting-events/${event.id}`);
      if (response.ok) {
        if (onEventUpdated) onEventUpdated();
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
    } finally {
      setDeletingId(null);
    }
  };

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
                      // Phase-specific completion:
                      // - Seed starts: tracked via Indoor Seed Starts page
                      // - Harvest: tracked via separate harvestCompleted flag
                      // - Other phases: use event.completed flag
                      const isSeedStartPhase = group.info.label === 'Start Seeds (Indoor)';
                      const isHarvestPhase = group.info.label === 'Harvest';
                      const isCompleted = isSeedStartPhase
                        ? (event.indoorSeedStartStatus != null && event.indoorSeedStartStatus !== 'planned')
                        : isHarvestPhase
                        ? !!event.harvestCompleted
                        : (event.completed || event.isComplete);
                      const isSelectable = isSeedStartPhase && !isCompleted;

                      return (
                        <div
                          key={event.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                            isCompleted ? 'border-gray-200 bg-gray-50' : 'border-gray-200'
                          } ${selectedIds.has(event.id) ? 'ring-2 ring-orange-300 border-orange-300' : ''}`}
                        >
                          {isSelectable && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(event.id)}
                              onChange={() => toggleSelect(event.id)}
                              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 flex-shrink-0"
                              onClick={e => e.stopPropagation()}
                            />
                          )}
                          <div className="flex-1 min-w-0 flex items-center gap-3" onClick={() => onEventClick(event)}>
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
                          </div>
                          {isCompleted && (
                            <span className="text-green-600 text-sm font-medium">{'\u2713'}</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event); }}
                            disabled={deletingId === event.id}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                            title="Delete event"
                          >
                            {deletingId === event.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                          <span className="text-gray-400 text-xs" onClick={() => onEventClick(event)}>{'\u203A'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk action bar for indoor starts */}
        {hasIndoorStarts && (
          <div className="px-4 py-2 border-t bg-orange-50 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selectedIds.size === indoorStartEvents.length && indoorStartEvents.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              Select all indoor starts ({indoorStartEvents.length})
            </label>
            <button
              onClick={handleBulkSwitch}
              disabled={selectedIds.size === 0 || bulkSwitching}
              className="ml-auto px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {bulkSwitching ? 'Switching...' : `Switch to Direct Seed (${selectedIds.size})`}
            </button>
          </div>
        )}

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
