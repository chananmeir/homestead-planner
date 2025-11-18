import React, { useState, useEffect } from 'react';
import { Modal, Button, FormTextarea, FormSelect, useToast } from '../common';

import { API_BASE_URL } from '../../config';
interface Photo {
  id: number;
  filename: string;
  filepath: string;
  caption: string | null;
  category: string;
  gardenBedId: number | null;
  uploadedAt: string;
}

interface EditPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: Photo | null;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'garden', label: 'Garden' },
  { value: 'harvest', label: 'Harvest' },
  { value: 'plants', label: 'Plants' },
  { value: 'progress', label: 'Progress' },
  { value: 'pest', label: 'Pest' },
  { value: 'disease', label: 'Disease' },
  { value: 'other', label: 'Other' },
];

export const EditPhotoModal: React.FC<EditPhotoModalProps> = ({
  isOpen,
  onClose,
  photo,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    caption: '',
    category: 'garden',
    gardenBedId: null as number | null,
  });

  // Update form when photo changes
  useEffect(() => {
    if (photo) {
      setFormData({
        caption: photo.caption || '',
        category: photo.category || 'garden',
        gardenBedId: photo.gardenBedId,
      });
    }
  }, [photo]);

  const handleSubmit = async () => {
    if (!photo) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${photo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: formData.caption,
          category: formData.category,
          gardenBedId: formData.gardenBedId,
        }),
      });

      if (response.ok) {
        showSuccess('Photo updated successfully!');
        onSuccess();
        onClose();
      } else {
        showError('Failed to update photo');
      }
    } catch (error) {
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!photo) return null;

  const uploadDate = new Date(photo.uploadedAt);
  const formattedDate = uploadDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Photo" size="medium">
      <div className="space-y-4">
        {/* Photo Preview */}
        <div className="flex items-start gap-4">
          <img
            src={`${API_BASE_URL}${photo.filepath}`}
            alt={photo.caption || 'Photo'}
            className="w-24 h-24 object-cover rounded-lg border border-gray-200"
          />
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Filename:</span> {photo.filename}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Uploaded:</span> {formattedDate}
            </p>
          </div>
        </div>

        {/* Caption */}
        <FormTextarea
          label="Caption"
          value={formData.caption}
          onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
          rows={3}
          placeholder="Add a description for this photo..."
        />

        {/* Category */}
        <FormSelect
          label="Category"
          options={CATEGORIES}
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        />

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};
