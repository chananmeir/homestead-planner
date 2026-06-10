import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  requiredConfirmationText?: string;
  confirmationLabel?: string;
  confirmationPlaceholder?: string;
  confirmationHelpText?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
  requiredConfirmationText,
  confirmationLabel = 'Type to confirm',
  confirmationPlaceholder,
  confirmationHelpText,
}) => {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [confirmationValue, setConfirmationValue] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setConfirmationValue('');
    }
  }, [isOpen]);

  const requiresTypedConfirmation = requiredConfirmationText != null;
  const typedConfirmationMatches =
    !requiresTypedConfirmation || confirmationValue === requiredConfirmationText;

  const handleConfirm = async () => {
    if (!typedConfirmationMatches) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error in confirm action:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="space-y-4">
        <p className="text-gray-700 whitespace-pre-line">{message}</p>

        {requiresTypedConfirmation && (
          <div className="space-y-2">
            <label htmlFor="confirm-dialog-confirmation-input" className="block text-sm font-medium text-gray-700">
              {confirmationLabel}
            </label>
            <input
              id="confirm-dialog-confirmation-input"
              data-testid="confirm-dialog-confirmation-input"
              type="text"
              value={confirmationValue}
              onChange={(event) => setConfirmationValue(event.target.value)}
              placeholder={confirmationPlaceholder || requiredConfirmationText}
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            {confirmationHelpText && (
              <p className="text-sm text-gray-500">{confirmationHelpText}</p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isConfirming || loading}
          >
            {cancelText}
          </Button>
          <Button
            data-testid="confirm-dialog-confirm"
            variant={variant}
            onClick={handleConfirm}
            loading={isConfirming || loading}
            disabled={!typedConfirmationMatches}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
