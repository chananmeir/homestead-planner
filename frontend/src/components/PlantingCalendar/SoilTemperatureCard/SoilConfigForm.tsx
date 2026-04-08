import React from 'react';
import { SoilConfig } from './types';
import { GardenBed } from '../../../types';

const PROTECTION_LABELS: Record<string, { label: string; boost: number }> = {
  'row-cover': { label: 'Row Cover', boost: 4 },
  'low-tunnel': { label: 'Low Tunnel', boost: 6 },
  'cold-frame': { label: 'Cold Frame', boost: 10 },
  'high-tunnel': { label: 'High Tunnel', boost: 8 },
  'greenhouse': { label: 'Greenhouse', boost: 10 },
};

interface SoilConfigFormProps {
  config: SoilConfig;
  onChange: (config: SoilConfig) => void;
  gardenBeds?: GardenBed[];
}

const SoilConfigForm: React.FC<SoilConfigFormProps> = ({ config, onChange, gardenBeds = [] }) => {
  const bedSelected = config.gardenBedId != null;

  const handleBedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      onChange({ ...config, gardenBedId: undefined });
    } else {
      onChange({ ...config, gardenBedId: Number(value) });
    }
  };

  const handleSoilTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...config,
      soilType: e.target.value as SoilConfig['soilType']
    });
  };

  const handleSunExposureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...config,
      sunExposure: e.target.value as SoilConfig['sunExposure']
    });
  };

  const handleMulchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...config,
      hasMulch: e.target.checked
    });
  };

  const getProtectionLabel = (bed: GardenBed): string => {
    const ext = bed.seasonExtension;
    if (!ext || ext.type === 'none') return '';
    const info = PROTECTION_LABELS[ext.type];
    if (!info) return '';
    let label = `${info.label} +${info.boost}°F`;
    if (ext.innerType && ext.innerType !== 'none') {
      const inner = PROTECTION_LABELS[ext.innerType];
      if (inner) {
        label += ` + ${inner.label}`;
      }
    }
    return label;
  };

  return (
    <div className="space-y-4">
      {/* Garden Bed Selector */}
      {gardenBeds.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Garden Bed
          </label>
          <select
            value={config.gardenBedId ?? ''}
            onChange={handleBedChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">All Beds (Property Wide)</option>
            {gardenBeds.map(bed => {
              const protection = getProtectionLabel(bed);
              return (
                <option key={bed.id} value={bed.id}>
                  {bed.name}{protection ? ` — ${protection}` : ''}
                </option>
              );
            })}
          </select>
          {bedSelected && (
            <p className="mt-1 text-xs text-green-700">
              Using soil, sun, and mulch settings from this bed
            </p>
          )}
        </div>
      )}

      {/* Soil Conditions Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${bedSelected ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Soil Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Soil Type
          </label>
          <select
            value={config.soilType}
            onChange={handleSoilTypeChange}
            disabled={bedSelected}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
          >
            <option value="sandy">Sandy (warms faster)</option>
            <option value="loamy">Loamy (baseline)</option>
            <option value="clay">Clay (warms slower)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {config.soilType === 'sandy' && 'Good drainage, warms quickly (+2°F)'}
            {config.soilType === 'loamy' && 'Ideal garden soil, balanced warmth'}
            {config.soilType === 'clay' && 'Heavy soil, slow to warm (-2°F)'}
          </p>
        </div>

        {/* Sun Exposure */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sun Exposure
          </label>
          <select
            value={config.sunExposure}
            onChange={handleSunExposureChange}
            disabled={bedSelected}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
          >
            <option value="full-sun">Full Sun (6+ hrs)</option>
            <option value="partial-shade">Partial Shade (3-6 hrs)</option>
            <option value="full-shade">Full Shade (&lt;3 hrs)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {config.sunExposure === 'full-sun' && 'Direct sunlight warms soil (+3°F)'}
            {config.sunExposure === 'partial-shade' && 'Some direct sun (+1°F)'}
            {config.sunExposure === 'full-shade' && 'Shaded areas stay cooler (-2°F)'}
          </p>
        </div>

        {/* Mulch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mulch Present
          </label>
          <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={config.hasMulch}
              onChange={handleMulchChange}
              disabled={bedSelected}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">
              {config.hasMulch ? 'Yes, mulched' : 'No mulch'}
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            {config.hasMulch
              ? 'Mulch insulates, slows warming (-3°F)'
              : 'Bare soil warms with air temperature'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SoilConfigForm;
