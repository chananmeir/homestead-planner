import React, { useState, useEffect } from 'react';
import { apiGet } from '../../utils/api';

interface SeasonData {
  in_season: boolean;
  in_season_window: boolean;
  season_start: string;
  season_end: string;
  forecast_days: Array<{
    date: string;
    max_temp: number;
    min_temp: number;
    ideal: boolean;
  }>;
  confidence: 'high' | 'medium' | 'low';
  message: string;
  notes: string;
}

const MapleTappingSeasonCard: React.FC = () => {
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSeasonData();
  }, []);

  const fetchSeasonData = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/maple-tapping/season-estimate');

      if (!response.ok) {
        throw new Error('Failed to fetch tapping season data');
      }

      const data = await response.json();
      setSeasonData(data);
    } catch (err) {
      console.error('Error fetching tapping season:', err);
      setError('Could not load tapping season information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (error || !seasonData) {
    return null; // Don't show card if there's an error
  }

  // Don't show if we're not in the season window at all
  if (!seasonData.in_season_window && seasonData.forecast_days.length === 0) {
    return null;
  }

  // Determine card style based on conditions
  const isIdeal = seasonData.in_season && seasonData.forecast_days.length > 0;
  const isUpcoming = !seasonData.in_season && seasonData.forecast_days.length > 0;

  const bgColor = isIdeal ? 'bg-orange-50' : isUpcoming ? 'bg-blue-50' : 'bg-gray-50';
  const borderColor = isIdeal ? 'border-orange-300' : isUpcoming ? 'border-blue-300' : 'border-gray-300';
  const textColor = isIdeal ? 'text-orange-800' : isUpcoming ? 'text-blue-800' : 'text-gray-800';
  const iconBg = isIdeal ? 'bg-orange-100' : isUpcoming ? 'bg-blue-100' : 'bg-gray-100';

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} p-4 shadow-sm`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-12 h-12 ${iconBg} rounded-full flex items-center justify-center text-2xl`}>
          🍁
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className={`font-bold text-lg ${textColor} mb-2`}>
            {isIdeal ? '🎉 Maple Tapping Season!' : isUpcoming ? '📅 Tapping Season Approaching' : 'Maple Tapping Info'}
          </h3>

          <p className={`${textColor} mb-3`}>
            {seasonData.message}
          </p>

          {/* Forecast details */}
          {seasonData.forecast_days.length > 0 && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Ideal Days in Forecast ({seasonData.forecast_days.length}):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {seasonData.forecast_days.slice(0, 6).map((day, idx) => (
                  <div key={idx} className="bg-white rounded p-2 text-sm border border-gray-200">
                    <div className="font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-gray-600">
                      ❄️ {day.min_temp}°F → ☀️ {day.max_temp}°F
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <p className="text-xs text-gray-600 italic">
            {seasonData.notes}
          </p>

          {/* Confidence badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              seasonData.confidence === 'high' ? 'bg-green-100 text-green-800' :
              seasonData.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {seasonData.confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapleTappingSeasonCard;
