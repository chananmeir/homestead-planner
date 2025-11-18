import React, { useState, useEffect, useMemo } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, MapPin } from 'lucide-react';
import { PlantingCalendar as PlantingCalendarType, Plant, GardenBed } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { API_BASE_URL } from '../../../config';
import { TimelineHeader } from './TimelineHeader';
import { TimelineBar } from './TimelineBar';
import AvailableSpacesView from './AvailableSpacesView';

interface TimelineViewProps {
  onAddCrop: (date?: Date, plant?: Plant) => void;
  onEditEvent: (event: PlantingCalendarType) => void;
  onRefresh: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  onAddCrop,
  onEditEvent,
  onRefresh,
}) => {
  const [timelineStart, setTimelineStart] = useState<Date>(startOfMonth(new Date()));
  const [monthCount] = useState(4); // Show 4 months at a time
  const [monthWidth] = useState(200); // 200px per month column
  const [events, setEvents] = useState<PlantingCalendarType[]>([]);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [selectedBedFilter, setSelectedBedFilter] = useState<string | null>(null);
  const [bedsError, setBedsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAvailableSpaces, setShowAvailableSpaces] = useState(false);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range to fetch
      const startDate = startOfMonth(timelineStart);
      const endDate = endOfMonth(addMonths(timelineStart, monthCount - 1));

      // Fetch events with date range filter
      const response = await fetch(
        `${API_BASE_URL}/api/planting-events?start_date=${format(
          startDate,
          'yyyy-MM-dd'
        )}&end_date=${format(endDate, 'yyyy-MM-dd')}`
      );

      if (!response.ok) {
        throw new Error('Failed to load planting events');
      }

      const data = await response.json();

      // Convert date strings to Date objects
      const eventsWithDates = data.map((event: any) => ({
        ...event,
        seedStartDate: event.seedStartDate ? new Date(event.seedStartDate) : undefined,
        transplantDate: event.transplantDate ? new Date(event.transplantDate) : undefined,
        directSeedDate: event.directSeedDate ? new Date(event.directSeedDate) : undefined,
        expectedHarvestDate: new Date(event.expectedHarvestDate),
      }));

      setEvents(eventsWithDates);
    } catch (err) {
      // Log error in development, use proper logging service in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading events:', err);
      }
      setError('Failed to load planting events');
    } finally {
      setLoading(false);
    }
  };

  // Load events for visible date range
  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineStart, monthCount]);

  // Load garden beds on mount
  useEffect(() => {
    const loadBeds = async () => {
      try {
        setBedsError(null);
        const response = await fetch(`${API_BASE_URL}/api/garden-beds`);
        if (response.ok) {
          const data = await response.json();
          setBeds(data);
        } else {
          setBedsError('Failed to load garden beds');
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error loading garden beds:', err);
        }
        setBedsError('Failed to load garden beds');
      }
    };
    loadBeds();
  }, []);

  // Create beds lookup map for fast access
  const bedsById = useMemo(() => {
    const map = new Map<string, GardenBed>();
    beds.forEach(bed => map.set(bed.id, bed));
    return map;
  }, [beds]);

  const handlePrevMonth = () => {
    setTimelineStart(subMonths(timelineStart, 1));
  };

  const handleNextMonth = () => {
    setTimelineStart(addMonths(timelineStart, 1));
  };

  const handleToday = () => {
    setTimelineStart(startOfMonth(new Date()));
  };

  const handleEventClick = (event: PlantingCalendarType) => {
    onEditEvent(event);
  };

  // Filter events by selected bed
  const filteredEvents = useMemo(() => {
    if (!selectedBedFilter) return events;
    return events.filter(event => event.gardenBedId === selectedBedFilter);
  }, [events, selectedBedFilter]);

  // Group events by succession group if they have one
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const key = event.successionGroupId || event.id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(event);
    return acc;
  }, {} as Record<string, PlantingCalendarType[]>);

  // Flatten back to array but keep succession groups together
  const sortedEvents = Object.values(groupedEvents).flat();

  // Get plant data for each event
  const eventsWithPlants = sortedEvents.map((event) => ({
    event,
    plant: PLANT_DATABASE.find((p) => p.id === event.plantId),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Timeline Navigation */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Bed Filter Dropdown */}
          <select
            value={selectedBedFilter || ''}
            onChange={(e) => setSelectedBedFilter(e.target.value || null)}
            className={`ml-4 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              bedsError ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            disabled={bedsError !== null}
          >
            {bedsError ? (
              <option value="">Failed to load beds</option>
            ) : (
              <>
                <option value="">All Beds ({events.length} events)</option>
                {beds.map(bed => (
                  <option key={bed.id} value={bed.id}>
                    {bed.name} ({events.filter(e => e.gardenBedId === bed.id).length} events)
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="text-lg font-semibold text-gray-900">
          {format(timelineStart, 'MMMM yyyy')} -{' '}
          {format(addMonths(timelineStart, monthCount - 1), 'MMMM yyyy')}
          {selectedBedFilter && (
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({filteredEvents.length} events from {bedsById.get(selectedBedFilter)?.name})
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAvailableSpaces(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            <span>Available Spaces</span>
          </button>
          <button
            onClick={() => onAddCrop()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Planting</span>
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-auto bg-white">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading timeline...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-600">{error}</div>
          </div>
        )}

        {!loading && !error && (
          <div className="min-w-max">
            {/* Timeline Header */}
            <TimelineHeader
              startDate={timelineStart}
              monthCount={monthCount}
              monthWidth={monthWidth}
            />

            {/* Timeline Rows */}
            {eventsWithPlants.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No planting events in this time range.
                <br />
                Click &quot;Add Planting&quot; to get started!
              </div>
            ) : (
              <div>
                {eventsWithPlants.map(({ event, plant }) => (
                  <TimelineBar
                    key={event.id}
                    event={event}
                    plant={plant}
                    timelineStart={timelineStart}
                    monthWidth={monthWidth}
                    beds={beds}
                    onClick={handleEventClick}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-700">Legend:</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600">Vegetable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span className="text-sm text-gray-600">Herb</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span className="text-sm text-gray-600">Fruit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-600 rounded"></div>
          <span className="text-sm text-gray-600">Nut</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Succession Planting</span>
        </div>
      </div>

      {/* Available Spaces Modal */}
      <AvailableSpacesView
        isOpen={showAvailableSpaces}
        onClose={() => setShowAvailableSpaces(false)}
        initialBedId={selectedBedFilter || undefined}
        initialDateRange={{
          start: startOfMonth(timelineStart),
          end: endOfMonth(addMonths(timelineStart, monthCount - 1)),
        }}
        onPositionSelect={(bedId, position) => {
          // Position selected - could open AddCropModal with pre-filled data
          // For now, just show a success message and close
          alert(`Position selected: Bed ${bedId}, Position (${position.x}, ${position.y})\n\nClick "Add Planting" to create an event at this position.`);
          setShowAvailableSpaces(false);
        }}
      />
    </div>
  );
};

export default TimelineView;
