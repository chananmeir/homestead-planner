import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { PlantedItem, Plant, PlantOutcome, PlantOutcomeReason } from '../../types';
import { apiPost } from '../../utils/api';
import { useToday } from '../../contexts/SimulationContext';
import { coordinateToGridLabel } from './utils/gridCoordinates';
import { createIdempotencyKey } from '../../utils/idempotency';

export interface HarvestPlantRecordResult {
  id?: number;
  plantId?: string;
  plantedItemId?: number | null;
  quality?: string;
  outcome?: PlantOutcome | null;
  outcomeReason?: PlantOutcomeReason | null;
  yieldExcluded?: boolean;
}

export interface HarvestPlantResult extends HarvestPlantRecordResult {
  plantedItem?: PlantedItem;
  harvestRecord?: HarvestPlantRecordResult | null;
}

interface HarvestPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantedItem: PlantedItem;
  plant: Plant | undefined;
  onSuccess: (result?: HarvestPlantResult) => void;
}

type Unit = 'lbs' | 'oz' | 'count' | 'bunches';
type Quality = 'excellent' | 'good' | 'fair' | 'poor';
type ZeroYieldOutcome = Extract<PlantOutcome, 'failed' | 'didnt_establish'>;

const zeroYieldOutcomeLabels: Record<ZeroYieldOutcome, string> = {
  didnt_establish: "Didn't establish",
  failed: 'Failed after growing',
};

const zeroYieldReasonOptions: Record<ZeroYieldOutcome, { value: PlantOutcomeReason; label: string }[]> = {
  didnt_establish: [
    { value: 'poor_germination', label: 'Poor germination' },
    { value: 'damping_off', label: 'Damping off' },
    { value: 'other', label: 'Other' },
  ],
  failed: [
    { value: 'pest', label: 'Pest pressure' },
    { value: 'disease', label: 'Disease' },
    { value: 'weather_frost', label: 'Weather/frost' },
    { value: 'drought_neglect', label: 'Drought or neglect' },
    { value: 'animal_damage', label: 'Animal damage' },
    { value: 'other', label: 'Other' },
  ],
};

const defaultReasonByOutcome: Record<ZeroYieldOutcome, PlantOutcomeReason> = {
  didnt_establish: 'poor_germination',
  failed: 'other',
};

const defaultZeroYieldOutcome = (status: PlantedItem['status']): ZeroYieldOutcome =>
  status === 'planned' ? 'didnt_establish' : 'failed';

