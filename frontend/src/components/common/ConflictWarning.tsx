import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Conflict } from '../../types';
import { coordinateToGridLabel } from '../GardenDesigner/utils/gridCoordinates';

interface ConflictWarningProps {
  conflicts: Conflict[];
  onOverride: () => void;
  onCancel: () => void;
  isOpen: boolean;
  title?: string;
  warningMessage?: string;
  overrideButtonText?: string;
}

const ConflictWarning: React.FC<ConflictWarningProps> = ({
  conflicts,
  onOverride,
  onCancel,
  isOpen,
  title = 'Space Conflict Detected',
  warningMessage,
  overrideButtonText = 'Auto-Adjust and Continue',
}) => {
  if (!isOpen || conflicts.length === 0) return null;

  const defaultWarning = `The selected position conflicts with ${conflicts.length} existing planting${conflicts.length > 1 ? 's' : ''}. This means the plants will be competing for the same space during overlapping time periods.`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-amber-50 to-red-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <h2 className="text-xl font-bold text-gray-800">
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-white rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning message */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> {warningMessage || defaultWarning}
            </p>
          </div>

          {/* Conflict list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Conflicting Plantings:
            </h3>

            {conflicts.map((conflict, index) => (
              <div
                key={conflict.eventId || index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">
                      {conflict.plantName}
                      {conflict.variety && (
                        <span className="text-gray-600 font-normal ml-1">
                          ({conflict.variety})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Dates: {conflict.dates}
                    </div>
                    {conflict.position && (
                      <div className="text-sm text-gray-600">
                        Position: {coordinateToGridLabel(conflict.position.x, conflict.position.y)}
                      </div>
                    )}
                    {conflict.bedName && (
                      <div className="text-sm text-gray-600">
                        Bed: {conflict.bedName}
                      </div>
                    )}
                    {conflict.conflictWith && (
                      <div className="text-sm text-red-700 mt-1 bg-red-50 rounded px-2 py-1">
                        Overlaps with: {conflict.conflictWith.plantName}
                        {conflict.conflictWith.variety && ` (${conflict.conflictWith.variety})`}
                        {' '}&mdash; {conflict.conflictWith.dates}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      conflict.type === 'both'
                        ? 'bg-red-100 text-red-800'
                        : conflict.type === 'spatial'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {conflict.type === 'both' ? 'Space & Time' : conflict.type === 'spatial' ? 'Space Only' : 'Time Only'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resolution options */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-blue-900">
              Resolution Options:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Choose a different position on the grid</li>
              <li>Adjust the planting dates to avoid overlap</li>
              <li>Override this warning if you plan to harvest early or use succession planting</li>
              <li>Skip position selection to track this planting on the timeline only</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onOverride}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {overrideButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictWarning;
