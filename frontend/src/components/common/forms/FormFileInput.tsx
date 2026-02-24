import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';

interface SelectedFile {
  file: File;
  preview: string;
  id: string;
}

export interface FormFileInputRef {
  reset: () => void;
}

interface FormFileInputProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  onChange: (files: File[]) => void;
  onReset?: () => void;
  error?: string;
  helperText?: string;
}

export const FormFileInput = forwardRef<FormFileInputRef, FormFileInputProps>(({
  label,
  accept = 'image/*',
  multiple = true,
  maxSize = 16 * 1024 * 1024, // 16MB default
  onChange,
  onReset,
  error,
  helperText,
}, ref) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose reset function to parent via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      setSelectedFiles([]);
      setValidationError('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      onChange([]);
      onReset?.();
    }
  }));

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File ${file.name} is too large (max ${(maxSize / 1024 / 1024).toFixed(0)}MB)`;
    }

    if (accept && accept !== '*') {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const fileType = file.type;
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExt === type;
        } else if (type.endsWith('/*')) {
          return fileType.startsWith(type.replace('/*', ''));
        } else {
          return fileType === type;
        }
      });

      if (!isAccepted) {
        return `File ${file.name} is not an accepted file type`;
      }
    }

    return null;
  };

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setValidationError('');

    // If multiple is false, only process the first file and replace existing selection
    const filesToProcess = multiple ? Array.from(files) : [files[0]];

    filesToProcess.forEach((file) => {
      const validation = validateFile(file);
      if (validation) {
        setValidationError(validation);
        return;
      }

      // Create preview for images
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        const selectedFile: SelectedFile = {
          file,
          preview,
          id: Math.random().toString(36).substring(7),
        };

        setSelectedFiles(prev => {
          // If multiple is false, replace the entire selection with the new file
          const updated = multiple ? [...prev, selectedFile] : [selectedFile];
          onChange(updated.map(sf => sf.file));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
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
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = (id: string) => {
    setSelectedFiles(prev => {
      const updated = prev.filter(sf => sf.id !== id);
      onChange(updated.map(sf => sf.file));
      return updated;
    });
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
          ${error || validationError ? 'border-red-500 bg-red-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />

        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-green-600">Click to upload</span> or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            {accept === 'image/*' ? 'PNG, JPG, GIF' : accept} (max {(maxSize / 1024 / 1024).toFixed(0)}MB)
          </p>
        </div>
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Selected Files ({selectedFiles.length}):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {selectedFiles.map((selectedFile) => (
              <div key={selectedFile.id} className="relative group">
                <img
                  src={selectedFile.preview}
                  alt={selectedFile.file.name}
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(selectedFile.id);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <p className="text-xs text-gray-600 mt-1 truncate" title={selectedFile.file.name}>
                  {selectedFile.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Messages */}
      {(error || validationError) && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error || validationError}
        </p>
      )}

      {/* Helper Text */}
      {helperText && !error && !validationError && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
});

FormFileInput.displayName = 'FormFileInput';
