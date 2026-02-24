import React from 'react';
import { Modal } from '../../common/Modal';
import { EventAdjustment, Conflict } from '../../../types';
import { format, parseISO, subDays } from 'date-fns';

interface AutoAdjustmentModalProps {
  isOpen: boolean;
  conflicts: Conflict[];
  newPlantName: string;
  newStartDate: string;
  onConfirm: (adjustments: EventAdjustment[]) => void;
  onCancel: () => void;
}

/**
 * Calculate adjustments needed to make room for new planting
 */
const calculateAdjustments = (
  conflicts: Conflict[],
  newStartDate: string
): EventAdjustment[] => {
  const startDate = parseISO(newStartDate);

  return conflicts.map(conflict => {
    // Parse conflict date range (format: "YYYY-MM-DD to YYYY-MM-DD")
    const dateRange = conflict.dates.split(' to ');
    const oldHarvestDate = parseISO(dateRange[1]);

    // New harvest = day before new planting starts
    const newHarvestDate = subDays(startDate, 1);

    // Calculate how many days earlier
    const daysEarlier = Math.ceil(
      (oldHarvestDate.getTime() - newHarvestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      eventId: parseInt(conflict.eventId),
      oldHarvestDate: oldHarvestDate.toISOString(),
      newHarvestDate: newHarvestDate.toISOString(),
      plantName: conflict.plantName,
      variety: conflict.variety,
      daysEarlier,
    };
  });
};

export const AutoAdjustmentModal: React.FC<AutoAdjustmentModalProps> = ({
  isOpen,
  conflicts,
  newPlantName,
  newStartDate,
  onConfirm,
  onCancel,
}) => {
  const adjustments = calculateAdjustments(conflicts, newStartDate);
  const formattedNewStartDate = format(parseISO(newStartDate), 'MMM d, yyyy');

  const handleConfirm = () => {
    onConfirm(adjustments);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Auto-Adjust Planting Schedule"
      size="medium"
      showCloseButton={false}
    >
      <div className="space-y-6">
        {/* Header message */}
        <div className="text-gray-700">
          <p className="text-lg">
            To make room for <span className="font-semibold">{newPlantName}</span> starting{' '}
            <span className="font-semibold">{formattedNewStartDate}</span>:
          </p>
        </div>

        {/* Adjustments list */}
        <div className="space-y-4">
          {adjustments.map((adjustment, index) => (
            <div
              key={adjustment.eventId}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-start space-x-3">
                {/* Check icon */}
                <div className="flex-shrink-0 mt-1">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>

                {/* Adjustment details */}
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-gray-900">
                    Adjust {adjustment.plantName}
                    {adjustment.variety && ` (${adjustment.variety})`} harvest date
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">From:</span>
                      <span className="font-medium text-gray-900">
                        {format(parseISO(adjustment.oldHarvestDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">To:</span>
                      <span className="font-medium text-blue-700">
                        {format(parseISO(adjustment.newHarvestDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-600 font-medium">
                        ({adjustment.daysEarlier} day{adjustment.daysEarlier !== 1 ? 's' : ''} earlier)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Warning message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            {/* Warning icon */}
            <div className="flex-shrink-0 mt-1">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm text-yellow-800">
              <span className="font-medium">Note:</span> Early harvest may reduce yield or affect quality.
              Consider whether this timing is appropriate for your garden plan.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Confirm Adjustment{adjustments.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};
