import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, FormInput, FormSelect, FormTextarea, FormDatePicker, FormNumber, useToast } from '../common';

import { API_BASE_URL } from '../../config';
interface Plant {
  id: string;
  name: string;
  category: string;
}

interface AddSeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CatalogSeed {
  id: number;
  variety: string;
  brand?: string;
}

export const AddSeedModal: React.FC<AddSeedModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [formData, setFormData] = useState({
    plantId: '',
    variety: '',
    brand: '',
    quantity: 1,
    purchaseDate: '',
    expirationDate: '',
    germinationRate: '',
    location: '',
    price: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Catalog dropdown state
  const [catalogSeeds, setCatalogSeeds] = useState<CatalogSeed[]>([]);
  const [useCustomVariety, setUseCustomVariety] = useState(false);
  const [selectedCatalogSeedId, setSelectedCatalogSeedId] = useState<string>('');

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

  const fetchCatalogSeeds = useCallback(async (plantId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/seed-catalog`, { credentials: 'include' });
      const data = await response.json();
      // Filter to only seeds for this plant
      const filtered = data.filter((seed: any) => seed.plantId === plantId);
      setCatalogSeeds(filtered);
    } catch (error) {
      console.error('Error fetching catalog seeds:', error);
      setCatalogSeeds([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPlants();
      // Reset form when modal opens
      setFormData({
        plantId: '',
        variety: '',
        brand: '',
        quantity: 1,
        purchaseDate: '',
        expirationDate: '',
        germinationRate: '',
        location: '',
        price: '',
        notes: '',
      });
      setErrors({});
      setUseCustomVariety(false);
      setSelectedCatalogSeedId('');
      setCatalogSeeds([]);
    }
  }, [isOpen, fetchPlants]);

  // Fetch catalog seeds when plant is selected and not using custom variety
  useEffect(() => {
    if (formData.plantId && !useCustomVariety) {
      fetchCatalogSeeds(formData.plantId);
    } else {
      setCatalogSeeds([]);
      setSelectedCatalogSeedId('');
    }
  }, [formData.plantId, useCustomVariety, fetchCatalogSeeds]);



  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.plantId) {
      newErrors.plantId = 'Plant is required';
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (formData.germinationRate && (Number(formData.germinationRate) < 0 || Number(formData.germinationRate) > 100)) {
      newErrors.germinationRate = 'Germination rate must be between 0 and 100';
    }

    if (formData.price && Number(formData.price) < 0) {
      newErrors.price = 'Price cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // If using catalog selection, use the from-catalog endpoint
      if (selectedCatalogSeedId && !useCustomVariety) {
        const payload: any = {
          catalogSeedId: parseInt(selectedCatalogSeedId),
          quantity: formData.quantity,
        };

        if (formData.purchaseDate) payload.purchaseDate = formData.purchaseDate;
        if (formData.location) payload.location = formData.location;
        if (formData.notes) payload.notes = formData.notes;

        const response = await fetch(`${API_BASE_URL}/api/my-seeds/from-catalog`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          showSuccess('Seed added from catalog!');
          onSuccess();
          onClose();
        } else {
          const errorData = await response.json();
          showError(errorData.error || 'Failed to add seed');
        }
      } else {
        // Custom variety - use regular endpoint
        const payload: any = {
          plantId: formData.plantId,
          variety: formData.variety,
          quantity: formData.quantity,
        };

        if (formData.brand) payload.brand = formData.brand;
        if (formData.purchaseDate) payload.purchaseDate = formData.purchaseDate;
        if (formData.expirationDate) payload.expirationDate = formData.expirationDate;
        if (formData.germinationRate) payload.germinationRate = Number(formData.germinationRate);
        if (formData.location) payload.location = formData.location;
        if (formData.price) payload.price = Number(formData.price);
        if (formData.notes) payload.notes = formData.notes;

        const response = await fetch(`${API_BASE_URL}/api/seeds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          showSuccess('Custom seed added successfully!');
          onSuccess();
          onClose();
        } else {
          const errorData = await response.json();
          showError(errorData.error || 'Failed to add seed');
        }
      }
    } catch (error) {
      console.error('Error adding seed:', error);
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const plantOptions = plants.map(p => ({
    value: p.id,
    label: `${p.name} (${p.category})`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Seed">
      <div className="space-y-4">
        <FormSelect
          label="Plant"
          options={[{ value: '', label: 'Select a plant...' }, ...plantOptions]}
          value={formData.plantId}
          onChange={(e) => setFormData({ ...formData, plantId: e.target.value })}
          error={errors.plantId}
          required
        />

        {/* Checkbox to toggle custom variety */}
        {formData.plantId && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useCustomVariety"
              checked={useCustomVariety}
              onChange={(e) => {
                setUseCustomVariety(e.target.checked);
                if (e.target.checked) {
                  setSelectedCatalogSeedId('');
                  setFormData({ ...formData, variety: '', brand: '' });
                }
              }}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="useCustomVariety" className="text-sm text-gray-700">
              Add custom variety (not in catalog)
            </label>
          </div>
        )}

        {/* Conditional rendering: dropdown for catalog, text input for custom */}
        {formData.plantId && !useCustomVariety && catalogSeeds.length > 0 ? (
          <FormSelect
            label="Select from Catalog"
            options={[
              { value: '', label: 'Choose a variety...' },
              ...catalogSeeds.map(seed => ({
                value: seed.id.toString(),
                label: `${seed.variety}${seed.brand ? ` (${seed.brand})` : ''}`
              }))
            ]}
            value={selectedCatalogSeedId}
            onChange={(e) => {
              setSelectedCatalogSeedId(e.target.value);
              const selected = catalogSeeds.find(s => s.id.toString() === e.target.value);
              if (selected) {
                setFormData({
                  ...formData,
                  variety: selected.variety,
                  brand: selected.brand || ''
                });
              }
            }}
          />
        ) : (
          <>
            <FormInput
              label="Variety"
              value={formData.variety}
              onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
              placeholder="e.g., Cherry Tomato, Beefsteak, etc."
            />

            <FormInput
              label="Brand"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="e.g., Burpee, Ferry-Morse, etc."
            />
          </>
        )}

        <FormNumber
          label="Quantity"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
          error={errors.quantity}
          required
          min={0}
          step={1}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormDatePicker
            label="Purchase Date"
            value={formData.purchaseDate}
            onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
          />

          <FormDatePicker
            label="Expiration Date"
            value={formData.expirationDate}
            onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
          />
        </div>

        <FormNumber
          label="Germination Rate (%)"
          value={formData.germinationRate}
          onChange={(e) => setFormData({ ...formData, germinationRate: e.target.value })}
          error={errors.germinationRate}
          min={0}
          max={100}
          step={1}
          placeholder="0-100"
        />

        <FormInput
          label="Storage Location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="e.g., Basement shelf, Garage cabinet, etc."
        />

        <FormNumber
          label="Price ($)"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          error={errors.price}
          min={0}
          step={0.01}
          placeholder="0.00"
        />

        <FormTextarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any additional notes about this seed..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={loading}>
          Add Seed
        </Button>
      </div>
    </Modal>
  );
};
