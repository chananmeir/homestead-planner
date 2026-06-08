import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PlantedItem, Plant } from '../../types';
import { apiPost } from '../../utils/api';
import { useToday } from '../../contexts/SimulationContext';

interface HarvestFromBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantedItem: PlantedItem;
  plant: Plant | undefined;
  onSuccess: () => void;
}

// "How did it go?" — the maturity signal that teaches the planner. Normal harvests are
// on_time; the other options correct the learned days-to-maturity (or, for a crop
// failure, record the reason without moving DTM). See backend MATURITY_MULTIPLIERS.
const OUTCOME_OPTIONS = [
  { value: 'on_time', label: 'Just right', maturityFeedback: 'on_time', outcomeReason: null as string | null },
  { value: 'too_early', label: 'Not mature enough — needed longer', maturityFeedback: 'too_early', outcomeReason: 'immature' },
  { value: 'too_late', label: 'Past prime / bolted', maturityFeedback: 'too_late', outcomeReason: 'bolted' },
  { value: 'failure', label: 'Crop failure (pest / disease / weather)', maturityFeedback: null, outcomeReason: 'failure' },
];

const FAILURE_REASONS = [
  { value: 'pest', label: 'Pest' },
  { value: 'disease', label: 'Disease' },
  { value: 'weather', label: 'Weather' },
  { value: 'other', label: 'Other' },
];

const UNIT_OPTIONS = [
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'count', label: 'Count' },
  { value: 'bunches', label: 'Bunches' },
];

const HarvestFromBedModal: React.FC<HarvestFromBedModalProps> = ({
  isOpen,
  onClose,
  plantedItem,
  plant,
  onSuccess,
}) => {
  const today = useToday();
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('lbs');
  const [harvestDate, setHarvestDate] = useState(today);
  const [outcome, setOutcome] = useState('on_time');
  const [failureReason, setFailureReason] = useState('pest');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The "what happened?" detail is surfaced when the harvest underperformed (none) or the
  // user flagged a non-on-time outcome — matching the user's "low to none → ask why" flow.
  const showOutcomeDetail = outcome !== 'on_time' || quantity <= 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const opt = OUTCOME_OPTIONS.find(o => o.value === outcome) || OUTCOME_OPTIONS[0];
      const outcomeReason = outcome === 'failure' ? failureReason : opt.outcomeReason;
      const response = await apiPost('/api/harvests', {
        plantId: plantedItem.plantId,
        plantedItemId: plantedItem.id,
        harvestDate,
        quantity,
        unit,
        maturityFeedback: opt.maturityFeedback,
        outcomeReason,
        notes: notes || undefined,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to log harvest');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log harvest');
    } finally {
      setSubmitting(false);
    }
  };

  const learnedDtm = plantedItem.learnedDtm;
  const sampleCount = plantedItem.learnedSampleCount;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Harvest from Bed" size="small">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800">
            Harvesting {plant?.name || plantedItem.plantId}
            {plantedItem.variety ? ` (${plantedItem.variety})` : ''}
          </p>
          {learnedDtm != null && sampleCount != null && sampleCount > 0 && (
            <p data-testid="learned-dtm-note" className="text-xs text-green-600 mt-1">
              Learned: {learnedDtm} days from {sampleCount} harvest{sampleCount === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              data-testid="harvest-quantity"
              type="number"
              min={0}
              step={0.1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Harvest Date</label>
          <input
            type="date"
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">How did it go?</label>
          <select
            data-testid="harvest-maturity"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            This teaches next season's harvest prediction for this crop in beds like this one.
          </p>
        </div>

        {showOutcomeDetail && outcome === 'failure' && (
          <div data-testid="harvest-failure-reason">
            <label className="block text-sm font-medium text-gray-700 mb-1">What happened?</label>
            <select
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {FAILURE_REASONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Optional notes about this harvest..."
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            data-testid="harvest-from-bed-submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Log Harvest'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default HarvestFromBedModal;
