import React, { useState, useRef } from 'react';
import { Modal, Button, useToast } from '../common';
import { API_BASE_URL } from '../../config';

interface ImportResponse {
  imported: number;
  skipped: number;
  totalRows: number;
  warnings: string[];
}

interface SeedImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SeedImportModal: React.FC<SeedImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      formData.append('skipDuplicates', skipDuplicates.toString());

      const response = await fetch(`${API_BASE_URL}/api/seeds/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data);

      if (data.imported > 0) {
        showSuccess(`Imported ${data.imported} seed${data.imported !== 1 ? 's' : ''}`);
        onSuccess();
      } else if (data.skipped > 0) {
        showSuccess(`All ${data.skipped} seeds already exist (skipped as duplicates)`);
      } else {
        showError('No seeds were imported. Check warnings for details.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import CSV';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setSkipDuplicates(true);
    setImportResult(null);
    setShowAllWarnings(false);
    onClose();
  };

  const visibleWarnings = importResult?.warnings
    ? showAllWarnings ? importResult.warnings : importResult.warnings.slice(0, 5)
    : [];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Seeds from CSV" size="medium">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Expected CSV Format</h3>
          <p className="text-sm text-blue-800 mb-2">
            Use the same format as the "Export to CSV" button. Required columns:
          </p>
          <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
            <li><strong>Plant</strong> (required) - Plant name (e.g., "Tomato", "Lettuce")</li>
            <li><strong>Variety</strong> (required) - Variety name (e.g., "Cherokee Purple")</li>
          </ul>
          <p className="text-xs text-blue-700 mt-2">
            All other columns (Brand, Quantity, DTM, spacing, etc.) are optional.
            Blank values are preserved as empty (not zero).
          </p>
        </div>

        {/* Skip Duplicates Checkbox */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <input
            type="checkbox"
            id="skipDuplicates"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500"
          />
          <label htmlFor="skipDuplicates" className="text-sm font-medium text-gray-700 cursor-pointer">
            Skip duplicates (same plant + variety + brand)
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

        {/* Import Result */}
        {importResult && (
          <div className={`border rounded-lg p-4 ${
            importResult.imported > 0
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Import Summary</h3>
            <div className="text-sm space-y-1">
              <p><strong>Imported:</strong> {importResult.imported}</p>
              <p><strong>Skipped (duplicates):</strong> {importResult.skipped}</p>
              <p><strong>Total rows parsed:</strong> {importResult.totalRows}</p>
            </div>

            {importResult.warnings.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="font-medium text-yellow-900 mb-1 text-sm">
                  Warnings ({importResult.warnings.length}):
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-800 text-sm">
                  {visibleWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
                {importResult.warnings.length > 5 && (
                  <button
                    onClick={() => setShowAllWarnings(!showAllWarnings)}
                    className="mt-2 text-xs text-yellow-900 underline hover:no-underline"
                  >
                    {showAllWarnings
                      ? 'Show fewer'
                      : `Show all ${importResult.warnings.length} warnings`}
                  </button>
                )}
              </div>
            )}
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
            {loading ? 'Importing...' : 'Import Seeds'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
