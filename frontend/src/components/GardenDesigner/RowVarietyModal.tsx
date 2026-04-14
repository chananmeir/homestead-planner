import React from 'react';
import { Plant } from '../../types';
import { Modal } from '../common/Modal';
import PlantIcon from '../common/PlantIcon';

interface RowVarietyModalProps {
  isOpen: boolean;
  rowNumber: number;
  cropName: string;
  varieties: Plant[];
  onSelect: (plant: Plant) => void;
  onClose: () => void;
}

/**
 * Modal for selecting a plant variety when dropping on MIGardener rows
 * Shows when a crop has multiple varieties available
 */
const RowVarietyModal: React.FC<RowVarietyModalProps> = ({
  isOpen,
  rowNumber,
  cropName,
  varieties,
  onSelect,
  onClose,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Select ${cropName} Variety for Row ${rowNumber}`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          This crop has multiple varieties. Select which one to plant:
        </p>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {varieties.map(plant => (
            <button
              key={plant.id}
              onClick={() => onSelect(plant)}
              className="w-full p-4 text-left border border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <PlantIcon plantId={plant.id} plantIcon={plant.icon || '🌱'} size={32} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{plant.name}</div>
                  <div className="text-sm text-gray-600 space-x-4">
                    <span>Spacing: {plant.spacing || 12}"</span>
                    {plant.daysToMaturity && (
                      <span>DTM: {plant.daysToMaturity} days</span>
                    )}
                    {plant.rowSpacing && (
                      <span>Row Spacing: {plant.rowSpacing}"</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RowVarietyModal;
