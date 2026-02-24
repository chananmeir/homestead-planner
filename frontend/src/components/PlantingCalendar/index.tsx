import React, { useState, useEffect } from 'react';
import { List, Calendar, Menu, Clock, PlusCircle, MapPin } from 'lucide-react';
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
import MapleTappingSeasonCard from './MapleTappingSeasonCard';
import TimelineView from './TimelineView';

const PlantingCalendar: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
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

  // Available Spaces state (for Timeline view)
  const [showAvailableSpaces, setShowAvailableSpaces] = useState(false);

  // Frost dates - fetched from API
  const [lastFrostDate, setLastFrostDate] = useState<Date>(new Date('2024-04-15'));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [firstFrostDate, setFirstFrostDate] = useState<Date>(new Date('2024-10-15'));

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

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleDateClick = (date: Date) => {
    setModalInitialDate(date);
    setModalInitialPlant(undefined);
    setModalOpen(true);
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
        const response = await apiGet('/api/frost-dates');
        if (response.ok) {
          const data = await response.json();
          if (data.lastFrostDate) {
            setLastFrostDate(new Date(data.lastFrostDate));
          }
          if (data.firstFrostDate) {
            setFirstFrostDate(new Date(data.firstFrostDate));
          }
        }
      } catch (err) {
        console.error('Failed to load frost dates:', err);
        // Continue with defaults
      }
    };

    fetchFrostDates();
  }, []);

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
  useEffect(() => {
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

    fetchPlantingEvents();
  }, []);

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
          </div>

          {/* Soil Temperature Card */}
          <SoilTemperatureCard plantingEvents={plantingEvents} />

          {/* Maple Tapping Season Card */}
          <MapleTappingSeasonCard />

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
              plantingEvents={plantingEvents}
              setPlantingEvents={setPlantingEvents}
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
                events={plantingEvents}
                onDateClick={handleDateClick}
                onEventClick={(event) => {
                  // For now, open the add modal with the event's plant and date
                  // TODO: Implement proper edit functionality
                  const plant = PLANT_DATABASE.find(p => p.id === event.plantId);
                  setModalInitialPlant(plant);
                  setModalInitialDate(event.directSeedDate || event.transplantDate || event.expectedHarvestDate);
                  setModalOpen(true);
                }}
              />

              {/* Legend */}
              {plantingEvents.length > 0 && (
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
              {plantingEvents.length === 0 && (
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
    </>
  );
};

export default PlantingCalendar;
