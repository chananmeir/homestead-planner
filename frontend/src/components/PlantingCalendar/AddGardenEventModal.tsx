import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { GardenBed } from '../../types';
import { API_BASE_URL } from '../../config';
import { formatLocalDate, parseDateInputValue } from '../../utils/dateUtils';

interface AddGardenEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded: () => void;
  gardenBeds: GardenBed[];
}

type EventType = 'mulch' | 'fertilizing' | 'irrigation';

type GardenEventPayload = {
  eventType: EventType;
  gardenBedId: number;
  applicationDate: string;
  notes?: string;
  mulchType?: string;
  coverage?: string;
  depthInches?: number;
  fertilizerType?: string;
  amount?: number;
  amountUnit?: string;
  applicationMethod?: string;
  npk?: string;
  method?: string;
  durationMinutes?: number;
  amountGallons?: number;
  zone?: string;
};

const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: 'mulch', label: 'Mulch' },
  { value: 'fertilizing', label: 'Fertilizing' },
  { value: 'irrigation', label: 'Irrigation' },
];

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

const FERTILIZER_TYPE_OPTIONS = [
  { value: 'compost', label: 'Compost' },
  { value: 'compost-tea', label: 'Compost Tea' },
  { value: 'fish-emulsion', label: 'Fish Emulsion' },
  { value: 'kelp', label: 'Kelp' },
  { value: 'blood-meal', label: 'Blood Meal' },
  { value: 'bone-meal', label: 'Bone Meal' },
  { value: 'balanced-organic', label: 'Balanced Organic' },
  { value: 'slow-release', label: 'Slow Release' },
  { value: 'synthetic', label: 'Synthetic' },
  { value: 'custom', label: 'Custom' },
];

const FERTILIZER_UNIT_OPTIONS = [
  { value: 'tsp', label: 'tsp' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
  { value: 'cup', label: 'cup' },
  { value: 'gallon', label: 'gallon' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'custom', label: 'custom' },
];

const FERTILIZER_METHOD_OPTIONS = [
  { value: 'top-dress', label: 'Top Dress' },
  { value: 'side-dress', label: 'Side Dress' },
  { value: 'soil-drench', label: 'Soil Drench' },
  { value: 'foliar', label: 'Foliar' },
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'fertigation', label: 'Fertigation' },
];

