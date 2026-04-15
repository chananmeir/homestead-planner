import React, { useState, useEffect } from 'react';
import './App.css';
import GardenPlanner from './components/GardenPlanner';
import WeatherAlerts from './components/WeatherAlerts';
import CompostTracker from './components/CompostTracker';
import GardenDesigner from './components/GardenDesigner';
import PropertyDesigner from './components/PropertyDesigner';
import Livestock from './components/Livestock';
import HarvestTracker from './components/HarvestTracker';
import PhotoGallery from './components/PhotoGallery';
import SeedsHub from './components/SeedsHub';
import NutritionalDashboard from './components/NutritionalDashboard';
import AdminUserManagement from './components/AdminUserManagement';
import Dashboard from './components/Dashboard';
import GardenSnapshot from './components/GardenPlanner/GardenSnapshot';
import IndoorSeedStarts from './components/IndoorSeedStarts';
import PlantingCalendar from './components/PlantingCalendar';
import { ToastProvider, ErrorBoundary } from './components/common';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ActivePlanProvider } from './contexts/ActivePlanContext';
import { SimulationProvider, useSimulation } from './contexts/SimulationContext';
import SimulationToolbar from './components/SimulationToolbar';
import { parseLocalDate } from './utils/dateUtils';
import { LoginModal } from './components/Auth/LoginModal';
import { RegisterModal } from './components/Auth/RegisterModal';
import { LoginRequiredMessage } from './components/Auth/LoginRequiredMessage';
import { API_BASE_URL } from './config';

// Preserved internal tab keys — each represents an existing module.
type Tab =
  | 'dashboard'
  | 'garden'
  | 'designer'
  | 'property'
  | 'livestock'
  | 'weather'
  | 'compost'
  | 'harvests'
  | 'photos'
  | 'seeds'
  | 'nutrition'
  | 'admin'
  | 'snapshot'
  | 'indoor-starts'
  | 'planting-calendar'
  | 'soil-temp';

type NavGroupId = 'dashboard' | 'plan' | 'design' | 'grow' | 'track' | 'manage' | 'admin';

interface NavSubItem {
  id: Tab;
  name: string;
  icon: string;
  description?: string;
}

interface NavGroup {
  id: NavGroupId;
  name: string;
  icon: string;
  description: string;
  items?: NavSubItem[]; // undefined for Dashboard (direct view)
}

