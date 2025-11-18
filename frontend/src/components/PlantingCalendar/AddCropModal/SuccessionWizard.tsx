import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { Plant, PlantingCalendar as PlantingCalendarType, GardenBed, ConflictCheck } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { format, addDays } from 'date-fns';
import { calculatePlantingDates } from '../utils/dateCalculations';
import { calculateSuggestedInterval, formatSuggestion, getSuggestedCount } from '../utils/successionCalculations';
import { API_BASE_URL } from '../../../config';

interface SuccessionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateEvents: (events: PlantingCalendarType[]) => void;
  initialDate?: Date;
  initialPlant?: Plant;
  lastFrostDate: Date;
}

type WizardStep = 1 | 2 | 3 | 4;

interface SuccessionEvent extends Omit<PlantingCalendarType, 'id'> {
  tempId: string; // Temporary ID for tracking before creation
  conflictCheck?: ConflictCheck;
  hasPosition: boolean;
}

export const SuccessionWizard: React.FC<SuccessionWizardProps> = ({
  isOpen,
  onClose,
  onCreateEvents,
  initialDate,
  initialPlant,
  lastFrostDate,
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Plant Selection
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(initialPlant || null);

  // Step 2: Configure Series
  const [interval, setInterval] = useState(14);
  const [count, setCount] = useState(5);
  const [startDate, setStartDate] = useState<Date>(initialDate || new Date());
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [variety, setVariety] = useState('');

  // Step 3: Space Check
  const [previewEvents, setPreviewEvents] = useState<SuccessionEvent[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Array<{ x: number; y: number } | null>>([]);

  // Step 4: Review (uses previewEvents)

  // Data loading
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(true);
  const [availableVarieties, setAvailableVarieties] = useState<string[]>([]);

  // Load garden beds
  useEffect(() => {
    const fetchBeds = async () => {
      try {
        setLoadingBeds(true);
        const response = await fetch(`${API_BASE_URL}/api/garden-beds`);
        if (response.ok) {
          const data = await response.json();
          setGardenBeds(data);
        }
      } catch (err) {
        console.error('Failed to load garden beds:', err);
      } finally {
        setLoadingBeds(false);
      }
    };
    fetchBeds();
  }, []);

  // Load varieties when plant changes
  useEffect(() => {
    const fetchVarieties = async () => {
      if (!selectedPlant) {
        setAvailableVarieties([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/seeds/varieties/${selectedPlant.id}`);
        if (response.ok) {
          const varieties = await response.json();
          setAvailableVarieties(varieties);
        }
      } catch (err) {
        console.error('Failed to load varieties:', err);
      }
    };
    fetchVarieties();
  }, [selectedPlant]);

  // Auto-suggest interval when plant changes
  useEffect(() => {
    if (selectedPlant && currentStep === 1) {
      const suggestion = calculateSuggestedInterval(selectedPlant);
      if (suggestion.recommended && suggestion.recommended > 0) {
        setInterval(suggestion.recommended);
      }
    }
  }, [selectedPlant, currentStep]);

  // Generate preview events when moving to step 3
  useEffect(() => {
    if (currentStep === 3 && selectedPlant) {
      generatePreviewEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const generatePreviewEvents = () => {
    if (!selectedPlant) return;

    const events: SuccessionEvent[] = [];
    const successionGroupId = crypto.randomUUID();

    for (let i = 0; i < count; i++) {
      const offset = i * interval;
      const baseDate = addDays(startDate, offset);
      const dates = calculatePlantingDates(selectedPlant, baseDate);

      events.push({
        tempId: `temp-${i}`,
        plantId: selectedPlant.id,
        variety: variety || undefined,
        gardenBedId: selectedBedId || '', // Empty string if no bed selected
        seedStartDate: dates.seedStartDate,
        transplantDate: dates.transplantDate,
        directSeedDate: undefined, // Not returned by calculatePlantingDates
        expectedHarvestDate: dates.expectedHarvestDate,
        successionPlanting: true,
        successionInterval: interval,
        successionGroupId,
        completed: false,
        hasPosition: false,
      });
    }

    setPreviewEvents(events);
    setSelectedPositions(new Array(count).fill(null));
  };

  // Check conflicts for all events
  const checkConflictsForAllEvents = async () => {
    if (!selectedBedId || previewEvents.length === 0) return;

    setCheckingConflicts(true);

    const bed = gardenBeds.find(b => b.id === selectedBedId);
    if (!bed) {
      setCheckingConflicts(false);
      return;
    }

    // Check conflicts for each event
    const updatedEvents = await Promise.all(
      previewEvents.map(async (event, index) => {
        const position = selectedPositions[index];
        if (!position) {
          return event; // No position, no conflict check
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/planting-events/check-conflict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gardenBedId: selectedBedId,
              positionX: position.x,
              positionY: position.y,
              startDate: event.directSeedDate || event.transplantDate,
              endDate: event.expectedHarvestDate,
              plantId: event.plantId,
              transplantDate: event.transplantDate?.toISOString(),
              directSeedDate: event.directSeedDate?.toISOString(),
              seedStartDate: event.seedStartDate?.toISOString(),
            }),
          });

          if (response.ok) {
            const conflictCheck: ConflictCheck = await response.json();
            return {
              ...event,
              conflictCheck,
              positionX: position.x,
              positionY: position.y,
              hasPosition: true,
            };
          }
        } catch (err) {
          console.error('Conflict check failed:', err);
        }

        return event;
      })
    );

    setPreviewEvents(updatedEvents);
    setCheckingConflicts(false);
  };

  // Step navigation
  const canProceedToStep2 = selectedPlant !== null;
  const canProceedToStep3 = canProceedToStep2 && interval > 0 && count >= 2 && count <= 20 && selectedBedId !== '';
  const canProceedToStep4 = canProceedToStep3 && previewEvents.length > 0;

  const handleNext = () => {
    if (currentStep === 1 && canProceedToStep2) {
      setCurrentStep(2);
    } else if (currentStep === 2 && canProceedToStep3) {
      setCurrentStep(3);
    } else if (currentStep === 3 && canProceedToStep4) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const handleCreate = () => {
    // Convert preview events to actual events (remove tempId, add proper types)
    const eventsToCreate: PlantingCalendarType[] = previewEvents.map((event) => {
      const { tempId, conflictCheck, hasPosition, ...rest } = event;
      return {
        ...rest,
        id: '', // Will be assigned by backend
      } as PlantingCalendarType;
    });

    onCreateEvents(eventsToCreate);
    onClose();
  };

  const handleCancel = () => {
    // Reset wizard state
    setCurrentStep(1);
    setSelectedPlant(null);
    setInterval(14);
    setCount(5);
    setStartDate(new Date());
    setSelectedBedId('');
    setVariety('');
    setPreviewEvents([]);
    setSelectedPositions([]);
    onClose();
  };

  if (!isOpen) return null;

  const selectedBed = gardenBeds.find(b => b.id === selectedBedId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Succession Planting Wizard</h2>
            <p className="text-sm text-gray-600 mt-1">
              Step {currentStep} of 4: {
                currentStep === 1 ? 'Select Plant' :
                currentStep === 2 ? 'Configure Series' :
                currentStep === 3 ? 'Check Space' :
                'Review & Confirm'
              }
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <React.Fragment key={step}>
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step < currentStep
                        ? 'bg-green-600 text-white'
                        : step === currentStep
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step < currentStep ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      step <= currentStep ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step === 1 ? 'Plant' : step === 2 ? 'Configure' : step === 3 ? 'Space' : 'Review'}
                  </span>
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6 min-h-[400px]">
          {/* Step 1: Plant Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select a Plant for Succession</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose a plant that's suitable for succession planting. We'll suggest an optimal interval based on the plant's characteristics.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plant *
                  </label>
                  <select
                    value={selectedPlant?.id || ''}
                    onChange={(e) => {
                      const plant = PLANT_DATABASE.find(p => p.id === e.target.value);
                      setSelectedPlant(plant || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Choose a plant...</option>
                    {PLANT_DATABASE.map((plant) => (
                      <option key={plant.id} value={plant.id}>
                        {plant.icon} {plant.name} ({plant.daysToMaturity} days)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPlant && (
                  <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{selectedPlant.icon}</div>
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900">{selectedPlant.name}</h4>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Days to Maturity:</span>{' '}
                            <span className="font-medium text-gray-900">{selectedPlant.daysToMaturity}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Category:</span>{' '}
                            <span className="font-medium text-gray-900 capitalize">{selectedPlant.category}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Spacing:</span>{' '}
                            <span className="font-medium text-gray-900">{selectedPlant.spacing}"</span>
                          </div>
                          {selectedPlant.sunRequirement && (
                            <div>
                              <span className="text-gray-600">Sun:</span>{' '}
                              <span className="font-medium text-gray-900 capitalize">{selectedPlant.sunRequirement}</span>
                            </div>
                          )}
                        </div>

                        {(() => {
                          const suggestion = calculateSuggestedInterval(selectedPlant);
                          return (
                            <div className={`mt-3 p-3 rounded-lg ${
                              suggestion.recommended !== null
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-amber-50 border border-amber-200'
                            }`}>
                              <div className="flex items-start gap-2">
                                <span className="text-lg">
                                  {suggestion.recommended !== null ? '💡' : 'ℹ️'}
                                </span>
                                <div>
                                  <p className={`text-sm font-medium ${
                                    suggestion.recommended !== null ? 'text-green-900' : 'text-amber-900'
                                  }`}>
                                    {formatSuggestion(suggestion)}
                                  </p>
                                  <p className={`text-xs mt-1 ${
                                    suggestion.recommended !== null ? 'text-green-700' : 'text-amber-700'
                                  }`}>
                                    {suggestion.reasoning}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Configure Series */}
          {currentStep === 2 && selectedPlant && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Succession Series</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Set up your succession planting schedule. Each planting will be spaced by the interval you choose.
                </p>

                {/* Interval */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Succession Interval (days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={interval}
                    onChange={(e) => setInterval(parseInt(e.target.value) || 7)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const suggestion = calculateSuggestedInterval(selectedPlant);
                      if (suggestion.recommended !== null) {
                        return `Suggested: ${suggestion.recommended} days (${suggestion.min}-${suggestion.max} day range)`;
                      }
                      return 'Enter the number of days between each planting';
                    })()}
                  </p>
                </div>

                {/* Number of Plantings */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Plantings *
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const suggestion = calculateSuggestedInterval(selectedPlant);
                      const suggestedCount = suggestion.recommended ? getSuggestedCount(suggestion.recommended) : 2;
                      return `Suggested: ${suggestedCount} plantings for continuous harvest`;
                    })()}
                  </p>
                </div>

                {/* Start Date */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Planting Date *
                  </label>
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The date for your first planting in the succession series
                  </p>
                </div>

                {/* Garden Bed (Optional) */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Garden Bed <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">No bed selected (timeline only)</option>
                    {gardenBeds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.name} ({bed.width}" × {bed.length}")
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Select a garden bed to enable space conflict checking in the next step
                  </p>
                </div>

                {/* Variety (Optional) */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variety <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  {availableVarieties.length > 0 ? (
                    <select
                      value={variety}
                      onChange={(e) => setVariety(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">No variety selected</option>
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
                      placeholder="e.g., 'Brandywine', 'Roma', 'Cherokee Purple'"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Specify a variety if you're planting a specific cultivar
                  </p>
                </div>

                {/* Preview Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Series Preview</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• {count} plantings of <strong>{selectedPlant.name}</strong></p>
                    <p>• Every {interval} days starting {startDate.toLocaleDateString()}</p>
                    <p>• Last planting: {addDays(startDate, (count - 1) * interval).toLocaleDateString()}</p>
                    {selectedBedId && (
                      <p>• Garden bed: <strong>{gardenBeds.find(b => b.id === selectedBedId)?.name}</strong></p>
                    )}
                    {variety && (
                      <p>• Variety: <strong>{variety}</strong></p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Space Check */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Positions (Optional)</h3>

                {!selectedBedId ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <div className="text-4xl mb-3">📍</div>
                    <h4 className="text-lg font-medium text-blue-900 mb-2">No Garden Bed Selected</h4>
                    <p className="text-sm text-blue-800 mb-4">
                      You haven't selected a garden bed, so position tracking is disabled. Your succession series will be tracked in the timeline view only.
                    </p>
                    <p className="text-xs text-blue-700">
                      To enable position tracking and conflict detection, go back to Step 2 and select a garden bed.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-6">
                      Assign grid positions for each planting in your succession series. This enables conflict detection and space planning.
                    </p>

                    {checkingConflicts && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                          <p className="text-sm text-yellow-800">Checking for conflicts...</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {previewEvents.map((event, idx) => {
                        const bed = gardenBeds.find(b => b.id === selectedBedId);
                        const position = selectedPositions[idx];
                        const hasConflict = event.conflictCheck?.hasConflict;

                        return (
                          <div key={event.tempId} className={`border rounded-lg p-4 ${
                            hasConflict ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h5 className="font-medium text-gray-900">
                                  Planting #{idx + 1}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {format(event.seedStartDate || event.transplantDate || event.expectedHarvestDate, 'MMM d, yyyy')}
                                </p>
                              </div>
                              {position ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">
                                    Position: ({position.x}, {position.y})
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newPositions = [...selectedPositions];
                                      newPositions[idx] = null;
                                      setSelectedPositions(newPositions);
                                    }}
                                    className="text-sm text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">No position assigned</span>
                              )}
                            </div>

                            {hasConflict && (
                              <div className="mb-3 bg-white border border-red-200 rounded p-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-red-900">
                                      Space Conflict Detected
                                    </p>
                                    <p className="text-xs text-red-700 mt-1">
                                      {event.conflictCheck?.conflicts.length} conflict(s) found at this position and time.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Mini grid for position selection */}
                            {bed && (
                              <div className="bg-gray-50 rounded p-3">
                                <p className="text-xs text-gray-600 mb-2">
                                  Click a cell to assign position (Grid: {Math.floor(bed.width / 12)}×{Math.floor(bed.length / 12)} squares)
                                </p>
                                <div className="inline-block border border-gray-300 bg-white">
                                  <svg
                                    width={Math.min(400, Math.floor(bed.width / 12) * 30)}
                                    height={Math.min(200, Math.floor(bed.length / 12) * 30)}
                                    className="cursor-pointer"
                                  >
                                    {/* Grid cells */}
                                    {Array.from({ length: Math.floor(bed.length / 12) }, (_, y) =>
                                      Array.from({ length: Math.floor(bed.width / 12) }, (_, x) => {
                                        const isSelected = position?.x === x && position?.y === y;
                                        const isOccupied = selectedPositions.some((p, i) => i !== idx && p?.x === x && p?.y === y);

                                        return (
                                          <rect
                                            key={`${x}-${y}`}
                                            x={x * 30}
                                            y={y * 30}
                                            width={30}
                                            height={30}
                                            fill={isSelected ? '#3b82f6' : isOccupied ? '#ef4444' : '#f9fafb'}
                                            stroke="#d1d5db"
                                            strokeWidth="1"
                                            onClick={() => {
                                              const newPositions = [...selectedPositions];
                                              newPositions[idx] = { x, y };
                                              setSelectedPositions(newPositions);
                                            }}
                                            className="hover:opacity-80 transition-opacity"
                                          />
                                        );
                                      })
                                    )}
                                  </svg>
                                </div>
                                <div className="mt-2 flex gap-3 text-xs">
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-blue-500 border border-gray-300"></div>
                                    <span className="text-gray-600">Selected</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-red-500 border border-gray-300"></div>
                                    <span className="text-gray-600">Occupied (other planting)</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-gray-50 border border-gray-300"></div>
                                    <span className="text-gray-600">Available</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Position Tips</h4>
                      <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                        <li>You can skip position assignment and add it later</li>
                        <li>Red cells show positions used by other plantings in this series</li>
                        <li>Position tracking enables conflict detection across all plantings</li>
                        <li>You can modify positions after creation in the timeline view</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {currentStep === 4 && selectedPlant && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Review & Confirm</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Review your succession planting series before creating. You can edit any event after creation.
                </p>

                {/* Series Summary */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-green-900 mb-3">Series Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">Plant:</span>{' '}
                      <span className="font-medium text-green-900">{selectedPlant.icon} {selectedPlant.name}</span>
                    </div>
                    {variety && (
                      <div>
                        <span className="text-green-700">Variety:</span>{' '}
                        <span className="font-medium text-green-900">{variety}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-green-700">Total Plantings:</span>{' '}
                      <span className="font-medium text-green-900">{count}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Interval:</span>{' '}
                      <span className="font-medium text-green-900">{interval} days</span>
                    </div>
                    <div>
                      <span className="text-green-700">First Planting:</span>{' '}
                      <span className="font-medium text-green-900">{startDate.toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Last Planting:</span>{' '}
                      <span className="font-medium text-green-900">
                        {addDays(startDate, (count - 1) * interval).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedBedId && (
                      <div>
                        <span className="text-green-700">Garden Bed:</span>{' '}
                        <span className="font-medium text-green-900">
                          {gardenBeds.find(b => b.id === selectedBedId)?.name}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-green-700">Positions Assigned:</span>{' '}
                      <span className="font-medium text-green-900">
                        {selectedPositions.filter(p => p !== null).length} / {count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Event List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">Planting Schedule</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {previewEvents.map((event, idx) => {
                      const position = selectedPositions[idx];
                      const hasConflict = event.conflictCheck?.hasConflict;

                      return (
                        <div
                          key={event.tempId}
                          className={`border rounded-lg p-3 ${
                            hasConflict ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{selectedPlant.icon}</span>
                                <h5 className="font-medium text-gray-900">
                                  Planting #{idx + 1}: {selectedPlant.name}
                                  {variety && <span className="text-gray-600"> ({variety})</span>}
                                </h5>
                              </div>
                              <div className="text-sm text-gray-600 space-y-1 ml-7">
                                {event.seedStartDate && (
                                  <p>
                                    <span className="font-medium">Seed Start:</span>{' '}
                                    {format(event.seedStartDate, 'MMM d, yyyy')}
                                  </p>
                                )}
                                {event.transplantDate && (
                                  <p>
                                    <span className="font-medium">Transplant:</span>{' '}
                                    {format(event.transplantDate, 'MMM d, yyyy')}
                                  </p>
                                )}
                                <p>
                                  <span className="font-medium">Expected Harvest:</span>{' '}
                                  {format(event.expectedHarvestDate, 'MMM d, yyyy')}
                                </p>
                                {position && (
                                  <p>
                                    <span className="font-medium">Position:</span>{' '}
                                    ({position.x}, {position.y})
                                  </p>
                                )}
                                {hasConflict && (
                                  <p className="text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="font-medium">
                                      {event.conflictCheck?.conflicts.length} conflict(s) detected
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Warnings */}
                {previewEvents.some(e => e.conflictCheck?.hasConflict) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-red-900 mb-1">Conflicts Detected</h4>
                        <p className="text-sm text-red-800">
                          Some plantings have space conflicts. You can still create these events, but you may need to adjust positions later.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPositions.filter(p => p !== null).length === 0 && selectedBedId && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-yellow-900 mb-1">No Positions Assigned</h4>
                        <p className="text-sm text-yellow-800">
                          You selected a garden bed but didn't assign positions. Events will be created without position tracking.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {!previewEvents.some(e => e.conflictCheck?.hasConflict) && selectedPositions.filter(p => p !== null).length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-green-900 mb-1">Ready to Create</h4>
                        <p className="text-sm text-green-800">
                          All plantings are positioned without conflicts. Click "Create {count} Events" to add them to your calendar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 1 && !canProceedToStep2) ||
                (currentStep === 2 && !canProceedToStep3) ||
                (currentStep === 3 && !canProceedToStep4)
              }
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Create {count} Events
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuccessionWizard;
