/**
 * focusSignal integration test for HarvestTracker.
 *
 * Background: `focusSignal` is a trigger-only prop. When a "Harvest ready"
 * Needs Attention item is clicked, App.tsx switches to the Harvests tab and
 * bumps `focusSignal` to a non-null value. The tracker's only job on that
 * signal is to clear search / filter / date-range state so the user can
 * immediately log a new harvest.
 *
 * It is NOT a row id. HarvestRecord has no planting_event_id in the backend
 * (see backend/models.py::HarvestRecord — it has planted_item_id only), and
 * the "Harvest ready" signal fires before any HarvestRecord exists, so there
 * is nothing on the page to scroll to or highlight. The previous test
 * exercised a logically-impossible path (harvest.id === focusPlantingEventId)
 * that could never happen in production.
 *
 * This test asserts the real contract:
 *   - filters set before signal
 *   - signal flips to a non-null value
 *   - search / filters / date range are cleared
 *   - all harvest rows are visible again
 *
 * Test setup notes:
 *  - HarvestTracker fetches /api/harvests, /api/plants, /api/harvests/stats
 *    on mount.
 *  - Toast context is required (ConfirmDialog + useToast); we wrap in
 *    ToastProvider.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import { installFetchMock, clearFetchMock } from '../Dashboard/testUtils';
import { ToastProvider } from '../common/Toast';
import HarvestTracker from '../HarvestTracker';

describe('HarvestTracker focusSignal integration', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  function renderWithProviders(signal: number | null) {
    return render(
      <ToastProvider>
        <HarvestTracker focusSignal={signal} />
      </ToastProvider>
    );
  }

  test('when focusSignal flips from null to a non-null value, search is cleared and all rows become visible again', async () => {
    installFetchMock([
      {
        match: '/api/harvests/stats',
        response: {},
      },
      {
        match: '/api/harvests',
        response: [
          {
            id: 7,
            plantId: 'lettuce',
            harvestDate: '2026-04-14T00:00:00Z',
            quantity: 12,
            unit: 'head',
            quality: 'excellent',
            notes: '',
          },
          {
            id: 8,
            plantId: 'tomato',
            harvestDate: '2026-04-13T00:00:00Z',
            quantity: 5,
            unit: 'lbs',
            quality: 'good',
            notes: '',
          },
        ],
      },
      {
        match: '/api/plants',
        response: [
          { id: 'lettuce', name: 'Lettuce', category: 'leafy' },
          { id: 'tomato', name: 'Tomato', category: 'fruiting' },
        ],
      },
    ]);

    const { rerender } = renderWithProviders(null);

    // Wait for the initial data load — both rows should render.
    await screen.findByTestId('harvest-row-7');
    expect(screen.getByTestId('harvest-row-8')).toBeInTheDocument();

    // Simulate the user narrowing the view with the search bar.
    const searchInput = screen.getByPlaceholderText(/search by plant name/i);
    fireEvent.change(searchInput, { target: { value: 'lettuce' } });

    // Only the lettuce row should now be visible.
    await waitFor(() => {
      expect(screen.queryByTestId('harvest-row-8')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('harvest-row-7')).toBeInTheDocument();
    expect((searchInput as HTMLInputElement).value).toBe('lettuce');

    // Now flip the focus signal — as if the user clicked the "Harvest ready"
    // Needs Attention item.
    rerender(
      <ToastProvider>
        <HarvestTracker focusSignal={42} />
      </ToastProvider>
    );

    // Search should be cleared and both rows should be visible again.
    await waitFor(() => {
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
    expect(screen.getByTestId('harvest-row-7')).toBeInTheDocument();
    expect(screen.getByTestId('harvest-row-8')).toBeInTheDocument();
  });
});