const NAV_GROUPS: NavGroup[] = [
  { id: 'dashboard', name: 'Dashboard', icon: '🏡', description: 'Your homestead today' },
  {
    id: 'plan',
    name: 'Plan',
    icon: '📋',
    description: 'Map out the season — what to grow, how much, and when.',
    items: [
      { id: 'garden', name: 'Garden Plans', icon: '🌱', description: 'Manage plans and season targets' },
      { id: 'snapshot', name: 'Garden Snapshot', icon: '📸', description: 'What is in the ground on any date' },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    icon: '🎨',
    description: 'Lay out beds, structures, and property features.',
    items: [
      { id: 'designer', name: 'Garden Designer', icon: '🎨', description: 'Arrange plantings on your grid' },
      { id: 'property', name: 'Property Designer', icon: '🗺️', description: 'Site-wide layout and zones' },
    ],
  },
  {
    id: 'grow',
    name: 'Grow',
    icon: '🌿',
    description: 'Day-to-day cultivation — calendar, indoor starts, soil, weather.',
    items: [
      { id: 'planting-calendar', name: 'Planting Calendar', icon: '📅', description: 'Timeline of all planting events' },
      { id: 'indoor-starts', name: 'Indoor Starts', icon: '🪴', description: 'Track seed starts indoors' },
      { id: 'soil-temp', name: 'Soil Temperature', icon: '🌡️', description: 'Planting readiness by soil temp' },
      { id: 'weather', name: 'Weather & Alerts', icon: '🌤️', description: 'Forecast and frost/heat alerts' },
    ],
  },
  {
    id: 'track',
    name: 'Track',
    icon: '📊',
    description: 'Capture outcomes — yields, photos, and nutrition.',
    items: [
      { id: 'harvests', name: 'Harvests', icon: '🧺', description: 'Log harvests by crop and bed' },
      { id: 'photos', name: 'Photos', icon: '📷', description: 'Photo journal of the garden' },
      { id: 'nutrition', name: 'Nutrition', icon: '🥗', description: 'Nutritional yield from your garden' },
    ],
  },
  {
    id: 'manage',
    name: 'Manage',
    icon: '🗂️',
    description: 'Inventory and ongoing systems.',
    items: [
      { id: 'seeds', name: 'Seeds', icon: '🌾', description: 'Seed inventory and catalog' },
      { id: 'livestock', name: 'Livestock', icon: '🐔', description: 'Animals and production tracking' },
      { id: 'compost', name: 'Compost', icon: '♻️', description: 'Compost batches and additions' },
    ],
  },
];

function AppContent() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { getToday, isSimulating } = useSimulation();
  const headerDateLabel = parseLocalDate(getToday()).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [activeGroup, setActiveGroup] = useState<NavGroupId>('dashboard');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const [locationInfo, setLocationInfo] = useState<{ zipCode: string; zone: string; city: string } | null>(null);
  const [designerBedId, setDesignerBedId] = useState<number | null>(null);
  const [designerDate, setDesignerDate] = useState<string | null>(null);
  const [transplantSeedStartId, setTransplantSeedStartId] = useState<number | null>(null);
  const [plantingEventId, setPlantingEventId] = useState<number | null>(null);

  // Build nav groups including conditional Admin.
  const navGroups: NavGroup[] = [
    ...NAV_GROUPS,
    ...(user?.isAdmin ? [{ id: 'admin' as NavGroupId, name: 'Admin', icon: '⚙️', description: 'User administration' }] : []),
  ];

  // Location info effect — preserved from previous App.tsx
  useEffect(() => {
    if (!user) {
      setLocationInfo(null);
      return;
    }
    const zipCode = localStorage.getItem('weatherZipCode');
    if (!zipCode) {
      setLocationInfo(null);
      return;
    }
    const fetchZone = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/weather/current?zipcode=${zipCode}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setLocationInfo({
            zipCode,
            zone: data.location?.zone || '',
            city: data.location?.city || '',
          });
        }
      } catch {
        setLocationInfo({ zipCode, zone: '', city: '' });
      }
    };
    fetchZone();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'weatherZipCode' && e.newValue) {
        setLocationInfo(prev => prev ? { ...prev, zipCode: e.newValue! } : null);
      }
    };
    const handleZipChanged = async (e: Event) => {
      const newZip = (e as CustomEvent).detail;
      if (newZip) {
        setLocationInfo({ zipCode: newZip, zone: '', city: '' });
        try {
          const resp = await fetch(
            `${API_BASE_URL}/api/weather/current?zipcode=${newZip}`,
            { credentials: 'include' }
          );
          if (resp.ok) {
            const data = await resp.json();
            setLocationInfo({
              zipCode: newZip,
              zone: data.location?.zone || '',
              city: data.location?.city || '',
            });
          }
        } catch { /* zip already shown */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('weatherZipCodeChanged', handleZipChanged);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('weatherZipCodeChanged', handleZipChanged);
    };
  }, [user]);

  // When activeTab changes, clear transient designer navigation state unless staying in designer.
  const goToTab = (tab: Tab, group?: NavGroupId) => {
    if (tab !== 'designer') {
      setDesignerBedId(null);
      setDesignerDate(null);
      setTransplantSeedStartId(null);
    }
    setActiveTab(tab);
    if (group) setActiveGroup(group);
  };

  // Navigate directly to a group, selecting first sub-item (or dashboard/admin for direct groups).
  const selectGroup = (groupId: NavGroupId) => {
    setActiveGroup(groupId);
    if (groupId === 'dashboard') {
      goToTab('dashboard', 'dashboard');
      return;
    }
    if (groupId === 'admin') {
      goToTab('admin', 'admin');
      return;
    }
    const group = navGroups.find(g => g.id === groupId);
    const first = group?.items?.[0];
    if (first) goToTab(first.id, groupId);
  };

  // Shortcut helpers for Dashboard buttons (sets both group + tab).
  const nav = {
    openGardenDesigner: () => goToTab('designer', 'design'),
    openPlantingCalendar: () => goToTab('planting-calendar', 'grow'),
    openGardenPlans: () => goToTab('garden', 'plan'),
    openSeasonPlanner: () => goToTab('garden', 'plan'),
    openWeather: () => goToTab('weather', 'grow'),
    openSeeds: () => goToTab('seeds', 'manage'),
    openLivestock: () => goToTab('livestock', 'manage'),
    openCompost: () => goToTab('compost', 'manage'),
    openHarvests: () => goToTab('harvests', 'track'),
    openPhotos: () => goToTab('photos', 'track'),
    openIndoorStarts: () => goToTab('indoor-starts', 'grow'),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-green-700">Loading...</div>
      </div>
    );
  }

  // For full-viewport tabs, skip container padding and show chromeless.
  const isFullViewport = activeTab === 'designer' || activeTab === 'property';
  const currentGroup = navGroups.find(g => g.id === activeGroup);
  const showSectionLanding =
    !!currentGroup?.items && currentGroup.items.length > 0 && activeGroup !== 'dashboard' && activeGroup !== 'admin';

  return (
    <>
      <div className={`bg-gradient-to-br from-green-50 to-blue-50 ${
        isFullViewport ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'
      }`}>
        {/* Header */}
        <header className="bg-green-700 text-white shadow-lg flex-shrink-0">
          <div className="container mx-auto px-4 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Homestead Tracker</h1>
              <p className="text-green-100 mt-1">
                Complete Homestead Planning • Garden Design • Livestock • Year-Round Growing
              </p>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <div
                    className={`hidden sm:flex items-center gap-1.5 text-sm text-green-100 px-3 py-1 rounded-full ${
                      isSimulating ? 'bg-amber-500/20 ring-1 ring-amber-300/40' : 'bg-green-800/40'
                    }`}
                    title={isSimulating ? 'Simulated date' : "Today's date"}
                  >
                    <span aria-hidden>📅</span>
                    <span>{headerDateLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-green-100">Welcome, {user?.username}</span>
                    {locationInfo && (
                      <p className="text-green-200 text-xs">
                        {locationInfo.city && `${locationInfo.city} · `}
                        {locationInfo.zipCode}
                        {locationInfo.zone && ` · Zone ${locationInfo.zone}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowLogin(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setShowRegister(true)}
                    className="px-4 py-2 bg-white text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Top-level Navigation (grouped) */}
        <nav className="bg-white shadow-md border-b flex-shrink-0">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap">
              {navGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => selectGroup(group.id)}
                  className={`px-6 py-4 font-medium transition-colors border-b-2 ${
                    activeGroup === group.id
                      ? 'border-green-600 text-green-700 bg-green-50'
                      : 'border-transparent text-gray-600 hover:text-green-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2" aria-hidden="true">{group.icon}</span>
                  {group.name}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className={
          isFullViewport ? 'flex-1 overflow-hidden' : 'container mx-auto px-4 py-8'
        }>
          {!isAuthenticated ? (
            <LoginRequiredMessage onLoginClick={() => setShowLogin(true)} />
          ) : (
            <>
              {/* Section landing for groups with sub-nav */}
              {showSectionLanding && currentGroup && (
                <div className="mb-6">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{currentGroup.name}</h2>
                    <p className="text-gray-600 mt-1 text-sm">{currentGroup.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-0">
                    {currentGroup.items!.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => goToTab(sub.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                          activeTab === sub.id
                            ? 'border-green-600 text-green-700 bg-green-50'
                            : 'border-transparent text-gray-600 hover:text-green-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="mr-1.5" aria-hidden="true">{sub.icon}</span>
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dashboard */}
              {activeTab === 'dashboard' && <Dashboard {...nav} />}

              {/* Plan group */}
              {activeTab === 'garden' && <GardenPlanner />}
              {activeTab === 'snapshot' && <GardenSnapshot />}

              {/* Design group */}
              {activeTab === 'designer' && (
                <GardenDesigner
                  initialBedId={designerBedId}
                  initialDate={designerDate}
                  transplantSeedStartId={transplantSeedStartId}
                  onTransplantComplete={() => setTransplantSeedStartId(null)}
                  plantingEventId={plantingEventId}
                  onPlantingComplete={() => setPlantingEventId(null)}
                />
              )}
              {activeTab === 'property' && <PropertyDesigner />}

              {/* Grow group */}
              {activeTab === 'planting-calendar' && (
                <PlantingCalendar onNavigateToBed={(bedId, date, seedStartId, eventId) => {
                  setDesignerBedId(bedId);
                  setDesignerDate(date || null);
                  setTransplantSeedStartId(seedStartId || null);
                  setPlantingEventId(eventId || null);
                  goToTab('designer', 'design');
                }} />
              )}
              {activeTab === 'indoor-starts' && (
                <IndoorSeedStarts onNavigateToBed={(bedId, date, seedStartId) => {
                  setDesignerBedId(bedId);
                  setDesignerDate(date || null);
                  setTransplantSeedStartId(seedStartId || null);
                  goToTab('designer', 'design');
                }} />
              )}
              {activeTab === 'soil-temp' && (
                <PlantingCalendar
                  initialView="soil-temp"
                  onNavigateToBed={(bedId, date, seedStartId, eventId) => {
                    setDesignerBedId(bedId);
                    setDesignerDate(date || null);
                    setTransplantSeedStartId(seedStartId || null);
                    setPlantingEventId(eventId || null);
                    goToTab('designer', 'design');
                  }}
                />
              )}
              {activeTab === 'weather' && <WeatherAlerts />}

              {/* Track group */}
              {activeTab === 'harvests' && <HarvestTracker />}
              {activeTab === 'photos' && <PhotoGallery />}
              {activeTab === 'nutrition' && <NutritionalDashboard />}

              {/* Manage group */}
              {activeTab === 'seeds' && <SeedsHub />}
              {activeTab === 'livestock' && <Livestock />}
              {activeTab === 'compost' && <CompostTracker />}

              {/* Admin */}
              {activeTab === 'admin' && user?.isAdmin && <AdminUserManagement />}
            </>
          )}
        </main>

        {/* Footer — hidden for full-viewport tabs */}
        {!isFullViewport && (
          <footer className="bg-gray-800 text-gray-300 mt-12">
            <div className="container mx-auto px-4 py-6 text-center">
              <p>
                Inspired by the techniques of Eliot Coleman &amp; Nico Jabour
              </p>
            </div>
          </footer>
        )}
      </div>

      {/* Auth Modals */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToRegister={() => {
          setShowLogin(false);
          setShowRegister(true);
        }}
      />
      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onSwitchToLogin={() => {
          setShowRegister(false);
          setShowLogin(true);
        }}
      />
      <SimulationToolbar />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SimulationProvider>
        <AuthProvider>
          <ToastProvider>
            <ActivePlanProvider>
              <AppContent />
            </ActivePlanProvider>
          </ToastProvider>
        </AuthProvider>
      </SimulationProvider>
    </ErrorBoundary>
  );
}

export default App;
