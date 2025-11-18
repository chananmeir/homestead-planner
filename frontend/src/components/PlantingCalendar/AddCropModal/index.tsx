import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Plant, PlantingCalendar as PlantingCalendarType, ConflictCheck } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { format, addDays } from 'date-fns';
import { calculatePlantingDates } from '../utils/dateCalculations';
import { API_BASE_URL } from '../../../config';
import PositionSelector from './PositionSelector';
import ConflictWarning from '../../common/ConflictWarning';

interface AddCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (event: PlantingCalendarType) => void;
  onAddEvents?: (events: PlantingCalendarType[]) => void;
  initialDate?: Date;
  initialPlant?: Plant;
  lastFrostDate: Date;
}

const AddCropModal: React.FC<AddCropModalProps> = ({
  isOpen,
  onClose,
  onAddEvent,
  onAddEvents,
  initialDate,
  initialPlant,
  lastFrostDate,
}) => {
  const [selectedPlant, setSelectedPlant] = useState<string>(initialPlant?.id || '');
  const [plantingMethod, setPlantingMethod] = useState<'seed' | 'transplant'>('seed');
  const [variety, setVariety] = useState('');
  const [gardenBedId, setGardenBedId] = useState('');
  const [notes, setNotes] = useState('');
  const [successionPlanting, setSuccessionPlanting] = useState(false);
  const [successionInterval, setSuccessionInterval] = useState(14);
  const [successionCount, setSuccessionCount] = useState(3);

  // Position selector state (Phase 2B)
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictCheck | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictOverride, setConflictOverride] = useState(false);

  // Variety options - fetched from seed inventory based on selected plant
  const [availableVarieties, setAvailableVarieties] = useState<string[]>([]);
  const [loadingVarieties, setLoadingVarieties] = useState(false);

  // Manual date overrides
  const [manualDates, setManualDates] = useState<{
    seedStartDate?: Date;
    transplantDate?: Date;
    directSeedDate?: Date;
    expectedHarvestDate?: Date;
  }>({});

  // Garden beds - fetched from API
  const [gardenBeds, setGardenBeds] = useState<Array<{ id: number; name: string; width?: number; length?: number }>>([]);
  const [loadingBeds, setLoadingBeds] = useState(true);

  // Fetch garden beds from API
  useEffect(() => {
    const fetchGardenBeds = async () => {
      try {
        setLoadingBeds(true);
        const response = await fetch(`${API_BASE_URL}/api/garden-beds`);
        if (response.ok) {
          const data = await response.json();
          setGardenBeds(data);
        }
      } catch (err) {
        console.error('Failed to load garden beds:', err);
        // Continue with empty list
      } finally {
        setLoadingBeds(false);
      }
    };

    fetchGardenBeds();
  }, []);

  // Fetch varieties when plant selection changes
  useEffect(() => {
    const fetchVarieties = async () => {
      if (!selectedPlant) {
        setAvailableVarieties([]);
        return;
      }

      try {
        setLoadingVarieties(true);
        const response = await fetch(`${API_BASE_URL}/api/seeds/varieties/${selectedPlant}`);
        if (response.ok) {
          const varieties = await response.json();
          setAvailableVarieties(varieties);
        } else {
          setAvailableVarieties([]);
        }
      } catch (err) {
        console.error('Failed to load varieties:', err);
        setAvailableVarieties([]);
      } finally {
        setLoadingVarieties(false);
      }
    };

    fetchVarieties();
  }, [selectedPlant]);

  // Clear variety when plant changes
  useEffect(() => {
    setVariety('');
  }, [selectedPlant]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedPlant(initialPlant?.id || '');
      setManualDates({});
      setVariety('');
      setGardenBedId('');
      setNotes('');
      setSuccessionPlanting(false);
      setSuccessionInterval(14);
      setSuccessionCount(3);
      setSelectedPosition(null);
      setConflicts(null);
      setShowConflictWarning(false);
      setConflictOverride(false);
    }
  }, [isOpen, initialPlant]);

  // Handler for position selection
  const handlePositionSelect = (position: { x: number; y: number } | null) => {
    setSelectedPosition(position);
    setConflictOverride(false); // Reset override when position changes
  };

  // Handler for conflict detection
  const handleConflictDetected = (conflictCheck: ConflictCheck) => {
    setConflicts(conflictCheck);
    if (conflictCheck.hasConflict && !conflictOverride) {
      setShowConflictWarning(true);
    }
  };

  // Handler for conflict override
  const handleConflictOverride = () => {
    setConflictOverride(true);
    setShowConflictWarning(false);
  };

  // Handler for conflict cancel
  const handleConflictCancel = () => {
    setShowConflictWarning(false);
    setSelectedPosition(null); // Clear position so user can select a different one
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant) return;

    const plant = PLANT_DATABASE.find((p) => p.id === selectedPlant);
    if (!plant) return;

    // Use initialDate if provided (from calendar click), otherwise use lastFrostDate
    const baseDate = initialDate || lastFrostDate;
    const dates = calculatePlantingDates(plant, baseDate);

    // Create base event
    const baseEvent: PlantingCalendarType = {
      id: String(Date.now()),
      plantId: plant.id,
      variety: variety || undefined,
      gardenBedId: gardenBedId || '',
      seedStartDate: plantingMethod === 'transplant'
        ? (manualDates.seedStartDate || dates.seedStartDate)
        : undefined,
      transplantDate: plantingMethod === 'transplant'
        ? (manualDates.transplantDate || dates.transplantDate)
        : undefined,
      directSeedDate: plantingMethod === 'seed'
        ? (manualDates.directSeedDate || dates.transplantDate)
        : undefined,
      expectedHarvestDate: manualDates.expectedHarvestDate || dates.expectedHarvestDate,
      successionPlanting: successionPlanting,
      successionInterval: successionPlanting ? successionInterval : undefined,
      positionX: selectedPosition?.x,
      positionY: selectedPosition?.y,
      spaceRequired: plant.spacing ? Math.ceil(plant.spacing / 12) : undefined, // Convert inches to grid cells
      conflictOverride: conflictOverride || undefined,
      completed: false,
      notes: notes || undefined,
    };

    // If succession planting, create multiple events
    if (successionPlanting && onAddEvents) {
      // Generate succession group ID for linking related events
      const successionGroupId = crypto.randomUUID();

      const successionEvents = [];
      for (let i = 0; i < successionCount; i++) {
        const offset = i * successionInterval;
        const successionEvent: PlantingCalendarType = {
          ...baseEvent,
          id: crypto.randomUUID(), // Unique ID for each event to avoid collisions
          successionGroupId, // Link all events in this succession series
          seedStartDate: baseEvent.seedStartDate
            ? addDays(baseEvent.seedStartDate, offset)
            : undefined,
          transplantDate: baseEvent.transplantDate
            ? addDays(baseEvent.transplantDate, offset)
            : undefined,
          directSeedDate: baseEvent.directSeedDate
            ? addDays(baseEvent.directSeedDate, offset)
            : undefined,
          expectedHarvestDate: addDays(baseEvent.expectedHarvestDate, offset),
        };
        successionEvents.push(successionEvent);
      }
      onAddEvents(successionEvents);
    } else {
      onAddEvent(baseEvent);
    }

    onClose();
  };

  const getPlantById = (id: string) => PLANT_DATABASE.find((p) => p.id === id);

  if (!isOpen) return null;

  const selectedPlantData = selectedPlant ? getPlantById(selectedPlant) : null;
  const dates = selectedPlantData
    ? calculatePlantingDates(selectedPlantData, initialDate || lastFrostDate)
    : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            Add Planting Event
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Plant Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Plant *
            </label>
            <select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Choose a plant...</option>
              {PLANT_DATABASE.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name} ({plant.daysToMaturity} days)
                </option>
              ))}
            </select>
          </div>

          {/* Variety */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Variety
            </label>
            {loadingVarieties ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading varieties...
              </div>
            ) : availableVarieties.length > 0 ? (
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">No variety selected (optional)</option>
                {availableVarieties.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder={selectedPlant ? "No varieties in seed inventory - enter manually" : "Select a plant first"}
                disabled={!selectedPlant}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            )}
            <p className="mt-1 text-xs text-gray-500">
              {availableVarieties.length > 0
                ? `${availableVarieties.length} ${availableVarieties.length === 1 ? 'variety' : 'varieties'} available from seed inventory`
                : selectedPlant
                  ? "No varieties found - you can add varieties in Seed Inventory or enter manually"
                  : "Select a plant to see available varieties"}
            </p>
          </div>

          {/* Garden Bed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Garden Bed (optional)
            </label>
            <select
              value={gardenBedId}
              onChange={(e) => setGardenBedId(e.target.value)}
              disabled={loadingBeds}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">{loadingBeds ? 'Loading beds...' : 'Select a bed...'}</option>
              {gardenBeds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.name} {bed.width && bed.length ? `(${bed.width}x${bed.length})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Position Selector - Only show if garden bed selected and plant selected */}
          {gardenBedId && selectedPlantData && dates && (() => {
            const bed = gardenBeds.find(b => b.id === parseInt(gardenBedId));
            if (!bed || !bed.width || !bed.length) return null;

            // Create garden bed object with gridSize (default to 12" if not provided)
            const gardenBedForSelector = {
              id: bed.id,
              name: bed.name,
              width: bed.width,
              length: bed.length,
              gridSize: 12 // Default to 12" grid (square foot gardening)
            };

            return (
              <PositionSelector
                gardenBed={gardenBedForSelector}
                selectedPlant={selectedPlantData}
                startDate={
                  plantingMethod === 'transplant'
                    ? (manualDates.transplantDate || dates.transplantDate)
                    : (manualDates.directSeedDate || dates.transplantDate)
                }
                endDate={manualDates.expectedHarvestDate || dates.expectedHarvestDate}
                onPositionSelect={handlePositionSelect}
                onConflictDetected={handleConflictDetected}
              />
            );
          })()}

          {/* Planting Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Planting Method *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="transplant"
                  checked={plantingMethod === 'transplant'}
                  onChange={(e) =>
                    setPlantingMethod(e.target.value as 'seed' | 'transplant')
                  }
                  className="mr-2"
                />
                Start Indoors & Transplant
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="seed"
                  checked={plantingMethod === 'seed'}
                  onChange={(e) =>
                    setPlantingMethod(e.target.value as 'seed' | 'transplant')
                  }
                  className="mr-2"
                />
                Direct Seed
              </label>
            </div>
          </div>

          {/* Calculated/Manual Dates */}
          {selectedPlantData && dates && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <h4 className="font-semibold text-blue-900">
                Planting Dates {initialDate && '(calculated from selected date)'}:
              </h4>

              {plantingMethod === 'transplant' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Start Seeds Indoors:
                    </label>
                    <input
                      type="date"
                      value={format(
                        manualDates.seedStartDate || dates.seedStartDate,
                        'yyyy-MM-dd'
                      )}
                      onChange={(e) =>
                        setManualDates({
                          ...manualDates,
                          seedStartDate: new Date(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Transplant Outdoors:
                    </label>
                    <input
                      type="date"
                      value={format(
                        manualDates.transplantDate || dates.transplantDate,
                        'yyyy-MM-dd'
                      )}
                      onChange={(e) =>
                        setManualDates({
                          ...manualDates,
                          transplantDate: new Date(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </>
              )}

              {plantingMethod === 'seed' && (
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Direct Seed:
                  </label>
                  <input
                    type="date"
                    value={format(
                      manualDates.directSeedDate || dates.transplantDate,
                      'yyyy-MM-dd'
                    )}
                    onChange={(e) =>
                      setManualDates({
                        ...manualDates,
                        directSeedDate: new Date(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">
                  Expected Harvest:
                </label>
                <input
                  type="date"
                  value={format(
                    manualDates.expectedHarvestDate || dates.expectedHarvestDate,
                    'yyyy-MM-dd'
                  )}
                  onChange={(e) =>
                    setManualDates({
                      ...manualDates,
                      expectedHarvestDate: new Date(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {/* Succession Planting */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="succession"
                checked={successionPlanting}
                onChange={(e) => setSuccessionPlanting(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <label htmlFor="succession" className="text-sm font-medium text-gray-700">
                Enable succession planting
              </label>
            </div>

            {successionPlanting && (
              <div className="pl-6 space-y-3">
                <p className="text-sm text-gray-600">
                  Create multiple plantings for continuous harvest
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plant every X days:
                    </label>
                    <input
                      type="number"
                      value={successionInterval}
                      onChange={(e) => setSuccessionInterval(Number(e.target.value))}
                      min="1"
                      max="90"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of plantings:
                    </label>
                    <input
                      type="number"
                      value={successionCount}
                      onChange={(e) => setSuccessionCount(Number(e.target.value))}
                      min="2"
                      max="12"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this planting..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedPlant}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {successionPlanting ? `Add ${successionCount} Events` : 'Add Event'}
            </button>
          </div>
        </form>
      </div>

      {/* Conflict Warning Modal */}
      {conflicts && conflicts.conflicts.length > 0 && (
        <ConflictWarning
          conflicts={conflicts.conflicts}
          onOverride={handleConflictOverride}
          onCancel={handleConflictCancel}
          isOpen={showConflictWarning}
        />
      )}
    </div>
  );
};

export default AddCropModal;
