import React, { useState } from 'react';
import { Modal, Button, FormFileInput, FormSelect, FormTextarea, useToast } from '../common';

import { API_BASE_URL } from '../../config';
interface UploadPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadProgress {
  [filename: string]: number;
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

export const UploadPhotoModal: React.FC<UploadPhotoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState('garden');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (files.length === 0) {
      newErrors.files = 'Please select at least one photo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFile = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', caption);
    formData.append('category', category);

    try {
      // Initialize progress
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

      const response = await fetch(`${API_BASE_URL}/api/photos`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        return true;
      } else {
        showError(`Failed to upload ${file.name}`);
        return false;
      }
    } catch (error) {
      showError(`Network error uploading ${file.name}`);
      return false;
    }
  };

  const handleUpload = async () => {
    if (!validate()) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    // Upload files sequentially
    for (const file of files) {
      const success = await uploadFile(file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      showSuccess(`Successfully uploaded ${successCount} photo${successCount > 1 ? 's' : ''}!`);
      onSuccess(); // Refresh gallery
      handleClose();
    }

    if (failCount > 0) {
      showError(`Failed to upload ${failCount} photo${failCount > 1 ? 's' : ''}`);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setCategory('garden');
      setCaption('');
      setUploadProgress({});
      setErrors({});
      onClose();
    }
  };

  const isFileUploading = (filename: string) => {
    const progress = uploadProgress[filename];
    return progress !== undefined && progress < 100;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Photos"
      size="large"
      showCloseButton={!uploading}
    >
      <div className="space-y-4">
        <FormFileInput
          label="Select Photos"
          accept="image/png,image/jpeg,image/jpg,image/gif"
          multiple={true}
          maxSize={16 * 1024 * 1024} // 16MB
          onChange={setFiles}
          error={errors.files}
          helperText="PNG, JPG, GIF (max 16MB each)"
        />

        <FormSelect
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          helperText="Choose the category for these photos"
        />

        <FormTextarea
          label="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          placeholder="Add a description for these photos..."
          helperText="This caption will apply to all uploaded photos"
        />

        {/* Upload Progress */}
        {uploading && files.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-medium text-gray-700">Uploading...</p>
            {files.map((file) => {
              const progress = uploadProgress[file.name] || 0;
              const isUploading = isFileUploading(file.name);
              const isComplete = progress === 100;

              return (
                <div key={file.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {isComplete ? '✓' : isUploading ? `${progress}%` : 'Waiting...'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isComplete ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="ghost" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={files.length === 0}
          >
            Upload {files.length > 0 && `(${files.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
