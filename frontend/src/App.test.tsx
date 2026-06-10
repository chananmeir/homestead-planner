/**
 * App.tsx nav restructure smoke tests.
 *
 * Guards the Phase 1 nav contract:
 *  - Default activeTab is 'dashboard' — Dashboard lands on login.
 *  - Top-level nav has 6 groups: Dashboard, Plan, Design, Grow, Track, Manage.
 *  - Clicking a group with sub-items renders the group's landing page with its
 *    first sub-item visible (e.g. Plan → Garden Plans; Design → Garden Designer).
 *
 * To avoid booting the full app (13 heavy tab components, real backend calls),
 * we:
 *  - Mock AuthContext to return an authenticated user.
 *  - Mock ActivePlanContext / SimulationContext to avoid network calls.
 *  - Mock each heavy tab component with a lightweight stand-in that renders a
 *    marker string. This lets us assert which component rendered.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Context mocks — MUST come before App import
// ---------------------------------------------------------------------------
jest.mock('./contexts/AuthContext', () => {
  const actual = jest.requireActual('./contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 1, username: 'tester', email: 't@example.com', isAdmin: false },
      isAuthenticated: true,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
    }),
    AuthProvider: ({ children }: any) => <>{children}</>,
  };
});

jest.mock('./contexts/ActivePlanContext', () => ({
  useActivePlan: () => ({
    activePlan: null,
    activePlanId: null,
    loading: false,
    setActivePlan: jest.fn(),
    setActivePlanById: jest.fn(),
    clearActivePlan: jest.fn(),
    refreshActivePlan: jest.fn(),
    ensureActivePlan: jest.fn(),
    planRefreshKey: 0,
    bumpPlanRefresh: jest.fn(),
  }),
  ActivePlanProvider: ({ children }: any) => <>{children}</>,
}));

jest.mock('./contexts/SimulationContext', () => ({
  useSimulation: () => ({
    isSimulating: false,
    simulatedDate: null,
    realDate: '2026-04-14',
    getNow: () => new Date('2026-04-14T12:00:00'),
    getToday: () => '2026-04-14',
    setSimulatedDate: jest.fn(),
    clearSimulation: jest.fn(),
    advanceDays: jest.fn(),
  }),
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
  SimulationProvider: ({ children }: any) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Component mocks — lightweight stand-ins, each renders a distinct marker
// ---------------------------------------------------------------------------
jest.mock('./components/Dashboard', () => (props: any) => (
  <div>
    <div>MOCK_DASHBOARD</div>
    <button
      type="button"
      onClick={() => props.onNavigate({ kind: 'harvestBed', plantingEventId: 7, bedId: 3 })}
    >
      MOCK_HARVEST_BED_NAV
    </button>
  </div>
));
jest.mock('./components/GardenPlanner', () => () => <div>MOCK_GARDEN_PLANNER</div>);
jest.mock('./components/GardenPlanner/GardenSnapshot', () => () => <div>MOCK_GARDEN_SNAPSHOT</div>);
jest.mock('./components/GardenDesigner', () => (props: any) => (
  <div
    data-testid="mock-garden-designer"
    data-initial-bed-id={props.initialBedId ?? ''}
    data-planting-event-id={props.plantingEventId ?? ''}
  >
    MOCK_GARDEN_DESIGNER
    <button type="button" onClick={props.onPlantingComplete}>
      MOCK_PLANTING_COMPLETE
    </button>
  </div>
));
jest.mock('./components/PropertyDesigner', () => () => <div>MOCK_PROPERTY_DESIGNER</div>);
jest.mock('./components/PlantingCalendar', () => (props: any) => (
  <div data-testid="mock-planting-calendar" data-preferred-view-mode={props.preferredViewMode || ''}>
    MOCK_PLANTING_CALENDAR
  </div>
));
jest.mock('./components/IndoorSeedStarts', () => () => <div>MOCK_INDOOR_STARTS</div>);
jest.mock('./components/WeatherAlerts', () => () => <div>MOCK_WEATHER</div>);
jest.mock('./components/HarvestTracker', () => () => <div>MOCK_HARVESTS</div>);
jest.mock('./components/PhotoGallery', () => () => <div>MOCK_PHOTOS</div>);
jest.mock('./components/NutritionalDashboard', () => () => <div>MOCK_NUTRITION</div>);
jest.mock('./components/SeedsHub', () => () => <div>MOCK_SEEDS</div>);
jest.mock('./components/Livestock', () => () => <div>MOCK_LIVESTOCK</div>);
jest.mock('./components/CompostTracker', () => () => <div>MOCK_COMPOST</div>);
jest.mock('./components/AdminUserManagement', () => () => <div>MOCK_ADMIN</div>);
jest.mock('./components/SimulationToolbar', () => () => <div />);
jest.mock('./components/Auth/LoginModal', () => ({ LoginModal: () => null }));
jest.mock('./components/Auth/RegisterModal', () => ({ RegisterModal: () => null }));
jest.mock('./components/Auth/LoginRequiredMessage', () => ({
  LoginRequiredMessage: () => <div>LOGIN_REQUIRED</div>,
}));

import App from './App';

// ---------------------------------------------------------------------------
// Fetch stub — App.tsx's location-info useEffect reads weatherZipCode from
// localStorage and calls /api/weather/current if present. We don't set a zip,
// but we still install a benign fetch mock to keep console clean.
// ---------------------------------------------------------------------------
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  Object.defineProperty(window, 'open', {
    writable: true,
    value: jest.fn(),
  });
  (global as any).fetch = jest.fn(async () => ({
    ok: false,
    status: 404,
    json: async () => ({}),
  } as any));
});

afterEach(() => {
  delete (global as any).fetch;
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('App.tsx nav restructure', () => {
  test('renders the 6 top-level nav groups', async () => {
    render(<App />);
    // Scope to the nav bar to avoid catching section-landing headings of the
    // same name (e.g. "Plan" appears in both the nav and the landing header).
    const nav = await screen.findByRole('navigation');
    expect(nav).toHaveTextContent('Dashboard');
    expect(nav).toHaveTextContent('Plan');
    expect(nav).toHaveTextContent('Design');
    expect(nav).toHaveTextContent('Grow');
    expect(nav).toHaveTextContent('Track');
    expect(nav).toHaveTextContent('Manage');
  });

  test('default active view is Dashboard', async () => {
    render(<App />);
    expect(await screen.findByText('MOCK_DASHBOARD')).toBeInTheDocument();
  });

  test('clicking the header date opens Planting Calendar in a new tab', async () => {
    render(<App />);
    expect(await screen.findByText('MOCK_DASHBOARD')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Open Planting Calendar for Tue, Apr 14, 2026/ }));
    expect(window.open).toHaveBeenCalledTimes(1);
    const [href, target, features] = (window.open as jest.Mock).mock.calls[0];
    const url = new URL(href);
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(url.searchParams.get('tab')).toBe('planting-calendar');
    expect(url.searchParams.get('group')).toBe('grow');
    expect(url.searchParams.get('calendarView')).toBe('grid');
    expect(screen.queryByText('MOCK_PLANTING_CALENDAR')).not.toBeInTheDocument();
  });

  test('clicking "Plan" opens Garden Plans (first sub-item of the Plan group)', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    const planBtn = Array.from(nav.querySelectorAll('button')).find(b => /Plan/.test(b.textContent || ''));
    expect(planBtn).toBeDefined();
    await userEvent.click(planBtn!);
    expect(await screen.findByText('MOCK_GARDEN_PLANNER')).toBeInTheDocument();
  });

  test('clicking "Design" opens Garden Designer (first sub-item of Design)', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    const designBtn = Array.from(nav.querySelectorAll('button')).find(b => /Design/.test(b.textContent || ''));
    await userEvent.click(designBtn!);
    expect(await screen.findByText('MOCK_GARDEN_DESIGNER')).toBeInTheDocument();
  });

  test('Needs Attention harvest bed target opens Garden Designer in a new tab with bed focus', async () => {
    render(<App />);
    expect(await screen.findByText('MOCK_DASHBOARD')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /MOCK_HARVEST_BED_NAV/ }));

    expect(window.open).toHaveBeenCalledTimes(1);
    const [href, target, features] = (window.open as jest.Mock).mock.calls[0];
    const url = new URL(href);
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    expect(url.searchParams.get('tab')).toBe('designer');
    expect(url.searchParams.get('group')).toBe('design');
    expect(url.searchParams.get('bedId')).toBe('3');
    expect(url.searchParams.has('plantingEventId')).toBe(false);
    expect(screen.queryByText('MOCK_GARDEN_DESIGNER')).not.toBeInTheDocument();
  });

  test('deep-linked Garden Designer URL restores bed focus in the new tab', async () => {
    window.history.replaceState({}, '', '/?tab=designer&group=design&bedId=3&plantingEventId=7');
    render(<App />);

    const designer = await screen.findByTestId('mock-garden-designer');
    expect(designer).toHaveAttribute('data-initial-bed-id', '3');
    expect(designer).toHaveAttribute('data-planting-event-id', '7');
  });

  test('planting-mode completion clears the planting event from the current URL', async () => {
    window.history.replaceState({}, '', '/?tab=designer&group=design&bedId=3&plantingEventId=7');
    render(<App />);

    expect(await screen.findByTestId('mock-garden-designer')).toHaveAttribute('data-planting-event-id', '7');

    await userEvent.click(screen.getByRole('button', { name: /MOCK_PLANTING_COMPLETE/ }));

    expect(window.location.search).toContain('bedId=3');
    expect(window.location.search).not.toContain('plantingEventId');
    expect(await screen.findByTestId('mock-garden-designer')).toHaveAttribute('data-planting-event-id', '');
  });

  test('returning to Dashboard clears bed-focused Designer navigation state', async () => {
    window.history.replaceState({}, '', '/?tab=designer&group=design&bedId=3&plantingEventId=7');
    render(<App />);

    expect(await screen.findByTestId('mock-garden-designer')).toHaveAttribute('data-planting-event-id', '7');

    const nav = await screen.findByRole('navigation');
    const dashboardBtn = Array.from(nav.querySelectorAll('button')).find(b => /Dashboard/.test(b.textContent || ''));
    await userEvent.click(dashboardBtn!);
    expect(await screen.findByText('MOCK_DASHBOARD')).toBeInTheDocument();

    const designBtn = Array.from(nav.querySelectorAll('button')).find(b => /Design/.test(b.textContent || ''));
    await userEvent.click(designBtn!);

    const genericDesigner = await screen.findByTestId('mock-garden-designer');
    expect(genericDesigner).toHaveAttribute('data-initial-bed-id', '');
    expect(genericDesigner).toHaveAttribute('data-planting-event-id', '');
  });

  test('deep-linked Planting Calendar URL restores requested grid view in the new tab', async () => {
    window.history.replaceState({}, '', '/?tab=planting-calendar&group=grow&calendarView=grid');
    render(<App />);

    expect(await screen.findByText('MOCK_PLANTING_CALENDAR')).toBeInTheDocument();
    expect(screen.getByTestId('mock-planting-calendar')).toHaveAttribute('data-preferred-view-mode', 'grid');
  });

  test('clicking "Grow" opens Planting Calendar (first sub-item of Grow)', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    const growBtn = Array.from(nav.querySelectorAll('button')).find(b => /Grow/.test(b.textContent || ''));
    await userEvent.click(growBtn!);
    expect(await screen.findByText('MOCK_PLANTING_CALENDAR')).toBeInTheDocument();
  });

  test('clicking "Track" opens Harvests (first sub-item of Track)', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    const trackBtn = Array.from(nav.querySelectorAll('button')).find(b => /Track/.test(b.textContent || ''));
    await userEvent.click(trackBtn!);
    expect(await screen.findByText('MOCK_HARVESTS')).toBeInTheDocument();
  });

  test('clicking "Manage" opens Seeds (first sub-item of Manage)', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    const manageBtn = Array.from(nav.querySelectorAll('button')).find(b => /Manage/.test(b.textContent || ''));
    await userEvent.click(manageBtn!);
    expect(await screen.findByText('MOCK_SEEDS')).toBeInTheDocument();
  });

  test('Plan group shows a section-landing with both sub-items', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    const planBtn = Array.from(nav.querySelectorAll('button')).find(b => /Plan/.test(b.textContent || ''));
    await userEvent.click(planBtn!);
    // Section landing tabs include both Plan items
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Garden Plans/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Garden Snapshot/ })).toBeInTheDocument();
    });
  });
});