const IRRIGATION_METHOD_OPTIONS = [
  { value: 'drip', label: 'Drip' },
  { value: 'soaker-hose', label: 'Soaker Hose' },
  { value: 'sprinkler', label: 'Sprinkler' },
  { value: 'hand-water', label: 'Hand Water' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'flood', label: 'Flood' },
  { value: 'other', label: 'Other' },
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
  const [coverage, setCoverage] = useState<string>('full');
  const [depthInches, setDepthInches] = useState<string>('');
  const [fertilizerType, setFertilizerType] = useState<string>('balanced-organic');
  const [fertilizerAmount, setFertilizerAmount] = useState<string>('');
  const [fertilizerUnit, setFertilizerUnit] = useState<string>('cup');
  const [fertilizerMethod, setFertilizerMethod] = useState<string>('top-dress');
  const [npk, setNpk] = useState<string>('');
  const [irrigationMethod, setIrrigationMethod] = useState<string>('drip');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [amountGallons, setAmountGallons] = useState<string>('');
  const [zone, setZone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsePositiveNumber = (value: string, label: string): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(`${label} must be greater than 0`);
      return null;
    }
    return parsed;
  };

  const parseOptionalNonNegativeNumber = (value: string, label: string): number | undefined | null => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(`${label} must be 0 or greater`);
      return null;
    }
    return parsed;
  };

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

    const parsedDate = parseDateInputValue(applicationDate);
    if (Number.isNaN(parsedDate.getTime())) {
      setError('Please select a valid application date');
      return;
    }

    const normalizedDate = formatLocalDate(parsedDate);
    const eventData: GardenEventPayload = {
      eventType,
      gardenBedId: gardenBedId as number,
      applicationDate: normalizedDate,
      notes: notes || undefined
    };

    if (eventType === 'mulch') {
      const parsedDepth = parseOptionalNonNegativeNumber(depthInches, 'Depth');
      if (parsedDepth === null) return;
      eventData.mulchType = mulchType;
      eventData.coverage = coverage;
      eventData.depthInches = parsedDepth;
    }

    if (eventType === 'fertilizing') {
      const parsedAmount = parsePositiveNumber(fertilizerAmount, 'Amount');
      if (parsedAmount === null) return;
      eventData.fertilizerType = fertilizerType;
      eventData.amount = parsedAmount;
      eventData.amountUnit = fertilizerUnit;
      eventData.applicationMethod = fertilizerMethod;
      eventData.npk = npk || undefined;
    }

    if (eventType === 'irrigation') {
      const parsedDuration = parsePositiveNumber(durationMinutes, 'Duration');
      const parsedGallons = parseOptionalNonNegativeNumber(amountGallons, 'Gallons');
      if (parsedDuration === null || parsedGallons === null) return;
      eventData.method = irrigationMethod;
      eventData.durationMinutes = parsedDuration;
      eventData.amountGallons = parsedGallons;
      eventData.zone = zone || undefined;
    }

    setIsSubmitting(true);

    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEventType('mulch');
    setGardenBedId('');
    setApplicationDate('');
    setMulchType('straw');
    setCoverage('full');
    setDepthInches('');
    setFertilizerType('balanced-organic');
    setFertilizerAmount('');
    setFertilizerUnit('cup');
    setFertilizerMethod('top-dress');
    setNpk('');
    setIrrigationMethod('drip');
    setDurationMinutes('');
    setAmountGallons('');
    setZone('');
    setNotes('');
    setError(null);
    onClose();
  };

  const selectedMulchOption = MULCH_TYPE_OPTIONS.find(opt => opt.value === mulchType);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Garden Event">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Type
          </label>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Event Type">
            {EVENT_TYPE_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                  eventType === option.value
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  checked={eventType === option.value}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="coverage" className="block text-sm font-medium text-gray-700 mb-1">
                  Coverage *
                </label>
                <select
                  id="coverage"
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="full">Full</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              <div>
                <label htmlFor="depthInches" className="block text-sm font-medium text-gray-700 mb-1">
                  Depth (inches)
                </label>
                <input
                  type="number"
                  id="depthInches"
                  value={depthInches}
                  onChange={(e) => setDepthInches(e.target.value)}
                  min="0"
                  max="12"
                  step="0.5"
                  placeholder="3"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </>
        )}

        {eventType === 'fertilizing' && (
          <>
            <div>
              <label htmlFor="fertilizerType" className="block text-sm font-medium text-gray-700 mb-1">
                Fertilizer Type *
              </label>
              <select
                id="fertilizerType"
                value={fertilizerType}
                onChange={(e) => setFertilizerType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {FERTILIZER_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="fertilizerAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  id="fertilizerAmount"
                  value={fertilizerAmount}
                  onChange={(e) => setFertilizerAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  placeholder="1"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="fertilizerUnit" className="block text-sm font-medium text-gray-700 mb-1">
                  Unit *
                </label>
                <select
                  id="fertilizerUnit"
                  value={fertilizerUnit}
                  onChange={(e) => setFertilizerUnit(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  {FERTILIZER_UNIT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="npk" className="block text-sm font-medium text-gray-700 mb-1">
                  NPK
                </label>
                <input
                  type="text"
                  id="npk"
                  value={npk}
                  onChange={(e) => setNpk(e.target.value)}
                  placeholder="5-1-1"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="fertilizerMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Application Method *
              </label>
              <select
                id="fertilizerMethod"
                value={fertilizerMethod}
                onChange={(e) => setFertilizerMethod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {FERTILIZER_METHOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {eventType === 'irrigation' && (
          <>
            <div>
              <label htmlFor="irrigationMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Irrigation Method *
              </label>
              <select
                id="irrigationMethod"
                value={irrigationMethod}
                onChange={(e) => setIrrigationMethod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {IRRIGATION_METHOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (min) *
                </label>
                <input
                  type="number"
                  id="durationMinutes"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="30"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="amountGallons" className="block text-sm font-medium text-gray-700 mb-1">
                  Gallons
                </label>
                <input
                  type="number"
                  id="amountGallons"
                  value={amountGallons}
                  onChange={(e) => setAmountGallons(e.target.value)}
                  min="0"
                  step="0.1"
                  placeholder="12"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="zone" className="block text-sm font-medium text-gray-700 mb-1">
                  Zone
                </label>
                <input
                  type="text"
                  id="zone"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="Valve 2"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

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
