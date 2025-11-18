import React, { useState, useRef } from 'react';
import { Modal, Button, FormSelect, useToast } from '../common';
import { API_BASE_URL } from '../../config';

interface ImportResult {
  variety: string;
  plant_id: string;
  days_to_maturity: number;
}

interface ImportResponse {
  success: boolean;
  imported: number;
  total_rows: number;
  crop_type: string;
  preview: ImportResult[];
  warnings?: string[];
}

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropType, setCropType] = useState('lettuce');
  const [isGlobal, setIsGlobal] = useState(true);  // Default to true (global catalog)
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cropTypes = [
    { value: 'lettuce', label: 'Lettuce' },
    { value: 'carrot', label: 'Carrots' },
    { value: 'tomato', label: 'Tomatoes' },
    { value: 'pepper', label: 'Peppers' },
    { value: 'bean', label: 'Beans' },
    { value: 'squash', label: 'Squash' },
    { value: 'cucumber', label: 'Cucumbers' },
    { value: 'pea', label: 'Peas' },
    { value: 'beet', label: 'Beets' },
    { value: 'radish', label: 'Radishes' },
    { value: 'broccoli', label: 'Broccoli' },
    { value: 'cauliflower', label: 'Cauliflower' },
    { value: 'cabbage', label: 'Cabbage' },
    { value: 'kale', label: 'Kale' },
    { value: 'potato', label: 'Potatoes' },
    { value: 'corn', label: 'Corn' },
    { value: 'asparagus', label: 'Asparagus' },
    { value: 'brussels-sprouts', label: 'Brussels Sprouts' },
    { value: 'eggplant', label: 'Eggplant' },
    { value: 'celery', label: 'Celery' },
    { value: 'shallot', label: 'Shallots' },
    { value: 'turnip', label: 'Turnips' },
    { value: 'collard-greens', label: 'Collard Greens' },
    { value: 'okra', label: 'Okra' },
    { value: 'kohlrabi', label: 'Kohlrabi' },
    { value: 'pumpkin', label: 'Pumpkins' },
    // Herbs
    { value: 'basil', label: 'Basil' },
    { value: 'cilantro', label: 'Cilantro' },
    { value: 'parsley', label: 'Parsley' },
    { value: 'dill', label: 'Dill' },
    { value: 'oregano', label: 'Oregano' },
    { value: 'thyme', label: 'Thyme' },
    { value: 'sage', label: 'Sage' },
    { value: 'rosemary', label: 'Rosemary' },
    { value: 'mint', label: 'Mint' },
    { value: 'fennel', label: 'Fennel' },
    { value: 'lavender', label: 'Lavender' },
    { value: 'lemon-balm', label: 'Lemon Balm' },
    { value: 'marjoram', label: 'Marjoram' },
    { value: 'tarragon', label: 'Tarragon' },
    // Berries/Fruits
    { value: 'blackberry', label: 'Blackberries' },
    { value: 'grape', label: 'Grapes' },
    { value: 'currant', label: 'Currants' },
    { value: 'gooseberry', label: 'Gooseberries' },
    { value: 'elderberry', label: 'Elderberries' },
    // Trees - Fruit
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'cherry-sweet', label: 'Cherry (Sweet)' },
    { value: 'cherry-sour', label: 'Cherry (Sour/Tart)' },
    { value: 'fig', label: 'Fig' },
    { value: 'peach', label: 'Peach' },
    { value: 'pear', label: 'Pear' },
    { value: 'persimmon', label: 'Persimmon' },
    { value: 'plum', label: 'Plum' },
    // Trees - Nut
    { value: 'almond', label: 'Almond' },
    { value: 'chestnut', label: 'Chestnut' },
    { value: 'hazelnut', label: 'Hazelnut (Filbert)' },
    { value: 'pecan', label: 'Pecan' },
    { value: 'walnut', label: 'Walnut' },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setImportResult(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setImportResult(null);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showError('Please select a CSV file to import');
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('cropType', cropType);
      formData.append('isGlobal', isGlobal.toString());

      const response = await fetch(`${API_BASE_URL}/api/varieties/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data);

      if (data.imported > 0) {
        showSuccess(`Successfully imported ${data.imported} varieties`);
        if (data.warnings && data.warnings.length > 0) {
          console.warn('Import warnings:', data.warnings);
        }
        onSuccess();
      } else {
        showError('No varieties were imported. Check for duplicates or errors.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import CSV';
      showError(errorMessage);
      console.error('CSV import error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCropType('lettuce');
    setIsGlobal(true);  // Reset to default (checked - global catalog)
    setImportResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Varieties from CSV" size="medium">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">CSV Format</h3>
          <p className="text-sm text-blue-800 mb-2">
            Your CSV file should include these columns:
          </p>
          <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
            <li><strong>Variety</strong> (required) - Name of the variety</li>
            <li><strong>Type</strong> (required) - Sub-type (e.g., Looseleaf, Romaine)</li>
            <li><strong>Days to Maturity</strong> (required) - Number or range (e.g., "46-50")</li>
            <li><strong>Soil Temp Sowing F</strong> (optional) - Temperature range</li>
            <li><strong>Notes</strong> (optional) - Additional information</li>
          </ul>
        </div>

        {/* Crop Type Selection */}
        <FormSelect
          label="Crop Type"
          value={cropType}
          onChange={(e) => setCropType(e.target.value)}
          options={cropTypes}
          disabled={loading}
        />

        {/* Share with All Users Checkbox */}
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <input
            type="checkbox"
            id="isGlobal"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500"
          />
          <label htmlFor="isGlobal" className="text-sm font-medium text-gray-700 cursor-pointer">
            Share with all users (add to global catalog)
          </label>
        </div>

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-green-500 bg-green-50'
              : selectedFile
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            disabled={loading}
          />

          {selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
              <Button
                onClick={handleFileButtonClick}
                variant="ghost"
                size="small"
                disabled={loading}
              >
                Choose Different File
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Drop your CSV file here, or
                </p>
                <Button
                  onClick={handleFileButtonClick}
                  variant="ghost"
                  size="small"
                  disabled={loading}
                >
                  Browse Files
                </Button>
              </div>
              <p className="text-xs text-gray-500">CSV files only</p>
            </div>
          )}
        </div>

        {/* Import Result Preview */}
        {importResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-2">Import Summary</h3>
            <div className="text-sm text-green-800 space-y-1">
              <p><strong>Imported:</strong> {importResult.imported} of {importResult.total_rows} varieties</p>
              <p><strong>Crop Type:</strong> {importResult.crop_type}</p>

              {importResult.preview && importResult.preview.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium mb-1">Preview (first 5):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {importResult.preview.map((item, idx) => (
                      <li key={idx}>
                        {item.variety} ({item.days_to_maturity} days)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.warnings && importResult.warnings.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-medium text-yellow-900 mb-1">Warnings:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-800">
                    {importResult.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={handleClose} variant="ghost" disabled={loading}>
            {importResult && importResult.imported > 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleImport}
            variant="primary"
            disabled={!selectedFile || loading}
            className="flex-1"
          >
            {loading ? 'Importing...' : 'Import Varieties'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
