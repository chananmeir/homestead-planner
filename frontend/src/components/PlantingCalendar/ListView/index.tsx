import React, { useState, useEffect } from 'react';
import { PlantingCalendar as PlantingCalendarType } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { format, addWeeks } from 'date-fns';
import { calculatePlantingDates } from '../utils/dateCalculations';
import GroupedEventsModal from '../CalendarGrid/GroupedEventsModal';
import { GroupedDateMarker, EventMarkerType } from '../CalendarGrid/utils';

interface ListViewProps {
  plantingEvents: PlantingCalendarType[];
  setPlantingEvents: React.Dispatch<React.SetStateAction<PlantingCalendarType[]>>;
  lastFrostDate?: Date;
  firstFrostDate?: Date;
  registerEventRef?: (id: number) => (el: HTMLElement | null) => void;
  highlightedEventId?: number | null;
  onEditEvent?: (event: PlantingCalendarType) => void;
  onEventUpdated?: () => void;
}

// A grouped item rendered as a single card representing 1+ events sharing
// (date, type, plantId, variety, bedId). When count === 1, the card looks
// identical to the legacy per-event card. When count > 1, the card shows
// "(N)" after the plant name and clicking opens GroupedEventsModal.
type ListGroupedItem = {
  key: string;
  primaryDate: Date;          // used for monthly bucketing + sorting
  type: EventMarkerType;      // primary date phase ('seed-start' | 'direct-seed' | 'transplant')
  plantId?: string;
  variety?: string;
  gardenBedId?: number;
  events: PlantingCalendarType[];
  count: number;
};

// Determine the primary date phase used for monthly grouping in ListView.
// Mirrors the priority used at line 88-89 below: seedStartDate first, then
// directSeedDate, then transplantDate. Returns null if none are set.
const getPrimaryDateAndType = (
  event: PlantingCalendarType
): { date: Date; type: EventMarkerType } | null => {
  if (event.seedStartDate) return { date: event.seedStartDate, type: 'seed-start' };
  if (event.directSeedDate) return { date: event.directSeedDate, type: 'direct-seed' };
  if (event.transplantDate) return { date: event.transplantDate, type: 'transplant' };
  return null;
};

