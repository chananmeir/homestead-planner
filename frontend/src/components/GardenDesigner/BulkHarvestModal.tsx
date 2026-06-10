import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PlantedItem } from '../../types';
import { apiPost } from '../../utils/api';
import { useToday } from '../../contexts/SimulationContext';

interface BulkHarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Plant id used for the HarvestRecord rows (first eligible item's plantId) */
  plantId: string;
  /** Display name used in the modal header (e.g., the plant's friendly name) */
  plantName: string;
  /** Variety shared across the eligible items (or undefined if none) */
  variety?: string;
  /** Items eligible for this bulk harvest. Must all belong to the current user. */
  eligibleItems: PlantedItem[];
  onSuccess: () => void;
}

type Unit = 'lbs' | 'oz' | 'count' | 'bunches';
type Quality = 'excellent' | 'good' | 'fair' | 'poor';

const BulkHarvestModal: React.FC<BulkHarvestModalProps> = ({
  isOpen,
  onClose,
  plantId,
  plantName,
  variety,
  eligibleItems,
  onSuccess,
}) => {
  const today = useToday();
  const [harvestDate, setHarvestDate] = useState(today);
  const [totalQuantity, setTotalQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<Unit>('lbs');
  const [quality, setQuality] = useState<Quality>('good');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemCount = eligibleItems.length;

  const handleSubmit = async () => {
    setError(null);
    if (!harvestDate) {
      setError('Harvest date is required');
      return;
    }
    if (!(totalQuantity > 0)) {
      setError('Total quantity must be greater than 0');
      return;
    }
    if (itemCount === 0) {
      setError('No eligible items to harvest');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiPost('/api/harvests/bulk', {
        plantedItemIds: eligibleItems.map(i => i.id),
        plantId,
        harvestDate,
        totalQuantity,
        unit,
        quality,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Harvest" size="small">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800">
            Harvesting {plantName}{variety ? ` (${variety})` : ''}
          </p>
          <p className="text-xs text-green-600 mt-1">
            {itemCount} {itemCount === 1 ? 'cell' : 'cells'} ready
          </p>
        </div>

        <div>
          <label htmlFor="bulk-harvest-date" className="block text-sm font-medium text-gray-700 mb-1">Harvest Date</label>
          <input
            id="bulk-harvest-date"
            type="date"
            value={harvestDate}
            onChange={(e) => setHarvestDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bulk-harvest-quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Total Quantity
            </label>
            <input
              id="bulk-harvest-quantity"
              type="number"
              min={0.1}
              step={0.1}
              value={totalQuantity}
              onChange={(e) => setTotalQuantity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="bulk-harvest-unit" className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              id="bulk-harvest-unit"
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
          <label htmlFor="bulk-harvest-quality" className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
          <select
            id="bulk-harvest-quality"
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

        <div>
          <label htmlFor="bulk-harvest-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
            <span className="text-gray-400 font-normal ml-1">optional</span>
          </label>
          <textarea
            id="bulk-harvest-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="e.g. End of season pull, light pest damage on a few"
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
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            data-testid="bulk-harvest-submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : `Log Harvest (${itemCount})`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkHarvestModal;
