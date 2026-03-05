import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import PlantIcon from '../../common/PlantIcon';
import { apiGet } from '../../../utils/api';
import { EditSeedStartModal, IndoorSeedStart } from '../../IndoorSeedStarts/EditSeedStartModal';

interface EventDetailModalProps {
  isOpen: boolean;
  event: PlantingCalendar | null;
  onClose: () => void;
  gardenBeds?: Array<{ id: number; name: string }>;
  onEventUpdated?: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ isOpen, event, onClose, gardenBeds, onEventUpdated }) => {
  const [seedStart, setSeedStart] = useState<IndoorSeedStart | null>(null);
  const [loadingSeedStart, setLoadingSeedStart] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const isIndoorStart = !!event?.seedStartDate;

  // Fetch linked indoor seed start when event is an indoor start type
  const fetchSeedStart = useCallback(async () => {
    if (!event || !isIndoorStart) {
      setSeedStart(null);
      return;
    }
    setLoadingSeedStart(true);
    try {
      const response = await apiGet(`/api/indoor-seed-starts/by-planting-event/${event.id}`);
      if (response.ok) {
        const data = await response.json();
        setSeedStart(data);
      } else {
        setSeedStart(null);
      }
    } catch {
      setSeedStart(null);
    } finally {
      setLoadingSeedStart(false);
    }
  }, [event, isIndoorStart]);

  useEffect(() => {
    if (isOpen && event) {
      fetchSeedStart();
    } else {
      setSeedStart(null);
      setShowEditModal(false);
    }
  }, [isOpen, event, fetchSeedStart]);

  if (!isOpen || !event) return null;

  const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
  const bedName = gardenBeds?.find(b => b.id === event.gardenBedId)?.name;

  const isDirectSeed = !!event.directSeedDate && !event.seedStartDate;
  const eventLabel = isIndoorStart ? 'Start Indoors & Transplant' : isDirectSeed ? 'Direct Seed' : 'Planting';

  const formatDate = (date?: Date) => {
    if (!date) return null;
    return format(date, 'MMM d, yyyy');
  };

  // Plants list for the edit modal
  const plants = PLANT_DATABASE.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    daysToMaturity: p.daysToMaturity,
  }));

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Event Details</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Plant info */}
            {plant && (
              <div className="flex items-center gap-3 pb-3 border-b">
                <PlantIcon plantId={plant.id} plantIcon={plant.icon || ''} size={40} />
                <div>
                  <div className="font-semibold text-gray-800">{plant.name}</div>
                  {event.variety && <div className="text-sm text-gray-500">{event.variety}</div>}
                </div>
                <div className="ml-auto">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isIndoorStart ? 'bg-green-100 text-green-700' :
                    isDirectSeed ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {eventLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="space-y-2">
              {event.seedStartDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Seed Start (Indoor):</span>
                  <span className="font-medium">{formatDate(event.seedStartDate)}</span>
                </div>
              )}
              {event.transplantDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Transplant (Outdoor):</span>
                  <span className="font-medium">{formatDate(event.transplantDate)}</span>
                </div>
              )}
              {event.directSeedDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Direct Seed:</span>
                  <span className="font-medium">{formatDate(event.directSeedDate)}</span>
                </div>
              )}
              {event.expectedHarvestDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Harvest:</span>
                  <span className="font-medium">{formatDate(event.expectedHarvestDate)}</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2 pt-2 border-t">
              {event.quantity != null && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{event.quantity} plants</span>
                </div>
              )}
              {bedName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Garden Bed:</span>
                  <span className="font-medium text-green-700">{bedName}</span>
                </div>
              )}
              {event.successionPlanting && event.successionInterval && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Succession:</span>
                  <span className="font-medium">Every {event.successionInterval} days</span>
                </div>
              )}
              {event.completed && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">Completed</span>
                </div>
              )}

              {/* Indoor seed start status */}
              {seedStart && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Seed Start Status:</span>
                  <span className="font-medium capitalize">{seedStart.status}</span>
                </div>
              )}
              {seedStart && seedStart.seedsGerminated != null && seedStart.seedsGerminated > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Germinated:</span>
                  <span className="font-medium">{seedStart.seedsGerminated} of {seedStart.seedsStarted}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {event.notes && (
              <div className="pt-2 border-t">
                <div className="text-gray-600 text-sm mb-1">Notes:</div>
                <div className="text-gray-800 text-sm bg-gray-50 p-2 rounded">{event.notes}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex gap-2">
            {isIndoorStart && seedStart && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Manage Seed Start
              </button>
            )}
            {isIndoorStart && loadingSeedStart && (
              <button disabled className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg">
                Loading...
              </button>
            )}
            <button
              onClick={onClose}
              className={`${isIndoorStart && seedStart ? '' : 'flex-1'} px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors`}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Edit Seed Start Modal */}
      {seedStart && (
        <EditSeedStartModal
          isOpen={showEditModal}
          seedStart={seedStart}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchSeedStart(); // refresh seed start data
            if (onEventUpdated) onEventUpdated();
          }}
          plants={plants}
          showSuccess={() => {}} // Toast handled by parent if needed
          showError={(msg) => console.error(msg)}
        />
      )}
    </>
  );
};

export default EventDetailModal;
