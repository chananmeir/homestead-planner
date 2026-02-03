import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, FormSelect, FormTextarea, FormDatePicker, FormNumber, useToast } from '../common';

import { API_BASE_URL } from '../../config';
interface Plant {
  id: string;
  name: string;
  category: string;
}

interface HarvestRecord {
  id: number;
  plantId: string;
  harvestDate: string;
  quantity: number;
  unit: string;
  quality: string;
  notes?: string;
}

interface EditHarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  harvestData: HarvestRecord;
}

export const EditHarvestModal: React.FC<EditHarvestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  harvestData
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [formData, setFormData] = useState({
    plantId: harvestData.plantId,
    harvestDate: harvestData.harvestDate.split('T')[0], // Format for date input
    quantity: harvestData.quantity,
    unit: harvestData.unit,
    quality: harvestData.quality,
    notes: harvestData.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when harvestData changes
  useEffect(() => {
    setFormData({
      plantId: harvestData.plantId,
      harvestDate: harvestData.harvestDate.split('T')[0],
      quantity: harvestData.quantity,
      unit: harvestData.unit,
      quality: harvestData.quality,
      notes: harvestData.notes || '',
    });
  }, [harvestData]);

  const fetchPlants = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/plants`, { credentials: 'include' });
      const data = await response.json();
      setPlants(data);
    } catch (error) {
      console.error('Error fetching plants:', error);
      showError('Failed to load plant list');
    }
  }, [showError]);

  useEffect(() => {
    if (isOpen) {
      fetchPlants();
      setErrors({});
    }
  }, [isOpen, fetchPlants]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.plantId) {
      newErrors.plantId = 'Plant is required';
    }

    if (!formData.harvestDate) {
      newErrors.harvestDate = 'Harvest date is required';
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        plantId: formData.plantId,
        harvestDate: formData.harvestDate,
        quantity: formData.quantity,
        unit: formData.unit,
        quality: formData.quality,
        notes: formData.notes || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/harvests/${harvestData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (response.ok) {
        showSuccess('Harvest updated successfully!');
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update harvest');
      }
    } catch (error) {
      console.error('Error updating harvest:', error);
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const plantOptions = plants.map(p => ({
    value: p.id,
    label: `${p.name} (${p.category})`,
  }));

  const unitOptions = [
    { value: 'lbs', label: 'Pounds (lbs)' },
    { value: 'oz', label: 'Ounces (oz)' },
    { value: 'count', label: 'Count' },
    { value: 'bunches', label: 'Bunches' },
  ];

  const qualityOptions = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Harvest">
      <div className="space-y-4">
        <FormSelect
          label="Plant"
          options={[{ value: '', label: 'Select a plant...' }, ...plantOptions]}
          value={formData.plantId}
          onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
          error={errors.plantId}
          required
        />

        <FormDatePicker
          label="Harvest Date"
          value={formData.harvestDate}
          onChange={(e) => setFormData({ ...formData, harvestDate: e.target.value })}
          error={errors.harvestDate}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <FormNumber
            label="Quantity"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
            error={errors.quantity}
            required
            min={0.1}
            step={0.1}
          />

          <FormSelect
            label="Unit"
            options={unitOptions}
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            required
          />
        </div>

        <FormSelect
          label="Quality"
          options={qualityOptions}
          value={formData.quality}
          onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
          required
        />

        <FormTextarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any notes about this harvest..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={loading}>
          Update Harvest
        </Button>
      </div>
    </Modal>
  );
};
