import React, { useState, useEffect } from 'react';
import GardenPlanner from './components/GardenPlanner';
import WeatherAlerts from './components/WeatherAlerts';
import CompostTracker from './components/CompostTracker';
import GardenDesigner from './components/GardenDesigner';
import GardenAssistant from './components/GardenAssistant/GardenAssistant';
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
import UserSettings from './components/UserSettings';
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
import type { NeedsAttentionTarget } from './components/Dashboard/types';

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
  | 'soil-temp'
  | 'settings';

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

interface IndoorStartFocusTarget {
  indoorSeedStartIds: number[];
  plantingEventIds: number[];
}

type CalendarViewModeRequest = { mode: 'grid'; requestId: number };

const collectNumberIds = (...groups: Array<ReadonlyArray<number | null | undefined> | undefined>): number[] => {
  const ids = new Set<number>();
  for (const group of groups) {
    for (const value of group || []) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        ids.add(value);
      }
    }
  }
  return Array.from(ids);
};

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
      { id: 'settings', name: 'Settings', icon: '⚙️', description: 'Preferences and reminder thresholds' },
    ],
  },
];

const TAB_TO_GROUP: Record<Tab, NavGroupId> = {
  dashboard: 'dashboard',
  garden: 'plan',
  snapshot: 'plan',
  designer: 'design',
  property: 'design',
  'planting-calendar': 'grow',
  'indoor-starts': 'grow',
  'soil-temp': 'grow',
  weather: 'grow',
  harvests: 'track',
  photos: 'track',
  nutrition: 'track',
  seeds: 'manage',
  livestock: 'manage',
  compost: 'manage',
  settings: 'manage',
  admin: 'admin',
};

const VALID_TABS = new Set<Tab>(Object.keys(TAB_TO_GROUP) as Tab[]);
const VALID_GROUPS = new Set<NavGroupId>(['dashboard', 'plan', 'design', 'grow', 'track', 'manage', 'admin']);

interface AppRouteState {
  activeGroup: NavGroupId;
  activeTab: Tab;
  designerBedId: number | null;
  designerDate: string | null;
  transplantSeedStartId: number | null;
  plantingEventId: number | null;
  harvestFocusId: number | null;
  harvestFocusIds: number[];
  seedFocusId: number | null;
  compostFocusId: number | null;
  indoorStartFocusId: number | null;
  indoorStartFocusTarget: IndoorStartFocusTarget | null;
  livestockFocusType: string | null;
  calendarFocusEventId: number | null;
  calendarViewModeRequest: CalendarViewModeRequest | null;
}

interface AppRouteDestination {
  tab: Tab;
  group?: NavGroupId;
  bedId?: number | null;
  date?: string | null;
  seedStartId?: number | null;
  plantingEventId?: number | null;
  harvestFocusId?: number | null;
  harvestFocusIds?: number[];
  seedId?: number | null;
  compostPileId?: number | null;
  indoorSeedStartId?: number | null;
  indoorSeedStartIds?: number[];
  plantingEventIds?: number[];
  livestockType?: string | null;
  calendarEventId?: number | null;
  calendarViewMode?: 'grid';
}

const defaultAppRouteState = (): AppRouteState => ({
  activeGroup: 'dashboard',
  activeTab: 'dashboard',
  designerBedId: null,
  designerDate: null,
  transplantSeedStartId: null,
  plantingEventId: null,
  harvestFocusId: null,
  harvestFocusIds: [],
  seedFocusId: null,
  compostFocusId: null,
  indoorStartFocusId: null,
  indoorStartFocusTarget: null,
  livestockFocusType: null,
  calendarFocusEventId: null,
  calendarViewModeRequest: null,
});

const readNumberParam = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const readNumberListParam = (params: URLSearchParams, key: string): number[] => {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => Number(part.trim()))
    .filter(value => Number.isFinite(value));
};

