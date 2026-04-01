import React, { useState } from 'react';
import { CropReadinessMap, CropReadinessForecastMap, DailyReadiness, DirectSowOnlyMap, FrostRiskDay } from './types';
import { PlantingCalendar } from '../../../types';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';

type PlantingMode = 'seed' | 'transplant';

interface ReadinessIndicatorProps {
  cropReadiness: CropReadinessMap;
  cropReadinessForecast?: CropReadinessForecastMap;
  cropReadinessTransplant?: CropReadinessForecastMap;
  plantingEvents: PlantingCalendar[];
  directSowOnly?: DirectSowOnlyMap;
}

const statusDotColor = (status: string) => {
  switch (status) {
    case 'ready': return 'bg-green-500';
    case 'marginal': return 'bg-yellow-400';
    case 'too_cold': return 'bg-red-500';
    default: return 'bg-gray-300';
  }
};

const statusBgColor = (status: string) => {
  switch (status) {
    case 'ready': return 'bg-green-50 border-green-200';
    case 'marginal': return 'bg-yellow-50 border-yellow-200';
    case 'too_cold': return 'bg-red-50 border-red-200';
    default: return 'bg-gray-50 border-gray-200';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'ready': return '\u2713';
    case 'marginal': return '\u26A0';
    case 'too_cold': return '\u2717';
    default: return '?';
  }
};

const statusTextColor = (status: string) => {
  switch (status) {
    case 'ready': return 'text-green-800';
    case 'marginal': return 'text-yellow-800';
    case 'too_cold': return 'text-red-800';
    default: return 'text-gray-800';
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'ready': return 'Ready to Plant';
    case 'marginal': return 'Marginal - Risky';
    case 'too_cold': return 'Too Cold';
    default: return 'Unknown';
  }
};

interface CropCardProps {
  name: string;
  minTemp: number;
  status: string;
  windowDays?: number;
  windowLabel: string;
  dailyReadiness?: DailyReadiness[];
  depthLabel?: string;
  frostRisk?: boolean;
  frostRiskDays?: FrostRiskDay[];
}

