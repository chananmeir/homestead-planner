import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Plant, PlantingEvent, FrostTolerance, GardenBed } from '../../types';
import { API_BASE_URL } from '../../config';

interface WeatherAlertBannerProps {
  date: string; // ISO date from dateFilter
  plantingEvents: PlantingEvent[];
  plants: Plant[]; // Full plant database for lookup
  beds: GardenBed[]; // All garden beds
  latitude?: number;
  longitude?: number;
  zipCode?: string; // Alternative to lat/lon
}

interface ForecastDay {
  date: string;
  highTemp: number;
  lowTemp: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  conditions: string;
  growingDegreeDays: number;
}

type HeatTolerance = 'low' | 'medium' | 'high' | 'excellent';

interface AtRiskPlant extends Plant {
  isAtRisk: boolean;
}

// Temperature thresholds for each frost tolerance level
const riskThresholds: Record<FrostTolerance, number> = {
  'very-tender': 32, // Dies at frost
  'tender': 28, // Damaged by freeze
  'half-hardy': 24, // Needs protection in hard freeze
  'hardy': 15, // Generally safe
  'very-hardy': -10, // Very cold tolerant
};

// Heat stress thresholds by heat_tolerance level (air temperature, °F)
const heatThresholds: Record<HeatTolerance, { advisory: number; warning: number; critical: number }> = {
  'low':       { advisory: 80, warning: 85, critical: 90 },
  'medium':    { advisory: 85, warning: 90, critical: 95 },
  'high':      { advisory: 90, warning: 95, critical: 100 },
  'excellent': { advisory: 95, warning: 100, critical: 105 },
};

