import React, { useState, useEffect } from 'react';
import { useToast } from '../common/Toast';
import { API_BASE_URL } from '../../config';

interface Seed {
  id: number;
  plantId: string;
  variety: string;
  brand?: string;
  daysToMaturity?: number;
  flavorProfile?: string;
  storageRating?: string;
}

interface AddFromCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogSeed: Seed | null;
  onSuccess: () => void;
}

export const AddFromCatalogModal: React.FC<AddFromCatalogModalProps> = ({
  isOpen,
  onClose,
  catalogSeed,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    quantity: 1,
    purchaseDate: '',
    location: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens with new seed
  useEffect(() => {
    if (isOpen && catalogSeed) {
      setFormData({
        quantity: 1,
        purchaseDate: '',
        location: '',
        notes: '',
      });
    }
  }, [isOpen, catalogSeed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!catalogSeed) {
      showError('No seed selected');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        catalogSeedId: catalogSeed.id,
        quantity: formData.quantity,
        purchaseDate: formData.purchaseDate || undefined,
        location: formData.location || undefined,
        notes: formData.notes || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/my-seeds/from-catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showSuccess(`Added ${catalogSeed.variety} to your inventory!`);
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to add seed to inventory');
      }
    } catch (error) {
      console.error('Error adding seed from catalog:', error);
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !catalogSeed) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Add to My Inventory</h2>

          {/* Seed Info Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <h3 className="font-bold text-gray-800">{catalogSeed.variety}</h3>
            {catalogSeed.brand && <p className="text-sm text-gray-600">{catalogSeed.brand}</p>}
            {catalogSeed.daysToMaturity && (
              <p className="text-xs text-gray-500 mt-1">
                {catalogSeed.daysToMaturity} days to maturity
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Quantity */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity (packets) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Purchase Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Date (optional)
              </label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Storage Location */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Storage Location (optional)
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Basement shelf, Garage"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Bought from local nursery, organic"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add to Inventory'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
