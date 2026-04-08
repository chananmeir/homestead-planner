import React, { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../../utils/api';
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
  actualGerminationDays?: number;
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
  status: 'germinating' | 'growing' | 'hardening' | 'transplanted' | 'failed' | 'seeded';
  plantingEventId?: number;
  gardenPlanCount?: number;
  gardenPlanExpectedSeeds?: number;
  gardenPlanInSync?: boolean;
  gardenPlanWarning?: string;
  destinationBeds?: string[];
  destinationBedDetails?: { id: number; name: string }[];
  hasManualDestination?: boolean;
  destinationBedIds?: number[] | null;
}

interface Plant {
  id: string;
  name: string;
  icon?: string;
  daysToMaturity?: number;
  germinationDays?: number;
  weeksIndoors?: number;
}

interface SeedInventoryItem {
  id: number;
  plantId: string;
  variety: string;
  quantity?: number;
  brand?: string;
}

interface EditSeedStartModalProps {
  isOpen: boolean;
  seedStart: IndoorSeedStart;
  onClose: () => void;
  onSuccess: () => void;
  plants: Plant[];
  seedInventory?: SeedInventoryItem[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  onRequestFailedCascade?: (seedStart: IndoorSeedStart) => void;
}

export const EditSeedStartModal: React.FC<EditSeedStartModalProps> = ({
  isOpen,
  seedStart,
  onClose,
  onSuccess,
  plants,
  seedInventory: seedInventoryProp,
  showSuccess,
  showError,
  onRequestFailedCascade,
}) => {
  const [formData, setFormData] = useState({
    status: seedStart.status,
    seedInventoryId: seedStart.seedInventoryId?.toString() || '',
    variety: seedStart.variety || '',
    startDate: seedStart.startDate?.split('T')[0] || '',
    seedsStarted: seedStart.seedsStarted || 0,
    seedsGerminated: seedStart.seedsGerminated || 0,
    actualGerminationDate: seedStart.actualGerminationDate?.split('T')[0] || '',
    lightHours: seedStart.lightHours || 14,
    temperature: seedStart.temperature || 70,
    humidity: seedStart.humidity || 60,
    notes: seedStart.notes || '',
    destinationBedIds: seedStart.destinationBedIds || (seedStart.destinationBedDetails?.map(b => b.id) ?? []),
  });

  // Fetch all garden beds for the destination picker
  const [allBeds, setAllBeds] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (isOpen) {
      apiGet('/api/garden-beds').then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setAllBeds(data.map((b: any) => ({ id: b.id, name: b.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  // If seedInventory not passed as prop, fetch it
  const [fetchedInventory, setFetchedInventory] = useState<SeedInventoryItem[]>([]);
  useEffect(() => {
    if (!seedInventoryProp && isOpen) {
      apiGet('/api/seeds').then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setFetchedInventory(data);
        }
      }).catch(() => {});
    }
  }, [seedInventoryProp, isOpen]);

  const seedInventory = seedInventoryProp || fetchedInventory;

  // Filter to seeds matching this plant
  const matchingSeeds = seedInventory.filter(s => s.plantId === seedStart.plantId);

  const handleSeedSelection = (value: string) => {
    if (value === '__custom__') {
      setFormData({ ...formData, seedInventoryId: '', variety: '' });
    } else if (value === '') {
      setFormData({ ...formData, seedInventoryId: '', variety: '' });
    } else {
      const seed = matchingSeeds.find(s => s.id === parseInt(value));
      if (seed) {
        setFormData({ ...formData, seedInventoryId: value, variety: seed.variety });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Intercept: if changing to 'failed' and there's a linked planting event, open cascade dialog
    if (
      formData.status === 'failed' &&
      seedStart.status !== 'failed' &&
      seedStart.plantingEventId != null &&
      onRequestFailedCascade
    ) {
      onRequestFailedCascade(seedStart);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        status: formData.status,
        variety: formData.variety || undefined,
        startDate: formData.startDate || undefined,
        seedsStarted: formData.seedsStarted,
        seedsGerminated: formData.seedsGerminated,
        actualGerminationDate: formData.actualGerminationDate || undefined,
        lightHours: formData.lightHours,
        temperature: formData.temperature,
        humidity: formData.humidity,
        notes: formData.notes || undefined,
        destinationBedIds: formData.destinationBedIds.length > 0 ? formData.destinationBedIds : null,
      };

      if (formData.seedInventoryId) {
        payload.seedInventoryId = parseInt(formData.seedInventoryId);
      }

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

  // Determine current dropdown value
  const currentDropdownValue = formData.seedInventoryId
    ? formData.seedInventoryId
    : formData.variety
      ? '__custom__'
      : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update: ${plant?.name || seedStart.plantId}${formData.variety ? ` (${formData.variety})` : ''}`}>
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
            <option value="germinating">Germinating</option>
            <option value="growing">Growing</option>
            <option value="hardening">Hardening Off</option>
            <option value="transplanted">Transplanted</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Variety from Seed Inventory */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variety (from My Seeds)
          </label>
          {matchingSeeds.length > 0 ? (
            <>
              <select
                value={currentDropdownValue}
                onChange={(e) => handleSeedSelection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Select a seed --</option>
                {matchingSeeds.map(seed => (
                  <option key={seed.id} value={seed.id.toString()}>
                    {seed.variety}{seed.brand ? ` (${seed.brand})` : ''}
                  </option>
                ))}
                <option value="__custom__">Other (type manually)</option>
              </select>
              {currentDropdownValue === '__custom__' && (
                <input
                  type="text"
                  value={formData.variety}
                  onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                  placeholder="Enter variety name"
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              )}
            </>
          ) : (
            <input
              type="text"
              value={formData.variety}
              onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
              placeholder="No seeds in inventory for this plant"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          )}
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

        {/* Destination Beds */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Destination Beds
          </label>
          {allBeds.length > 0 ? (
            <div className="border border-gray-300 rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
              {allBeds.map(bed => (
                <label key={bed.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 rounded">
                  <input
                    type="checkbox"
                    checked={formData.destinationBedIds.includes(bed.id)}
                    onChange={(e) => {
                      const ids = formData.destinationBedIds;
                      if (e.target.checked) {
                        setFormData({ ...formData, destinationBedIds: [...ids, bed.id] });
                      } else {
                        setFormData({ ...formData, destinationBedIds: ids.filter(id => id !== bed.id) });
                      }
                    }}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm">{bed.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Loading beds...</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Select which beds these seedlings will be transplanted to.
            {seedStart.hasManualDestination && <span className="text-blue-600 ml-1">(manually set)</span>}
          </p>
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
