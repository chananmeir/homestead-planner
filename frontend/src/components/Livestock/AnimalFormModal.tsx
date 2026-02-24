import React, { useState, useEffect } from 'react';
import { Modal, Button, FormInput, FormSelect, FormTextarea, FormDatePicker, FormNumber, useToast } from '../common';

import { API_BASE_URL } from '../../config';
interface Animal {
  id?: number;
  name: string;
  breed?: string;
  quantity?: number;
  hatchDate?: string;
  purpose?: string;
  sex?: string;
  status?: string;
  coopLocation?: string;
  notes?: string;
  // Beehive specific
  type?: string;
  installDate?: string;
  queenMarked?: boolean;
  queenColor?: string;
  location?: string;
  // Other livestock
  animalType?: string;
}

interface AnimalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category: 'chickens' | 'ducks' | 'bees' | 'other';
  mode: 'add' | 'edit';
  animalData?: Animal | null;
}

export const AnimalFormModal: React.FC<AnimalFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
  mode,
  animalData,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Animal>({
    name: '',
    breed: '',
    quantity: 1,
    hatchDate: '',
    purpose: '',
    sex: '',
    status: 'active',
    coopLocation: '',
    notes: '',
    type: '',
    installDate: '',
    queenMarked: false,
    queenColor: '',
    location: '',
    animalType: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && animalData) {
        setFormData({ ...animalData });
      } else {
        // Reset form for add mode
        setFormData({
          name: '',
          breed: '',
          quantity: 1,
          hatchDate: '',
          purpose: '',
          sex: '',
          status: 'active',
          coopLocation: '',
          notes: '',
          type: '',
          installDate: '',
          queenMarked: false,
          queenColor: '',
          location: '',
          animalType: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, animalData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = 'Name is required';
    }

    if (category === 'other' && !formData.animalType) {
      newErrors.animalType = 'Animal type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getApiEndpoint = () => {
    const baseUrl = `${API_BASE_URL}/api`;
    switch (category) {
      case 'chickens':
        return mode === 'edit' ? `${baseUrl}/chickens/${animalData?.id}` : `${baseUrl}/chickens`;
      case 'ducks':
        return mode === 'edit' ? `${baseUrl}/ducks/${animalData?.id}` : `${baseUrl}/ducks`;
      case 'bees':
        return mode === 'edit' ? `${baseUrl}/beehives/${animalData?.id}` : `${baseUrl}/beehives`;
      case 'other':
        return mode === 'edit' ? `${baseUrl}/livestock/${animalData?.id}` : `${baseUrl}/livestock`;
    }
  };

  const buildPayload = () => {
    const payload: any = { name: formData.name };

    if (category === 'bees') {
      // Beehive specific fields
      if (formData.type) payload.type = formData.type;
      if (formData.installDate) payload.installDate = formData.installDate;
      if (formData.queenMarked !== undefined) payload.queenMarked = formData.queenMarked;
      if (formData.queenColor) payload.queenColor = formData.queenColor;
      if (formData.status) payload.status = formData.status;
      if (formData.location) payload.location = formData.location;
      if (formData.notes) payload.notes = formData.notes;
    } else if (category === 'other') {
      // Other livestock fields
      if (formData.animalType) payload.animalType = formData.animalType;
      if (formData.breed) payload.breed = formData.breed;
      if (formData.quantity) payload.quantity = formData.quantity;
      if (formData.notes) payload.notes = formData.notes;
    } else {
      // Chickens/Ducks fields
      if (formData.breed) payload.breed = formData.breed;
      if (formData.quantity) payload.quantity = formData.quantity;
      if (formData.hatchDate) payload.hatchDate = formData.hatchDate;
      if (formData.purpose) payload.purpose = formData.purpose;
      if (formData.sex) payload.sex = formData.sex;
      if (formData.status) payload.status = formData.status;
      if (formData.coopLocation) payload.coopLocation = formData.coopLocation;
      if (formData.notes) payload.notes = formData.notes;
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = buildPayload();
      const response = await fetch(getApiEndpoint(), {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showSuccess(`${getCategoryLabel()} ${mode === 'edit' ? 'updated' : 'added'} successfully!`);
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        showError(errorData.error || `Failed to ${mode} ${getCategoryLabel()}`);
      }
    } catch (error) {
      console.error(`Error ${mode}ing ${category}:`, error);
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'chickens':
        return 'Chicken';
      case 'ducks':
        return 'Duck';
      case 'bees':
        return 'Beehive';
      case 'other':
        return 'Livestock';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${mode === 'edit' ? 'Edit' : 'Add'} ${getCategoryLabel()}`}
    >
      <div className="space-y-4">
        <FormInput
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          placeholder={category === 'bees' ? 'e.g., Hive #1' : 'e.g., Henrietta'}
        />

        {category === 'other' && (
          <FormInput
            label="Animal Type"
            value={formData.animalType || ''}
            onChange={(e) => setFormData({ ...formData, animalType: e.target.value })}
            error={errors.animalType}
            required
            placeholder="e.g., Goat, Sheep, Pig, etc."
          />
        )}

        {category === 'bees' ? (
          <>
            <FormInput
              label="Hive Type"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="e.g., Langstroth, Top Bar, etc."
            />

            <FormDatePicker
              label="Install Date"
              value={formData.installDate || ''}
              onChange={(e) => setFormData({ ...formData, installDate: e.target.value })}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="queenMarked"
                checked={formData.queenMarked || false}
                onChange={(e) => setFormData({ ...formData, queenMarked: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="queenMarked" className="text-sm font-medium text-gray-700">
                Queen Marked
              </label>
            </div>

            {formData.queenMarked && (
              <FormSelect
                label="Queen Color"
                options={[
                  { value: '', label: 'Select color...' },
                  { value: 'white', label: 'White' },
                  { value: 'yellow', label: 'Yellow' },
                  { value: 'red', label: 'Red' },
                  { value: 'green', label: 'Green' },
                  { value: 'blue', label: 'Blue' },
                ]}
                value={formData.queenColor || ''}
                onChange={(e) => setFormData({ ...formData, queenColor: e.target.value })}
              />
            )}

            <FormInput
              label="Location"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., East garden, North yard, etc."
            />
          </>
        ) : (
          <>
            <FormSelect
              label="Breed"
              value={formData.breed || ''}
              onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
              options={
                category === 'chickens'
                  ? [
                      { value: '', label: 'Select breed...' },
                      { value: 'Ameraucana', label: 'Ameraucana (215 eggs/yr)' },
                      { value: 'Australorp', label: 'Australorp (275 eggs/yr)' },
                      { value: 'Austra White', label: 'Austra White (250 eggs/yr)' },
                      { value: 'Barnevelder', label: 'Barnevelder (190 eggs/yr)' },
                      { value: 'Bielefelder', label: 'Bielefelder (230 eggs/yr)' },
                      { value: 'Brahma', label: 'Brahma (175 eggs/yr)' },
                      { value: 'Cinnamon Queen', label: 'Cinnamon Queen (300 eggs/yr)' },
                      { value: 'Cochin', label: 'Cochin (130 eggs/yr)' },
                      { value: 'Cornish Cross', label: 'Cornish Cross (Meat)' },
                      { value: 'Delaware', label: 'Delaware (175 eggs/yr)' },
                      { value: 'Easter Egger', label: 'Easter Egger (240 eggs/yr)' },
                      { value: 'Golden Comet', label: 'Golden Comet (290 eggs/yr)' },
                      { value: 'ISA Brown', label: 'ISA Brown (300 eggs/yr)' },
                      { value: 'Leghorn', label: 'Leghorn (300 eggs/yr)' },
                      { value: 'Marans', label: 'Marans (215 eggs/yr)' },
                      { value: 'New Hampshire', label: 'New Hampshire (265 eggs/yr)' },
                      { value: 'Orpington', label: 'Orpington (228 eggs/yr)' },
                      { value: 'Plymouth Rock', label: 'Plymouth Rock (240 eggs/yr)' },
                      { value: 'Polish', label: 'Polish (180 eggs/yr)' },
                      { value: 'Rhode Island Red', label: 'Rhode Island Red (275 eggs/yr)' },
                      { value: 'Silkie', label: 'Silkie (120 eggs/yr)' },
                      { value: 'Sussex', label: 'Sussex (275 eggs/yr)' },
                      { value: 'Welsummer', label: 'Welsummer (200 eggs/yr)' },
                      { value: 'Wyandotte', label: 'Wyandotte (220 eggs/yr)' },
                      { value: 'Other', label: 'Other/Unknown (250 eggs/yr default)' },
                    ]
                  : category === 'ducks'
                  ? [
                      { value: '', label: 'Select breed...' },
                      { value: 'Ancona', label: 'Ancona (245 eggs/yr)' },
                      { value: 'Buff', label: 'Buff (185 eggs/yr)' },
                      { value: 'Cayuga', label: 'Cayuga (140 eggs/yr)' },
                      { value: 'Golden 300 Hybrid Layer', label: 'Golden 300 Hybrid Layer (260 eggs/yr)' },
                      { value: 'Khaki Campbell', label: 'Khaki Campbell (300 eggs/yr)' },
                      { value: 'Magpie', label: 'Magpie (220 eggs/yr)' },
                      { value: 'Muscovy', label: 'Muscovy (120 eggs/yr)' },
                      { value: 'Pekin', label: 'Pekin (200 eggs/yr)' },
                      { value: 'Runner', label: 'Runner (280 eggs/yr)' },
                      { value: 'Saxony', label: 'Saxony (215 eggs/yr)' },
                      { value: 'Silver Appleyard', label: 'Silver Appleyard (235 eggs/yr)' },
                      { value: 'Swedish', label: 'Swedish (150 eggs/yr)' },
                      { value: 'Welsh Harlequin', label: 'Welsh Harlequin (275 eggs/yr)' },
                      { value: 'White Layer', label: 'White Layer (260 eggs/yr)' },
                      { value: 'Other', label: 'Other/Unknown (200 eggs/yr default)' },
                    ]
                  : [
                      { value: '', label: 'Select breed...' },
                      { value: 'Alpine', label: 'Alpine (2,500 lbs milk/yr)' },
                      { value: 'Boer', label: 'Boer (Meat)' },
                      { value: 'Golden Guernsey', label: 'Golden Guernsey (1,050 lbs milk/yr)' },
                      { value: 'Kiko', label: 'Kiko (Meat)' },
                      { value: 'LaMancha', label: 'LaMancha (2,200 lbs milk/yr)' },
                      { value: 'Nigerian Dwarf', label: 'Nigerian Dwarf (750 lbs milk/yr)' },
                      { value: 'Nubian', label: 'Nubian (1,800 lbs milk/yr)' },
                      { value: 'Oberhasli', label: 'Oberhasli (2,000 lbs milk/yr)' },
                      { value: 'Sable', label: 'Sable (2,400 lbs milk/yr)' },
                      { value: 'Saanen', label: 'Saanen (2,600 lbs milk/yr)' },
                      { value: 'Spanish', label: 'Spanish (Meat)' },
                      { value: 'Toggenburg', label: 'Toggenburg (2,200 lbs milk/yr)' },
                      { value: 'Other', label: 'Other/Unknown (2,000 lbs/yr default)' },
                    ]
              }
            />

            <FormNumber
              label="Quantity"
              value={formData.quantity || 1}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              min={1}
              step={1}
            />

            {(category === 'chickens' || category === 'ducks') && (
              <>
                <FormDatePicker
                  label="Hatch Date"
                  value={formData.hatchDate || ''}
                  onChange={(e) => setFormData({ ...formData, hatchDate: e.target.value })}
                />

                <FormSelect
                  label="Purpose"
                  options={[
                    { value: '', label: 'Select purpose...' },
                    { value: 'eggs', label: 'Eggs' },
                    { value: 'meat', label: 'Meat' },
                    { value: 'dual', label: 'Dual Purpose' },
                    { value: 'pet', label: 'Pet' },
                  ]}
                  value={formData.purpose || ''}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />

                <FormSelect
                  label="Sex"
                  options={[
                    { value: '', label: 'Select sex...' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'mixed', label: 'Mixed' },
                  ]}
                  value={formData.sex || ''}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                />

                <FormInput
                  label="Coop Location"
                  value={formData.coopLocation || ''}
                  onChange={(e) => setFormData({ ...formData, coopLocation: e.target.value })}
                  placeholder="e.g., Main coop, Small run, etc."
                />
              </>
            )}
          </>
        )}

        <FormSelect
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'sold', label: 'Sold' },
            { value: 'deceased', label: 'Deceased' },
          ]}
          value={formData.status || 'active'}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        />

        <FormTextarea
          label="Notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any additional notes..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={loading} data-testid="animal-form-submit">
          {mode === 'edit' ? 'Save Changes' : `Add ${getCategoryLabel()}`}
        </Button>
      </div>
    </Modal>
  );
};
