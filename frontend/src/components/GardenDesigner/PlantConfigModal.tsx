import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Plant } from '../../types';
import { API_BASE_URL } from '../../config';

interface PlantConfigModalProps {
  isOpen: boolean;
  plant: Plant | null;
  position: { x: number; y: number } | null;
  planningMethod?: string;  // Planning method from garden bed (e.g., 'square-foot', 'row', 'intensive')
  onSave: (config: PlantConfig) => void;
  onCancel: () => void;
}

export interface PlantConfig {
  variety?: string;
  quantity: number;
  notes: string;
}

const PlantConfigModal: React.FC<PlantConfigModalProps> = ({
  isOpen,
  plant,
  position,
  planningMethod = 'square-foot',
  onSave,
  onCancel
}) => {
  const [variety, setVariety] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [varieties, setVarieties] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch varieties when plant changes
  useEffect(() => {
    if (!plant || !isOpen) {
      return;
    }

    const fetchVarieties = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/seeds/varieties/${encodeURIComponent(plant.id)}`
        );

        if (!response.ok) {
          // If no varieties found, that's okay - user can leave blank
          if (response.status === 404) {
            setVarieties([]);
            return;
          }
          throw new Error(`Failed to fetch varieties: ${response.statusText}`);
        }

        const data = await response.json();
        setVarieties(data || []);
      } catch (err) {
        console.error('Error fetching varieties:', err);
        setError('Could not load varieties. You can still specify a variety manually.');
        setVarieties([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVarieties();
  }, [plant, isOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && plant) {
      // Calculate default quantity based on planning method
      let defaultQuantity = 1;

      if (planningMethod === 'square-foot' && plant.spacing) {
        // Square foot gardening: plants per square foot
        const spacing = plant.spacing;
        if (spacing <= 12) {
          // Small plants: multiple per square - (12 / spacing)²
          defaultQuantity = Math.floor(Math.pow(12 / spacing, 2));
        } else {
          // Large plants: store as negative to indicate squares needed
          defaultQuantity = -Math.floor(Math.pow(spacing / 12, 2));
        }
      } else if (planningMethod === 'migardener' && plant.rowSpacing && plant.spacing) {
        // MIgardener high-intensity: (12 / rowSpacing) × (12 / plantSpacing)
        const rowsPerFoot = 12 / plant.rowSpacing;
        const plantsPerFoot = 12 / plant.spacing;
        defaultQuantity = Math.floor(rowsPerFoot * plantsPerFoot);
      }
      // For other methods (row, intensive, etc.), default to 1

      setQuantity(defaultQuantity);
      setVariety('');
      setNotes('');
    }
  }, [isOpen, plant, planningMethod]);

  const handleSave = () => {
    const config: PlantConfig = {
      variety: variety.trim() || undefined,
      quantity,
      notes: notes.trim()
    };

    onSave(config);
  };

  const handleCancel = () => {
    setVariety('');
    setQuantity(1);
    setNotes('');
    setError('');
    onCancel();
  };

  if (!plant || !position) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={`Configure ${plant.name}`}
    >
      <div className="space-y-4">
        {/* Plant Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{plant.icon || '🌱'}</span>
            <div>
              <p className="font-semibold text-gray-900">{plant.name}</p>
              <p className="text-sm text-gray-600">
                Position: ({position.x}, {position.y})
              </p>
            </div>
          </div>
        </div>

        {/* Variety Selection */}
        <div>
          <label htmlFor="variety" className="block text-sm font-medium text-gray-700 mb-1">
            Variety (optional)
          </label>

          {loading ? (
            <div className="flex items-center justify-center py-2 text-gray-500">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading varieties...
            </div>
          ) : varieties.length > 0 ? (
            <select
              id="variety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">-- No variety (generic {plant.name}) --</option>
              {varieties.map((v, index) => (
                <option key={index} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              id="variety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              placeholder={`e.g., Buttercrunch, Romaine, Red Leaf`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          )}

          {error && (
            <p className="mt-1 text-sm text-amber-600">{error}</p>
          )}

          {varieties.length === 0 && !loading && !error && (
            <p className="mt-1 text-sm text-gray-500">
              No varieties in seed inventory. You can type a variety name manually.
            </p>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            min="1"
            max="100"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Number of {plant.name} plants to place at this position
          </p>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this planting..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Place Plant
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PlantConfigModal;
