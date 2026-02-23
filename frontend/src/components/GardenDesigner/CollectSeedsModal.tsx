import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PlantedItem, Plant } from '../../types';
import { apiPost } from '../../utils/api';

interface CollectSeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantedItem: PlantedItem;
  plant: Plant | undefined;
  onSuccess: (result: { plantedItem: PlantedItem; seedInventory: any }) => void;
}

const CollectSeedsModal: React.FC<CollectSeedsModalProps> = ({
  isOpen,
  onClose,
  plantedItem,
  plant,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [seedsPerPacket, setSeedsPerPacket] = useState(50);
  const [germinationRate, setGerminationRate] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [variety, setVariety] = useState(plantedItem.variety || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiPost(`/api/planted-items/${plantedItem.id}/collect-seeds`, {
        quantity,
        seedsPerPacket,
        germinationRate: germinationRate === '' ? null : germinationRate,
        notes,
        variety: variety || plantedItem.variety || 'Homegrown',
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to collect seeds');
      }

      const result = await response.json();
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to collect seeds');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Seeds" size="small">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-800">
            Collecting seeds from {plant?.name || plantedItem.plantId}
            {plantedItem.variety ? ` (${plantedItem.variety})` : ''}
          </p>
          <p className="text-xs text-amber-600 mt-1">
            This will create a new entry in your Seed Inventory marked as "Homegrown".
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Variety</label>
          <input
            type="text"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="e.g. Brandywine, Cherokee Purple"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Packets</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seeds/Packet</label>
            <input
              type="number"
              min={1}
              value={seedsPerPacket}
              onChange={(e) => setSeedsPerPacket(Math.max(1, parseInt(e.target.value) || 50))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Germination Rate (%)
            <span className="text-gray-400 font-normal ml-1">optional</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={germinationRate}
            onChange={(e) => setGerminationRate(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseFloat(e.target.value))))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="e.g. 85"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="e.g. Saved from healthiest plant, good fruit size"
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
            data-testid="collect-seeds-submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Collect Seeds'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CollectSeedsModal;
