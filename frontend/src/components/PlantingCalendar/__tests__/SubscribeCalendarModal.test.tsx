/**
 * Tests for SubscribeCalendarModal — the .ics feed subscription dialog.
 * Verifies the feed URL loads from /api/calendar/feed-info and that
 * regeneration swaps in the new secret URL.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubscribeCalendarModal from '../SubscribeCalendarModal';

const FEED_INFO = {
  feedPath: '/api/calendar/feed/secret-token-1.ics',
  feedUrl: 'http://localhost:5051/api/calendar/feed/secret-token-1.ics',
};
const REGENERATED = {
  feedPath: '/api/calendar/feed/secret-token-2.ics',
  feedUrl: 'http://localhost:5051/api/calendar/feed/secret-token-2.ics',
};

beforeEach(() => {
  global.fetch = jest.fn(async (url: any, options?: any) => {
    const href = String(url);
    if (href.includes('/api/calendar/feed-token/regenerate')) {
      return { ok: true, json: async () => REGENERATED } as Response;
    }
    if (href.includes('/api/calendar/feed-info')) {
      return { ok: true, json: async () => FEED_INFO } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SubscribeCalendarModal', () => {
  test('loads and displays the secret feed URL when opened', async () => {
    render(<SubscribeCalendarModal isOpen onClose={jest.fn()} />);

    const input = await screen.findByTestId('ics-feed-url');
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe(FEED_INFO.feedUrl);
    });
    // Provider instructions render alongside.
    expect(screen.getByText(/Google Calendar:/)).toBeInTheDocument();
  });

  test('renders nothing when closed', () => {
    render(<SubscribeCalendarModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('subscribe-calendar-modal')).toBeNull();
  });

  test('regenerate flow requires confirmation and swaps in the new URL', async () => {
    render(<SubscribeCalendarModal isOpen onClose={jest.fn()} />);
    await screen.findByTestId('ics-feed-url');

    fireEvent.click(screen.getByText(/Regenerate secret URL/));
    fireEvent.click(screen.getByText('Yes, regenerate'));

    await waitFor(() => {
      const input = screen.getByTestId('ics-feed-url') as HTMLInputElement;
      expect(input.value).toBe(REGENERATED.feedUrl);
    });
  });
});
