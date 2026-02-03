import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { GardenBed } from '../../types';
import { API_BASE_URL } from '../../config';

interface AddGardenEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded: () => void;
  gardenBeds: GardenBed[];
}

type EventType = 'mulch' | 'fertilizing';

interface MulchEventData {
  eventType: 'mulch';
  gardenBedId: number;
  applicationDate: string;
  mulchType: string;
  depthInches?: number;
  notes?: string;
}

const MULCH_TYPE_OPTIONS = [
  { value: 'none', label: 'Remove Mulch', description: 'Remove existing mulch from bed' },
  { value: 'straw', label: 'Straw/Hay', description: 'Best for summer cooling' },
  { value: 'wood-chips', label: 'Wood Chips', description: 'Long-lasting, good for paths' },
  { value: 'leaves', label: 'Leaves', description: 'Free, good for winter protection' },
  { value: 'grass', label: 'Grass Clippings', description: 'Quick decomposition, adds nitrogen' },
  { value: 'compost', label: 'Compost', description: 'Adds nutrients while mulching' },
  { value: 'black-plastic', label: 'Black Plastic', description: 'Warms soil, season extension' },
  { value: 'clear-plastic', label: 'Clear Plastic', description: 'Maximum soil warming' },
];

const AddGardenEventModal: React.FC<AddGardenEventModalProps> = ({
  isOpen,
  onClose,
  onEventAdded,
  gardenBeds
}) => {
  const [eventType, setEventType] = useState<EventType>('mulch');
  const [gardenBedId, setGardenBedId] = useState<number | ''>('');
  const [applicationDate, setApplicationDate] = useState<string>('');
  const [mulchType, setMulchType] = useState<string>('straw');
  const [depthInches, setDepthInches] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!gardenBedId) {
      setError('Please select a garden bed');
      return;
    }

    if (!applicationDate) {
      setError('Please select an application date');
      return;
    }

    setIsSubmitting(true);

    try {
      if (eventType === 'mulch') {
        const eventData: MulchEventData = {
          eventType: 'mulch',
          gardenBedId: gardenBedId as number,
          applicationDate: new Date(applicationDate).toISOString(),
          mulchType,
          depthInches: depthInches ? parseFloat(depthInches) : undefined,
          notes: notes || undefined
        };

        const response = await fetch(`${API_BASE_URL}/api/planting-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(eventData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create garden event');
        }

        onEventAdded();
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setGardenBedId('');
    setApplicationDate('');
    setMulchType('straw');
    setDepthInches('');
    setNotes('');
    setError(null);
    onClose();
  };

  const selectedMulchOption = MULCH_TYPE_OPTIONS.find(opt => opt.value === mulchType);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Garden Event">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Event Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="mulch"
                checked={eventType === 'mulch'}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="mr-2"
              />
              <span>🛡️ Mulch Application</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="fertilizing"
                checked={eventType === 'fertilizing'}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="mr-2"
                disabled
              />
              <span className="text-gray-400">💧 Fertilizing (Coming Soon)</span>
            </label>
          </div>
        </div>

        {/* Garden Bed Selection */}
        <div>
          <label htmlFor="gardenBed" className="block text-sm font-medium text-gray-700 mb-1">
            Garden Bed *
          </label>
          <select
            id="gardenBed"
            value={gardenBedId}
            onChange={(e) => setGardenBedId(e.target.value ? Number(e.target.value) : '')}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          >
            <option value="">Select a bed...</option>
            {gardenBeds.map(bed => (
              <option key={bed.id} value={bed.id}>
                {bed.name} ({bed.length}' x {bed.width}')
              </option>
            ))}
          </select>
        </div>

        {/* Application Date */}
        <div>
          <label htmlFor="applicationDate" className="block text-sm font-medium text-gray-700 mb-1">
            Application Date *
          </label>
          <input
            type="date"
            id="applicationDate"
            value={applicationDate}
            onChange={(e) => setApplicationDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        {/* Mulch-Specific Fields */}
        {eventType === 'mulch' && (
          <>
            <div>
              <label htmlFor="mulchType" className="block text-sm font-medium text-gray-700 mb-1">
                Mulch Type *
              </label>
              <select
                id="mulchType"
                value={mulchType}
                onChange={(e) => setMulchType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {MULCH_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedMulchOption && (
                <p className="mt-1 text-sm text-gray-500">
                  {selectedMulchOption.description}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="depthInches" className="block text-sm font-medium text-gray-700 mb-1">
                Depth (inches) <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <input
                type="number"
                id="depthInches"
                value={depthInches}
                onChange={(e) => setDepthInches(e.target.value)}
                min="0"
                max="12"
                step="0.5"
                placeholder="e.g., 3"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Typical: 2-4 inches for most mulches
              </p>
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any additional notes..."
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            {isSubmitting ? 'Adding...' : 'Add Event'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddGardenEventModal;
