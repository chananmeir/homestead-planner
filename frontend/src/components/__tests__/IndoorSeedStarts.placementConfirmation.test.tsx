/**
 * Placement-confirmation tests for IndoorSeedStarts cards.
 *
 * After a user completes the AUDIT-013 cell-picker flow, IndoorSeedStart.status
 * flips from 'growing' → 'transplanted'. Before this fix, the card silently
 * dropped the "Plan Placement" button with no positive-confirmation affordance,
 * leaving users with the impression "nothing happened".
 *
 * These tests guard:
 *  - status === 'transplanted' renders the green ✓ confirmation with bed name.
 *  - status === 'growing' does NOT render the confirmation; "Plan Placement"
 *    button still appears (regression guard for the conditional render).
 *  - status === 'transplanted' but no destinationBedDetails → fallback copy.
 *
 * Decision: dev/active/production-readiness-audit/indoor-start-post-placement-state-decision.md
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

jest.mock('../../contexts/ActivePlanContext', () => ({
  useActivePlan: () => ({
    activePlan: null,
    activePlanId: null,
    loading: false,
    setActivePlan: () => {},
    setActivePlanById: async () => {},
    clearActivePlan: () => {},
    refreshActivePlan: async () => {},
    ensureActivePlan: async () => null,
    planRefreshKey: 0,
    bumpPlanRefresh: () => {},
  }),
}));

import { installFetchMock, clearFetchMock } from '../Dashboard/testUtils';
import { ToastProvider } from '../common/Toast';
import IndoorSeedStarts from '../IndoorSeedStarts';

describe('IndoorSeedStarts placement confirmation', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  function renderComponent() {
    return render(
      <ToastProvider>
        <IndoorSeedStarts onNavigateToBed={() => {}} />
      </ToastProvider>
    );
  }

  test('status="transplanted" with destinationBedDetails renders the ✓ confirmation with bed name', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: { events: [], count: 0 },
      },
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 77,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01',
            seedsStarted: 12,
            status: 'transplanted',
            destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
          },
        ],
      },
      {
        match: '/api/plants',
        response: [{ id: 'tomato', name: 'Tomato', icon: '🍅' }],
      },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent();

    const confirmation = await screen.findByTestId('iss-placement-confirmation-77');
    expect(confirmation).toBeInTheDocument();
    expect(confirmation.textContent).toContain('✓');
    expect(confirmation.textContent).toContain('Placed in Bed Iota');
    // Visual treatment: green success palette per codebase convention.
    expect(confirmation.className).toMatch(/bg-green-50/);
    expect(confirmation.className).toMatch(/text-green-700/);
    expect(confirmation.className).toMatch(/border-green-200/);

    // Regression: "Plan Placement" button must NOT render for transplanted.
    expect(screen.queryByText(/Plan Placement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Transplant Now/i)).not.toBeInTheDocument();
  });

  test('status="growing" does NOT render the confirmation and keeps "Plan Placement" button', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: { events: [], count: 0 },
      },
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 88,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01',
            seedsStarted: 12,
            status: 'growing',
            destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
          },
        ],
      },
      {
        match: '/api/plants',
        response: [{ id: 'tomato', name: 'Tomato', icon: '🍅' }],
      },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent();

    // Wait for card to render so we know fetch resolved.
    await screen.findByTestId('iss-card-88');

    expect(screen.queryByTestId('iss-placement-confirmation-88')).not.toBeInTheDocument();

    // The "Plan Placement" CTA is what the user expects on a growing card —
    // confirm the actions row still wires to onNavigateToBed by label.
    expect(screen.getByText(/Plan Placement/i)).toBeInTheDocument();
  });

  test('status="transplanted" with no destinationBedDetails falls back to "Placement chosen"', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: { events: [], count: 0 },
      },
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 99,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01',
            seedsStarted: 12,
            status: 'transplanted',
            // No destinationBedDetails / destinationBeds — fallback path.
          },
        ],
      },
      {
        match: '/api/plants',
        response: [{ id: 'tomato', name: 'Tomato', icon: '🍅' }],
      },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent();

    const confirmation = await screen.findByTestId('iss-placement-confirmation-99');
    expect(confirmation).toBeInTheDocument();
    expect(confirmation.textContent).toContain('✓');
    expect(confirmation.textContent).toContain('Placement chosen');
    // Bed-specific copy is intentionally absent here.
    expect(confirmation.textContent).not.toMatch(/Placed in/);
  });

  test('status="failed" does NOT render the confirmation', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: { events: [], count: 0 },
      },
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 66,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01',
            seedsStarted: 12,
            status: 'failed',
            destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
          },
        ],
      },
      {
        match: '/api/plants',
        response: [{ id: 'tomato', name: 'Tomato', icon: '🍅' }],
      },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent();

    await screen.findByTestId('iss-card-66');
    await waitFor(() => {
      expect(
        screen.queryByTestId('iss-placement-confirmation-66')
      ).not.toBeInTheDocument();
    });
  });
});
