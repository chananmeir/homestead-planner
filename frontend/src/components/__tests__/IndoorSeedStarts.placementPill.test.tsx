/**
 * Placement-pill tests for IndoorSeedStarts cards.
 *
 * The placement pill answers, at a glance, "does this seed start have a
 * spot in the garden or not?" Per product Model 1 ("Placement means
 * transplant now"), only status='transplanted' starts have a confirmed
 * cell in a bed — every other lifecycle state shows "no spot".
 *
 * Decision: dev/active/production-readiness-audit/indoor-start-pending-placement-not-visible-in-bed-finding.md
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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

const PLANTS_RESPONSE = [{ id: 'tomato', name: 'Tomato', icon: '🍅' }];

function renderComponent(onNavigateToBed = () => {}) {
  return render(
    <ToastProvider>
      <IndoorSeedStarts onNavigateToBed={onNavigateToBed} />
    </ToastProvider>
  );
}

function installStart(start: Record<string, unknown>) {
  installFetchMock([
    {
      match: '/api/planting-events/needs-indoor-starts',
      response: { events: [], count: 0 },
    },
    {
      match: '/api/indoor-seed-starts',
      response: [start],
    },
    { match: '/api/plants', response: PLANTS_RESPONSE },
    { match: '/api/seeds', response: [] },
  ]);
}

describe('IndoorSeedStarts placement pill', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('shows germinated seedlings remaining to plant', async () => {
    installStart({
      id: 110,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      seedsStarted: 20,
      seedsGerminated: 15,
      placedCount: 3,
      remainingToPlant: 12,
      status: 'growing',
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent();

    const remaining = await screen.findByTestId('iss-remaining-to-plant-110');
    expect(remaining).toHaveTextContent('12 of 15 remaining to plant');
    expect(remaining).toHaveAttribute('title', '3 planted in planned beds');
  });

  test('status="transplanted" shows the green "has spot" pill', async () => {
    installStart({
      id: 101,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      seedsStarted: 12,
      status: 'transplanted',
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent();

    const pill = await screen.findByTestId('iss-placement-pill-101');
    expect(pill.textContent).toContain('has spot');
    expect(pill.textContent).toContain('✓');
    expect(pill.className).toMatch(/bg-green-100/);
    expect(pill.className).toMatch(/text-green-800/);
  });

  test.each(['planned', 'seeded', 'germinating', 'growing', 'hardening'])(
    'status="%s" shows the amber "no spot" pill',
    async (status) => {
      installStart({
        id: 102,
        plantId: 'tomato',
        variety: 'Cherokee Purple',
        startDate: '2026-04-01',
        seedsStarted: 12,
        status,
        destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
      });

      renderComponent();

      const pill = await screen.findByTestId('iss-placement-pill-102');
      expect(pill.textContent).toContain('no spot');
      expect(pill.textContent).toContain('⚠');
      expect(pill.className).toMatch(/bg-amber-100/);
      expect(pill.className).toMatch(/text-amber-800/);
    }
  );

  test('non-transplanted start with hasPlannedPlacement shows the green "has spot" pill', async () => {
    installStart({
      id: 108,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      seedsStarted: 12,
      status: 'growing',
      hasPlannedPlacement: true,
      plantingEventId: 456,
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent();

    const pill = await screen.findByTestId('iss-placement-pill-108');
    expect(pill.textContent).toContain('has spot');
    expect(pill.className).toMatch(/bg-green-100/);
    expect(pill.className).toMatch(/text-green-800/);
  });

  test('non-transplanted start with no destination bed still shows "no spot"', async () => {
    // Even without a destination bed assigned, the placement pill answers
    // the cell-level question. "No spot" is correct here too.
    installStart({
      id: 103,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      seedsStarted: 12,
      status: 'planned',
    });

    renderComponent();

    const pill = await screen.findByTestId('iss-placement-pill-103');
    expect(pill.textContent).toContain('no spot');
  });

  test('status="failed" suppresses the placement pill entirely', async () => {
    installStart({
      id: 104,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      seedsStarted: 12,
      status: 'failed',
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent();

    // Wait for the card to mount so we know the fetch resolved.
    await screen.findByTestId('iss-card-104');
    expect(screen.queryByTestId('iss-placement-pill-104')).not.toBeInTheDocument();
  });

  test('"has spot" pill coexists with the green Placed-in-bed banner for transplanted starts', async () => {
    // The pill is at-a-glance; the banner is the post-placement confirmation
    // affordance. Both should appear together so users can scan AND read.
    installStart({
      id: 105,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      seedsStarted: 12,
      status: 'transplanted',
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent();

    await screen.findByTestId('iss-placement-pill-105');
    expect(screen.getByTestId('iss-placement-confirmation-105')).toBeInTheDocument();
  });

  test('overdue Plan Placement opens Designer on today instead of the missed transplant date', async () => {
    const onNavigateToBed = jest.fn();
    installStart({
      id: 106,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      expectedTransplantDate: '2026-04-10',
      seedsStarted: 12,
      status: 'growing',
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent(onNavigateToBed);

    fireEvent.click(await screen.findByRole('button', { name: 'Plan Placement' }));

    expect(onNavigateToBed).toHaveBeenCalledWith(9, '2026-04-14', 106);
  });

  test('future Plan Placement still opens Designer on the scheduled transplant date', async () => {
    const onNavigateToBed = jest.fn();
    installStart({
      id: 107,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      expectedTransplantDate: '2026-04-20T00:00:00',
      seedsStarted: 12,
      status: 'growing',
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent(onNavigateToBed);

    fireEvent.click(await screen.findByRole('button', { name: 'Plan Placement' }));

    expect(onNavigateToBed).toHaveBeenCalledWith(9, '2026-04-20', 107);
  });

  test('planned placement shows View Planned Spot and does not re-enter picker mode', async () => {
    const onNavigateToBed = jest.fn();
    installStart({
      id: 109,
      plantId: 'tomato',
      variety: 'Cherokee Purple',
      startDate: '2026-04-01',
      expectedTransplantDate: '2026-04-20T00:00:00',
      seedsStarted: 12,
      status: 'growing',
      hasPlannedPlacement: true,
      plantingEventId: 456,
      destinationBedDetails: [{ id: 9, name: 'Bed Iota' }],
    });

    renderComponent(onNavigateToBed);

    expect(await screen.findByRole('button', { name: 'View Planned Spot' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plan Placement' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Planned Spot' }));

    expect(onNavigateToBed).toHaveBeenCalledWith(9, '2026-04-20', undefined);
  });
});
