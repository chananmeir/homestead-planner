import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { SeasonExtension, GardenBed } from '../../types';
import {
  HEIGHT_PRESETS,
  getNearestPreset,
  calculateSoilVolume,
  getDrainageRating,
  getSoilWarmingBenefit,
  getErgonomicBenefit,
  getWateringConsideration
} from '../../utils/raisedBedHeight';
import { getAllZones, getZone, ZoneId } from '../../utils/permacultureZones';

interface BedFormData {
  name: string;
  sizePreset: string;
  width: number;
  length: number;
  height: number;
  location: string;
  sunExposure: string;
  soilType: string;
  mulchType: string;
  planningMethod: string;
  zone?: ZoneId;
  seasonExtension?: SeasonExtension;
}

interface BedFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bedData: BedFormData) => Promise<void>;
  bed?: GardenBed; // Optional: for edit mode
}

interface PresetSize {
  id: string;
  label: string;
  width: number;
  length: number;
  description: string;
}

interface PlanningMethod {
  id: string;
  label: string;
  description: string;
  gridSize: number;
}

interface SunExposureOption {
  value: string;
  label: string;
  description: string;
}

const PRESET_SIZES: PresetSize[] = [
  { id: '3x3', label: '3\' × 3\' (9 sq ft)', width: 3, length: 3, description: 'Compact, perfect for small spaces' },
  { id: '3x6', label: '3\' × 6\' (18 sq ft)', width: 3, length: 6, description: 'Narrow, good for corner gardens' },
  { id: '4x4', label: '4\' × 4\' (16 sq ft)', width: 4, length: 4, description: 'Square-foot gardening classic' },
  { id: '4x8', label: '4\' × 8\' (32 sq ft)', width: 4, length: 8, description: 'Most common raised bed size' },
  { id: '4x12', label: '4\' × 12\' (48 sq ft)', width: 4, length: 12, description: 'Extended row gardening' },
  { id: '5x10', label: '5\' × 10\' (50 sq ft)', width: 5, length: 10, description: 'Intensive/bio-intensive' },
  { id: '5x20', label: '5\' × 20\' (100 sq ft)', width: 5, length: 20, description: 'Traditional plot garden' },
  { id: 'custom', label: 'Custom dimensions', width: 0, length: 0, description: 'Specify your own size' },
];

const PLANNING_METHODS: PlanningMethod[] = [
  { id: 'square-foot', label: 'Square-Foot Gardening', description: '12" cells, perfect for beginners and small spaces', gridSize: 12 },
  { id: 'row', label: 'Row Gardening', description: '6" cells, traditional rows for larger spaces', gridSize: 6 },
  { id: 'intensive', label: 'Intensive/Bio-Intensive', description: '6" cells, maximum yield per square foot', gridSize: 6 },
  { id: 'migardener', label: 'MIgardener High-Intensity', description: '3" cells, ultra-dense spacing for maximum productivity', gridSize: 3 },
  { id: 'raised-bed', label: 'Raised Bed', description: '6" cells, improved drainage & soil warming, height adjustable for accessibility', gridSize: 6 },
  { id: 'permaculture', label: 'Permaculture', description: '12" cells, for perennials and food forests', gridSize: 12 },
];

const SUN_EXPOSURE_OPTIONS: SunExposureOption[] = [
  { value: 'full', label: 'Full Sun (6+ hours)', description: 'Best for most vegetables' },
  { value: 'partial', label: 'Partial Sun (3-6 hours)', description: 'Good for leafy greens' },
  { value: 'shade', label: 'Shade (< 3 hours)', description: 'Limited crop options' },
];

interface SoilTypeOption {
  value: string;
  label: string;
  description: string;
}

const SOIL_TYPE_OPTIONS: SoilTypeOption[] = [
  { value: 'sandy', label: 'Sandy', description: 'Drains quickly, warms fast in spring' },
  { value: 'loamy', label: 'Loamy', description: 'Ideal balance, retains moisture well' },
  { value: 'clay', label: 'Clay', description: 'Heavy soil, slow to drain and warm' },
];

interface MulchTypeOption {
  value: string;
  label: string;
  description: string;
  tempEffect: string;
}

