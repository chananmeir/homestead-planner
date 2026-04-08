import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Thermometer, AlertCircle } from 'lucide-react';
import { apiGet } from '../../../utils/api';
import { SoilConfig, SoilTempResponse } from './types';
import { PlantingCalendar, GardenBed } from '../../../types';
import SoilConfigForm from './SoilConfigForm';
import ReadinessIndicator from './ReadinessIndicator';

interface SoilTemperatureCardProps {
  plantingEvents: PlantingCalendar[];
  onDataLoaded?: (data: SoilTempResponse) => void;
  gardenBeds?: GardenBed[];
}

const SoilTemperatureCard: React.FC<SoilTemperatureCardProps> = ({ plantingEvents, onDataLoaded, gardenBeds = [] }) => {
  // Expanded/collapsed state (persisted in localStorage)
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('soilTemperatureCard.expanded');
    return saved !== null ? saved === 'true' : true; // Default to expanded
  });

  // Soil configuration
  const [config, setConfig] = useState<SoilConfig>({
    soilType: 'loamy',
    sunExposure: 'full-sun',
    hasMulch: false
  });

  // API response data
  const [soilTempData, setSoilTempData] = useState<SoilTempResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem('soilTemperatureCard.expanded', String(expanded));
  }, [expanded]);

  // Validate persisted gardenBedId against available beds
  useEffect(() => {
    if (config.gardenBedId != null && gardenBeds.length > 0) {
      const bedExists = gardenBeds.some(b => b.id === config.gardenBedId);
      if (!bedExists) {
        setConfig(prev => ({ ...prev, gardenBedId: undefined }));
      }
    }
  }, [gardenBeds, config.gardenBedId]);

  // Fetch soil temperature data whenever config changes
  useEffect(() => {
    const fetchSoilTemperature = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();

        // Use the weather zip code so soil temp matches user's actual location
        const zipCode = localStorage.getItem('weatherZipCode') || '53209';
        params.set('zipcode', zipCode);

        if (config.gardenBedId != null) {
          // When a bed is selected, let backend resolve soil/sun/mulch from the bed
          params.set('garden_bed_id', String(config.gardenBedId));
        } else {
          // Property-wide: use manual config
          params.set('soil_type', config.soilType);
          params.set('sun_exposure', config.sunExposure);
          params.set('has_mulch', String(config.hasMulch));
        }

        const response = await apiGet(`/api/soil-temperature?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch soil temperature');
        }

        const data: SoilTempResponse = await response.json();
        setSoilTempData(data);
        if (onDataLoaded) onDataLoaded(data);
      } catch (err) {
        console.error('Error fetching soil temperature:', err);
        const errorMessage = err instanceof Error
          ? `Failed to load soil temperature: ${err.message}`
          : 'Failed to load soil temperature data. Please try again.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSoilTemperature();
  }, [config]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <button
        data-testid="soil-temp-toggle"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Thermometer className="w-6 h-6 text-green-600" />
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-800">Soil Temperature</h3>
            {!expanded && soilTempData && (
              <p className="text-sm text-gray-600">
                {soilTempData.estimated_soil_temp}°F
              </p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-6 pt-0 space-y-6">
          {/* Data Source Badge */}
          {soilTempData && !soilTempData.using_mock_data && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-green-800">
                <span className="font-semibold">
                  {soilTempData.method === 'measured' ? 'Live Measured Data' : 'Live Weather Data'}
                </span>
                {' '}from {soilTempData.source || 'API'}
              </p>
            </div>
          )}

          {/* Mock Data Warning */}
          {soilTempData?.using_mock_data && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Using Mock Weather Data</p>
                <p>
                  For live weather data, sign up for a free WeatherAPI.com account and add your
                  API key to <code className="bg-yellow-100 px-1 rounded">backend/.env</code>
                </p>
                <p className="mt-1">
                  <a
                    href="https://www.weatherapi.com/signup.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-900"
                  >
                    Get API key (free tier: 1M calls/month)
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Soil Conditions
            </h4>
            <SoilConfigForm config={config} onChange={setConfig} gardenBeds={gardenBeds} />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Calculating...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Temperature Display */}
          {!loading && !error && soilTempData && (
            <>
              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Base Temperature (from API) */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">
                      {soilTempData.method === 'measured' ? 'Measured Soil Temp (6cm / 2.4in)' : 'Air Temperature'}
                    </p>
                    <p className="text-4xl font-bold text-gray-800">
                      {soilTempData.base_temp?.toFixed(1) || soilTempData.air_temp}°F
                    </p>
                    {soilTempData.temps_by_depth && soilTempData.method === 'measured' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Surface: {soilTempData.temps_by_depth['0']?.baseTemp?.toFixed(1)}°F
                        {' | '}Deep (18cm): {soilTempData.temps_by_depth['18']?.baseTemp?.toFixed(1)}°F
                      </p>
                    )}
                    {!soilTempData.temps_by_depth && (
                      <p className="text-xs text-gray-500 mt-1">
                        {soilTempData.method === 'measured' ? 'From soil sensors' : 'From weather station'}
                      </p>
                    )}
                  </div>

                  {/* Final Soil Temperature (with adjustments) */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Your Soil Temperature</p>
                    <p className="text-4xl font-bold text-green-600">
                      {soilTempData.final_soil_temp || soilTempData.estimated_soil_temp}°F
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      At seed depth (6cm) after adjustments
                    </p>
                  </div>
                </div>

                {/* Adjustments Breakdown */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    Adjustments: Soil Type {soilTempData.soil_adjustments.soil_type > 0 ? '+' : ''}
                    {soilTempData.soil_adjustments.soil_type}°F, Sun Exposure{' '}
                    {soilTempData.soil_adjustments.sun_exposure > 0 ? '+' : ''}
                    {soilTempData.soil_adjustments.sun_exposure}°F, Mulch{' '}
                    {soilTempData.soil_adjustments.mulch > 0 ? '+' : ''}
                    {soilTempData.soil_adjustments.mulch}°F
                    {soilTempData.protection_offset != null && soilTempData.protection_offset > 0 && (
                      <>, Protection ({soilTempData.protection_label}) +{soilTempData.protection_offset}°F</>
                    )}
                  </p>
                </div>
              </div>

              {/* Crop Readiness */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Planting Readiness for Your Crops
                </h4>
                <ReadinessIndicator
                  cropReadiness={soilTempData.crop_readiness}
                  cropReadinessForecast={soilTempData.crop_readiness_forecast}
                  cropReadinessTransplant={soilTempData.crop_readiness_transplant}
                  plantingEvents={plantingEvents}
                  directSowOnly={soilTempData.directSowOnly}
                  frostDataUnavailable={soilTempData.frostDataUnavailable}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SoilTemperatureCard;
