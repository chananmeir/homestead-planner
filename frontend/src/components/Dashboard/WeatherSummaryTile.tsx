import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';

interface WeatherSummaryTileProps {
  onOpenWeather: () => void;
}

interface ForecastDay {
  date: string;
  highTemp: number;
  lowTemp: number;
  precipitation?: number;
  conditions?: string;
}

interface CurrentWeather {
  temperature?: number;
  conditions?: string;
}

const WeatherSummaryTile: React.FC<WeatherSummaryTileProps> = ({ onOpenWeather }) => {
  const [zipCode] = useState<string>(() => localStorage.getItem('weatherZipCode') || '');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zipCode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [curResp, forecastResp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/weather/current?zipcode=${zipCode}`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/weather/forecast?zipcode=${zipCode}&days=3`, { credentials: 'include' }),
        ]);
        if (cancelled) return;
        if (curResp.ok) {
          const data = await curResp.json();
          setCurrent(data.weather || data);
        }
        if (forecastResp.ok) {
          const data = await forecastResp.json();
          setForecast(Array.isArray(data.forecast) ? data.forecast : []);
        }
      } catch {
        if (!cancelled) setError('Weather unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [zipCode]);

  const frostRisk = useMemo(() => {
    const next24 = forecast.slice(0, 1);
    const risky = next24.find(d => typeof d.lowTemp === 'number' && d.lowTemp < 36);
    return risky ? { low: risky.lowTemp } : null;
  }, [forecast]);

  const rainNext48 = useMemo(() => {
    const window = forecast.slice(0, 2);
    const total = window.reduce((sum, d) => sum + (d.precipitation || 0), 0);
    return total >= 0.1 ? { inches: total } : null;
  }, [forecast]);

  if (!zipCode) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Weather</h3>
            <p className="text-sm text-gray-500 mt-1">Set your zip code in Weather settings to see the forecast here.</p>
          </div>
          <button
            onClick={onOpenWeather}
            className="text-sm text-green-700 hover:text-green-800 font-medium whitespace-nowrap"
          >
            Set up →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Weather</h3>
            {current?.conditions && (
              <span className="text-xs text-gray-500 truncate">{current.conditions}</span>
            )}
          </div>
          {loading ? (
            <div className="h-8 w-40 bg-gray-100 rounded animate-pulse mt-2" />
          ) : error ? (
            <div className="text-sm text-gray-500 mt-1">{error}</div>
          ) : (
            <div className="flex items-baseline gap-3 mt-1">
              {typeof current?.temperature === 'number' && (
                <span className="text-2xl font-bold text-gray-900">
                  {Math.round(current.temperature)}°F
                </span>
              )}
              {forecast[0] && (
                <span className="text-sm text-gray-500">
                  H {Math.round(forecast[0].highTemp)}° · L {Math.round(forecast[0].lowTemp)}°
                </span>
              )}
            </div>
          )}

          {!loading && !error && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Chip
                active={!!frostRisk}
                activeTone="red"
                label={frostRisk ? `Frost risk · ${Math.round(frostRisk.low)}°F` : 'No frost risk'}
              />
              <Chip
                active={!!rainNext48}
                activeTone="blue"
                label={rainNext48 ? `Rain 48h · ${rainNext48.inches.toFixed(1)}"` : 'Dry 48h'}
              />
            </div>
          )}
        </div>

        <button
          onClick={onOpenWeather}
          className="text-sm text-green-700 hover:text-green-800 font-medium whitespace-nowrap"
        >
          Details →
        </button>
      </div>
    </div>
  );
};

const Chip: React.FC<{ active: boolean; activeTone: 'red' | 'blue'; label: string }> = ({ active, activeTone, label }) => {
  const activeClasses = activeTone === 'red'
    ? 'bg-red-50 text-red-800 border-red-200'
    : 'bg-blue-50 text-blue-800 border-blue-200';
  const inactiveClasses = 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${active ? activeClasses : inactiveClasses}`}>
      {label}
    </span>
  );
};

export default WeatherSummaryTile;
