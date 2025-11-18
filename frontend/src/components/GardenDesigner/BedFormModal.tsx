import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';

interface BedFormData {
  name: string;
  sizePreset: string;
  width: number;
  length: number;
  location: string;
  sunExposure: string;
  planningMethod: string;
}

interface BedFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bedData: BedFormData) => Promise<void>;
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
  { id: 'raised-bed', label: 'Raised Bed', description: '6" cells, ideal for poor soil or accessibility', gridSize: 6 },
  { id: 'permaculture', label: 'Permaculture', description: '12" cells, for perennials and food forests', gridSize: 12 },
];

const SUN_EXPOSURE_OPTIONS: SunExposureOption[] = [
  { value: 'full', label: 'Full Sun (6+ hours)', description: 'Best for most vegetables' },
  { value: 'partial', label: 'Partial Sun (3-6 hours)', description: 'Good for leafy greens' },
  { value: 'shade', label: 'Shade (< 3 hours)', description: 'Limited crop options' },
];

const BedFormModal: React.FC<BedFormModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<BedFormData>({
    name: '',
    sizePreset: '4x8',
    width: 4,
    length: 8,
    location: '',
    sunExposure: 'full',
    planningMethod: 'square-foot',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        sizePreset: '4x8',
        width: 4,
        length: 8,
        location: '',
        sunExposure: 'full',
        planningMethod: 'square-foot',
      });
      setErrors({});
    }
  }, [isOpen]);

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
        location: '',
        sunExposure: 'full',
        planningMethod: 'square-foot',
      });
      setErrors({});
      onClose();
    } catch (error) {
      // Error is already handled by parent component (shows toast)
      setErrors({ submit: 'Failed to create bed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const isCustom = formData.sizePreset === 'custom';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium" title="Add Garden Bed">
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
              disabled={loading}
              className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Bed'
              )}
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default BedFormModal;
