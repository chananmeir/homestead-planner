import React, { useState } from 'react';
import { apiPost } from '../../utils/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { IndoorSeedStart } from './EditSeedStartModal';

interface FailedSeedStartDialogProps {
  isOpen: boolean;
  seedStart: IndoorSeedStart;
  plantName: string;
  onClose: () => void;
  onComplete: () => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

export const FailedSeedStartDialog: React.FC<FailedSeedStartDialogProps> = ({
  isOpen,
  seedStart,
  plantName,
  onClose,
  onComplete,
  showSuccess,
  showError,
}) => {
  const [loading, setLoading] = useState(false);

  const handleCascade = async (cascade: 'direct-seed' | 'abandon') => {
    setLoading(true);
    try {
      const response = await apiPost(`/api/indoor-seed-starts/${seedStart.id}/mark-failed`, { cascade });
      if (response.ok) {
        const actionLabel = cascade === 'direct-seed'
          ? 'Marked as failed — planting event switched to direct seed'
          : 'Marked as failed — planting abandoned';
        showSuccess(actionLabel);
        onComplete();
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error marking seed start as failed:', error);
      showError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const displayName = seedStart.variety
    ? `${plantName} (${seedStart.variety})`
    : plantName;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Indoor Start Failed" size="small">
      <div className="space-y-4">
        <p className="text-gray-700">
          <strong>{displayName}</strong> has a linked planting event
          {seedStart.expectedTransplantDate && (
            <> scheduled for transplant on{' '}
              <strong>{new Date(seedStart.expectedTransplantDate).toLocaleDateString()}</strong>
            </>
          )}.
        </p>
        <p className="text-gray-700 font-medium">
          Do you plan to do a direct seeding instead?
        </p>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            variant="primary"
            onClick={() => handleCascade('direct-seed')}
            loading={loading}
            fullWidth
          >
            Yes — Switch to Direct Seed
          </Button>
          <Button
            variant="danger"
            onClick={() => handleCascade('abandon')}
            loading={loading}
            fullWidth
          >
            No — Abandon This Planting
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            fullWidth
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
