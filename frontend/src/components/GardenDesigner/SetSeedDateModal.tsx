import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PlantedItem, Plant } from '../../types';
import { apiPut } from '../../utils/api';

interface SetSeedDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantedItem: PlantedItem;
  plant: Plant | undefined;
  onSuccess: (updated: PlantedItem) => void;
}

const SetSeedDateModal: React.FC<SetSeedDateModalProps> = ({
  isOpen,
  onClose,
  plantedItem,
  plant,
  onSuccess,
}) => {
  // Compute a smart default date from plant timing data
  const daysToSeed = plant?.daysToSeed;
  const dtm = plant?.daysToMaturity ?? (plant as any)?.daysToMaturity ?? 0;
  const computeDefaultDate = (): string => {
    if (plantedItem.seedMaturityDate) {
      return new Date(plantedItem.seedMaturityDate).toISOString().split('T')[0];
    }
    // Use harvest date if available, else transplant/planted + DTM
    const harvestDate = plantedItem.harvestDate ? new Date(plantedItem.harvestDate) : null;
    const inGroundDate = plantedItem.transplantDate
      ? new Date(plantedItem.transplantDate)
      : plantedItem.plantedDate
        ? new Date(plantedItem.plantedDate)
        : null;
    let baseDate = harvestDate;
    if (!baseDate && inGroundDate && dtm) {
      baseDate = new Date(inGroundDate);
      baseDate.setDate(baseDate.getDate() + dtm);
    }
    if (baseDate && daysToSeed) {
      const result = new Date(baseDate);
      result.setDate(result.getDate() + daysToSeed);
      return result.toISOString().split('T')[0];
    }
    // Fallback: 60 days from now
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 60);
    return fallback.toISOString().split('T')[0];
  };
  const [dateStr, setDateStr] = useState(computeDefaultDate());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!dateStr) {
      setError('Please select a date');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiPut(`/api/planted-items/${plantedItem.id}`, {
        seedMaturityDate: new Date(dateStr).toISOString(),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to set seed maturity date');
      }

      const updated = await response.json();
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Seed Maturity Date" size="small">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-800">
            {plant?.name || plantedItem.plantId}
            {plantedItem.variety ? ` (${plantedItem.variety})` : ''}
          </p>
          <p className="text-xs text-amber-600 mt-1">
            {daysToSeed
              ? `This plant typically needs ~${daysToSeed} extra days past harvest for seeds to mature.`
              : 'No default seed maturity timing available for this plant. Please enter a date manually.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seed Maturity Date
          </label>
          <input
            data-testid="seed-date-input"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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
            data-testid="seed-date-submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Set Date'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SetSeedDateModal;
