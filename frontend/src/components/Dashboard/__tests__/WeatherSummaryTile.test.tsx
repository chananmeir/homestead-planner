/**
 * WeatherSummaryTile tests — two primary render paths:
 *   1. No zip code stored → shows "Set up →" prompt, does NOT call fetch
 *   2. Zip code stored → fetches current + forecast, renders temps + chips
 *
 * Zip code is read from localStorage at mount time, so tests must seed it
 * before rendering.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WeatherSummaryTile from '../WeatherSummaryTile';
import { installFetchMock, clearFetchMock } from '../testUtils';

describe('WeatherSummaryTile', () => {
  afterEach(() => {
    clearFetchMock();
    localStorage.clear();
  });

  test('renders "Set up →" prompt when no zip code is configured', () => {
    const fetchMock = installFetchMock();
    render(<WeatherSummaryTile onOpenWeather={jest.fn()} />);
    expect(screen.getByText(/Set your zip code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set up/i })).toBeInTheDocument();
    // No fetch should fire without a zip code
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('clicking "Set up →" calls onOpenWeather', async () => {
    installFetchMock();
    const onOpenWeather = jest.fn();
    render(<WeatherSummaryTile onOpenWeather={onOpenWeather} />);
    await userEvent.click(screen.getByRole('button', { name: /Set up/i }));
    expect(onOpenWeather).toHaveBeenCalledTimes(1);
  });

  test('renders temperature and chips when zip code + weather data present', async () => {
    localStorage.setItem('weatherZipCode', '05001');
    installFetchMock([
      {
        match: '/api/weather/current',
        response: { weather: { temperature: 58.3, conditions: 'Partly cloudy' } },
      },
      {
        match: '/api/weather/forecast',
        response: {
          forecast: [
            { date: '2026-04-14', highTemp: 62, lowTemp: 34, precipitation: 0.2 },
            { date: '2026-04-15', highTemp: 65, lowTemp: 40, precipitation: 0 },
          ],
        },
      },
    ]);
    render(<WeatherSummaryTile onOpenWeather={jest.fn()} />);
    expect(await screen.findByText(/58°F/)).toBeInTheDocument();
    // lowTemp of 34 triggers frost risk chip
    expect(await screen.findByText(/Frost risk/i)).toBeInTheDocument();
    // precipitation >= 0.1 triggers rain chip
    expect(screen.getByText(/Rain 48h/i)).toBeInTheDocument();
  });

  test('renders "No frost risk" chip when low temp is above 36°F', async () => {
    localStorage.setItem('weatherZipCode', '05001');
    installFetchMock([
      {
        match: '/api/weather/current',
        response: { weather: { temperature: 70, conditions: 'Sunny' } },
      },
      {
        match: '/api/weather/forecast',
        response: {
          forecast: [
            { date: '2026-06-14', highTemp: 80, lowTemp: 55, precipitation: 0 },
            { date: '2026-06-15', highTemp: 82, lowTemp: 58, precipitation: 0 },
          ],
        },
      },
    ]);
    render(<WeatherSummaryTile onOpenWeather={jest.fn()} />);
    expect(await screen.findByText(/No frost risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Dry 48h/i)).toBeInTheDocument();
  });

  test('fetches both current and forecast endpoints when zip present', async () => {
    localStorage.setItem('weatherZipCode', '05001');
    const fetchMock = installFetchMock([
      { match: '/api/weather/current', response: { weather: { temperature: 50 } } },
      { match: '/api/weather/forecast', response: { forecast: [] } },
    ]);
    render(<WeatherSummaryTile onOpenWeather={jest.fn()} />);
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(c => String(c[0]));
      expect(urls.some(u => u.includes('/api/weather/current?zipcode=05001'))).toBe(true);
      expect(urls.some(u => u.includes('/api/weather/forecast?zipcode=05001'))).toBe(true);
    });
  });
});
