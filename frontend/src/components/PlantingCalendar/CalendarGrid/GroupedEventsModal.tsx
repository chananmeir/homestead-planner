import React, { useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { GroupedDateMarker, getEventLabel } from './utils';
import { API_BASE_URL } from '../../../config';
import { coordinateToGridLabel } from '../../GardenDesigner/utils/gridCoordinates';

interface GroupedEventsModalProps {
  isOpen: boolean;
  marker: GroupedDateMarker | null;
  onClose: () => void;
  onEditEvent: (event: PlantingCalendar) => void;
}

const GroupedEventsModal: React.FC<GroupedEventsModalProps> = ({
  isOpen,
  marker,
  onClose,
  onEditEvent
}) => {
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlantingCalendar | null>(null);
  const [partialQuantity, setPartialQuantity] = useState<number>(0);

  if (!isOpen || !marker) return null;

  const plant = PLANT_DATABASE.find(p => p.id === marker.plantId);
  const eventLabel = getEventLabel(marker.type);

  const handleEventClick = (event: PlantingCalendar) => {
    onEditEvent(event);
    onClose();
  };

  // Calculate completion summary
  const getCompletionSummary = () => {
    const total = marker.events.length;
    const completed = marker.events.filter(e =>
      e.quantityCompleted !== undefined && e.quantityCompleted !== null && e.quantity && e.quantityCompleted >= e.quantity
    ).length;
    const partial = marker.events.filter(e =>
      e.quantityCompleted !== undefined && e.quantityCompleted !== null && e.quantity &&
      e.quantityCompleted > 0 && e.quantityCompleted < e.quantity
    ).length;

    return `${completed}/${total} complete${partial > 0 ? `, ${partial} partial` : ''}`;
  };

  // Bulk mark all complete
  const handleBulkMarkComplete = async () => {
    const eventIds = marker.events.map(e => e.id);
    const updates = {
      completed: true,
      quantityCompleted: marker.events[0].quantity || null
    };

    try {
      await fetch(`${API_BASE_URL}/api/planting-events/bulk-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds, updates })
      });

      // Refresh events
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error bulk updating events:', error);
    }
  };

  // Quick complete single event
  const handleQuickComplete = async (event: PlantingCalendar, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await fetch(`${API_BASE_URL}/api/planting-events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          completed: true,
          quantityCompleted: event.quantity || null
        })
      });

      // Refresh
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  // Open partial completion modal
  const openPartialModal = (event: PlantingCalendar, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setPartialQuantity(event.quantityCompleted || 0);
    setShowPartialModal(true);
  };

  // Save partial completion
  const handleSavePartial = async () => {
    if (!selectedEvent) return;

    try {
      await fetch(`${API_BASE_URL}/api/planting-events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedEvent,
          quantityCompleted: partialQuantity,
          completed: selectedEvent.quantity ? partialQuantity >= selectedEvent.quantity : false
        })
      });

      setShowPartialModal(false);
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error saving partial completion:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {plant?.icon || '🌱'} {plant?.name || marker.plantId}
              {marker.variety && ` - ${marker.variety}`}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {eventLabel} on {format(marker.date, 'MMMM d, yyyy')} • {marker.count} plantings
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Bulk Actions Bar */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMarkComplete}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                ✓ Mark All Complete
              </button>
              <button
                onClick={() => setShowPartialModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                📊 Set Partial Completion
              </button>
            </div>

            {/* Completion Summary */}
            <div className="text-sm text-gray-600">
              {getCompletionSummary()}
            </div>
          </div>
        </div>

        {/* Event List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {marker.events.map((event, index) => (
              <div
                key={event.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleEventClick(event)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {plant?.icon || '🌱'} {plant?.name || marker.plantId}
                      {event.variety && ` - ${event.variety}`}
                      <span className="text-sm text-gray-500 ml-2">#{index + 1}</span>
                    </div>

                    {/* Position and completion status */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-3">
                        {/* Existing position display */}
                        {event.positionX !== undefined && event.positionY !== undefined && (
                          <div className="text-sm text-gray-700">
                            📍 Position: {coordinateToGridLabel(event.positionX!, event.positionY!)}
                            {event.spaceRequired && (
                              <span className="ml-2">• {event.spaceRequired} cells</span>
                            )}
                          </div>
                        )}

                        {/* NEW: Quantity completion display */}
                        {event.quantity && (
                          <div className="text-sm">
                            {event.quantityCompleted !== null && event.quantityCompleted !== undefined ? (
                              <span className={`font-medium ${
                                event.quantityCompleted >= event.quantity
                                  ? 'text-green-600'
                                  : event.quantityCompleted > 0
                                    ? 'text-yellow-600'
                                    : 'text-gray-500'
                              }`}>
                                {event.quantityCompleted}/{event.quantity} planted
                                {event.quantityCompleted >= event.quantity && ' ✓'}
                                {event.quantityCompleted > 0 && event.quantityCompleted < event.quantity && ' ⏳'}
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                0/{event.quantity} planted
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quick action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleQuickComplete(event, e)}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          title="Mark this event as fully complete"
                        >
                          ✓ Complete
                        </button>
                        <button
                          onClick={(e) => openPartialModal(event, e)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Set partial completion"
                        >
                          📊 Partial
                        </button>
                      </div>
                    </div>

                    {/* Garden bed info */}
                    {event.gardenBedId && (
                      <div className="text-sm text-gray-600 mt-1">
                        Bed ID: {event.gardenBedId}
                      </div>
                    )}

                    {/* Date info */}
                    <div className="text-sm text-gray-500 mt-1">
                      {event.seedStartDate && (
                        <span>🌱 Start: {format(new Date(event.seedStartDate), 'MMM d')} • </span>
                      )}
                      {event.transplantDate && (
                        <span>🌿 Transplant: {format(new Date(event.transplantDate), 'MMM d')} • </span>
                      )}
                      {event.directSeedDate && (
                        <span>🥕 Direct Seed: {format(new Date(event.directSeedDate), 'MMM d')} • </span>
                      )}
                      {event.expectedHarvestDate && (
                        <span>🎉 Harvest: {format(new Date(event.expectedHarvestDate), 'MMM d')}</span>
                      )}
                    </div>

                    {/* Notes */}
                    {event.notes && (
                      <div className="text-sm text-gray-600 italic mt-2">
                        {event.notes}
                      </div>
                    )}

                    {/* Status badges */}
                    <div className="flex gap-2 mt-2">
                      {/* Completion Status Badge - Enhanced */}
                      {event.quantity && event.quantityCompleted !== null && event.quantityCompleted !== undefined ? (
                        event.quantityCompleted >= event.quantity ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            ✓ Complete ({event.quantityCompleted}/{event.quantity})
                          </span>
                        ) : event.quantityCompleted > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⏳ Partial ({event.quantityCompleted}/{event.quantity})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Not Started (0/{event.quantity})
                          </span>
                        )
                      ) : event.completed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          ✓ Completed
                        </span>
                      ) : null}
                      {event.conflictOverride && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          ⚠️ Conflict Override
                        </span>
                      )}
                      {event.successionGroupId && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          🔄 Succession
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit indicator */}
                  <div className="ml-4 text-gray-400 text-sm">
                    Click to edit →
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Partial Completion Modal */}
      {showPartialModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Set Partial Completion
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event: {plant?.name || marker.plantId} #{marker.events.findIndex(e => e.id === selectedEvent.id) + 1}
                </label>
                <p className="text-sm text-gray-600">
                  Target: {selectedEvent.quantity || 'N/A'} seeds
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How many did you actually plant?
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedEvent.quantity || 999}
                  value={partialQuantity}
                  onChange={(e) => setPartialQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedEvent.quantity && partialQuantity >= selectedEvent.quantity &&
                    '✓ This will mark the event as fully complete'}
                  {selectedEvent.quantity && partialQuantity > 0 && partialQuantity < selectedEvent.quantity &&
                    `⏳ Partial: ${Math.round(partialQuantity / selectedEvent.quantity * 100)}% complete`}
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowPartialModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePartial}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupedEventsModal;
