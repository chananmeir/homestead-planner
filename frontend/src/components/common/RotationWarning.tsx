import React from 'react';
import { RotationWarning as RotationWarningType } from '../../types';

interface RotationWarningProps {
  warnings: RotationWarningType[];
  className?: string;
}

/**
 * RotationWarning Component
 *
 * Displays crop rotation warnings when a plant family was grown in the same bed
 * within the recommended rotation window (typically 3 years).
 *
 * Used in GardenPlanner to show rotation conflicts for planned crops.
 */
const RotationWarning: React.FC<RotationWarningProps> = ({
  warnings,
  className = ''
}) => {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {warnings.map((warning, index) => (
        <div
          key={index}
          className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded"
        >
          <div className="flex items-start">
            <span className="text-yellow-400 text-xl mr-2 flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-yellow-800 font-medium mb-1">
                Rotation Conflict: {warning.bed_name}
              </p>
              <p className="text-sm text-yellow-700">
                {warning.message}
              </p>
              <div className="mt-2 text-xs text-yellow-600">
                <p>
                  Family <span className="font-semibold">{warning.family}</span> was planted in{' '}
                  {warning.conflict_years.length === 1 ? (
                    <span className="font-semibold">{warning.conflict_years[0]}</span>
                  ) : (
                    <>
                      <span className="font-semibold">{warning.conflict_years.join(', ')}</span>
                    </>
                  )}
                </p>
                <p className="mt-1">
                  Safe to plant again in <span className="font-semibold">{warning.safe_year}</span> or choose a different bed.
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RotationWarning;
