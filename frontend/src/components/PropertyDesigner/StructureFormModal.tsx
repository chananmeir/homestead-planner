import React, { useState, useEffect } from 'react';
import { Modal, Button, FormInput, FormNumber, FormSelect, FormTextarea, useToast, ConfirmDialog } from '../common';
import { API_BASE_URL } from '../../config';

interface Structure {
  id: string;
  name: string;
  category: string;
  width: number;
  length: number;
  description?: string;
  icon?: string;
  cost?: number;
}

interface PlacedStructure {
  id?: number;
  propertyId: number;
  structureId: string;
  name?: string;
  position: {
    x: number;
    y: number;
  };
  rotation?: number;
  notes?: string;
  builtDate?: string;
  cost?: number;
}

interface StructureFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId: number;
  mode?: 'add' | 'edit';
  structureData?: PlacedStructure | null;
  availableStructures: Structure[];
  prefilledPosition?: {x: number, y: number, structureId: string} | null;
  onDelete?: (id: number) => void;
}

export const StructureFormModal: React.FC<StructureFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  mode = 'add',
  structureData,
  availableStructures,
  prefilledPosition,
  onDelete,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<PlacedStructure>({
    propertyId,
    structureId: '',
    name: '',
    position: { x: 0, y: 0 },
    rotation: 0,
    notes: '',
    builtDate: '',
    cost: undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);

  // Handle modal open/close and mode changes
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});

    if (mode === 'edit' && structureData) {
      setFormData({ ...structureData, propertyId });
      // Find and set the selected structure
      const structure = availableStructures.find(s => s.id === structureData.structureId);
      setSelectedStructure(structure || null);
    } else {
      // Reset form for add mode
      setFormData({
        propertyId,
        structureId: '',
        name: '',
        position: { x: 0, y: 0 },
        rotation: 0,
        notes: '',
        builtDate: '',
        cost: undefined,
      });
      setSelectedStructure(null);
    }
  }, [isOpen, mode, structureData, propertyId, availableStructures]);

  // Handle pre-filled position from drag-drop (separate effect to avoid re-renders)
  useEffect(() => {
    if (isOpen && mode !== 'edit' && prefilledPosition) {
      const structure = availableStructures.find(s => s.id === prefilledPosition.structureId);

      setFormData(prev => ({
        ...prev,
        structureId: prefilledPosition.structureId,
        position: { x: prefilledPosition.x, y: prefilledPosition.y },
        name: structure?.name || '',
        cost: structure?.cost,
      }));

      setSelectedStructure(structure || null);
    }
  }, [isOpen, mode, prefilledPosition, availableStructures]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.structureId || formData.structureId === '') {
      newErrors.structureId = 'Please select a structure';
    }

    if (formData.position.x < 0) {
      newErrors.positionX = 'Position X cannot be negative';
    }

    if (formData.position.y < 0) {
      newErrors.positionY = 'Position Y cannot be negative';
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
      const url = mode === 'edit' && formData.id
        ? `${API_BASE_URL}/api/placed-structures/${formData.id}`
        : `${API_BASE_URL}/api/placed-structures`;

      const method = mode === 'edit' ? 'PUT' : 'POST';

      // Prepare data for backend (convert camelCase to snake_case)
      const payload = {
        property_id: formData.propertyId,
        structure_id: formData.structureId,
        name: formData.name || null,
        position_x: formData.position.x,
        position_y: formData.position.y,
        rotation: formData.rotation || 0,
        notes: formData.notes || null,
        built_date: formData.builtDate || null,
        cost: formData.cost || null,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${mode} structure`);
      }

      await response.json();
      showSuccess(mode === 'edit' ? 'Structure updated successfully!' : 'Structure added successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(`Error ${mode}ing structure:`, error);
      showError(error instanceof Error ? error.message : `Failed to ${mode} structure`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.id || !onDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/placed-structures/${formData.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete structure');
      }

      showSuccess('Structure deleted successfully!');
      setShowDeleteConfirm(false);
      onDelete(formData.id);
      onSuccess();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete structure');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    if (field === 'positionX') {
      setFormData(prev => ({ ...prev, position: { ...prev.position, x: Number(value) } }));
    } else if (field === 'positionY') {
      setFormData(prev => ({ ...prev, position: { ...prev.position, y: Number(value) } }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleStructureSelect = (structureId: string) => {
    const structure = availableStructures.find(s => s.id === structureId);
    setSelectedStructure(structure || null);

    // Auto-populate structure name if custom name is empty
    if (structure && !formData.name) {
      setFormData(prev => ({
        ...prev,
        structureId,
        name: structure.name,
        cost: structure.cost || prev.cost,
      }));
    } else {
      setFormData(prev => ({ ...prev, structureId }));
    }

    // Clear structure error
    if (errors.structureId) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.structureId;
        return newErrors;
      });
    }
  };

  // Group structures by category
  const structuresByCategory = availableStructures.reduce((acc, structure) => {
    if (!acc[structure.category]) {
      acc[structure.category] = [];
    }
    acc[structure.category].push(structure);
    return acc;
  }, {} as Record<string, Structure[]>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Structure' : 'Add Structure'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Structure Selection */}
        <FormSelect
          label="Structure Type"
          value={formData.structureId}
          onChange={(e) => handleStructureSelect(e.target.value)}
          required
          error={errors.structureId}
          options={[
            { value: '', label: 'Select a structure...' },
            ...Object.entries(structuresByCategory).flatMap(([category, structures]) => [
              { value: `category-${category}`, label: `--- ${category.toUpperCase()} ---`, disabled: true },
              ...structures.map(s => ({
                value: s.id,
                label: `${s.icon} ${s.name} (${s.width}x${s.length} ft)`,
              })),
            ]),
          ]}
        />

        {/* Show selected structure details */}
        {selectedStructure && (
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{selectedStructure.icon}</span>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{selectedStructure.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{selectedStructure.description}</p>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>Size: {selectedStructure.width}' × {selectedStructure.length}'</span>
                  {selectedStructure.cost && <span>Est. Cost: ${selectedStructure.cost}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Name */}
        <FormInput
          label="Custom Name (Optional)"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder={selectedStructure ? `e.g., ${selectedStructure.name} #1` : 'e.g., Main Coop'}
          helperText="Leave empty to use default structure name"
        />

        {/* Position X and Y */}
        <div className="grid grid-cols-2 gap-4">
          <FormNumber
            label="Position X (ft from left)"
            value={formData.position.x}
            onChange={(e) => handleChange('positionX', parseFloat(e.target.value) || 0)}
            placeholder="0"
            required
            min={0}
            step={0.1}
            error={errors.positionX}
          />

          <FormNumber
            label="Position Y (ft from top)"
            value={formData.position.y}
            onChange={(e) => handleChange('positionY', parseFloat(e.target.value) || 0)}
            placeholder="0"
            required
            min={0}
            step={0.1}
            error={errors.positionY}
          />
        </div>

        {/* Rotation */}
        <FormSelect
          label="Rotation (Optional)"
          value={formData.rotation?.toString() || '0'}
          onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
          options={[
            { value: '0', label: '0° (Default)' },
            { value: '90', label: '90° (Clockwise)' },
            { value: '180', label: '180° (Upside down)' },
            { value: '270', label: '270° (Counter-clockwise)' },
          ]}
        />

        {/* Cost */}
        <FormNumber
          label="Actual Cost (Optional)"
          value={formData.cost || ''}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            handleChange('cost', isNaN(value) ? 0 : value);
          }}
          placeholder={selectedStructure?.cost !== undefined ? `Est. $${selectedStructure.cost}` : '0'}
          min={0}
          step={0.01}
          helperText="Enter actual cost if different from estimate"
        />

        {/* Built Date */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Built Date (Optional)
          </label>
          <input
            type="date"
            value={formData.builtDate || ''}
            onChange={(e) => handleChange('builtDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notes */}
        <FormTextarea
          label="Notes (Optional)"
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes about this structure..."
          rows={3}
        />

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4">
          {/* Delete button (only in edit mode) */}
          {mode === 'edit' && formData.id && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
            >
              Delete
            </Button>
          )}

          {/* Cancel and Save buttons */}
          <div className="flex gap-3 ml-auto">
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
              {mode === 'edit' ? 'Update Structure' : 'Add Structure'}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Structure"
        message={`Are you sure you want to delete "${formData.name || selectedStructure?.name}"? This action cannot be undone.`}
        confirmText="Delete Structure"
        variant="danger"
      />
    </Modal>
  );
};