const parseInitialAppRoute = (): AppRouteState => {
  const route = defaultAppRouteState();
  const params = new URLSearchParams(window.location.search);

  const tabParam = params.get('tab') as Tab | null;
  if (tabParam && VALID_TABS.has(tabParam)) {
    route.activeTab = tabParam;
    route.activeGroup = TAB_TO_GROUP[tabParam];
  }

  const groupParam = params.get('group') as NavGroupId | null;
  if (groupParam && VALID_GROUPS.has(groupParam)) {
    route.activeGroup = groupParam;
  }

  route.designerBedId = readNumberParam(params, 'bedId');
  route.designerDate = params.get('date') || params.get('designerDate');
  route.transplantSeedStartId = readNumberParam(params, 'seedStartId');
  route.plantingEventId = readNumberParam(params, 'plantingEventId');
  route.harvestFocusId = readNumberParam(params, 'harvestFocusId');
  route.harvestFocusIds = collectNumberIds(
    [route.harvestFocusId],
    readNumberListParam(params, 'harvestFocusIds')
  );
  if (route.harvestFocusId == null && route.harvestFocusIds.length > 0) {
    route.harvestFocusId = route.harvestFocusIds[0];
  }
  route.seedFocusId = readNumberParam(params, 'seedId');
  route.compostFocusId = readNumberParam(params, 'compostPileId');
  route.livestockFocusType = params.get('livestockType');
  route.calendarFocusEventId = readNumberParam(params, 'calendarEventId');
  route.calendarViewModeRequest = params.get('calendarView') === 'grid'
    ? { mode: 'grid', requestId: 1 }
    : null;

  const indoorSeedStartId = readNumberParam(params, 'indoorSeedStartId');
  const indoorSeedStartIds = collectNumberIds(
    [indoorSeedStartId],
    readNumberListParam(params, 'indoorSeedStartIds')
  );
  const plantingEventIds = readNumberListParam(params, 'plantingEventIds');
  if (indoorSeedStartIds.length > 0 || plantingEventIds.length > 0) {
    route.indoorStartFocusId = indoorSeedStartIds[0] ?? plantingEventIds[0] ?? null;
    route.indoorStartFocusTarget = { indoorSeedStartIds, plantingEventIds };
  }

  return route;
};

const setNumberParam = (params: URLSearchParams, key: string, value: number | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    params.set(key, String(value));
  }
};

const setNumberListParam = (params: URLSearchParams, key: string, values: number[] | undefined) => {
  const cleanValues = collectNumberIds(values);
  if (cleanValues.length > 0) {
    params.set(key, cleanValues.join(','));
  }
};

const buildAppDestinationUrl = (destination: AppRouteDestination): string => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  const params = url.searchParams;

  params.set('tab', destination.tab);
  params.set('group', destination.group || TAB_TO_GROUP[destination.tab]);
  setNumberParam(params, 'bedId', destination.bedId);
  if (destination.date) params.set('date', destination.date);
  setNumberParam(params, 'seedStartId', destination.seedStartId);
  setNumberParam(params, 'plantingEventId', destination.plantingEventId);
  setNumberParam(params, 'harvestFocusId', destination.harvestFocusId);
  setNumberListParam(params, 'harvestFocusIds', destination.harvestFocusIds);
  setNumberParam(params, 'seedId', destination.seedId);
  setNumberParam(params, 'compostPileId', destination.compostPileId);
  setNumberParam(params, 'indoorSeedStartId', destination.indoorSeedStartId);
  setNumberListParam(params, 'indoorSeedStartIds', destination.indoorSeedStartIds);
  setNumberListParam(params, 'plantingEventIds', destination.plantingEventIds);
  if (destination.livestockType) params.set('livestockType', destination.livestockType);
  setNumberParam(params, 'calendarEventId', destination.calendarEventId);
  if (destination.calendarViewMode) params.set('calendarView', destination.calendarViewMode);

  return url.toString();
};

