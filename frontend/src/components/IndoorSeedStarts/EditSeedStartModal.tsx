import React, { useState } from 'react';
import { apiPut } from '../../utils/api';
import { Modal } from '../common/Modal';

export interface IndoorSeedStart {
  id: number;
  plantId: string;
  variety?: string;
  seedInventoryId?: number;
  startDate: string;
  expectedGerminationDate?: string;
  expectedTransplantDate?: string;
  actualGerminationDate?: string;
  actualTransplantDate?: string;
  seedsStarted: number;
  seedsGerminated?: number;
  expectedGerminationRate?: number;
  actualGerminationRate?: number;
  containerType?: string;
  cellSize?: string;
  lightHours?: number;
  temperature?: number;
  humidity?: number;
  location?: string;
  notes?: string;
  status: 'started' | 'germinating' | 'growing' | 'hardening' | 'transplanted' | 'failed' | 'seeded';
  plantingEventId?: number;
  gardenPlanCount?: number;
  gardenPlanExpectedSeeds?: number;
  gardenPlanInSync?: boolean;
  gardenPlanWarning?: string;
  destinationBeds?: string[];
}

interface Plant {
  id: string;
  name: string;
  icon?: string;
  daysToMaturity?: number;
  germinationDays?: number;
  weeksIndoors?: number;
}

interface EditSeedStartModalProps {
  isOpen: boolean;
  seedStart: IndoorSeedStart;
  onClose: () => void;
  onSuccess: () => void;
  plants: Plant[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

export const EditSeedStartModal: React.FC<EditSeedStartModalProps> = ({
  isOpen,
  seedStart,
  onClose,
  onSuccess,
  plants,
  showSuccess,
  showError,
}) => {
  const [formData, setFormData] = useState({
    status: seedStart.status,
    startDate: seedStart.startDate?.split('T')[0] || '',
    seedsStarted: seedStart.seedsStarted || 0,
    seedsGerminated: seedStart.seedsGerminated || 0,
    actualGerminationDate: seedStart.actualGerminationDate?.split('T')[0] || '',
    lightHours: seedStart.lightHours || 14,
    temperature: seedStart.temperature || 70,
    humidity: seedStart.humidity || 60,
    notes: seedStart.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        status: formData.status,
        startDate: formData.startDate || undefined,
        seedsStarted: formData.seedsStarted,
        seedsGerminated: formData.seedsGerminated,
        actualGerminationDate: formData.actualGerminationDate || undefined,
        lightHours: formData.lightHours,
        temperature: formData.temperature,
        humidity: formData.humidity,
        notes: formData.notes || undefined,
      };

      const response = await apiPut(`/api/indoor-seed-starts/${seedStart.id}`, payload);

      if (response.ok) {
        showSuccess('Seed start updated successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to update seed start');
      }
    } catch (error) {
      console.error('Error updating seed start:', error);
      showError('Network error');
    }
  };

  const plant = plants.find(p => p.id === seedStart.plantId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update: ${plant?.name || seedStart.plantId}${seedStart.variety ? ` (${seedStart.variety})` : ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="planned">Planned (not yet seeded)</option>
            <option value="seeded">Seeded</option>
            <option value="started">Started (not germinated yet)</option>
            <option value="germinating">Germinating</option>
            <option value="growing">Growing</option>
            <option value="hardening">Hardening Off</option>
            <option value="transplanted">Transplanted</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Germination Info */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seeds Planted
            </label>
            <input
              type="number"
              value={formData.seedsStarted}
              onChange={(e) => setFormData({ ...formData, seedsStarted: parseInt(e.target.value) || 0 })}
              min="0"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Germinated Count
            </label>
            <input
              type="number"
              value={formData.seedsGerminated}
              onChange={(e) => setFormData({ ...formData, seedsGerminated: parseInt(e.target.value) || 0 })}
              min="0"
              max={formData.seedsStarted}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">Out of {formData.seedsStarted} seeds</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Germination Date
            </label>
            <input
              type="date"
              value={formData.actualGerminationDate}
              onChange={(e) => setFormData({ ...formData, actualGerminationDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Growing Conditions */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Light (hrs/day)
            </label>
            <input
              type="number"
              value={formData.lightHours}
              onChange={(e) => setFormData({ ...formData, lightHours: parseInt(e.target.value) })}
              min="0"
              max="24"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temp (F)
            </label>
            <input
              type="number"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseInt(e.target.value) })}
              min="40"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Humidity (%)
            </label>
            <input
              type="number"
              value={formData.humidity}
              onChange={(e) => setFormData({ ...formData, humidity: parseInt(e.target.value) })}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Expected dates will recalculate if changed.</p>
        </div>

        {/* Expected Dates Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          {seedStart.expectedGerminationDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Expected Germination:</span>
              <span className="font-medium">{new Date(seedStart.expectedGerminationDate).toLocaleDateString()}</span>
            </div>
          )}
          {seedStart.expectedTransplantDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Expected Transplant:</span>
              <span className="font-medium">{new Date(seedStart.expectedTransplantDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Update
          </button>
        </div>
      </form>
    </Modal>
  );
};
