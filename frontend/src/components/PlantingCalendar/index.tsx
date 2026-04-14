import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNow } from '../../contexts/SimulationContext';
import { List, Calendar, Menu, Clock, PlusCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { PlantingCalendar as PlantingCalendarType, Plant, GardenBed } from '../../types';
import { apiGet, apiPost } from '../../utils/api';
import { PLANT_DATABASE } from '../../data/plantDatabase';
import ListView from './ListView';
import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarGrid/CalendarHeader';
import CropsSidebar from './CropsSidebar';
import AddCropModal from './AddCropModal';
import AddGardenEventModal from './AddGardenEventModal';
import AddMapleTappingModal from './AddMapleTappingModal';
import SoilTemperatureCard from './SoilTemperatureCard';
import { SoilTempResponse } from './SoilTemperatureCard/types';
import MapleTappingSeasonCard from './MapleTappingSeasonCard';
import TimelineView from './TimelineView';
import EventDetailModal from './CalendarGrid/EventDetailModal';
import DayDetailModal from './CalendarGrid/DayDetailModal';

interface PlantingCalendarProps {
  onNavigateToBed?: (bedId: number, date?: string, seedStartId?: number, plantingEventId?: number) => void;
  // When set to 'soil-temp', scrolls the Soil Temperature card into view on mount.
  initialView?: 'soil-temp';
}

const PlantingCalendar: React.FC<PlantingCalendarProps> = ({ onNavigateToBed, initialView }) => {
  const now = useNow();
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list');
  const [currentDate, setCurrentDate] = useState<Date>(now);
  // Shared state for both views - lifted up from ListView
  const [plantingEvents, setPlantingEvents] = useState<PlantingCalendarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>();
  const [modalInitialPlant, setModalInitialPlant] = useState<Plant | undefined>();

  // Garden Event Modal state
  const [gardenEventModalOpen, setGardenEventModalOpen] = useState(false);
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([]);

  // Maple Tapping Modal state
  const [mapleTappingModalOpen, setMapleTappingModalOpen] = useState(false);

  // Event Detail Modal state
  const [detailEvent, setDetailEvent] = useState<PlantingCalendarType | null>(null);

  // Day Detail Modal state
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Available Spaces state (for Timeline view)
  const [showAvailableSpaces, setShowAvailableSpaces] = useState(false);

  // Bed filter state
  const [selectedBedId, setSelectedBedId] = useState<number | 'all'>('all');

  // Frost dates - fetched from API (defaults are placeholders until API responds)
  const [lastFrostDate, setLastFrostDate] = useState<Date>(new Date(new Date().getFullYear() + '-04-15'));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [firstFrostDate, setFirstFrostDate] = useState<Date>(new Date(new Date().getFullYear() + '-10-15'));
  const [frostDateSource, setFrostDateSource] = useState<'property' | 'zone' | 'zipcode' | 'default' | null>(null);

  // Load view preference from localStorage on mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem('plantingCalendar.viewMode');
    if (savedViewMode === 'list' || savedViewMode === 'grid' || savedViewMode === 'timeline') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('plantingCalendar.viewMode', viewMode);
  }, [viewMode]);

  const soilTempCardRef = useRef<HTMLDivElement | null>(null);
  // Deep-link: when mounted via the soil-temp nav item, scroll the soil card into view.
  useEffect(() => {
    if (initialView === 'soil-temp' && soilTempCardRef.current) {
      soilTempCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialView]);

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDay(date);
  };

  const handlePlantSelect = (plant: Plant) => {
    setModalInitialPlant(plant);
    setModalInitialDate(undefined);
    setModalOpen(true);
  };

  const handleAddEvent = async (event: PlantingCalendarType) => {
    try {
      // Save to API
      const response = await apiPost('/api/planting-events', {
        ...event,
        // Convert dates to ISO strings for API
        seedStartDate: event.seedStartDate?.toISOString(),
        transplantDate: event.transplantDate?.toISOString(),
        directSeedDate: event.directSeedDate?.toISOString(),
        expectedHarvestDate: event.expectedHarvestDate?.toISOString(),
      });

      if (response.ok) {
        const savedEvent = await response.json();
        // Add saved event to local state
        setPlantingEvents(prev => [...prev, savedEvent]);
      } else {
        throw new Error('Failed to save planting event');
      }
    } catch (err) {
      console.error('Error saving planting event:', err);
      setError('Failed to save planting event. Please try again.');
    }
  };

  const handleAddEvents = async (events: PlantingCalendarType[]) => {
    try {
      // Save all events to API in parallel
      const savePromises = events.map(event =>
        apiPost('/api/planting-events', {
          ...event,
          // Convert dates to ISO strings for API
          seedStartDate: event.seedStartDate?.toISOString(),
          transplantDate: event.transplantDate?.toISOString(),
          directSeedDate: event.directSeedDate?.toISOString(),
          expectedHarvestDate: event.expectedHarvestDate?.toISOString(),
        }).then(res => {
          if (!res.ok) throw new Error('Failed to save event');
          return res.json();
        })
      );

      // Wait for all events to save
      const savedEvents = await Promise.all(savePromises);
      // Add all saved events to local state in one update
      setPlantingEvents(prev => [...prev, ...savedEvents]);
    } catch (err) {
      console.error('Error saving planting events:', err);
      setError('Failed to save planting events. Please try again.');
    }
  };

  // Persist sidebar state in localStorage
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('plantingCalendar.sidebarCollapsed');
    if (savedSidebarState !== null) {
      setSidebarOpen(savedSidebarState === 'false');
    } else {
      // Default: closed on mobile, open on desktop
      setSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('plantingCalendar.sidebarCollapsed', String(!sidebarOpen));
  }, [sidebarOpen]);

  // Fetch frost dates from API
  useEffect(() => {
    const fetchFrostDates = async () => {
      try {
        const weatherZip = localStorage.getItem('weatherZipCode');
        const frostUrl = weatherZip ? `/api/frost-dates?zipcode=${encodeURIComponent(weatherZip)}` : '/api/frost-dates';
        const response = await apiGet(frostUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.lastFrostDate) {
            setLastFrostDate(new Date(data.lastFrostDate));
          }
          if (data.firstFrostDate) {
            setFirstFrostDate(new Date(data.firstFrostDate));
          }
          if (data.source) {
            setFrostDateSource(data.source);
          }
        }
      } catch (err) {
        console.error('Failed to load frost dates:', err);
        // Continue with defaults
      }
    };

    fetchFrostDates();
  }, []);

  // Soil temp forecast for cold warnings on calendar events
  const [soilTempForecast, setSoilTempForecast] = useState<Record<string, number>>({});
  // Multi-depth forecast: date -> {depthCm -> temp}
  const [soilTempForecastByDepth, setSoilTempForecastByDepth] = useState<Record<string, Record<number, number>>>({});
  const [plantSoilTemps, setPlantSoilTemps] = useState<Record<string, { soilTempMin: number; transplantSoilTempMin: number | null }>>({});

  // Receive soil temp data from SoilTemperatureCard instead of fetching independently
  const handleSoilDataLoaded = useCallback((data: SoilTempResponse) => {
    // Build date -> soil temp map from forecast (6cm default)
    if (data.soil_temp_forecast) {
      const tempMap: Record<string, number> = {};
      for (const day of data.soil_temp_forecast) {
        if (day.soilTemp != null) {
          tempMap[day.date] = day.soilTemp;
        }
      }
      setSoilTempForecast(tempMap);
    }
    // Build multi-depth forecast: date -> {depth -> temp}
    if (data.forecast_by_depth) {
      const byDepth: Record<string, Record<number, number>> = {};
      for (const [depthStr, days] of Object.entries(data.forecast_by_depth as Record<string, any[]>)) {
        const depth = parseInt(depthStr, 10);
        for (const day of days) {
          if (day.soilTemp != null) {
            if (!byDepth[day.date]) byDepth[day.date] = {};
            byDepth[day.date][depth] = day.soilTemp;
          }
        }
      }
      setSoilTempForecastByDepth(byDepth);
    }
    // Build plantId -> soil temp requirements from crop_readiness + crop_readiness_transplant
    const plantTemps: Record<string, { soilTempMin: number; transplantSoilTempMin: number | null }> = {};
    if (data.crop_readiness_forecast) {
      for (const [pid, info] of Object.entries(data.crop_readiness_forecast as Record<string, any>)) {
        plantTemps[pid] = { soilTempMin: info.min_temp, transplantSoilTempMin: null };
      }
    }
    if (data.crop_readiness_transplant) {
      for (const [pid, info] of Object.entries(data.crop_readiness_transplant as Record<string, any>)) {
        if (plantTemps[pid]) {
          plantTemps[pid].transplantSoilTempMin = info.min_temp;
        } else {
          plantTemps[pid] = { soilTempMin: 0, transplantSoilTempMin: info.min_temp };
        }
      }
    }
    setPlantSoilTemps(plantTemps);
  }, []);

  // Map plant planting depth (inches) to Open-Meteo depth (cm)
  const inchesToDepth = (inches: number | undefined): number => {
    if (inches == null) return 6;
    if (inches <= 0.5) return 0;
    if (inches <= 3.0) return 6;
    return 18;
  };

  // Build a set of weather-warning event markers: eventId -> warning type
  const coldWarnings = useMemo(() => {
    const warnings: Record<string, 'too_cold' | 'marginal' | 'too_hot'> = {};
    const SAFETY_MARGIN = 5;
    const HOT_THRESHOLD_ABOVE_MIN = 20; // matches backend season_validator.py
    const forecastDates = Object.keys(soilTempForecast).sort();
    const todayKey = forecastDates.length > 0 ? forecastDates[0] : null;
    const todayTemp = todayKey ? soilTempForecast[todayKey] : null;

    for (const event of plantingEvents) {
      if (!event.plantId) continue;
      // Skip completed events
      if (event.completed || event.isComplete) continue;
      const temps = plantSoilTemps[event.plantId];
      if (!temps) continue;

      // Check the relevant date for this event type
      const checkDate = event.directSeedDate ?? event.transplantDate;
      if (!checkDate) continue;
      const dateKey = format(new Date(checkDate), 'yyyy-MM-dd');

      // Look up this plant's appropriate depth
      const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
      const depthCm = inchesToDepth(plant?.plantingDepth);

      // Use depth-specific temp if available, fall back to 6cm default
      const depthForecast = soilTempForecastByDepth[dateKey];
      let soilTemp = depthForecast?.[depthCm] ?? soilTempForecast[dateKey];

      // For past/today dates that aren't completed: use today's temp
      if (soilTemp == null && todayKey && dateKey <= todayKey) {
        const todayDepthForecast = soilTempForecastByDepth[todayKey];
        soilTemp = todayDepthForecast?.[depthCm] ?? todayTemp ?? undefined;
      }
      if (soilTemp == null) continue;

      // Use transplant min if it's a transplant event, otherwise seed min
      const isTransplant = !!event.transplantDate && !event.directSeedDate;
      const minTemp = isTransplant
        ? (temps.transplantSoilTempMin ?? temps.soilTempMin)
        : temps.soilTempMin;

      if (soilTemp < minTemp - SAFETY_MARGIN) {
        warnings[`${event.id}`] = 'too_cold';
      } else if (soilTemp < minTemp + SAFETY_MARGIN) {
        warnings[`${event.id}`] = 'marginal';
      }

      // Check too-hot for cool-weather crops (low heat tolerance)
      if (plant?.heatTolerance === 'low' && soilTemp > minTemp + HOT_THRESHOLD_ABOVE_MIN) {
        // Too hot overrides marginal (but not too_cold — cold is more urgent)
        if (warnings[`${event.id}`] !== 'too_cold') {
          warnings[`${event.id}`] = 'too_hot';
        }
      }
    }
    return warnings;
  }, [plantingEvents, soilTempForecast, soilTempForecastByDepth, plantSoilTemps]);

  // Fetch garden beds for garden event modal
  useEffect(() => {
    const fetchGardenBeds = async () => {
      try {
        const response = await apiGet('/api/garden-beds');
        if (response.ok) {
          const data = await response.json();
          setGardenBeds(data);
        }
      } catch (err) {
        console.error('Failed to load garden beds:', err);
      }
    };

    fetchGardenBeds();
  }, []);

  // Fetch planting events from API
  const fetchPlantingEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet('/api/planting-events');
      if (response.ok) {
        const data = await response.json();
        setPlantingEvents(data);
      } else {
        throw new Error('Failed to load planting events');
      }
    } catch (err) {
      console.error('Error loading planting events:', err);
      setError('Failed to load planting events. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlantingEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter events by selected bed
  const filteredEvents = useMemo(() => {
    if (selectedBedId === 'all') return plantingEvents;
    return plantingEvents.filter(e => e.gardenBedId === selectedBedId);
  }, [plantingEvents, selectedBedId]);

  return (
    <>
      <div className="planting-calendar flex flex-col lg:flex-row gap-6">
        {/* Crops Sidebar - Only show in grid view */}
        {viewMode === 'grid' && (
          <CropsSidebar
            onPlantSelect={handlePlantSelect}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Header with View Toggle */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Sidebar toggle for mobile */}
                {viewMode === 'grid' && (
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Menu className="w-5 h-5 text-gray-700" />
                  </button>
                )}
                <h2 className="text-2xl font-bold text-gray-800">Planting Calendar</h2>
              </div>

              {/* View Mode Toggle Buttons + Add Garden Event Button */}
              <div className="flex gap-2">
                <button
                  data-testid="view-toggle-list"
                  onClick={() => setViewMode('list')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                    ${viewMode === 'list'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  data-testid="view-toggle-grid"
                  onClick={() => setViewMode('grid')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                    ${viewMode === 'grid'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </button>
                <button
                  data-testid="view-toggle-timeline"
                  onClick={() => setViewMode('timeline')}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                    ${viewMode === 'timeline'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">Timeline</span>
                </button>

                {/* Add Garden Event Button */}
                <div className="ml-2 pl-2 border-l border-gray-300">
                  <button
                    data-testid="btn-add-garden-event"
                    onClick={() => setGardenEventModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    title="Add garden maintenance events like mulch application"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Garden Event</span>
                  </button>
                </div>

                {/* Add Maple Tapping Button */}
                <div className="ml-2 pl-2 border-l border-gray-300">
                  <button
                    data-testid="btn-add-maple-tapping"
                    onClick={() => setMapleTappingModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    title="Track maple syrup tapping events"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Maple Tapping</span>
                  </button>
                </div>

                {/* Available Spaces Button - Only in Timeline view */}
                {viewMode === 'timeline' && (
                  <button
                    onClick={() => setShowAvailableSpaces(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-2"
                    title="View available planting spaces in your beds"
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="hidden sm:inline">Available Spaces</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bed Filter */}
            {gardenBeds.length > 0 && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200">
                <label htmlFor="bed-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Filter by Bed:
                </label>
                <select
                  id="bed-filter"
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="all">All Beds ({plantingEvents.length} events)</option>
                  {gardenBeds.map(bed => {
                    const count = plantingEvents.filter(e => e.gardenBedId === bed.id).length;
                    return (
                      <option key={bed.id} value={bed.id}>
                        {bed.name} ({count} events)
                      </option>
                    );
                  })}
                </select>
                {selectedBedId !== 'all' && (
                  <button
                    onClick={() => setSelectedBedId('all')}
                    className="text-sm text-green-600 hover:text-green-800 underline"
                  >
                    Show All
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Soil Temperature Card */}
          <div ref={soilTempCardRef}>
            <SoilTemperatureCard plantingEvents={plantingEvents} onDataLoaded={handleSoilDataLoaded} gardenBeds={gardenBeds} calendarBedId={selectedBedId} />
          </div>

          {/* Maple Tapping Season Card */}
          <MapleTappingSeasonCard />

          {/* Frost Date Source Warning */}
          {frostDateSource === 'default' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 font-medium">Using default frost dates (Zone 5b - Milwaukee)</p>
                <p className="text-amber-700 text-sm mt-1">
                  Your property does not have a USDA hardiness zone set. Frost date warnings and planting
                  suggestions are based on Zone 5b defaults (last frost April 15, first frost October 15).
                  To get accurate frost dates for your area, edit your property in the Property Designer and
                  select your USDA hardiness zone.
                </p>
              </div>
            </div>
          )}

          {frostDateSource === 'zipcode' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-800 font-medium">Frost dates based on your weather location</p>
                <p className="text-blue-700 text-sm mt-1">
                  Frost dates are derived from your weather ZIP code. For more precise dates,
                  set your USDA hardiness zone in Property Designer.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading planting events...</p>
            </div>
          ) : (
            <>
              {/* List View */}
              {viewMode === 'list' && (
            <ListView
              plantingEvents={filteredEvents}
              setPlantingEvents={setPlantingEvents}
              lastFrostDate={lastFrostDate}
              firstFrostDate={firstFrostDate}
            />
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <CalendarHeader
                currentDate={currentDate}
                onMonthChange={handleMonthChange}
              />
              <CalendarGrid
                currentDate={currentDate}
                events={filteredEvents}
                coldWarnings={coldWarnings}
                onDateClick={handleDateClick}
                onEventClick={(event) => {
                  setDetailEvent(event);
                }}
                onEventUpdated={fetchPlantingEvents}
              />

              {/* Legend */}
              {filteredEvents.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="font-medium text-gray-700">Event Types:</div>
                    <div className="flex items-center gap-2">
                      <span>🌱</span>
                      <span className="text-gray-600">Start Seeds (Indoor)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🥕</span>
                      <span className="text-gray-600">Direct Seed (Outdoor)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🌿</span>
                      <span className="text-gray-600">Transplant (Outdoor)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🎉</span>
                      <span className="text-gray-600">Harvest</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state for grid view */}
              {filteredEvents.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🌱</div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    No planting events yet
                  </p>
                  <p className="text-gray-500 mb-4">
                    Start planning your garden!
                  </p>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add Your First Event
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="bg-white rounded-lg shadow-md h-[calc(100vh-16rem)]">
              <TimelineView
                onAddCrop={(date, plant) => {
                  setModalInitialDate(date);
                  setModalInitialPlant(plant);
                  setModalOpen(true);
                }}
                onEditEvent={(event) => {
                  // TODO: Implement edit functionality
                }}
                onRefresh={() => {
                  // Timeline manages its own data loading
                }}
                showAvailableSpaces={showAvailableSpaces}
                setShowAvailableSpaces={setShowAvailableSpaces}
              />
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Add Crop Modal */}
      <AddCropModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddEvent={handleAddEvent}
        onAddEvents={handleAddEvents}
        initialDate={modalInitialDate}
        initialPlant={modalInitialPlant}
        lastFrostDate={lastFrostDate}
      />

      {/* Add Garden Event Modal */}
      <AddGardenEventModal
        isOpen={gardenEventModalOpen}
        onClose={() => setGardenEventModalOpen(false)}
        onEventAdded={() => {
          // Refresh planting events to show new garden event
          const fetchPlantingEvents = async () => {
            try {
              const response = await apiGet('/api/planting-events');
              if (response.ok) {
                const data = await response.json();
                setPlantingEvents(data);
              }
            } catch (err) {
              console.error('Failed to reload events:', err);
            }
          };
          fetchPlantingEvents();
        }}
        gardenBeds={gardenBeds}
      />

      {/* Add Maple Tapping Modal */}
      <AddMapleTappingModal
        isOpen={mapleTappingModalOpen}
        onClose={() => setMapleTappingModalOpen(false)}
        onEventAdded={() => {
          // Refresh planting events to show new tapping event
          const fetchPlantingEvents = async () => {
            try {
              const response = await apiGet('/api/planting-events');
              if (response.ok) {
                const data = await response.json();
                setPlantingEvents(data);
              }
            } catch (err) {
              console.error('Failed to reload events:', err);
            }
          };
          fetchPlantingEvents();
        }}
      />

      {/* Day Detail Modal */}
      <DayDetailModal
        isOpen={!!selectedDay}
        date={selectedDay}
        events={plantingEvents}
        onClose={() => setSelectedDay(null)}
        onEventClick={(event) => {
          setSelectedDay(null);
          setDetailEvent(event);
        }}
        onAddEvent={() => {
          setModalInitialDate(selectedDay || undefined);
          setModalInitialPlant(undefined);
          setSelectedDay(null);
          setModalOpen(true);
        }}
        gardenBeds={gardenBeds}
        onEventUpdated={fetchPlantingEvents}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        isOpen={!!detailEvent}
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        gardenBeds={gardenBeds}
        onEventUpdated={fetchPlantingEvents}
        onNavigateToBed={onNavigateToBed}
        coldWarning={detailEvent ? coldWarnings[`${detailEvent.id}`] : undefined}
        soilTempForecast={soilTempForecast}
      />
    </>
  );
};

export default PlantingCalendar;
