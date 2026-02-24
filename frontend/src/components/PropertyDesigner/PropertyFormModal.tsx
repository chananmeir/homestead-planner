import React, { useState, useEffect } from 'react';
import { Modal, Button, FormInput, FormNumber, FormSelect, FormTextarea, useToast } from '../common';
import { apiPost, apiPut } from '../../utils/api';
interface Property {
  id?: number;
  name: string;
  width: number;
  length: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  zone?: string;
  soilType?: string;
  slope?: string;
  notes?: string;
}

interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'add' | 'edit';
  propertyData?: Property | null;
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'add',
  propertyData,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Property>({
    name: '',
    width: 0,
    length: 0,
    address: '',
    latitude: undefined,
    longitude: undefined,
    zone: '',
    soilType: '',
    slope: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressValidation, setAddressValidation] = useState<{
    validated: boolean;
    loading: boolean;
    error: string | null;
  }>({
    validated: false,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && propertyData) {
        setFormData({ ...propertyData });
      } else {
        // Reset form for add mode
        setFormData({
          name: '',
          width: 0,
          length: 0,
          address: '',
          latitude: undefined,
          longitude: undefined,
          zone: '',
          soilType: '',
          slope: '',
          notes: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, propertyData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Property name is required';
    }

    if (!formData.width || formData.width <= 0) {
      newErrors.width = 'Width must be greater than 0';
    }

    if (!formData.length || formData.length <= 0) {
      newErrors.length = 'Length must be greater than 0';
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
      // Prepare data for backend (convert camelCase to snake_case)
      const payload = {
        name: formData.name,
        width: formData.width,
        length: formData.length,
        address: formData.address || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        zone: formData.zone || null,
        soil_type: formData.soilType || null,
        slope: formData.slope || null,
        notes: formData.notes || null,
      };

      const response = mode === 'edit' && formData.id
        ? await apiPut(`/api/properties/${formData.id}`, payload)
        : await apiPost('/api/properties', payload);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${mode} property`);
      }

      await response.json();
      showSuccess(mode === 'edit' ? 'Property updated successfully!' : 'Property created successfully!');
      onSuccess();
    } catch (error) {
      console.error(`Error ${mode}ing property:`, error);
      showError(error instanceof Error ? error.message : `Failed to ${mode} property`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Property, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    // Reset validation when address changes
    if (field === 'address') {
      setAddressValidation({ validated: false, loading: false, error: null });
    }
  };

  const handleValidateAddress = async () => {
    if (!formData.address || formData.address.trim() === '') {
      showError('Please enter an address first');
      return;
    }

    setAddressValidation({ validated: false, loading: true, error: null });

    try {
      const response = await apiPost('/api/properties/validate-address', { address: formData.address });

      const data = await response.json();

      if (!response.ok) {
        setAddressValidation({
          validated: false,
          loading: false,
          error: data.error || 'Address validation failed',
        });
        return;
      }

      // Auto-populate fields from validation
      if (data.formatted_address) {
        handleChange('address', data.formatted_address);
      }
      if (data.latitude) {
        setFormData(prev => ({ ...prev, latitude: data.latitude }));
      }
      if (data.longitude) {
        setFormData(prev => ({ ...prev, longitude: data.longitude }));
      }
      if (data.zone && !formData.zone) {
        handleChange('zone', data.zone);
      }

      setAddressValidation({
        validated: true,
        loading: false,
        error: null,
      });

      showSuccess('Address validated successfully!');
    } catch (error) {
      setAddressValidation({
        validated: false,
        loading: false,
        error: 'Failed to validate address',
      });
      showError('Address validation failed. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Property' : 'Create New Property'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Property Name */}
        <FormInput
          label="Property Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Main Homestead"
          required
          error={errors.name}
        />

        {/* Width and Length */}
        <div className="grid grid-cols-2 gap-4">
          <FormNumber
            label="Width (ft)"
            value={formData.width}
            onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)}
            placeholder="0"
            required
            min={0}
            step={0.1}
            error={errors.width}
          />

          <FormNumber
            label="Length (ft)"
            value={formData.length}
            onChange={(e) => handleChange('length', parseFloat(e.target.value) || 0)}
            placeholder="0"
            required
            min={0}
            step={0.1}
            error={errors.length}
          />
        </div>

        {/* Address with Validation */}
        <div className="space-y-2">
          <FormInput
            label="Address (Optional)"
            value={formData.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="e.g., 123 Farm Road, City, State"
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleValidateAddress}
              loading={addressValidation.loading}
              disabled={!formData.address || addressValidation.loading}
              className="text-sm"
            >
              Validate Address
            </Button>

            {addressValidation.validated && (
              <span className="text-green-600 text-sm flex items-center gap-1">
                ✓ Address validated
              </span>
            )}

            {addressValidation.error && (
              <span className="text-red-600 text-sm">
                {addressValidation.error}
              </span>
            )}
          </div>

          {addressValidation.validated && formData.zone && (
            <p className="text-xs text-gray-500">
              Auto-detected hardiness zone: <span className="font-medium">{formData.zone}</span>
            </p>
          )}
        </div>

        {/* USDA Hardiness Zone */}
        <FormSelect
          label="USDA Hardiness Zone (Optional)"
          value={formData.zone || ''}
          onChange={(e) => handleChange('zone', e.target.value)}
          options={[
            { value: '', label: 'Select zone...' },
            { value: '1a', label: 'Zone 1a' },
            { value: '1b', label: 'Zone 1b' },
            { value: '2a', label: 'Zone 2a' },
            { value: '2b', label: 'Zone 2b' },
            { value: '3a', label: 'Zone 3a' },
            { value: '3b', label: 'Zone 3b' },
            { value: '4a', label: 'Zone 4a' },
            { value: '4b', label: 'Zone 4b' },
            { value: '5a', label: 'Zone 5a' },
            { value: '5b', label: 'Zone 5b' },
            { value: '6a', label: 'Zone 6a' },
            { value: '6b', label: 'Zone 6b' },
            { value: '7a', label: 'Zone 7a' },
            { value: '7b', label: 'Zone 7b' },
            { value: '8a', label: 'Zone 8a' },
            { value: '8b', label: 'Zone 8b' },
            { value: '9a', label: 'Zone 9a' },
            { value: '9b', label: 'Zone 9b' },
            { value: '10a', label: 'Zone 10a' },
            { value: '10b', label: 'Zone 10b' },
            { value: '11a', label: 'Zone 11a' },
            { value: '11b', label: 'Zone 11b' },
            { value: '12a', label: 'Zone 12a' },
            { value: '12b', label: 'Zone 12b' },
            { value: '13a', label: 'Zone 13a' },
            { value: '13b', label: 'Zone 13b' },
          ]}
        />

        {/* Soil Type */}
        <FormSelect
          label="Soil Type (Optional)"
          value={formData.soilType || ''}
          onChange={(e) => handleChange('soilType', e.target.value)}
          options={[
            { value: '', label: 'Select soil type...' },
            { value: 'clay', label: 'Clay' },
            { value: 'loam', label: 'Loam' },
            { value: 'sandy', label: 'Sandy' },
            { value: 'silt', label: 'Silt' },
            { value: 'peat', label: 'Peat' },
            { value: 'chalk', label: 'Chalk' },
            { value: 'mixed', label: 'Mixed' },
          ]}
        />

        {/* Slope */}
        <FormSelect
          label="Slope (Optional)"
          value={formData.slope || ''}
          onChange={(e) => handleChange('slope', e.target.value)}
          options={[
            { value: '', label: 'Select slope...' },
            { value: 'flat', label: 'Flat (0-2%)' },
            { value: 'gentle', label: 'Gentle (2-5%)' },
            { value: 'moderate', label: 'Moderate (5-10%)' },
            { value: 'steep', label: 'Steep (>10%)' },
          ]}
        />

        {/* Notes */}
        <FormTextarea
          label="Notes (Optional)"
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes about the property..."
          rows={3}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            {mode === 'edit' ? 'Update Property' : 'Create Property'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
