/**
 * ImportFromGardenModal — plan-scope override props (Tier 1 post-export bridge).
 *
 * The Garden Planner's post-export prompt opens this modal scoped to the
 * just-exported plan, which may not be the active plan. These tests guard:
 *  - planIdOverride wins over the active plan when fetching needs-indoor-starts
 *  - planNameOverride is shown in the "Importing from:" header
 *  - without overrides, the active plan still scopes the fetch (regression)
 *
 * Proposal: dev/active/production-readiness-audit/indoor-start-export-bridge-proposal.md
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../contexts/ActivePlanContext', () => ({
  useActivePlan: () => ({
    activePlan: { id: 7, name: 'Active Plan', year: 2026 },
    activePlanId: 7,
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
import { ImportFromGardenModal } from '../IndoorSeedStarts/ImportFromGardenModal';

const noop = () => {};

function renderModal(extraProps: Partial<React.ComponentProps<typeof ImportFromGardenModal>> = {}) {
  return render(
    <ImportFromGardenModal
      isOpen={true}
      onClose={noop}
      onSuccess={noop}
      showSuccess={noop}
      showError={noop}
      {...extraProps}
    />
  );
}

describe('ImportFromGardenModal — plan scope override', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = installFetchMock([
      { match: '/api/planting-events/needs-indoor-starts', response: { events: [], count: 0 } },
    ]);
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  it('fetches with planIdOverride instead of the active plan', async () => {
    renderModal({ planIdOverride: 42, planNameOverride: 'Exported Plan' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(u => u.includes('needs-indoor-starts?planId=42'))).toBe(true);
    expect(urls.some(u => u.includes('planId=7'))).toBe(false);
  });

  it('shows planNameOverride in the header', async () => {
    renderModal({ planIdOverride: 42, planNameOverride: 'Exported Plan' });

    await waitFor(() => {
      expect(screen.getByText('Exported Plan')).toBeInTheDocument();
    });
    expect(screen.queryByText('Active Plan')).not.toBeInTheDocument();
  });

  it('falls back to the active plan when no override is given', async () => {
    renderModal();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(u => u.includes('needs-indoor-starts?planId=7'))).toBe(true);
    expect(screen.getByText('Active Plan')).toBeInTheDocument();
  });
});