const MULCH_TYPE_OPTIONS: MulchTypeOption[] = [
  { value: 'none', label: 'No Mulch', description: 'Bare soil, warms quickly', tempEffect: 'Baseline' },
  { value: 'straw', label: 'Straw/Hay', description: 'Best for summer cooling', tempEffect: '-6°F spring, -10°F summer' },
  { value: 'wood-chips', label: 'Wood Chips', description: 'Long-lasting, moderate effect', tempEffect: '-4°F spring, -6°F summer' },
  { value: 'leaves', label: 'Leaves', description: 'Free, pack down over time', tempEffect: '-4°F spring, -6°F summer' },
  { value: 'grass', label: 'Grass Clippings', description: 'Quick nitrogen, watch thickness', tempEffect: '-3°F spring, -5°F summer' },
  { value: 'compost', label: 'Compost', description: 'Adds nutrients, mild effect', tempEffect: '-2°F (mild)' },
  { value: 'black-plastic', label: 'Black Plastic', description: 'Warms soil, season extension', tempEffect: '+8°F spring' },
  { value: 'clear-plastic', label: 'Clear Plastic', description: 'Maximum warming, watch overheating', tempEffect: '+15°F spring' },
];

const BedFormModal: React.FC<BedFormModalProps> = ({ isOpen, onClose, onSubmit, bed }) => {
  const isEditMode = !!bed;
  const [formData, setFormData] = useState<BedFormData>({
    name: '',
    sizePreset: '4x8',
    width: 4,
    length: 8,
    height: 12,
    location: '',
    sunExposure: 'full',
    soilType: 'loamy',
    mulchType: 'none',
    planningMethod: 'square-foot',
    zone: undefined,
    seasonExtension: {
      type: 'none',
      innerType: 'none',
      layers: 1,
      material: '',
      notes: ''
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Reset or populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && bed) {
        // Edit mode: populate with existing bed data
        // Determine size preset or set to custom
        const matchingPreset = PRESET_SIZES.find(
          p => p.width === bed.width && p.length === bed.length
        );

        setFormData({
          name: bed.name || '',
          sizePreset: matchingPreset?.id || 'custom',
          width: bed.width,
          length: bed.length,
          height: bed.height || 12,
          location: bed.location || '',
          sunExposure: bed.sunExposure || 'full',
          soilType: bed.soilType || 'loamy',
          mulchType: bed.mulchType || 'none',
          planningMethod: bed.planningMethod || 'square-foot',
          zone: bed.zone,
          seasonExtension: bed.seasonExtension || {
            type: 'none',
            innerType: 'none',
            layers: 1,
            material: '',
            notes: ''
          },
        });
      } else {
        // Create mode: reset to defaults
        setFormData({
          name: '',
          sizePreset: '4x8',
          width: 4,
          length: 8,
          height: 12,
          location: '',
          sunExposure: 'full',
          soilType: 'loamy',
          mulchType: 'none',
          planningMethod: 'square-foot',
          zone: undefined,
          seasonExtension: {
            type: 'none',
            innerType: 'none',
            layers: 1,
            material: '',
            notes: ''
          },
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditMode, bed]);

  const handlePresetChange = (presetId: string) => {
    const preset = PRESET_SIZES.find(p => p.id === presetId);
    if (preset) {
      setFormData({
        ...formData,
        sizePreset: presetId,
        width: preset.width,
        length: preset.length,
      });
      // Clear width/length errors when selecting preset
      const newErrors = { ...errors };
      delete newErrors.width;
      delete newErrors.length;
      setErrors(newErrors);
    }
  };

  const handleCustomDimensionChange = (field: 'width' | 'length', value: string) => {
    const numValue = parseFloat(value);
    setFormData({
      ...formData,
      [field]: isNaN(numValue) ? 0 : numValue,
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.width <= 0) {
      newErrors.width = 'Width must be greater than 0';
    }

    if (formData.length <= 0) {
      newErrors.length = 'Length must be greater than 0';
    }

    if (formData.width > 100) {
      newErrors.width = 'Width seems unreasonably large (max 100 feet)';
    }

    if (formData.length > 100) {
      newErrors.length = 'Length seems unreasonably large (max 100 feet)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        name: '',
        sizePreset: '4x8',
        width: 4,
        length: 8,
        height: 12,
        location: '',
        sunExposure: 'full',
        soilType: 'loamy',
        mulchType: 'none',
        planningMethod: 'square-foot',
        zone: undefined,
        seasonExtension: {
          type: 'none',
          innerType: 'none',
          layers: 1,
          material: '',
          notes: ''
        },
      });
      setErrors({});
      onClose();
    } catch (error) {
      // Error is already handled by parent component (shows toast)
      setErrors({ submit: isEditMode ? 'Failed to update bed. Please try again.' : 'Failed to create bed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const isCustom = formData.sizePreset === 'custom';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium" title={isEditMode ? "Edit Garden Bed" : "Add Garden Bed"}>
      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bed Name */}
          <div>
            <label htmlFor="bed-name" className="block text-sm font-medium text-gray-700 mb-1">
              Bed Name <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              id="bed-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="e.g., Front Yard Bed, Tomato Bed"
            />
          </div>

          {/* Size Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bed Size <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {PRESET_SIZES.map((preset) => (
                <label
                  key={preset.id}
                  className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.sizePreset === preset.id
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="sizePreset"
                    value={preset.id}
                    checked={formData.sizePreset === preset.id}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="mt-1 text-green-600 focus:ring-green-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">{preset.label}</div>
                    <div className="text-sm text-gray-600">{preset.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Dimensions */}
          {isCustom && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div>
                <label htmlFor="custom-width" className="block text-sm font-medium text-gray-700 mb-1">
                  Width (feet) <span className="text-red-500">*</span>
                </label>
                <input
                  id="custom-width"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formData.width || ''}
                  onChange={(e) => handleCustomDimensionChange('width', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.width ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="4"
                />
                {errors.width && <p className="mt-1 text-sm text-red-600">{errors.width}</p>}
              </div>

              <div>
                <label htmlFor="custom-length" className="block text-sm font-medium text-gray-700 mb-1">
                  Length (feet) <span className="text-red-500">*</span>
                </label>
                <input
                  id="custom-length"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formData.length || ''}
                  onChange={(e) => handleCustomDimensionChange('length', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.length ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="8"
                />
                {errors.length && <p className="mt-1 text-sm text-red-600">{errors.length}</p>}
              </div>
            </div>
          )}

          {/* Height (for all bed types) */}
          <div>
            <label htmlFor="bed-height" className="block text-sm font-medium text-gray-700 mb-2">
              Raised Bed Height (inches)
            </label>

            {/* Preset Height Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {HEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.height}
                  type="button"
                  onClick={() => setFormData({ ...formData, height: preset.height })}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                    formData.height === preset.height
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                  }`}
                >
                  {preset.height}"
                  <div className="text-xs font-normal mt-1">{preset.category}</div>
                </button>
              ))}
            </div>

            {/* Custom Height Input */}
            <div className="mb-3">
              <label htmlFor="custom-height" className="block text-xs font-medium text-gray-600 mb-1">
                Or enter custom height:
              </label>
              <input
                id="custom-height"
                type="number"
                min="4"
                max="48"
                step="1"
                value={formData.height || ''}
                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) || 12 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="12"
              />
            </div>

            {/* Height Benefits Display */}
            {formData.height && formData.height >= 4 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <div className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-green-900">
                      {getNearestPreset(formData.height).label}
                    </span>
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                      {getDrainageRating(formData.height).rating} drainage
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mb-2">
                    {getNearestPreset(formData.height).description}
                  </p>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded p-2">
                    <div className="font-medium text-gray-700 mb-1">🌱 Soil Warming</div>
                    <div className="text-gray-600">
                      {getSoilWarmingBenefit(formData.height).earlierPlanting}
                    </div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="font-medium text-gray-700 mb-1">💪 Ergonomics</div>
                    <div className="text-gray-600">
                      {getErgonomicBenefit(formData.height).benefit}
                    </div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="font-medium text-gray-700 mb-1">💧 Watering</div>
                    <div className="text-gray-600">
                      {getWateringConsideration(formData.height).frequency}
                    </div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="font-medium text-gray-700 mb-1">🪴 Soil Needed</div>
                    <div className="text-gray-600">
                      {formData.width && formData.length
                        ? `${calculateSoilVolume(formData.width, formData.length, formData.height).cubicFeet} cu ft`
                        : 'Enter size first'}
                    </div>
                  </div>
                </div>

                {/* Best For */}
                <div className="pt-2 border-t border-green-200">
                  <div className="text-xs font-medium text-green-900 mb-1">Best for:</div>
                  <div className="text-xs text-green-700">
                    {getNearestPreset(formData.height).bestFor.slice(0, 3).join(', ')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Planning Method */}
          <div>
            <label htmlFor="planning-method" className="block text-sm font-medium text-gray-700 mb-2">
              Planning Method <span className="text-red-500">*</span>
            </label>
            <select
              id="planning-method"
              value={formData.planningMethod}
              onChange={(e) => setFormData({ ...formData, planningMethod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {PLANNING_METHODS.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label} - {method.description}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Grid size will be automatically set based on method
            </p>
          </div>

          {/* Permaculture Zone */}
          <div>
            <label htmlFor="zone" className="block text-sm font-medium text-gray-700 mb-2">
              Permaculture Zone (optional)
            </label>
            <select
              id="zone"
              value={formData.zone || ''}
              onChange={(e) => setFormData({ ...formData, zone: (e.target.value || undefined) as ZoneId | undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">No zone assigned</option>
              {getAllZones().map((zone) => (
                <option key={zone.id} value={zone.id}>
                  Zone {zone.number}: {zone.description}
                </option>
              ))}
            </select>
            {formData.zone && (() => {
              const selectedZone = getZone(formData.zone);
              if (!selectedZone) return null;
              return (
                <div className={`mt-2 p-3 rounded-lg border-2 ${selectedZone.color.background} ${selectedZone.color.border}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs font-bold text-white rounded ${selectedZone.color.badge}`}>
                      Z{selectedZone.number}
                    </span>
                    <span className={`text-sm font-medium ${selectedZone.color.text}`}>
                      {selectedZone.name}
                    </span>
                  </div>
                  <p className={`text-xs ${selectedZone.color.text} mb-2`}>
                    <strong>Frequency:</strong> {selectedZone.frequency}
                  </p>
                  <p className={`text-xs ${selectedZone.color.text} mb-2`}>
                    <strong>Maintenance:</strong> {selectedZone.maintenance}
                  </p>
                  <p className={`text-xs ${selectedZone.color.text}`}>
                    <strong>Examples:</strong> {selectedZone.examples.join(', ')}
                  </p>
                </div>
              );
            })()}
            <p className="mt-1 text-xs text-gray-500">
              Organize beds by frequency of use: Zone 1 (daily) → Zone 5 (wilderness)
            </p>
          </div>

          {/* Sun Exposure */}
          <div>
            <label htmlFor="sun-exposure" className="block text-sm font-medium text-gray-700 mb-2">
              Sun Exposure
            </label>
            <select
              id="sun-exposure"
              value={formData.sunExposure}
              onChange={(e) => setFormData({ ...formData, sunExposure: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {SUN_EXPOSURE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          {/* Soil Type */}
          <div>
            <label htmlFor="soil-type" className="block text-sm font-medium text-gray-700 mb-2">
              Soil Type
            </label>
            <select
              id="soil-type"
              value={formData.soilType}
              onChange={(e) => setFormData({ ...formData, soilType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {SOIL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Affects soil temperature calculations and watering needs
            </p>
          </div>

          {/* Mulch Type */}
          <div>
            <label htmlFor="mulch-type" className="block text-sm font-medium text-gray-700 mb-2">
              Mulch Type
            </label>
            <select
              id="mulch-type"
              value={formData.mulchType}
              onChange={(e) => setFormData({ ...formData, mulchType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {MULCH_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.tempEffect}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Adjusts soil temperature estimates based on mulch material
            </p>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="e.g., Backyard, Side Yard, Greenhouse"
            />
          </div>

          {/* Season Extension / Protective Covers */}
          <div className="border-t border-gray-200 pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Season Extension</h3>
              <p className="text-sm text-gray-600">Add protective covers to extend your growing season and adjust soil temperatures</p>
            </div>

            {/* Protection Type */}
            <div>
              <label htmlFor="protection-type" className="block text-sm font-medium text-gray-700 mb-2">
                Protection Type
              </label>
              <select
                id="protection-type"
                value={formData.seasonExtension?.type || 'none'}
                onChange={(e) => setFormData({
                  ...formData,
                  seasonExtension: {
                    ...formData.seasonExtension!,
                    type: e.target.value as SeasonExtension['type']
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="none">None - No protection</option>
                <option value="row-cover">Row Cover (+4°F)</option>
                <option value="low-tunnel">Low Tunnel (+6°F)</option>
                <option value="cold-frame">Cold Frame (+10°F)</option>
                <option value="high-tunnel">High Tunnel (+8°F)</option>
                <option value="greenhouse">Greenhouse (+10°F)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Temperature boost affects planting date validation and frost protection
              </p>
            </div>

            {/* Conditional fields - only show if protection type is not 'none' */}
            {formData.seasonExtension?.type !== 'none' && (
              <>
                {/* Inner Protection Type */}
                <div className="mt-4">
                  <label htmlFor="inner-protection-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Inner Protection <span className="text-gray-500 text-xs">(optional, adds 65% efficiency)</span>
                  </label>
                  <select
                    id="inner-protection-type"
                    value={formData.seasonExtension?.innerType || 'none'}
                    onChange={(e) => setFormData({
                      ...formData,
                      seasonExtension: {
                        ...formData.seasonExtension!,
                        innerType: e.target.value as SeasonExtension['innerType']
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="row-cover">Row Cover</option>
                    <option value="low-tunnel">Low Tunnel</option>
                    <option value="cold-frame">Cold Frame</option>
                    <option value="high-tunnel">High Tunnel</option>
                    <option value="greenhouse">Greenhouse</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Example: Cold frame inside greenhouse for extra protection
                  </p>
                </div>

                {/* Number of Layers */}
                <div className="mt-4">
                  <label htmlFor="protection-layers" className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Layers
                  </label>
                  <input
                    id="protection-layers"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.seasonExtension?.layers || 1}
                    onChange={(e) => setFormData({
                      ...formData,
                      seasonExtension: {
                        ...formData.seasonExtension!,
                        layers: parseInt(e.target.value) || 1
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Eliot Coleman's system: each layer adds protection
                  </p>
                </div>

                {/* Material */}
                <div className="mt-4">
                  <label htmlFor="protection-material" className="block text-sm font-medium text-gray-700 mb-2">
                    Material <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <input
                    id="protection-material"
                    type="text"
                    value={formData.seasonExtension?.material || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      seasonExtension: {
                        ...formData.seasonExtension!,
                        material: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., 6mil plastic, Reemay fabric, twin-wall polycarbonate"
                  />
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label htmlFor="protection-notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <textarea
                    id="protection-notes"
                    rows={2}
                    value={formData.seasonExtension?.notes || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      seasonExtension: {
                        ...formData.seasonExtension!,
                        notes: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Installed November 1st, Remove when temps consistently above 50°F"
                  />
                </div>
              </>
            )}

            {/* Shade Cloth (Heat Protection) */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="mb-3">
                <h4 className="text-md font-semibold text-gray-800 mb-1">Heat Protection</h4>
                <p className="text-sm text-gray-600">Shade cloth reduces air temperature for heat-sensitive crops</p>
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="shade-cloth-toggle" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="shade-cloth-toggle"
                    type="checkbox"
                    checked={formData.seasonExtension?.shadeCloth?.installed || false}
                    onChange={(e) => setFormData({
                      ...formData,
                      seasonExtension: {
                        ...formData.seasonExtension!,
                        shadeCloth: {
                          installed: e.target.checked,
                          shadeFactor: formData.seasonExtension?.shadeCloth?.shadeFactor || 50
                        }
                      }
                    })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Shade Cloth Installed</span>
                </label>
              </div>

              {formData.seasonExtension?.shadeCloth?.installed && (
                <div className="mt-3">
                  <label htmlFor="shade-factor" className="block text-sm font-medium text-gray-700 mb-2">
                    Shade Factor
                  </label>
                  <select
                    id="shade-factor"
                    value={formData.seasonExtension?.shadeCloth?.shadeFactor || 50}
                    onChange={(e) => setFormData({
                      ...formData,
                      seasonExtension: {
                        ...formData.seasonExtension!,
                        shadeCloth: {
                          installed: true,
                          shadeFactor: parseInt(e.target.value)
                        }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="30">30% (-6°F) - Light shade</option>
                    <option value="40">40% (-8°F) - Moderate shade</option>
                    <option value="50">50% (-10°F) - Standard for vegetables</option>
                    <option value="60">60% (-12°F) - Heavy shade</option>
                    <option value="70">70% (-14°F) - Shade-loving plants</option>
                    <option value="80">80% (-16°F) - Maximum shade</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    50% shade cloth is standard for most vegetable gardens. Lower values for sun-loving crops, higher for lettuce and greens.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="create-bed-submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Update Bed' : 'Create Bed'
              )}
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default BedFormModal;