const WeatherAlertBanner: React.FC<WeatherAlertBannerProps> = ({
  date,
  plantingEvents,
  plants,
  beds,
  latitude,
  longitude,
  zipCode,
}) => {
  const [forecastDay, setForecastDay] = useState<ForecastDay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      // Skip if no location provided
      if (!latitude && !longitude && !zipCode) {
        setForecastDay(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Build API URL based on available location data
        let apiUrl = `${API_BASE_URL}/api/weather/forecast?days=10`;
        if (latitude && longitude) {
          apiUrl += `&lat=${latitude}&lon=${longitude}`;
        } else if (zipCode) {
          apiUrl += `&zipcode=${zipCode}`;
        }

        const response = await fetch(apiUrl, { credentials: 'include' });

        if (!response.ok) {
          throw new Error('Failed to fetch weather forecast');
        }

        const data = await response.json();

        // Find forecast for the selected date
        const targetDate = date.split('T')[0]; // Get YYYY-MM-DD
        const matchingForecast = data.forecast?.find(
          (f: ForecastDay) => f.date === targetDate
        );

        setForecastDay(matchingForecast || null);
      } catch (err) {
        console.error('Failed to fetch weather:', err);
        setError('Unable to load weather data');
        setForecastDay(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [date, latitude, longitude, zipCode]);

  // Get active planting events by bed
  const getActivePlantsByBed = () => {
    const currentDate = new Date(date);
    const activePlantingEvents = plantingEvents.filter((event) => {
      const plantingDateStr = event.transplantDate || event.directSeedDate;
      if (!plantingDateStr) return false;
      const plantingDate = new Date(plantingDateStr);
      const isPlantedByNow = plantingDate <= currentDate;
      const harvestDateStr = event.expectedHarvestDate;
      const harvestDate = harvestDateStr ? new Date(harvestDateStr) : null;
      const isStillGrowing = !harvestDate || harvestDate >= currentDate;
      return isPlantedByNow && isStillGrowing;
    });

    const bedPlantMap = new Map<number, Set<string>>();
    activePlantingEvents.forEach((event) => {
      if (!event.gardenBedId || !event.plantId) return;
      if (!bedPlantMap.has(event.gardenBedId)) {
        bedPlantMap.set(event.gardenBedId, new Set());
      }
      bedPlantMap.get(event.gardenBedId)!.add(event.plantId);
    });
    return bedPlantMap;
  };

  // Analyze cold risk (frost/freeze)
  const analyzeColdRisk = () => {
    if (!forecastDay || forecastDay.lowTemp > 32) {
      return { atRiskPlants: [] as AtRiskPlant[], criticalByBed: new Map<number, { bedName: string; plants: AtRiskPlant[] }>(), warningByBed: new Map<number, { bedName: string; plants: AtRiskPlant[] }>() };
    }

    const bedPlantMap = getActivePlantsByBed();
    const atRiskPlants: AtRiskPlant[] = [];
    const criticalByBed = new Map<number, { bedName: string; plants: AtRiskPlant[] }>();
    const warningByBed = new Map<number, { bedName: string; plants: AtRiskPlant[] }>();

    bedPlantMap.forEach((plantIds, bedId) => {
      const bed = beds.find((b) => b.id === bedId);
      if (!bed) return;
      const bedCritical: AtRiskPlant[] = [];
      const bedWarning: AtRiskPlant[] = [];

      plantIds.forEach((plantId) => {
        const plant = plants.find((p) => p.id === plantId);
        if (!plant) return;
        const threshold = riskThresholds[plant.frostTolerance || 'tender'];
        const isAtRisk = forecastDay.lowTemp <= threshold;
        if (isAtRisk) {
          const atRiskPlant = { ...plant, isAtRisk };
          atRiskPlants.push(atRiskPlant);
          if (['very-tender', 'tender'].includes(plant.frostTolerance || 'tender')) {
            bedCritical.push(atRiskPlant);
          } else {
            bedWarning.push(atRiskPlant);
          }
        }
      });

      if (bedCritical.length > 0) criticalByBed.set(bedId, { bedName: bed.name, plants: bedCritical });
      if (bedWarning.length > 0) warningByBed.set(bedId, { bedName: bed.name, plants: bedWarning });
    });

    return { atRiskPlants, criticalByBed, warningByBed };
  };

  // Analyze heat risk
  const analyzeHeatRisk = () => {
    if (!forecastDay || forecastDay.highTemp < 80) {
      return { heatRiskPlants: [] as AtRiskPlant[], heatCriticalByBed: new Map<number, { bedName: string; plants: AtRiskPlant[] }>(), heatWarningByBed: new Map<number, { bedName: string; plants: AtRiskPlant[] }>() };
    }

    const bedPlantMap = getActivePlantsByBed();
    const heatRiskPlants: AtRiskPlant[] = [];
    const heatCriticalByBed = new Map<number, { bedName: string; plants: AtRiskPlant[] }>();
    const heatWarningByBed = new Map<number, { bedName: string; plants: AtRiskPlant[] }>();

    bedPlantMap.forEach((plantIds, bedId) => {
      const bed = beds.find((b) => b.id === bedId);
      if (!bed) return;
      const bedCritical: AtRiskPlant[] = [];
      const bedWarning: AtRiskPlant[] = [];

      plantIds.forEach((plantId) => {
        const plant = plants.find((p) => p.id === plantId);
        if (!plant) return;

        const tolerance = (plant.heatTolerance || 'medium') as HeatTolerance;
        const thresholds = heatThresholds[tolerance] || heatThresholds['medium'];

        if (forecastDay.highTemp >= thresholds.warning) {
          const atRiskPlant = { ...plant, isAtRisk: true };
          heatRiskPlants.push(atRiskPlant);
          if (forecastDay.highTemp >= thresholds.critical) {
            bedCritical.push(atRiskPlant);
          } else {
            bedWarning.push(atRiskPlant);
          }
        } else if (forecastDay.highTemp >= thresholds.advisory) {
          const atRiskPlant = { ...plant, isAtRisk: true };
          heatRiskPlants.push(atRiskPlant);
          bedWarning.push(atRiskPlant);
        }
      });

      if (bedCritical.length > 0) heatCriticalByBed.set(bedId, { bedName: bed.name, plants: bedCritical });
      if (bedWarning.length > 0) heatWarningByBed.set(bedId, { bedName: bed.name, plants: bedWarning });
    });

    return { heatRiskPlants, heatCriticalByBed, heatWarningByBed };
  };

  const { atRiskPlants, criticalByBed, warningByBed } = analyzeColdRisk();
  const { heatRiskPlants, heatCriticalByBed, heatWarningByBed } = analyzeHeatRisk();

  const hasColdRisk = forecastDay && forecastDay.lowTemp <= 32 && atRiskPlants.length > 0;
  const hasHeatRisk = forecastDay && forecastDay.highTemp >= 80 && heatRiskPlants.length > 0;

  // Don't show banner if no risk
  if (loading || error || !forecastDay || (!hasColdRisk && !hasHeatRisk)) {
    return null;
  }

  const formatDate = () => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  };

  // Cold alert style
  const getColdAlertStyle = () => {
    const lowTemp = forecastDay!.lowTemp;
    const hasCritical = criticalByBed.size > 0;
    const hasWarning = warningByBed.size > 0;

    if (lowTemp <= 28 && hasCritical) {
      return { backgroundColor: '#fee2e2', borderColor: '#dc2626', textColor: 'text-red-900', icon: '🧊', title: 'Freeze Warning' };
    } else if (lowTemp <= 32 && hasCritical) {
      return { backgroundColor: '#fed7aa', borderColor: '#ea580c', textColor: 'text-orange-900', icon: '❄️', title: 'Frost Alert' };
    } else if (lowTemp <= 24 && hasWarning) {
      return { backgroundColor: '#fef3c7', borderColor: '#f59e0b', textColor: 'text-yellow-900', icon: '⚠️', title: 'Cold Weather Alert' };
    }
    return { backgroundColor: '#fed7aa', borderColor: '#ea580c', textColor: 'text-orange-900', icon: '❄️', title: 'Frost Alert' };
  };

  // Heat alert style
  const getHeatAlertStyle = () => {
    const highTemp = forecastDay!.highTemp;
    const hasCritical = heatCriticalByBed.size > 0;

    if (highTemp >= 95 && hasCritical) {
      return { backgroundColor: '#fee2e2', borderColor: '#dc2626', textColor: 'text-red-900', icon: '🔥', title: 'Extreme Heat Warning' };
    } else if (highTemp >= 90) {
      return { backgroundColor: '#ffedd5', borderColor: '#ea580c', textColor: 'text-orange-900', icon: '🌡️', title: 'Heat Warning' };
    }
    return { backgroundColor: '#fef3c7', borderColor: '#f59e0b', textColor: 'text-yellow-900', icon: '☀️', title: 'Heat Advisory' };
  };

  return (
    <>
      {/* Cold risk banner */}
      {hasColdRisk && (() => {
        const alertStyle = getColdAlertStyle();
        return (
          <div
            className="mb-4 rounded-lg border-2 p-4"
            style={{ backgroundColor: alertStyle.backgroundColor, borderColor: alertStyle.borderColor }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" style={{ color: alertStyle.borderColor }} />
              <div className="flex-1">
                <h4 className={`font-bold text-lg ${alertStyle.textColor}`}>
                  {alertStyle.icon} {alertStyle.title} - {Math.round(forecastDay!.lowTemp)}°F Low
                </h4>
                <p className={`text-sm mt-1 ${alertStyle.textColor}`}>
                  Protect these plants on {formatDate()}:
                </p>
                <div className="mt-2 space-y-2">
                  {criticalByBed.size > 0 && (
                    <div>
                      <div className="font-bold text-red-900 mb-1">Critical Risk:</div>
                      {Array.from(criticalByBed.values()).map((bedData, idx) => (
                        <div key={idx} className="ml-3 text-red-800">
                          <strong>{bedData.bedName}:</strong> {bedData.plants.map((p) => p.name).join(', ')}
                          <span className="text-xs ml-2">(very-tender/tender)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {warningByBed.size > 0 && (
                    <div>
                      <div className="font-bold text-orange-900 mb-1">At Risk:</div>
                      {Array.from(warningByBed.values()).map((bedData, idx) => (
                        <div key={idx} className="ml-3 text-orange-800">
                          <strong>{bedData.bedName}:</strong> {bedData.plants.map((p) => p.name).join(', ')}
                          <span className="text-xs ml-2">
                            ({bedData.plants.map(p => p.frostTolerance).filter((v, i, a) => a.indexOf(v) === i).join(', ')})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`mt-3 text-sm ${alertStyle.textColor}`}>
                  <strong>Recommendations:</strong>
                  <ul className="list-disc ml-5 mt-1">
                    {forecastDay!.lowTemp <= 28 && <li>Cover plants with row covers or frost blankets</li>}
                    {Array.from(criticalByBed.values()).some((bedData) =>
                      bedData.plants.some((p) => p.category === 'vegetable')
                    ) && <li>Harvest mature vegetables before nightfall</li>}
                    <li>Water soil before evening (moist soil retains heat)</li>
                    {forecastDay!.lowTemp <= 24 && <li>Consider moving container plants indoors</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Heat risk banner */}
      {hasHeatRisk && (() => {
        const alertStyle = getHeatAlertStyle();
        return (
          <div
            className="mb-4 rounded-lg border-2 p-4"
            style={{ backgroundColor: alertStyle.backgroundColor, borderColor: alertStyle.borderColor }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" style={{ color: alertStyle.borderColor }} />
              <div className="flex-1">
                <h4 className={`font-bold text-lg ${alertStyle.textColor}`}>
                  {alertStyle.icon} {alertStyle.title} - {Math.round(forecastDay!.highTemp)}°F High
                </h4>
                <p className={`text-sm mt-1 ${alertStyle.textColor}`}>
                  Heat-sensitive plants at risk on {formatDate()}:
                </p>
                <div className="mt-2 space-y-2">
                  {heatCriticalByBed.size > 0 && (
                    <div>
                      <div className="font-bold text-red-900 mb-1">Critical Heat Stress:</div>
                      {Array.from(heatCriticalByBed.values()).map((bedData, idx) => (
                        <div key={idx} className="ml-3 text-red-800">
                          <strong>{bedData.bedName}:</strong> {bedData.plants.map((p) => p.name).join(', ')}
                          <span className="text-xs ml-2">
                            ({bedData.plants.map(p => p.heatTolerance || 'medium').filter((v, i, a) => a.indexOf(v) === i).join(', ')} heat tolerance)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {heatWarningByBed.size > 0 && (
                    <div>
                      <div className="font-bold text-orange-900 mb-1">Heat Stress Risk:</div>
                      {Array.from(heatWarningByBed.values()).map((bedData, idx) => (
                        <div key={idx} className="ml-3 text-orange-800">
                          <strong>{bedData.bedName}:</strong> {bedData.plants.map((p) => p.name).join(', ')}
                          <span className="text-xs ml-2">
                            ({bedData.plants.map(p => p.heatTolerance || 'medium').filter((v, i, a) => a.indexOf(v) === i).join(', ')} heat tolerance)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`mt-3 text-sm ${alertStyle.textColor}`}>
                  <strong>Recommendations:</strong>
                  <ul className="list-disc ml-5 mt-1">
                    <li>Install shade cloth (50% recommended for vegetables)</li>
                    <li>Water deeply in the early morning</li>
                    <li>Apply mulch to keep soil cool and retain moisture</li>
                    {forecastDay!.highTemp >= 95 && <li>Harvest heat-sensitive crops before peak heat</li>}
                    {forecastDay!.highTemp >= 90 && <li>Avoid transplanting until temperatures moderate</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default WeatherAlertBanner;
