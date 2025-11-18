import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { Plant, PlantingCalendar as PlantingCalendarType, GardenBed, ConflictCheck } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { format, addDays } from 'date-fns';
import { calculatePlantingDates } from '../utils/dateCalculations';
import { calculateSuggestedInterval, formatSuggestion } from '../utils/successionCalculations';
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
      const dates = calculatePlantingDates(selectedPlant, baseDate, lastFrostDate);

      events.push({
        tempId: `temp-${i}`,
        plantId: selectedPlant.id,
        variety: variety || undefined,
        gardenBedId: selectedBedId ? Number(selectedBedId) : undefined,
        seedStartDate: dates.seedStartDate,
        transplantDate: dates.transplantDate,
        directSeedDate: dates.directSeedDate,
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

    const bed = gardenBeds.find(b => b.id === Number(selectedBedId));
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
        id: 0, // Will be assigned by backend
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

  const selectedBed = gardenBeds.find(b => b.id === Number(selectedBedId));

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

          {/* Step 2: Configure Series - TO BE IMPLEMENTED */}
          {currentStep === 2 && (
            <div className="text-center text-gray-500 py-20">
              Step 2: Configure Series - Implementation in progress
            </div>
          )}

          {/* Step 3: Space Check - TO BE IMPLEMENTED */}
          {currentStep === 3 && (
            <div className="text-center text-gray-500 py-20">
              Step 3: Space Check - Implementation in progress
            </div>
          )}

          {/* Step 4: Review & Confirm - TO BE IMPLEMENTED */}
          {currentStep === 4 && (
            <div className="text-center text-gray-500 py-20">
              Step 4: Review & Confirm - Implementation in progress
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