const HarvestPlantModal: React.FC<HarvestPlantModalProps> = ({
  isOpen,
  onClose,
  plantedItem,
  plant,
  onSuccess,
}) => {
  const today = useToday();
  const [harvestDate, setHarvestDate] = useState(today);
  const [quantity, setQuantity] = useState<number>(plantedItem.quantity || 1);
  const [unit, setUnit] = useState<Unit>('lbs');
  const [quality, setQuality] = useState<Quality>('good');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [finalHarvest, setFinalHarvest] = useState(false);
  const [zeroYieldMode, setZeroYieldMode] = useState(false);
  const [zeroYieldOutcome, setZeroYieldOutcome] = useState<ZeroYieldOutcome>(
    defaultZeroYieldOutcome(plantedItem.status)
  );
  const [zeroYieldReason, setZeroYieldReason] = useState<PlantOutcomeReason>(
    defaultReasonByOutcome[defaultZeroYieldOutcome(plantedItem.status)]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positionLabel = coordinateToGridLabel(plantedItem.position.x, plantedItem.position.y);
  const plantName = plant?.name || plantedItem.plantId;

  useEffect(() => {
    if (isOpen) {
      const defaultOutcome = defaultZeroYieldOutcome(plantedItem.status);
      setHarvestDate(today);
      setQuantity(plantedItem.quantity || 1);
      setUnit('lbs');
      setQuality('good');
      setNotes('');
      setIdempotencyKey(createIdempotencyKey());
      setFinalHarvest(false);
      setZeroYieldMode(false);
      setZeroYieldOutcome(defaultOutcome);
      setZeroYieldReason(defaultReasonByOutcome[defaultOutcome]);
      setError(null);
    }
  }, [isOpen, plantedItem.id, plantedItem.quantity, plantedItem.status, today]);

  const handleZeroYieldOutcomeChange = (outcome: ZeroYieldOutcome) => {
    setZeroYieldOutcome(outcome);
    setZeroYieldReason(defaultReasonByOutcome[outcome]);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!harvestDate) {
      setError('Harvest date is required');
      return;
    }
    if (!(quantity > 0)) {
      setError('Quantity must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiPost('/api/harvests', {
        plantId: plantedItem.plantId,
        plantedItemId: plantedItem.id,
        harvestDate,
        quantity,
        unit,
        quality,
        notes: notes || undefined,
        idempotencyKey,
        finalHarvest,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errData = result as { error?: string };
        throw new Error(errData.error || 'Failed to log harvest');
      }

      onSuccess(result as HarvestPlantResult);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log harvest');
    } finally {
      setSubmitting(false);
    }
  };

  const handleZeroYieldSubmit = async () => {
    setError(null);
    if (!harvestDate) {
      setError('Outcome date is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiPost(`/api/planted-items/${plantedItem.id}/outcome`, {
        outcome: zeroYieldOutcome,
        outcomeReason: zeroYieldReason,
        outcomeDate: harvestDate,
        ...(notes.trim() ? { outcomeNotes: notes.trim() } : {}),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errData = result as { error?: string };
        throw new Error(errData.error || 'Failed to record plant outcome');
      }

      onSuccess(result as HarvestPlantResult);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record plant outcome');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Harvest" size="small">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800">
            Harvesting {plantName}
            {plantedItem.variety ? ` (${plantedItem.variety})` : ''}
          </p>
          <p className="text-xs text-green-600 mt-1">
            Position {positionLabel}
          </p>
        </div>

        <div>
          <label htmlFor="harvest-date" className="block text-sm font-medium text-gray-700 mb-1">Harvest Date</label>
          <input
            id="harvest-date"
            type="date"
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {zeroYieldMode ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-red-800">Record 0 yield</p>
              <button
                type="button"
                onClick={() => setZeroYieldMode(false)}
                disabled={submitting}
                className="text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Use harvest form
              </button>
            </div>

            <label htmlFor="zero-yield-outcome" className="block text-sm font-medium text-gray-700">
              Outcome
              <select
                id="zero-yield-outcome"
                value={zeroYieldOutcome}
                onChange={(e) => handleZeroYieldOutcomeChange(e.target.value as ZeroYieldOutcome)}
                disabled={submitting}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                {(Object.keys(zeroYieldOutcomeLabels) as ZeroYieldOutcome[]).map(outcome => (
                  <option key={outcome} value={outcome}>
                    {zeroYieldOutcomeLabels[outcome]}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="zero-yield-reason" className="block text-sm font-medium text-gray-700">
              Reason
              <select
                id="zero-yield-reason"
                value={zeroYieldReason}
                onChange={(e) => setZeroYieldReason(e.target.value as PlantOutcomeReason)}
                disabled={submitting}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                {zeroYieldReasonOptions[zeroYieldOutcome].map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="harvest-quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  id="harvest-quantity"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="harvest-unit" className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select
                  id="harvest-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="lbs">Pounds (lbs)</option>
                  <option value="oz">Ounces (oz)</option>
                  <option value="count">Count</option>
                  <option value="bunches">Bunches</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="harvest-quality" className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
              <select
                id="harvest-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <input
                type="checkbox"
                data-testid="harvest-final-checkbox"
                checked={finalHarvest}
                onChange={(e) => setFinalHarvest(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 rounded border-green-300 text-green-700 focus:ring-green-500"
              />
              <span>
                <span className="block font-medium">Final harvest</span>
                <span className="block text-xs text-green-700">
                  Clear this planting from the bed after saving.
                </span>
              </span>
            </label>

            <button
              type="button"
              data-testid="zero-yield-toggle"
              onClick={() => setZeroYieldMode(true)}
              disabled={submitting}
              className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Record 0 yield / didn't make it
            </button>
          </>
        )}

        <div>
          <label htmlFor="harvest-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
            <span className="text-gray-400 font-normal ml-1">optional</span>
          </label>
          <textarea
            id="harvest-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="e.g. First-of-season pick, slight pest damage"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={zeroYieldMode ? () => setZeroYieldMode(false) : onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {zeroYieldMode ? 'Back' : 'Cancel'}
          </button>
          <button
            data-testid="harvest-plant-submit"
            onClick={zeroYieldMode ? handleZeroYieldSubmit : handleSubmit}
            disabled={submitting}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              zeroYieldMode ? 'bg-red-700 hover:bg-red-800' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {submitting ? 'Saving...' : zeroYieldMode ? 'Record 0 Yield' : finalHarvest ? 'Log Final Harvest' : 'Log Harvest'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default HarvestPlantModal;
