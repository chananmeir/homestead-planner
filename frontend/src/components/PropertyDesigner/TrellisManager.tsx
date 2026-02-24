import React, { useState, useEffect } from 'react';
import { Modal, Button, FormInput, FormNumber, FormSelect, FormTextarea, useToast, ConfirmDialog } from '../common';
import { API_BASE_URL } from '../../config';
import { TrellisStructure, TrellisCapacity } from '../../types';

interface TrellisManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId: number;
}

export const TrellisManager: React.FC<TrellisManagerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
}) => {
  const { showSuccess, showError } = useToast();
  const [trellises, setTrellises] = useState<TrellisStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTrellis, setEditingTrellis] = useState<TrellisStructure | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [capacityData, setCapacityData] = useState<Record<number, TrellisCapacity>>({});

  const [formData, setFormData] = useState({
    name: '',
    trellisType: 'post_wire' as 'fence' | 'arbor' | 'a-frame' | 'post_wire' | 'espalier',
    startX: 0,
    startY: 0,
    endX: 10,
    endY: 10,
    heightInches: 72,
    wireSpacingInches: 12,
    numWires: 6,
    notes: '',
  });

  // Fetch trellises when modal opens
  useEffect(() => {
    if (isOpen && propertyId) {
      fetchTrellises();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, propertyId]);

  const fetchTrellises = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures?propertyId=${propertyId}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch trellises');

      const data = await response.json();
      setTrellises(data);

      // Fetch capacity for each trellis
      for (const trellis of data) {
        fetchCapacity(trellis.id);
      }
    } catch (error) {
      showError('Failed to load trellis structures');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCapacity = async (trellisId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures/${trellisId}/capacity`, {
        credentials: 'include',
      });

      if (!response.ok) return;

      const data = await response.json();
      setCapacityData(prev => ({ ...prev, [trellisId]: data }));
    } catch (error) {
      console.error('Failed to fetch capacity:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        propertyId,
      };

      const url = editingTrellis
        ? `${API_BASE_URL}/api/trellis-structures/${editingTrellis.id}`
        : `${API_BASE_URL}/api/trellis-structures`;

      const method = editingTrellis ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save trellis');
      }

      showSuccess(editingTrellis ? 'Trellis updated' : 'Trellis created');
      setShowForm(false);
      setEditingTrellis(null);
      resetForm();
      fetchTrellises();
      onSuccess();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures/${deletingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete trellis');
      }

      showSuccess('Trellis deleted');
      setShowDeleteConfirm(false);
      setDeletingId(null);
      fetchTrellises();
      onSuccess();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      trellisType: 'post_wire',
      startX: 0,
      startY: 0,
      endX: 10,
      endY: 10,
      heightInches: 72,
      wireSpacingInches: 12,
      numWires: 6,
      notes: '',
    });
  };

  const calculateLength = (startX: number, startY: number, endX: number, endY: number) => {
    const dx = endX - startX;
    const dy = endY - startY;
    return Math.sqrt(dx * dx + dy * dy).toFixed(1);
  };

  const calculatedLength = calculateLength(formData.startX, formData.startY, formData.endX, formData.endY);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Trellis Structures"
        size="large"
      >
        <div className="space-y-4">
          {!showForm ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                  Manage trellis structures for vine crops (grapes, pole beans, cucumbers, etc.)
                </p>
                <Button
                  variant="primary"
                  onClick={() => {
                    resetForm();
                    setEditingTrellis(null);
                    setShowForm(true);
                  }}
                >
                  + Add Trellis
                </Button>
              </div>

              {loading && <p className="text-center py-4">Loading...</p>}

              {!loading && trellises.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No trellis structures yet</p>
                  <p className="text-sm mt-2">Create a trellis to place vine crops</p>
                </div>
              )}

              {!loading && trellises.length > 0 && (
                <div className="space-y-3">
                  {trellises.map((trellis) => {
                    const capacity = capacityData[trellis.id];
                    return (
                      <div
                        key={trellis.id}
                        className="border rounded-lg p-4 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{trellis.name}</h3>
                            <div className="text-sm text-gray-600 space-y-1 mt-2">
                              <p>Type: <span className="capitalize">{trellis.trellisType.replace('_', ' ')}</span></p>
                              <p>Length: {trellis.totalLengthFeet} ft ({trellis.totalLengthInches} inches)</p>
                              <p>Height: {trellis.heightInches} inches</p>
                              {capacity && (
                                <p className={capacity.availableFeet < 5 ? 'text-orange-600 font-medium' : ''}>
                                  Capacity: {capacity.availableFeet.toFixed(1)} ft available
                                  ({capacity.percentOccupied.toFixed(0)}% occupied)
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => {
                                setFormData({
                                  name: trellis.name,
                                  trellisType: trellis.trellisType,
                                  startX: trellis.startX,
                                  startY: trellis.startY,
                                  endX: trellis.endX,
                                  endY: trellis.endY,
                                  heightInches: trellis.heightInches,
                                  wireSpacingInches: trellis.wireSpacingInches || 12,
                                  numWires: trellis.numWires || 6,
                                  notes: trellis.notes || '',
                                });
                                setEditingTrellis(trellis);
                                setShowForm(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => {
                                setDeletingId(trellis.id);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormInput
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., South Fence Trellis"
              />

              <FormSelect
                label="Trellis Type"
                value={formData.trellisType}
                onChange={(e) => setFormData({ ...formData, trellisType: e.target.value as any })}
                options={[
                  { value: 'post_wire', label: 'Post & Wire' },
                  { value: 'fence', label: 'Fence' },
                  { value: 'arbor', label: 'Arbor' },
                  { value: 'a-frame', label: 'A-Frame' },
                  { value: 'espalier', label: 'Espalier' },
                ]}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormNumber
                  label="Start X (feet)"
                  value={formData.startX}
                  onChange={(e) => setFormData({ ...formData, startX: parseFloat(e.target.value) || 0 })}
                  required
                  step={0.1}
                />
                <FormNumber
                  label="Start Y (feet)"
                  value={formData.startY}
                  onChange={(e) => setFormData({ ...formData, startY: parseFloat(e.target.value) || 0 })}
                  required
                  step={0.1}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormNumber
                  label="End X (feet)"
                  value={formData.endX}
                  onChange={(e) => setFormData({ ...formData, endX: parseFloat(e.target.value) || 0 })}
                  required
                  step={0.1}
                />
                <FormNumber
                  label="End Y (feet)"
                  value={formData.endY}
                  onChange={(e) => setFormData({ ...formData, endY: parseFloat(e.target.value) || 0 })}
                  required
                  step={0.1}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>Calculated Length:</strong> {calculatedLength} feet
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormNumber
                  label="Height (inches)"
                  value={formData.heightInches}
                  onChange={(e) => setFormData({ ...formData, heightInches: parseFloat(e.target.value) || 72 })}
                  required
                  min={24}
                  max={240}
                />
                <FormNumber
                  label="Wire Spacing (inches)"
                  value={formData.wireSpacingInches}
                  onChange={(e) => setFormData({ ...formData, wireSpacingInches: parseFloat(e.target.value) || 12 })}
                  min={6}
                  max={24}
                />
                <FormNumber
                  label="Number of Wires"
                  value={formData.numWires}
                  onChange={(e) => setFormData({ ...formData, numWires: parseInt(e.target.value) || 6 })}
                  min={1}
                  max={20}
                />
              </div>

              <FormTextarea
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this trellis..."
                rows={3}
              />

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTrellis(null);
                    resetForm();
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingTrellis ? 'Update Trellis' : 'Create Trellis'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingId(null);
        }}
        onConfirm={handleDelete}
        title="Delete Trellis?"
        message="This will permanently delete the trellis structure. Any plants allocated to it will need to be reassigned."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
};