const ListView: React.FC<ListViewProps> = ({ plantingEvents, setPlantingEvents, lastFrostDate: lastFrostProp, firstFrostDate: firstFrostProp, registerEventRef, highlightedEventId, onEditEvent, onEventUpdated }) => {
  const [lastFrostDate, setLastFrostDate] = useState<Date>(lastFrostProp || new Date(new Date().getFullYear() + '-04-15'));
  const [firstFrostDate, setFirstFrostDate] = useState<Date>(firstFrostProp || new Date(new Date().getFullYear() + '-10-15'));

  // Sync with parent frost dates when they arrive from the API
  useEffect(() => {
    if (lastFrostProp) setLastFrostDate(lastFrostProp);
  }, [lastFrostProp]);
  useEffect(() => {
    if (firstFrostProp) setFirstFrostDate(firstFrostProp);
  }, [firstFrostProp]);

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

    const dates = calculatePlantingDates(plant, lastFrostDate, plantingMethod);

    const newEvent: PlantingCalendarType = {
      id: Date.now(),
      plantId: plant.id,
      gardenBedId: undefined,
      seedStartDate: plantingMethod === 'transplant'
        ? (manualDates.seedStartDate || dates.seedStartDate)
        : undefined,
      transplantDate: plantingMethod === 'transplant'
        ? (manualDates.transplantDate || dates.transplantDate)
        : undefined,
      directSeedDate: plantingMethod === 'seed'
        ? (manualDates.directSeedDate || dates.directSeedDate)
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

  const removeEvent = (id: number) => {
    setPlantingEvents(plantingEvents.filter((e) => e.id !== id));
  };

  const toggleCompleted = (id: number) => {
    setPlantingEvents(
      plantingEvents.map((e) =>
        e.id === id ? { ...e, completed: !e.completed, isComplete: !e.completed } : e
      )
    );
  };

  const getPlantById = (id: string) => PLANT_DATABASE.find((p) => p.id === id);

  // Modal state for grouped (count > 1) cards
  const [selectedGroup, setSelectedGroup] = useState<GroupedDateMarker | null>(null);

  // Step 1: Collapse events that share (date, type, plantId, variety, bedId)
  // into ListGroupedItem objects. Group key formula intentionally matches
  // CalendarGrid (frontend/src/components/PlantingCalendar/CalendarGrid/utils.ts:139)
  // so future changes to grouping apply consistently across both views.
  // Non-planting events (maple-tapping, mulch) and events without a primary
  // date are passed through as singleton groups to preserve existing behavior.
  const groupedItems: ListGroupedItem[] = (() => {
    const groupMap = new Map<string, ListGroupedItem>();

    plantingEvents.forEach((event) => {
      // Maple-tapping uses expectedHarvestDate; render it as its own non-grouped card.
      // Mulch / other non-planting events also fall through as singletons.
      const isPlantingEvent = !event.eventType || event.eventType === 'planting';

      if (!isPlantingEvent) {
        // Maple-tapping: keep its existing primary date (expectedHarvestDate) for monthly bucketing.
        const fallbackDate = event.expectedHarvestDate || event.seedStartDate || event.directSeedDate || event.transplantDate;
        if (!fallbackDate) return;
        groupMap.set(`solo_${event.id}`, {
          key: `solo_${event.id}`,
          primaryDate: fallbackDate,
          type: 'seed-start', // unused for non-planting render path, but type-required
          plantId: event.plantId,
          variety: event.variety,
          gardenBedId: event.gardenBedId,
          events: [event],
          count: 1,
        });
        return;
      }

      const primary = getPrimaryDateAndType(event);
      if (!primary) return;

      const dateKey = format(primary.date, 'yyyy-MM-dd');
      // Same composite key shape as CalendarGrid utils.ts (line ~139).
      const groupKey = `${dateKey}_${primary.type}_${event.plantId}_${event.variety || 'none'}_${event.gardenBedId || 'none'}`;

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.events.push(event);
        existing.count = existing.events.length;
      } else {
        groupMap.set(groupKey, {
          key: groupKey,
          primaryDate: primary.date,
          type: primary.type,
          plantId: event.plantId,
          variety: event.variety,
          gardenBedId: event.gardenBedId,
          events: [event],
          count: 1,
        });
      }
    });

    return Array.from(groupMap.values());
  })();

  // Step 2: Bucket groups by month, preserving existing month-sort behavior.
  const groupedByMonth = groupedItems.reduce((acc, item) => {
    const monthYear = format(item.primaryDate, 'MMMM yyyy');
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(item);
    return acc;
  }, {} as Record<string, ListGroupedItem[]>);

  // Convert a grouped item to the GroupedDateMarker shape that GroupedEventsModal expects.
  // Only called for count > 1 cards (planting events with valid plantId).
  const toGroupedDateMarker = (item: ListGroupedItem): GroupedDateMarker => ({
    date: item.primaryDate,
    type: item.type,
    plantId: item.plantId || '',
    variety: item.variety,
    gardenBedId: item.gardenBedId,
    events: item.events,
    count: item.count,
  });

  const handleGroupedCardClick = (item: ListGroupedItem) => {
    setSelectedGroup(toGroupedDateMarker(item));
  };

  const handleModalEdit = (event: PlantingCalendarType) => {
    if (onEditEvent) onEditEvent(event);
  };

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
          data-testid="btn-add-planting-event"
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
                    const dates = calculatePlantingDates(plant, lastFrostDate, plantingMethod);
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
                                  manualDates.seedStartDate || dates.seedStartDate!,
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
                                  manualDates.transplantDate || dates.transplantDate!,
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
                                manualDates.directSeedDate || dates.directSeedDate!,
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
            {Object.entries(groupedByMonth)
              .sort(
                ([a], [b]) =>
                  new Date(a).getTime() - new Date(b).getTime()
              )
              .map(([month, items]) => (
                <div key={month}>
                  <h4 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b">
                    {month}
                  </h4>
                  <div className="space-y-3">
                    {items.map((item) => {
                      // Singleton groups (count === 1) render exactly as the legacy
                      // per-event card to avoid any visual regression. Only count > 1
                      // groups get the "(N)" badge + click-to-open-modal behavior.
                      const event = item.events[0];
                      const isGrouped = item.count > 1;

                      // Handle maple-tapping events (always singletons by design)
                      if (event.eventType === 'maple-tapping') {
                        let treeType = 'Sugar Maple';
                        let tapCount = 1;
                        try {
                          if (event.eventDetails) {
                            const details = typeof event.eventDetails === 'string'
                              ? JSON.parse(event.eventDetails)
                              : event.eventDetails;
                            const types = { sugar: 'Sugar Maple', red: 'Red Maple', black: 'Black Maple', boxelder: 'Box Elder Maple' };
                            treeType = types[details.treeType as keyof typeof types] || 'Maple Tree';
                            tapCount = details.tapCount || 1;
                          }
                        } catch {
                          // Use defaults
                        }

                        return (
                          <div
                            key={event.id}
                            ref={registerEventRef ? registerEventRef(event.id) : undefined}
                            data-focus-id={event.id}
                            className={`p-4 rounded-lg border bg-white border-orange-200 transition-all ${
                              highlightedEventId === event.id ? 'ring-2 ring-amber-400 ring-offset-2' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🍁</span>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{treeType}</h4>
                                  <p className="text-sm text-gray-600">
                                    {tapCount} tap{tapCount > 1 ? 's' : ''}
                                  </p>
                                  {event.expectedHarvestDate && (
                                    <p className="text-sm text-orange-600 mt-1">
                                      Tapped: {format(event.expectedHarvestDate, 'MMM d, yyyy')}
                                    </p>
                                  )}
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
                      }

                      // Skip other non-planting events (like mulch events) in list view for now
                      if (!event.plantId) return null;

                      const plant = getPlantById(event.plantId);
                      if (!plant) return null;

                      // Aggregate completion / total quantities across the group for the header summary.
                      const totalQty = item.events.reduce((sum, e) => sum + (e.quantity || 0), 0);
                      const completedQty = item.events.reduce((sum, e) => sum + (e.quantityCompleted || 0), 0);
                      // For grouped cards we treat the card as "complete" only when ALL underlying events are complete.
                      const allComplete = item.events.every((e) => e.isComplete || e.completed);

                      // For singleton cards, the existing per-event focus + completion styling applies.
                      // For grouped cards, we use group-level completion + only register the first event id
                      // for focus highlighting (deep-link still works against any underlying event id).
                      const focusId = event.id;
                      const isCardComplete = isGrouped ? allComplete : (event.isComplete || event.completed);

                      return (
                        <div
                          key={item.key}
                          ref={registerEventRef ? registerEventRef(focusId) : undefined}
                          data-testid="planting-event-item"
                          data-focus-id={focusId}
                          {...(isGrouped ? { 'data-grouped-count': item.count } : {})}
                          onClick={isGrouped ? () => handleGroupedCardClick(item) : undefined}
                          className={`p-4 rounded-lg border transition-all ${
                            isCardComplete
                              ? 'bg-green-50 border-green-200 opacity-60'
                              : 'bg-white border-gray-200'
                          } ${highlightedEventId === focusId ? 'ring-2 ring-amber-400 ring-offset-2' : ''} ${
                            isGrouped ? 'cursor-pointer hover:bg-gray-50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                {/* Singletons keep the inline checkbox toggle. Grouped cards
                                    delegate per-event completion to the modal so we don't show
                                    an ambiguous group-level checkbox. */}
                                {!isGrouped && (
                                  <input
                                    type="checkbox"
                                    checked={event.completed}
                                    onChange={() => toggleCompleted(event.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-5 h-5"
                                  />
                                )}
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-semibold text-gray-800">
                                      {plant.name}
                                      {item.variety && (
                                        <span className="text-sm text-gray-600 ml-1">
                                          ({item.variety})
                                        </span>
                                      )}
                                      {isGrouped && (
                                        <span className="text-sm text-gray-700 ml-1 font-semibold">
                                          ({item.count})
                                        </span>
                                      )}
                                    </h5>
                                    {/* "Plan only" / "Tracked" pill: only meaningful when the primary
                                        date is the seed-start date. For grouped cards the pill applies
                                        to the underlying first event (same plant + variety + bed + date,
                                        so all events share the same indoorSeedStartStatus value). */}
                                    {event.seedStartDate && item.type === 'seed-start' && (
                                      event.indoorSeedStartStatus != null ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700">
                                          Tracked
                                        </span>
                                      ) : (
                                        <span
                                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-amber-400 text-amber-700 bg-amber-50"
                                          title="Scheduled in your plan but not yet on the Indoor Starts page. Click Start tracking to add it."
                                        >
                                          Plan only
                                        </span>
                                      )
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 space-y-1 mt-1">
                                    {(() => {
                                      let seedStart = event.seedStartDate;
                                      if (!seedStart && event.transplantDate && plant?.transplantWeeksBefore) {
                                        seedStart = addWeeks(event.transplantDate, -plant.transplantWeeksBefore);
                                      }
                                      return seedStart ? (
                                        <div>
                                          🌱 Start Seeds:{' '}
                                          {format(seedStart, 'MMM d')}
                                          {!event.seedStartDate && <span className="text-xs text-gray-500 ml-1">(calc)</span>}
                                        </div>
                                      ) : null;
                                    })()}
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
                                    {event.expectedHarvestDate && (
                                      <div>
                                        🎉 Harvest:{' '}
                                        {format(event.expectedHarvestDate, 'MMM d')}
                                      </div>
                                    )}
                                    {/* Group summary: total quantity and per-bed indicator when grouped. */}
                                    {isGrouped && totalQty > 0 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {completedQty}/{totalQty} planted across {item.count} plantings
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {!isGrouped && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeEvent(event.id);
                                }}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                              >
                                Remove
                              </button>
                            )}
                            {isGrouped && (
                              <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                Click to manage →
                              </span>
                            )}
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

      {/* Grouped Events Modal — opens for cards where count > 1.
          Mirrors the modal CalendarGrid uses (CalendarDayCell.tsx:122). */}
      <GroupedEventsModal
        isOpen={!!selectedGroup}
        marker={selectedGroup}
        onClose={() => setSelectedGroup(null)}
        onEditEvent={handleModalEdit}
        onEventUpdated={onEventUpdated}
      />
    </div>
  );
};

export default ListView;
