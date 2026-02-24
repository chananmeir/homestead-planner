import React, { useState, useEffect } from 'react';
import { WeatherAlert, WeatherData } from '../types';
import { format } from 'date-fns';
import { API_BASE_URL } from '../config';

const WeatherAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [zipCode, setZipCode] = useState(() => {
    // Load from localStorage or default to '53209'
    return localStorage.getItem('weatherZipCode') || '53209';
  });
  const [city, setCity] = useState('Your Location');
  const [showSettings, setShowSettings] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<any>(null);

  // Fetch real weather data from backend
  useEffect(() => {
    if (zipCode) {
      fetchWeatherData(zipCode);
    }
  }, [zipCode]);

  const fetchWeatherData = async (zip: string) => {
    try {
      // Fetch current weather
      const currentResponse = await fetch(
        `${API_BASE_URL}/api/weather/current?zipcode=${zip}`,
        { credentials: 'include' }
      );
      if (!currentResponse.ok) {
        throw new Error(`Failed to fetch current weather: ${currentResponse.status}`);
      }
      const currentData = await currentResponse.json();
      setCurrentWeather(currentData.weather);

      // Extract city name if available
      if (currentData.location && currentData.location.city) {
        setCity(currentData.location.city);
      }

      // Fetch forecast
      const forecastResponse = await fetch(
        `${API_BASE_URL}/api/weather/forecast?zipcode=${zip}&days=7`,
        { credentials: 'include' }
      );
      if (!forecastResponse.ok) {
        throw new Error(`Failed to fetch forecast: ${forecastResponse.status}`);
      }
      const forecastData = await forecastResponse.json();

      // Convert forecast data to WeatherData format
      const formattedForecast: WeatherData[] = forecastData.forecast.map((day: any) => ({
        date: new Date(day.date),
        highTemp: day.highTemp,
        lowTemp: day.lowTemp,
        precipitation: day.precipitation || 0,
        humidity: day.humidity,
        windSpeed: day.windSpeed,
        conditions: day.conditions || 'Unknown',
        growingDegreeDays: day.growingDegreeDays || 0,
      }));
      setForecast(formattedForecast);

      // Generate frost and heat alerts
      const weatherAlerts: WeatherAlert[] = [];
      formattedForecast.forEach((day, index) => {
        // Frost/freeze alerts
        if (day.lowTemp <= 32) {
          weatherAlerts.push({
            id: `frost-${index}`,
            type: day.lowTemp <= 28 ? 'freeze' : 'frost',
            severity: day.lowTemp <= 28 ? 'warning' : 'watch',
            startDate: day.date,
            endDate: new Date(day.date.getTime() + 24 * 60 * 60 * 1000),
            description: `${day.lowTemp <= 28 ? 'Freeze' : 'Frost'} warning. Low temperature expected: ${Math.round(day.lowTemp)}°F. Protect tender plants.`,
            temperature: day.lowTemp,
            dismissed: false,
          });
        }
        // Heat alerts
        if (day.highTemp >= 85) {
          const severity: WeatherAlert['severity'] = day.highTemp >= 95 ? 'warning' : day.highTemp >= 90 ? 'watch' : 'advisory';
          const label = day.highTemp >= 95 ? 'Extreme heat' : day.highTemp >= 90 ? 'Heat warning' : 'Heat advisory';
          weatherAlerts.push({
            id: `heat-${index}`,
            type: 'heat',
            severity,
            startDate: day.date,
            endDate: new Date(day.date.getTime() + 24 * 60 * 60 * 1000),
            description: `${label}. High temperature expected: ${Math.round(day.highTemp)}°F. Provide shade cloth for heat-sensitive crops, water deeply, and mulch.`,
            temperature: day.highTemp,
            dismissed: false,
          });
        }
      });
      setAlerts(weatherAlerts);

    } catch (error) {
      console.error('Error fetching weather:', error);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
  };

  const getSeverityColor = (severity: WeatherAlert['severity']) => {
    switch (severity) {
      case 'warning':
        return 'bg-red-50 border-red-300 text-red-900';
      case 'watch':
        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      case 'advisory':
        return 'bg-blue-50 border-blue-300 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-900';
    }
  };

  const getAlertIcon = (type: WeatherAlert['type']) => {
    switch (type) {
      case 'frost':
        return '❄️';
      case 'freeze':
        return '🧊';
      case 'heat':
        return '🌡️';
      case 'storm':
        return '⛈️';
      case 'precipitation':
        return '🌧️';
      default:
        return '⚠️';
    }
  };

  const getConditionIcon = (conditions: string) => {
    if (conditions.includes('Sunny')) return '☀️';
    if (conditions.includes('Rain')) return '🌧️';
    if (conditions.includes('Cloudy')) return '☁️';
    return '🌤️';
  };

  const activeAlerts = alerts.filter((a) => !a.dismissed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Weather & Alerts
            </h2>
            <p className="text-gray-600">
              Monitor weather conditions and receive alerts to protect your garden.
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            data-testid="weather-settings-btn"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ⚙️ Settings
          </button>
        </div>

        {showSettings && (
          <div data-testid="weather-settings-panel" className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold text-gray-700 mb-3">Location Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code or City
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="Enter ZIP code or city"
                    data-testid="weather-zipcode-input"
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={() => {
                      if (zipCode) {
                        localStorage.setItem('weatherZipCode', zipCode);
                        // City will be set when weather data loads
                      }
                      setShowSettings(false);
                    }}
                    data-testid="weather-zipcode-save"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Save
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Note: In production, this will integrate with OpenWeatherMap API or
                Weather.gov for real-time data.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">Active Alerts</h3>
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-2 ${getSeverityColor(
                alert.severity
              )}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getAlertIcon(alert.type)}</span>
                    <div>
                      <h4 className="font-semibold capitalize">
                        {alert.type} {alert.severity}
                      </h4>
                      <p className="text-sm">
                        {format(alert.startDate, 'MMM d, h:mm a')} -{' '}
                        {format(alert.endDate, 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm">{alert.description}</p>
                  {alert.temperature && (
                    <p className="text-sm font-semibold mt-2">
                      {alert.type === 'heat' ? 'High' : 'Low'}: {alert.temperature}°F
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="ml-4 px-3 py-1 bg-white border rounded hover:bg-gray-50 text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7-Day Forecast */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          7-Day Forecast - {city}
        </h3>
        <div data-testid="weather-forecast-grid" className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {forecast.map((day, index) => (
            <div
              key={index}
              data-testid={`weather-forecast-day-${index}`}
              className={`p-4 rounded-lg border-2 ${
                index === 0 ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
              }`}
            >
              <div className="text-center">
                <div className="font-semibold text-gray-700">
                  {index === 0 ? 'Today' : format(day.date, 'EEE')}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {format(day.date, 'MMM d')}
                </div>
                <div className="text-3xl mb-2">
                  {getConditionIcon(day.conditions)}
                </div>
                <div className="text-sm font-semibold text-gray-800">
                  {Math.round(day.highTemp)}° / {Math.round(day.lowTemp)}°
                </div>
                <div className="text-xs text-gray-600 mt-2">
                  {day.conditions}
                </div>
                {day.precipitation > 0.1 && (
                  <div className="text-xs text-blue-600 mt-1">
                    💧 {day.precipitation.toFixed(1)}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div data-testid="weather-temp-card" className="bg-white rounded-lg shadow-md p-6">
          <h4 className="font-semibold text-gray-700 mb-3">Temperature</h4>
          <div className="text-4xl font-bold text-gray-800">
            {currentWeather ? Math.round(currentWeather.temperature) : '--'}°F
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Feels like {currentWeather ? Math.round(currentWeather.feelsLike) : '--'}°F
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="font-semibold text-gray-700 mb-3">Precipitation</h4>
          <div className="text-4xl font-bold text-gray-800">
            {forecast[0] ? forecast[0].precipitation.toFixed(1) : '0.0'}"
          </div>
          <p className="text-sm text-gray-600 mt-2">Expected today</p>
        </div>

        <div data-testid="weather-wind-card" className="bg-white rounded-lg shadow-md p-6">
          <h4 className="font-semibold text-gray-700 mb-3">Wind</h4>
          <div className="text-4xl font-bold text-gray-800">
            {currentWeather ? Math.round(currentWeather.windSpeed) : '0'} mph
          </div>
          <p className="text-sm text-gray-600 mt-2">Current wind speed</p>
        </div>
      </div>

      {/* Growing Degree Days */}
      <div data-testid="weather-gdd-chart" className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Growing Degree Days (GDD)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Track accumulated heat units to predict crop development and pest emergence.
        </p>
        <div className="flex items-end gap-2 h-48">
          {forecast.map((day, index) => {
            const gdd = day.growingDegreeDays || 0;
            const height = (gdd / 20) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-green-500 rounded-t"
                  style={{ height: `${height}%` }}
                />
                <div className="text-xs text-gray-600 mt-2">
                  {format(day.date, 'MMM d')}
                </div>
                <div className="text-xs font-semibold text-gray-700">{gdd}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weather Tips */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">
          🌱 Weather-Based Garden Tips
        </h3>
        <ul className="text-sm text-green-800 space-y-2">
          <li>
            • <strong>Frost Protection:</strong> Cover tender plants when temps drop
            below 35°F. Water plants before a frost for added protection.
          </li>
          <li>
            • <strong>Heat Stress:</strong> Provide shade cloth when temperatures
            exceed 85°F for cool-season crops.
          </li>
          <li>
            • <strong>Watering:</strong> Water deeply when rainfall is less than 1"
            per week during growing season.
          </li>
          <li>
            • <strong>Wind Protection:</strong> Install windbreaks for young
            transplants when winds exceed 15 mph.
          </li>
          <li>
            • <strong>Planting:</strong> Avoid transplanting when temps are above
            80°F or below 45°F.
          </li>
        </ul>
      </div>

      {/* API Integration Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-semibold text-yellow-900 mb-2">
          📡 Weather API Integration
        </h3>
        <p className="text-sm text-yellow-800">
          <strong>For Production:</strong> Integrate with OpenWeatherMap API
          (openweathermap.org) or Weather.gov API for real-time weather data, alerts,
          and forecasts. Both offer free tiers for personal use.
        </p>
        <div className="mt-3 text-xs text-yellow-700">
          <p>OpenWeatherMap: Free tier includes 1000 calls/day</p>
          <p>Weather.gov: Free, US-only, no API key required</p>
        </div>
      </div>
    </div>
  );
};

export default WeatherAlerts;
