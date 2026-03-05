import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../utils/api';
import { Modal } from '../common/Modal';

interface PlantingEventNeedingStart {
  plantingEventId: number;
  plantId: string;
  plantName: string;
  plantIcon: string;
  variety?: string;
  gardenBedId?: number;
  gardenBedName?: string;
  transplantDate: string;
  weeksIndoors: number;
  germinationDays: number;
  suggestedIndoorStartDate: string;
  expectedGerminationDate: string;
  daysUntilStart: number;
  timingStatus: 'good' | 'urgent' | 'past';
  canStartIndoors: boolean;
  notes?: string;
  spaceRequired?: number;  // Number of plants planned in garden
}

interface ImportFromGardenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

export const ImportFromGardenModal: React.FC<ImportFromGardenModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showSuccess,
  showError,
}) => {
  const [allEvents, setAllEvents] = useState<PlantingEventNeedingStart[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [creating, setCreating] = useState(false);
  const [showAllYears, setShowAllYears] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/planting-events/needs-indoor-starts');
      if (response.ok) {
        const data = await response.json();
        const loadedEvents = data.events || [];
        setAllEvents(loadedEvents);
        setSelectedEvents(new Set()); // Reset selection

        // Initialize quantities from spaceRequired (number of plants planned in garden)
        const defaultQuantities: Record<number, number> = {};
        loadedEvents.forEach((event: PlantingEventNeedingStart) => {
          // Use spaceRequired from garden plan, fallback to 3 if not set
          const quantity = event.spaceRequired || 3;
          defaultQuantities[event.plantingEventId] = quantity;
        });
        setQuantities(defaultQuantities);
      } else {
        showError('Failed to load planting events');
      }
    } catch (error) {
      console.error('Error loading events:', error);
      showError('Network error while loading events');
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on date range (show only events within next 6 months by default)
  const events = showAllYears ? allEvents : allEvents.filter(event => {
    const transplantDate = new Date(event.transplantDate);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return transplantDate <= sixMonthsFromNow;
  });

  const toggleSelection = (eventId: number) => {
    const newSelection = new Set(selectedEvents);
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
    setSelectedEvents(newSelection);
  };

  const selectAll = () => {
    if (selectedEvents.size === events.length) {
      setSelectedEvents(new Set()); // Deselect all
    } else {
      setSelectedEvents(new Set(events.map(e => e.plantingEventId))); // Select all
    }
  };

  const handleCreateSelected = async () => {
    if (selectedEvents.size === 0) {
      showError('Please select at least one event');
      return;
    }

    try {
      setCreating(true);
      let successCount = 0;
      let errorCount = 0;

      for (const eventId of Array.from(selectedEvents)) {
        const event = events.find(e => e.plantingEventId === eventId);
        if (!event) continue;

        try {
          const desiredQuantity = quantities[event.plantingEventId] || 3;
          const payload = {
            plantingEventId: event.plantingEventId,
            plantId: event.plantId,
            variety: event.variety,
            transplantDate: event.transplantDate,
            desiredQuantity: desiredQuantity,
            location: 'windowsill',
            notes: `For ${event.gardenBedName || 'garden bed ' + (event.gardenBedId || 'TBD')}. Transplant on ${new Date(event.transplantDate).toLocaleDateString()}.`,
          };

          const response = await apiPost('/api/indoor-seed-starts/from-planting-event', payload);

          if (response.ok) {
            successCount++;
            // Check for warnings (e.g., past-due start dates)
            const responseData = await response.json();
            if (responseData.warning) {
              console.warn(`${event.plantName}: ${responseData.warning}`);
            }
          } else {
            errorCount++;
            const errorData = await response.json();
            console.error(`Failed to create indoor start for ${event.plantName}:`, errorData.error || errorData);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error creating indoor start for ${event.plantName}:`, error);
        }
      }

      // Show results
      if (successCount > 0) {
        showSuccess(`Created ${successCount} indoor seed start${successCount > 1 ? 's' : ''} with quantities you specified`);
      }
      if (errorCount > 0) {
        showError(`Failed to create ${errorCount} indoor start${errorCount > 1 ? 's' : ''}`);
      }

      // Reload events and close
      if (successCount > 0) {
        onSuccess();
        onClose();
      } else {
        loadEvents(); // Reload to show current state
      }
    } catch (error) {
      console.error('Error during batch creation:', error);
      showError('Unexpected error during creation');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    // Always show year to avoid confusion with far-future dates
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getTimingColor = (status: string): string => {
    switch (status) {
      case 'past':
        return 'bg-red-50 border-red-200';
      case 'urgent':
        return 'bg-yellow-50 border-yellow-200';
      case 'good':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTimingBadge = (status: string, daysUntilStart: number): React.ReactElement => {
    if (status === 'past') {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">Overdue</span>;
    } else if (status === 'urgent') {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">Start Soon</span>;
    } else {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">{daysUntilStart} days</span>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from Garden Plan" size="large">
      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Select planting events to create indoor seed starts for:
            </p>
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              disabled={loading || events.length === 0}
            >
              {selectedEvents.size === events.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Date Range Filter */}
          {!loading && allEvents.length > 0 && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllYears}
                  onChange={(e) => {
                    setShowAllYears(e.target.checked);
                    setSelectedEvents(new Set()); // Clear selection when filter changes
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">Show all future events</span>
              </label>

              {!showAllYears && allEvents.length > events.length ? (
                <div className="text-xs text-gray-600">
                  Showing {events.length} in next 6 months (hiding {allEvents.length - events.length} far-future)
                </div>
              ) : (
                <div className="text-xs text-gray-600">
                  {allEvents.length} total events
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading planting events...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && events.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-gray-600">No planting events need indoor starts.</p>
            <p className="text-sm text-gray-500 mt-2">
              Add transplant dates to your planting calendar to see them here.
            </p>
          </div>
        )}

        {/* Events List */}
        {!loading && events.length > 0 && (
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedEvents.size === events.length && events.length > 0}
                      onChange={selectAll}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plant
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variety
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bed
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transplant Date
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timing
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr
                    key={event.plantingEventId}
                    className={`hover:bg-gray-50 cursor-pointer ${getTimingColor(event.timingStatus)}`}
                    onClick={() => toggleSelection(event.plantingEventId)}
                  >
                    <td className="px-3 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(event.plantingEventId)}
                        onChange={() => toggleSelection(event.plantingEventId)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">{event.plantIcon}</span>
                        <span className="font-medium text-gray-900">{event.plantName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600">
                      {event.variety || '-'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600">
                      {event.gardenBedName || '-'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(event.transplantDate)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(event.suggestedIndoorStartDate)}
                      <div className="text-xs text-gray-500">{event.weeksIndoors} weeks before</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="number"
                        value={quantities[event.plantingEventId] || 3}
                        onChange={(e) => {
                          const newQuantities = { ...quantities };
                          newQuantities[event.plantingEventId] = parseInt(e.target.value) || 1;
                          setQuantities(newQuantities);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        min="1"
                        max="100"
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        ~{Math.ceil((quantities[event.plantingEventId] || 3) / 0.85 * 1.15)} seeds
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      {getTimingBadge(event.timingStatus, event.daysUntilStart)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {events.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>{selectedEvents.size}</strong> of <strong>{events.length}</strong> events selected
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateSelected}
            disabled={selectedEvents.size === 0 || creating}
            className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              selectedEvents.size === 0 || creating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {creating ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Creating...
              </>
            ) : (
              `Create ${selectedEvents.size} Indoor Start${selectedEvents.size !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
