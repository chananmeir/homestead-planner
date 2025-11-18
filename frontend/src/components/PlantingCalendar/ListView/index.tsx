import React, { useState } from 'react';
import { PlantingCalendar as PlantingCalendarType, Plant } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { format } from 'date-fns';
import { calculatePlantingDates } from '../utils/dateCalculations';

interface ListViewProps {
  plantingEvents: PlantingCalendarType[];
  setPlantingEvents: React.Dispatch<React.SetStateAction<PlantingCalendarType[]>>;
}

const ListView: React.FC<ListViewProps> = ({ plantingEvents, setPlantingEvents }) => {
  const [lastFrostDate, setLastFrostDate] = useState<Date>(new Date('2024-04-15'));
  const [firstFrostDate, setFirstFrostDate] = useState<Date>(new Date('2024-10-15'));
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [plantingMethod, setPlantingMethod] = useState<'seed' | 'transplant'>('seed');

  // State for manual date overrides
  const [manualDates, setManualDates] = useState<{
    seedStartDate?: Date;
    transplantDate?: Date;
    directSeedDate?: Date;
    expectedHarvestDate?: Date;
  }>({});

  const addPlantingEvent = () => {
    if (!selectedPlant) return;

    const plant = PLANT_DATABASE.find((p) => p.id === selectedPlant);
    if (!plant) return;

    const dates = calculatePlantingDates(plant, lastFrostDate);

    const newEvent: PlantingCalendarType = {
      id: String(Date.now()),
      plantId: plant.id,
      gardenBedId: '',
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
      successionPlanting: false,
      completed: false,
    };

    setPlantingEvents([...plantingEvents, newEvent]);
    setShowAddEvent(false);
    setSelectedPlant('');
    setManualDates({}); // Reset manual dates
  };

  const removeEvent = (id: string) => {
    setPlantingEvents(plantingEvents.filter((e) => e.id !== id));
  };

  const toggleCompleted = (id: string) => {
    setPlantingEvents(
      plantingEvents.map((e) =>
        e.id === id ? { ...e, completed: !e.completed } : e
      )
    );
  };

  const getPlantById = (id: string) => PLANT_DATABASE.find((p) => p.id === id);

  // Group events by month
  const groupedEvents = plantingEvents.reduce((acc, event) => {
    const date =
      event.seedStartDate || event.directSeedDate || event.transplantDate;
    if (!date) return acc;

    const monthYear = format(date, 'MMMM yyyy');
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(event);
    return acc;
  }, {} as Record<string, PlantingCalendarType[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Planting Calendar
        </h2>
        <p className="text-gray-600 mb-4">
          Plan your seed starting and transplanting schedule based on your frost
          dates.
        </p>

        {/* Frost Date Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Spring Frost Date
            </label>
            <input
              type="date"
              value={format(lastFrostDate, 'yyyy-MM-dd')}
              onChange={(e) => setLastFrostDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Fall Frost Date
            </label>
            <input
              type="date"
              value={format(firstFrostDate, 'yyyy-MM-dd')}
              onChange={(e) => setFirstFrostDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Add Event Button */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <button
          onClick={() => setShowAddEvent(!showAddEvent)}
          className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {showAddEvent ? 'Cancel' : '+ Add Planting Event'}
        </button>

        {/* Add Event Form */}
        {showAddEvent && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Plant
                </label>
                <select
                  value={selectedPlant}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Choose a plant...</option>
                  {PLANT_DATABASE.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.name} ({plant.daysToMaturity} days)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planting Method
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

              {selectedPlant && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    Planting Dates (edit if needed):
                  </h4>
                  {(() => {
                    const plant = getPlantById(selectedPlant);
                    if (!plant) return null;
                    const dates = calculatePlantingDates(plant, lastFrostDate);
                    return (
                      <div className="space-y-3">
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
                    );
                  })()}
                </div>
              )}

              <button
                onClick={addPlantingEvent}
                disabled={!selectedPlant}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add to Calendar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Events */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Scheduled Plantings
        </h3>

        {plantingEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No planting events scheduled yet. Add your first event to get started!
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents)
              .sort(
                ([a], [b]) =>
                  new Date(a).getTime() - new Date(b).getTime()
              )
              .map(([month, events]) => (
                <div key={month}>
                  <h4 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b">
                    {month}
                  </h4>
                  <div className="space-y-3">
                    {events.map((event) => {
                      const plant = getPlantById(event.plantId);
                      if (!plant) return null;

                      return (
                        <div
                          key={event.id}
                          className={`p-4 rounded-lg border transition-all ${
                            event.completed
                              ? 'bg-green-50 border-green-200 opacity-60'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={event.completed}
                                  onChange={() => toggleCompleted(event.id)}
                                  className="w-5 h-5"
                                />
                                <div>
                                  <h5 className="font-semibold text-gray-800">
                                    {plant.name}
                                  </h5>
                                  <div className="text-sm text-gray-600 space-y-1 mt-1">
                                    {event.seedStartDate && (
                                      <div>
                                        🌱 Start Seeds:{' '}
                                        {format(event.seedStartDate, 'MMM d')}
                                      </div>
                                    )}
                                    {event.transplantDate && (
                                      <div>
                                        🌿 Transplant:{' '}
                                        {format(event.transplantDate, 'MMM d')}
                                      </div>
                                    )}
                                    {event.directSeedDate && (
                                      <div>
                                        🌱 Direct Seed:{' '}
                                        {format(event.directSeedDate, 'MMM d')}
                                      </div>
                                    )}
                                    <div>
                                      🎉 Harvest:{' '}
                                      {format(event.expectedHarvestDate, 'MMM d')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeEvent(event.id)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-semibold text-yellow-900 mb-2">
          📅 Succession Planting Tips
        </h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>
            • Plant lettuce, radishes, and greens every 2-3 weeks for continuous
            harvest
          </li>
          <li>
            • Start cool-season crops 6-8 weeks before last frost for spring
            harvest
          </li>
          <li>
            • Plant fall crops 10-12 weeks before first frost for autumn harvest
          </li>
          <li>• Keep a planting journal to refine your schedule each year</li>
        </ul>
      </div>
    </div>
  );
};

export default ListView;
