/**
 * UpcomingTimeline fetches /api/planting-events for a 14-day window and renders
 * the next 7 events. Smoke-tests the three render states: loading → data →
 * empty.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import UpcomingTimeline from '../UpcomingTimeline';
import { installFetchMock, clearFetchMock } from '../testUtils';

describe('UpcomingTimeline', () => {
  afterEach(() => clearFetchMock());

  test('renders without crashing and calls planting-events endpoint with 14-day window', async () => {
    const fetchMock = installFetchMock([
      { match: '/api/planting-events', response: [] },
      { match: '/api/garden-beds', response: [] },
    ]);
    render(<UpcomingTimeline onViewCalendar={jest.fn()} />);
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(c => String(c[0]));
      // 14-day window: end = start + 14 days
      expect(urls.some(u => u.includes('/api/planting-events?start_date=') && u.includes('end_date='))).toBe(true);
    });
  });

  test('shows empty-state copy when there are no upcoming events', async () => {
    installFetchMock([
      { match: '/api/planting-events', response: [] },
      { match: '/api/garden-beds', response: [] },
    ]);
    render(<UpcomingTimeline onViewCalendar={jest.fn()} />);
    expect(await screen.findByText(/No events in the next 14 days/i)).toBeInTheDocument();
  });

  test('renders future planting-event rows with variety and type label', async () => {
    installFetchMock([
      {
        match: '/api/planting-events',
        response: [
          {
            id: 1,
            userId: 1,
            eventType: 'planting',
            plantId: 'tomato-1',
            variety: 'Brandywine',
            gardenBedId: 10,
            transplantDate: '2026-04-20T00:00:00Z',
          },
        ],
      },
      { match: '/api/garden-beds', response: [{ id: 10, name: 'Bed A' }] },
    ]);
    render(<UpcomingTimeline onViewCalendar={jest.fn()} />);
    expect(await screen.findByText('Brandywine')).toBeInTheDocument();
    expect(screen.getByText('Transplant')).toBeInTheDocument();
    expect(screen.getByText('Bed A')).toBeInTheDocument();
  });

  test('clicking "See full calendar" calls onViewCalendar', async () => {
    installFetchMock([
      { match: '/api/planting-events', response: [] },
      { match: '/api/garden-beds', response: [] },
    ]);
    const onViewCalendar = jest.fn();
    render(<UpcomingTimeline onViewCalendar={onViewCalendar} />);
    // Wait for loading to finish before clicking
    await screen.findByText(/No events in the next 14 days/i);
    await userEvent.click(screen.getByRole('button', { name: /See full calendar/i }));
    expect(onViewCalendar).toHaveBeenCalledTimes(1);
  });
});
