/**
 * Focus-prop integration test for CompostTracker.
 *
 * Verifies that when focusPileId changes to a matching pile id, the pile card's
 * scrollIntoView is called and the amber highlight ring class is applied.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import { installFetchMock, clearFetchMock } from '../Dashboard/testUtils';
import CompostTracker from '../CompostTracker';

describe('CompostTracker focus integration', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('when focusPileId matches a pile id, scrollIntoView is called and ring class applies', async () => {
    installFetchMock([
      {
        match: '/api/compost-piles',
        response: [
          {
            id: 5,
            name: 'Main Pile',
            location: 'Backyard',
            startDate: '2026-03-01T00:00:00Z',
            size: { width: 3, length: 3, height: 3 },
            ingredients: [],
            estimatedReadyDate: '2026-07-01T00:00:00Z',
            moisture: 'ideal',
            carbonNitrogenRatio: 30,
            status: 'cooking',
          },
        ],
      },
    ]);

    const { rerender } = render(
      <CompostTracker focusPileId={null} onFocusConsumed={() => {}} />
    );

    // Pile card should render after fetch completes.
    const card = await screen.findByTestId('compost-pile-5');
    expect(card).toBeInTheDocument();
    expect((Element.prototype as any).scrollIntoView).not.toHaveBeenCalled();

    // Flip focus to the pile id.
    rerender(<CompostTracker focusPileId={5} onFocusConsumed={() => {}} />);

    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    const highlighted = screen.getByTestId('compost-pile-5');
    expect(highlighted.className).toMatch(/ring-2/);
    expect(highlighted.className).toMatch(/ring-amber-400/);
  });
});