const CropCard: React.FC<CropCardProps> = ({ name, minTemp, status, windowDays, windowLabel, dailyReadiness, depthLabel, frostRisk, frostRiskDays }) => {
  return (
    <div className={`rounded-lg border p-3 ${statusBgColor(status)}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`font-medium text-sm ${statusTextColor(status)}`}>
            {statusIcon(status)} {name}
          </span>
          {frostRisk && (
            <span
              className="text-blue-600 text-sm"
              title={`Frost risk: ${frostRiskDays?.length || 0} day(s) with air temps near or below kill threshold`}
            >
              &#x2744;
            </span>
          )}
        </div>
        <span className={`text-xs ${statusTextColor(status)} opacity-75`}>
          needs {minTemp}°F{depthLabel ? ` at ${depthLabel.toLowerCase()}` : ''}
        </span>
      </div>

      {/* Frost risk detail */}
      {frostRisk && frostRiskDays && frostRiskDays.length > 0 && (
        <div className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-1 border border-blue-200">
          &#x2744; Frost risk: {frostRiskDays.length} day(s) with forecast lows at or below {frostRiskDays[0].killTemp}°F
        </div>
      )}

      {/* Forecast dots */}
      {dailyReadiness && dailyReadiness.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-gray-500">
              {windowDays}-day {windowLabel}:
            </span>
          </div>
          <div className="flex gap-0.5 items-end">
            {dailyReadiness.map((day, i) => {
              let dateLabel: string;
              try {
                dateLabel = format(parseISO(day.date), 'MMM d');
              } catch {
                dateLabel = day.date;
              }
              return (
                <div key={i} className="flex flex-col items-center group relative">
                  <div
                    className={`w-4 h-4 rounded-sm ${statusDotColor(day.status)} cursor-default`}
                    title={`${dateLabel}: ${day.soilTemp.toFixed(1)}°F (${statusLabel(day.status)})`}
                  />
                  <span className="text-[9px] text-gray-400 mt-0.5 leading-none">
                    {i === 0 ? 'Today' : i < 7 ? `D${i + 1}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Ready
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-yellow-400 inline-block" /> Marginal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Too Cold
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const CollapsibleSection: React.FC<{
  label: string;
  count: number;
  dotColor: string;
  textColor: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}> = ({ label, count, dotColor, textColor, defaultOpen, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`text-sm font-semibold ${textColor} mb-2 flex items-center w-full hover:opacity-80 transition-opacity`}
      >
        {open
          ? <ChevronDown className="w-4 h-4 mr-1 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 mr-1 flex-shrink-0" />
        }
        <span className={`w-3 h-3 ${dotColor} rounded-full mr-2 flex-shrink-0`}></span>
        {label} ({count})
      </button>
      {open && children}
    </div>
  );
};

interface CropEntry {
  plantId: string;
  status: string;
  name: string;
  minTemp: number;
  windowDays?: number;
  dailyReadiness?: DailyReadiness[];
  depthLabel?: string;
  frostRisk?: boolean;
  frostRiskDays?: FrostRiskDay[];
}

const buildCropEntry = (
  plantId: string,
  activeForecast: CropReadinessForecastMap | undefined,
  cropReadiness: CropReadinessMap,
  useForecast: boolean
): CropEntry | null => {
  if (useForecast && activeForecast && activeForecast[plantId]) {
    const fc = activeForecast[plantId];
    return {
      plantId,
      status: fc.status,
      name: fc.name,
      minTemp: fc.min_temp,
      windowDays: fc.germination_days,
      dailyReadiness: fc.daily_readiness,
      depthLabel: fc.depth_label,
      frostRisk: fc.frostRisk,
      frostRiskDays: fc.frostRiskDays,
    };
  }
  if (cropReadiness[plantId]) {
    const cr = cropReadiness[plantId];
    return {
      plantId,
      status: cr.status,
      name: cr.name,
      minTemp: cr.min_temp,
      windowDays: undefined,
      dailyReadiness: undefined,
      depthLabel: cr.depth_label,
    };
  }
  return null;
};

const renderCropGrid = (crops: CropEntry[], windowLabel: string) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {crops.map(crop => (
      <CropCard
        key={crop.plantId}
        name={crop.name}
        minTemp={crop.minTemp}
        status={crop.status}
        windowDays={crop.windowDays}
        windowLabel={windowLabel}
        dailyReadiness={crop.dailyReadiness}
        depthLabel={crop.depthLabel}
        frostRisk={crop.frostRisk}
        frostRiskDays={crop.frostRiskDays}
      />
    ))}
  </div>
);

const ReadinessIndicator: React.FC<ReadinessIndicatorProps> = ({
  cropReadiness,
  cropReadinessForecast,
  cropReadinessTransplant,
  plantingEvents,
  directSowOnly,
}) => {
  const [mode, setMode] = useState<PlantingMode>('seed');

  // Get unique plant IDs from planting events
  const plantedCropIds = Array.from(
    new Set(plantingEvents.map(event => event.plantId).filter((id): id is string => id !== undefined))
  );

  // Pick the active forecast data based on mode
  const activeForecast = mode === 'transplant' ? cropReadinessTransplant : cropReadinessForecast;
  const useForecast = activeForecast != null;
  const windowLabel = mode === 'transplant' ? 'establishment window' : 'germination window';

  // Build planned crops list (crops the user has planting events for)
  const plannedCrops = plantedCropIds
    .map(plantId => buildCropEntry(plantId, activeForecast, cropReadiness, useForecast))
    .filter((c): c is CropEntry => c !== null);

  // Build other crops list (all remaining crops from the forecast that aren't planned)
  const allForecastIds = activeForecast ? Object.keys(activeForecast) : Object.keys(cropReadiness);
  const otherCropIds = allForecastIds.filter(id => !plantedCropIds.includes(id));
  const otherCrops = otherCropIds
    .map(plantId => buildCropEntry(plantId, activeForecast, cropReadiness, useForecast))
    .filter((c): c is CropEntry => c !== null);

  // Group planned crops by status
  const ready = plannedCrops.filter(c => c.status === 'ready');
  const marginal = plannedCrops.filter(c => c.status === 'marginal');
  const tooCold = plannedCrops.filter(c => c.status === 'too_cold');

  // Count how many crops are in transplant data (to show in toggle)
  const transplantCount = cropReadinessTransplant ? Object.keys(cropReadinessTransplant).length : 0;
  const seedCount = cropReadinessForecast ? Object.keys(cropReadinessForecast).length : 0;

  // Direct-sow-only info
  const directSowOnlyEntries = directSowOnly ? Object.entries(directSowOnly) : [];

  const hasNoData = plantingEvents.length === 0 && otherCrops.length === 0;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setMode('seed')}
          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'seed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Direct Seeding ({seedCount})
        </button>
        <button
          onClick={() => setMode('transplant')}
          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'transplant'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Transplanting ({transplantCount})
        </button>
      </div>

      {useForecast && (
        <p className="text-xs text-gray-500">
          {mode === 'seed'
            ? 'Readiness for direct seeding based on soil temps across each crop\'s germination window.'
            : 'Readiness for transplanting based on soil temps across a 7-day root establishment window. Direct-sow-only crops are excluded.'
          }
          {' '}Hover over squares for daily details.
        </p>
      )}

      {hasNoData && (
        <div className="text-center py-8 text-gray-500">
          <p>No planting events yet. Add crops to see planting readiness.</p>
        </div>
      )}

      {/* Planned crops sections */}
      {plannedCrops.length > 0 && (
        <>
          {ready.length > 0 && (
            <CollapsibleSection
              label={mode === 'transplant' ? 'Ready to Transplant' : 'Ready to Plant'}
              count={ready.length}
              dotColor="bg-green-500"
              textColor="text-green-700"
              defaultOpen={true}
            >
              {renderCropGrid(ready, windowLabel)}
            </CollapsibleSection>
          )}

          {marginal.length > 0 && (
            <CollapsibleSection
              label="Marginal - Wait for Warmer Weather"
              count={marginal.length}
              dotColor="bg-yellow-500"
              textColor="text-yellow-700"
              defaultOpen={true}
            >
              {renderCropGrid(marginal, windowLabel)}
            </CollapsibleSection>
          )}

          {tooCold.length > 0 && (
            <CollapsibleSection
              label={mode === 'transplant' ? 'Too Cold - Do Not Transplant' : 'Too Cold - Do Not Plant'}
              count={tooCold.length}
              dotColor="bg-red-500"
              textColor="text-red-700"
              defaultOpen={false}
            >
              {renderCropGrid(tooCold, windowLabel)}
            </CollapsibleSection>
          )}
        </>
      )}

      {plannedCrops.length === 0 && plantingEvents.length > 0 && (
        <div className="text-center py-6 text-gray-500">
          <p>
            {mode === 'transplant'
              ? 'None of your planned crops are typically transplanted.'
              : 'Soil temperature data not available for your crops.'}
          </p>
        </div>
      )}

      {/* All Other Crops — collapsed by default */}
      {otherCrops.length > 0 && (
        <CollapsibleSection
          label="All Other Crops"
          count={otherCrops.length}
          dotColor="bg-indigo-400"
          textColor="text-indigo-700"
          defaultOpen={false}
        >
          {renderCropGrid(otherCrops, windowLabel)}
        </CollapsibleSection>
      )}

      {/* Direct-Sow Only — transplant tab only, collapsed */}
      {mode === 'transplant' && directSowOnlyEntries.length > 0 && (
        <CollapsibleSection
          label="Direct-Sow Only"
          count={directSowOnlyEntries.length}
          dotColor="bg-gray-400"
          textColor="text-gray-600"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {directSowOnlyEntries.map(([plantId, info]) => (
              <div key={plantId} className="rounded-lg border p-3 bg-gray-50 border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 font-medium">{info.name}</span>
                  <span className="text-xs text-gray-500">Direct sow only (needs {info.soil_temp_min}°F)</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

export default ReadinessIndicator;
