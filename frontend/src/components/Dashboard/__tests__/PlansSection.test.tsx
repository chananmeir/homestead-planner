/**
 * PlansSection tests.
 *
 * Verifies:
 *  - Empty state ("No other plans yet.")
 *  - Chips render for other plans (excluding the active one)
 *  - Clicking a chip calls setActivePlan (from ActivePlanContext)
 *  - "+ New Plan" button calls onManagePlans
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../contexts/ActivePlanContext', () => ({
  useActivePlan: jest.fn(),
}));

import PlansSection from '../PlansSection';
import { useActivePlan } from '../../../contexts/ActivePlanContext';
import { installFetchMock, clearFetchMock, makePlan } from '../testUtils';

const mockUseActivePlan = useActivePlan as jest.Mock;

describe('PlansSection', () => {
  afterEach(() => {
    clearFetchMock();
    jest.clearAllMocks();
  });

  test('shows "No other plans yet." when only the active plan exists', async () => {
    const activePlan = makePlan({ id: 1, name: 'Current' });
    mockUseActivePlan.mockReturnValue({ activePlan, setActivePlan: jest.fn() });
    installFetchMock([{ match: '/api/garden-plans', response: [activePlan] }]);
    render(<PlansSection onManagePlans={jest.fn()} />);
    expect(await screen.findByText(/No other plans yet/i)).toBeInTheDocument();
  });

  test('renders chips for other plans (excluding active)', async () => {
    const activePlan = makePlan({ id: 1, name: 'Current', year: 2026 });
    const other1 = makePlan({ id: 2, name: 'Fall Experiment', year: 2025 });
    const other2 = makePlan({ id: 3, name: 'Cover Crop Plan', year: 2024 });
    mockUseActivePlan.mockReturnValue({ activePlan, setActivePlan: jest.fn() });
    installFetchMock([
      { match: '/api/garden-plans', response: [activePlan, other1, other2] },
    ]);
    render(<PlansSection onManagePlans={jest.fn()} />);
    expect(await screen.findByText('Fall Experiment')).toBeInTheDocument();
    expect(screen.getByText('Cover Crop Plan')).toBeInTheDocument();
    // Active plan chip should NOT appear in the "Other plans" list — only as the
    // active indicator line. The chip buttons have title="Make X active".
    expect(screen.queryByTitle('Make Current active')).not.toBeInTheDocument();
  });

  test('caps visible chips at 4 and shows "Show all" when more exist', async () => {
    const activePlan = makePlan({ id: 1, name: 'Current' });
    const others = Array.from({ length: 6 }, (_, i) =>
      makePlan({ id: i + 2, name: `Plan ${i + 1}`, year: 2020 + i })
    );
    mockUseActivePlan.mockReturnValue({ activePlan, setActivePlan: jest.fn() });
    installFetchMock([
      { match: '/api/garden-plans', response: [activePlan, ...others] },
    ]);
    render(<PlansSection onManagePlans={jest.fn()} />);
    await screen.findByRole('button', { name: /Show all \(6\)/i });
    // Count how many chip buttons exist (their title starts with "Make ")
    const chips = screen.getAllByTitle(/^Make Plan /);
    expect(chips).toHaveLength(4);
  });

  test('clicking a chip calls setActivePlan with that plan', async () => {
    const setActivePlan = jest.fn();
    const activePlan = makePlan({ id: 1, name: 'Current' });
    const other = makePlan({ id: 2, name: 'Other Plan', year: 2025 });
    mockUseActivePlan.mockReturnValue({ activePlan, setActivePlan });
    installFetchMock([{ match: '/api/garden-plans', response: [activePlan, other] }]);
    render(<PlansSection onManagePlans={jest.fn()} />);
    const chip = await screen.findByRole('button', { name: /Other Plan/i });
    await userEvent.click(chip);
    expect(setActivePlan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: 'Other Plan' })
    );
  });

  test('"+ New Plan" button calls onManagePlans', async () => {
    mockUseActivePlan.mockReturnValue({ activePlan: null, setActivePlan: jest.fn() });
    installFetchMock([{ match: '/api/garden-plans', response: [] }]);
    const onManagePlans = jest.fn();
    render(<PlansSection onManagePlans={onManagePlans} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ New Plan/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ New Plan/i }));
    expect(onManagePlans).toHaveBeenCalledTimes(1);
  });
});
