/**
 * ActivePlanCard tests.
 *
 * Verifies:
 *  - Renders "No active plan yet" empty state when no plan
 *  - Renders plan name + action buttons when plan present
 *  - "Open Garden" / "View Calendar" / "Add Event" buttons call the correct
 *    navigation handlers (each handler maps to an activeTab switch in App.tsx)
 *
 * Context mocking: we stub the Active Plan + Simulation contexts so the real
 * providers (which hit the backend on mount) don't run.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mock contexts BEFORE component import ---
jest.mock('../../../contexts/ActivePlanContext', () => ({
  useActivePlan: jest.fn(),
}));
jest.mock('../../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import ActivePlanCard from '../ActivePlanCard';
import { useActivePlan } from '../../../contexts/ActivePlanContext';
import { installFetchMock, clearFetchMock, makePlan } from '../testUtils';

const mockUseActivePlan = useActivePlan as jest.Mock;

function renderCard() {
  const handlers = {
    onOpenGarden: jest.fn(),
    onViewCalendar: jest.fn(),
    onAddEvent: jest.fn(),
    onManagePlans: jest.fn(),
  };
  render(<ActivePlanCard {...handlers} />);
  return handlers;
}

describe('ActivePlanCard', () => {
  afterEach(() => {
    clearFetchMock();
    jest.clearAllMocks();
  });

  test('renders "No active plan yet" when no plan is active', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: null, loading: false });
    installFetchMock();
    renderCard();
    expect(await screen.findByText(/No active plan yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Plan/i })).toBeInTheDocument();
  });

  test('renders loading skeleton when plan context is loading', () => {
    mockUseActivePlan.mockReturnValue({ activePlan: null, loading: true });
    installFetchMock();
    const { container } = render(
      <ActivePlanCard
        onOpenGarden={jest.fn()}
        onViewCalendar={jest.fn()}
        onAddEvent={jest.fn()}
        onManagePlans={jest.fn()}
      />
    );
    // Pulse placeholders are rendered when loading
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  test('renders the active plan name and year', async () => {
    mockUseActivePlan.mockReturnValue({
      activePlan: makePlan({ name: 'Spring Trial', year: 2026, season: 'spring' }),
      loading: false,
    });
    installFetchMock([
      { match: '/api/garden-beds', response: [] },
      { match: '/api/planting-events', response: [] },
    ]);
    renderCard();
    expect(await screen.findByText('Spring Trial')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  test('clicking "Open Garden" calls onOpenGarden (maps to designer tab)', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: makePlan(), loading: false });
    installFetchMock([
      { match: '/api/garden-beds', response: [] },
      { match: '/api/planting-events', response: [] },
    ]);
    const handlers = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /Open Garden/i }));
    expect(handlers.onOpenGarden).toHaveBeenCalledTimes(1);
  });

  test('clicking "View Calendar" calls onViewCalendar (maps to planting-calendar tab)', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: makePlan(), loading: false });
    installFetchMock([
      { match: '/api/garden-beds', response: [] },
      { match: '/api/planting-events', response: [] },
    ]);
    const handlers = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /^View Calendar$/i }));
    expect(handlers.onViewCalendar).toHaveBeenCalledTimes(1);
  });

  test('clicking "Add Event" calls onAddEvent', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: makePlan(), loading: false });
    installFetchMock([
      { match: '/api/garden-beds', response: [] },
      { match: '/api/planting-events', response: [] },
    ]);
    const handlers = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /^Add Event$/i }));
    expect(handlers.onAddEvent).toHaveBeenCalledTimes(1);
  });

  test('clicking "Create Plan" (empty state) calls onManagePlans', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: null, loading: false });
    installFetchMock();
    const handlers = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /Create Plan/i }));
    expect(handlers.onManagePlans).toHaveBeenCalledTimes(1);
  });

  test('fetches garden-beds and planting-events when a plan is active', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: makePlan(), loading: false });
    const fetchMock = installFetchMock([
      { match: '/api/garden-beds', response: [{ id: 1, name: 'Bed A' }] },
      { match: '/api/planting-events', response: [] },
    ]);
    renderCard();
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(call => String(call[0]));
      expect(urls.some(u => u.includes('/api/garden-beds'))).toBe(true);
      expect(urls.some(u => u.includes('/api/planting-events'))).toBe(true);
    });
  });
});