function AppContent() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { getToday, isSimulating } = useSimulation();
  const initialAppRoute = React.useMemo(parseInitialAppRoute, []);
  const headerDateLabel = parseLocalDate(getToday()).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [activeGroup, setActiveGroup] = useState<NavGroupId>(initialAppRoute.activeGroup);
  const [activeTab, setActiveTab] = useState<Tab>(initialAppRoute.activeTab);

  const [locationInfo, setLocationInfo] = useState<{
    zipCode: string; zone: string; city: string;
    weatherTemp?: number; weatherConditions?: string; weatherIcon?: string;
  } | null>(null);
  const [designerBedId, setDesignerBedId] = useState<number | null>(initialAppRoute.designerBedId);
  const [designerDate, setDesignerDate] = useState<string | null>(initialAppRoute.designerDate);
  const [transplantSeedStartId, setTransplantSeedStartId] = useState<number | null>(initialAppRoute.transplantSeedStartId);
  const [plantingEventId, setPlantingEventId] = useState<number | null>(initialAppRoute.plantingEventId);

  // Phase B: focus-state atoms for Needs Attention deep-links. Destinations
  // will consume these in Phase C; here we only plumb them through.
  const [harvestFocusId, setHarvestFocusId] = useState<number | null>(initialAppRoute.harvestFocusId);
  const [harvestFocusIds, setHarvestFocusIds] = useState<number[]>(initialAppRoute.harvestFocusIds);
  const [seedFocusId, setSeedFocusId] = useState<number | null>(initialAppRoute.seedFocusId);
  const [compostFocusId, setCompostFocusId] = useState<number | null>(initialAppRoute.compostFocusId);
  const [indoorStartFocusId, setIndoorStartFocusId] = useState<number | null>(initialAppRoute.indoorStartFocusId);
  const [indoorStartFocusTarget, setIndoorStartFocusTarget] = useState<IndoorStartFocusTarget | null>(initialAppRoute.indoorStartFocusTarget);
  const [livestockFocusType, setLivestockFocusType] = useState<string | null>(initialAppRoute.livestockFocusType);
  const [calendarFocusEventId, setCalendarFocusEventId] = useState<number | null>(initialAppRoute.calendarFocusEventId);
  const [calendarViewModeRequest, setCalendarViewModeRequest] = useState<CalendarViewModeRequest | null>(initialAppRoute.calendarViewModeRequest);

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
            weatherTemp: data.weather?.temperature,
            weatherConditions: data.weather?.conditions,
            weatherIcon: data.weather?.icon,
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
              weatherTemp: data.weather?.temperature,
              weatherConditions: data.weather?.conditions,
              weatherIcon: data.weather?.icon,
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

  // Clear transient designer navigation state when leaving Designer, or when
  // entering Designer through generic nav instead of an explicit deep link.
  const goToTab = (tab: Tab, group?: NavGroupId) => {
    if (tab !== 'designer' || activeTab !== 'designer') {
      setDesignerBedId(null);
      setDesignerDate(null);
      setTransplantSeedStartId(null);
      setPlantingEventId(null);
    }
    // Phase B: clear focus atoms for tabs we're leaving. Clearing them all on
    // every tab switch is simple and prevents stale state.
    if (tab !== 'harvests') {
      setHarvestFocusId(null);
      setHarvestFocusIds([]);
    }
    if (tab !== 'seeds') setSeedFocusId(null);
    if (tab !== 'compost') setCompostFocusId(null);
    if (tab !== 'indoor-starts') {
      setIndoorStartFocusId(null);
      setIndoorStartFocusTarget(null);
    }
    if (tab !== 'livestock') setLivestockFocusType(null);
    if (tab !== 'planting-calendar' && tab !== 'soil-temp') setCalendarFocusEventId(null);
    setActiveTab(tab);
    if (group) setActiveGroup(group);
  };

  const openAppDestination = (destination: AppRouteDestination) => {
    window.open(buildAppDestinationUrl(destination), '_blank', 'noopener,noreferrer');
  };

  const clearDesignerPlantingEvent = () => {
    setPlantingEventId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('plantingEventId')) {
      url.searchParams.delete('plantingEventId');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const openPlantingCalendarGrid = () => {
    openAppDestination({
      tab: 'planting-calendar',
      group: 'grow',
      calendarViewMode: 'grid',
    });
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

  // Needs Attention router: opens a deep-linked browser tab so the Dashboard
  // remains available for reference while the destination view receives focus.
  const handleNeedsAttentionNavigate = (target: NeedsAttentionTarget) => {
    switch (target.kind) {
      case 'harvest': {
        const targetHarvestFocusIds = collectNumberIds(
          [target.plantingEventId],
          target.plantingEventIds
        );
        openAppDestination({
          tab: 'harvests',
          group: 'track',
          harvestFocusId: target.plantingEventId,
          harvestFocusIds: targetHarvestFocusIds,
        });
        return;
      }
      case 'harvestBed':
        openAppDestination({
          tab: 'designer',
          group: 'design',
          bedId: target.bedId,
        });
        return;
      case 'indoorStart':
      case 'indoorGerminationCheck': {
        const indoorSeedStartIds = collectNumberIds(
          [target.indoorSeedStartId],
          target.indoorSeedStartIds
        );
        const plantingEventIds = collectNumberIds(
          [target.plantingEventId],
          target.plantingEventIds
        );
        openAppDestination({
          tab: 'indoor-starts',
          group: 'grow',
          indoorSeedStartId: indoorSeedStartIds[0] ?? null,
          indoorSeedStartIds,
          plantingEventIds,
        });
        return;
      }
      case 'transplant':
        if (target.bedId != null) {
          openAppDestination({
            tab: 'designer',
            group: 'design',
            bedId: target.bedId,
            plantingEventId: target.plantingEventId,
          });
        } else {
          openAppDestination({
            tab: 'planting-calendar',
            group: 'grow',
            calendarEventId: target.plantingEventId,
          });
        }
        return;
      case 'germinationCheck':
        if (target.bedId != null) {
          openAppDestination({
            tab: 'designer',
            group: 'design',
            bedId: target.bedId,
            plantingEventId: target.plantingEventId,
          });
        } else {
          openAppDestination({
            tab: 'planting-calendar',
            group: 'grow',
            calendarEventId: target.plantingEventId,
          });
        }
        return;
      case 'directSeed':
        if (target.bedId != null) {
          openAppDestination({
            tab: 'designer',
            group: 'design',
            bedId: target.bedId,
            plantingEventId: target.plantingEventId,
          });
        } else {
          openAppDestination({
            tab: 'planting-calendar',
            group: 'grow',
            calendarEventId: target.plantingEventId,
          });
        }
        return;
      case 'placePlantedItem':
        if (target.bedId != null) {
          openAppDestination({
            tab: 'designer',
            group: 'design',
            bedId: target.bedId,
          });
        } else {
          openAppDestination({ tab: 'designer', group: 'design' });
        }
        return;
      case 'compost':
        openAppDestination({
          tab: 'compost',
          group: 'manage',
          compostPileId: target.pileId,
        });
        return;
      case 'seedLow':
      case 'seedExpiring':
        openAppDestination({
          tab: 'seeds',
          group: 'manage',
          seedId: target.seedId,
        });
        return;
      case 'livestock':
        openAppDestination({
          tab: 'livestock',
          group: 'manage',
          livestockType: target.type,
        });
        return;
      case 'weatherFrost':
      case 'weatherRain':
        openAppDestination({ tab: 'weather', group: 'grow' });
        return;
      default: {
        // Exhaustiveness guard — TS will fail if a new NeedsAttentionTarget
        // kind is added without a matching case above.
        const _exhaustive: never = target;
        return _exhaustive;
      }
    }
  };

  // Shortcut helpers for Dashboard action buttons.
  const nav = {
    openGardenDesigner: () => openAppDestination({ tab: 'designer', group: 'design' }),
    openPlantingCalendar: () => openAppDestination({ tab: 'planting-calendar', group: 'grow' }),
    openGardenPlans: () => openAppDestination({ tab: 'garden', group: 'plan' }),
    openSeasonPlanner: () => openAppDestination({ tab: 'garden', group: 'plan' }),
    openWeather: () => openAppDestination({ tab: 'weather', group: 'grow' }),
    openSeeds: () => openAppDestination({ tab: 'seeds', group: 'manage' }),
    openLivestock: () => openAppDestination({ tab: 'livestock', group: 'manage' }),
    openCompost: () => openAppDestination({ tab: 'compost', group: 'manage' }),
    openHarvests: () => openAppDestination({ tab: 'harvests', group: 'track' }),
    openPhotos: () => openAppDestination({ tab: 'photos', group: 'track' }),
    openIndoorStarts: () => openAppDestination({ tab: 'indoor-starts', group: 'grow' }),
    onNavigate: handleNeedsAttentionNavigate,
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
      <div
        className={`bg-gradient-to-br from-green-50 to-blue-50 transition-[padding] duration-200 ${
          isFullViewport ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'
        }`}
        // The Garden Assistant is a fixed-position panel on the right edge.
        // Pad by its current width so no page content sits underneath it —
        // content there would be both covered and unclickable. The variable is
        // published by GardenAssistant and is 0px whenever it is not mounted.
        style={{ paddingRight: 'var(--assistant-inset, 0px)' }}
      >
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
                  <button
                    type="button"
                    onClick={openPlantingCalendarGrid}
                    className={`hidden sm:flex items-center gap-1.5 text-sm text-green-100 px-3 py-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/70 ${
                      isSimulating ? 'bg-amber-500/20 ring-1 ring-amber-300/40 hover:bg-amber-500/30' : 'bg-green-800/40 hover:bg-green-800/60'
                    }`}
                    title={isSimulating ? 'Simulated date - open Planting Calendar' : "Today's date - open Planting Calendar"}
                    aria-label={`Open Planting Calendar for ${headerDateLabel}`}
                  >
                    <span aria-hidden>📅</span>
                    <span>{headerDateLabel}</span>
                  </button>
                  <div className="text-right">
                    <span className="text-green-100">Welcome, {user?.username}</span>
                    {locationInfo && (
                      <>
                        <p className="text-green-200 text-xs">
                          {locationInfo.city && `${locationInfo.city} · `}
                          {locationInfo.zipCode}
                          {locationInfo.zone && ` · Zone ${locationInfo.zone}`}
                        </p>
                        {locationInfo.weatherTemp != null && (
                          <p className="text-green-200 text-xs">
                            {locationInfo.weatherIcon} {Math.round(locationInfo.weatherTemp)}°F {locationInfo.weatherConditions}
                          </p>
                        )}
                      </>
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
          isFullViewport ? 'flex-1 min-h-0 overflow-hidden flex flex-col' : 'container mx-auto px-4 py-8'
        }>
          {!isAuthenticated ? (
            <LoginRequiredMessage onLoginClick={() => setShowLogin(true)} />
          ) : (
            <>
              {/* Section landing for groups with sub-nav */}
              {showSectionLanding && currentGroup && (
                <div className={isFullViewport ? 'mb-6 flex-shrink-0' : 'mb-6'}>
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
                <div className="flex-1 min-h-0">
                  <GardenDesigner
                    initialBedId={designerBedId}
                    initialDate={designerDate}
                    transplantSeedStartId={transplantSeedStartId}
                    onTransplantComplete={() => setTransplantSeedStartId(null)}
                    plantingEventId={plantingEventId}
                    onPlantingComplete={clearDesignerPlantingEvent}
                  />
                </div>
              )}
              {activeTab === 'property' && (
                <div className="flex-1 min-h-0">
                  <PropertyDesigner />
                </div>
              )}

              {/* Grow group */}
              {activeTab === 'planting-calendar' && (
                <PlantingCalendar
                  preferredViewMode={calendarViewModeRequest?.mode}
                  preferredViewModeRequestId={calendarViewModeRequest?.requestId}
                  onPreferredViewModeConsumed={() => setCalendarViewModeRequest(null)}
                  focusPlantingEventId={calendarFocusEventId}
                  onNavigateToBed={(bedId, date, seedStartId, eventId) => {
                    openAppDestination({
                      tab: 'designer',
                      group: 'design',
                      bedId,
                      date,
                      seedStartId,
                      plantingEventId: eventId,
                    });
                  }}
                />
              )}
              {activeTab === 'indoor-starts' && (
                <IndoorSeedStarts
                  focusIndoorStartId={indoorStartFocusId}
                  focusIndoorStartTarget={indoorStartFocusTarget}
                  onNavigateToBed={(bedId, date, seedStartId) => {
                    openAppDestination({
                      tab: 'designer',
                      group: 'design',
                      bedId,
                      date,
                      seedStartId,
                    });
                  }}
                />
              )}
              {activeTab === 'soil-temp' && (
                <PlantingCalendar
                  initialView="soil-temp"
                  focusPlantingEventId={calendarFocusEventId}
                  onNavigateToBed={(bedId, date, seedStartId, eventId) => {
                    openAppDestination({
                      tab: 'designer',
                      group: 'design',
                      bedId,
                      date,
                      seedStartId,
                      plantingEventId: eventId,
                    });
                  }}
                />
              )}
              {activeTab === 'weather' && <WeatherAlerts />}

              {/* Track group */}
              {activeTab === 'harvests' && (
                <HarvestTracker
                  focusSignal={harvestFocusId}
                  focusPlantingEventIds={harvestFocusIds}
                />
              )}
              {activeTab === 'photos' && <PhotoGallery />}
              {activeTab === 'nutrition' && <NutritionalDashboard />}

              {/* Manage group */}
              {activeTab === 'seeds' && <SeedsHub focusSeedId={seedFocusId} />}
              {activeTab === 'livestock' && <Livestock focusType={livestockFocusType} />}
              {activeTab === 'compost' && <CompostTracker focusPileId={compostFocusId} />}
              {activeTab === 'settings' && <UserSettings />}

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
      {isAuthenticated && <GardenAssistant />}
      {/* <SimulationToolbar /> — Time Machine deactivated */}
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
