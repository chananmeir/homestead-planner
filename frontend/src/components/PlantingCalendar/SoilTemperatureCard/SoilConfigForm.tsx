import React from 'react';
import { SoilConfig } from './types';

interface SoilConfigFormProps {
  config: SoilConfig;
  onChange: (config: SoilConfig) => void;
}

const SoilConfigForm: React.FC<SoilConfigFormProps> = ({ config, onChange }) => {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Soil Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Soil Type
        </label>
        <select
          value={config.soilType}
          onChange={handleSoilTypeChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
  );
};

export default SoilConfigForm;
