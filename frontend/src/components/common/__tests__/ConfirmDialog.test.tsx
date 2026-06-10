import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmDialog } from '../ConfirmDialog';


test('requires exact typed confirmation before enabling confirm action', async () => {
  const onConfirm = jest.fn();

  render(
    <ConfirmDialog
      isOpen
      onClose={jest.fn()}
      onConfirm={onConfirm}
      title="Delete Garden Bed"
      message="This cannot be undone."
      confirmText="Delete Bed"
      requiredConfirmationText="delete"
      confirmationLabel='Type "delete" to permanently delete this bed'
    />
  );

  const confirmButton = screen.getByTestId('confirm-dialog-confirm');
  const input = screen.getByTestId('confirm-dialog-confirmation-input');

  expect(confirmButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'Delete' } });
  expect(confirmButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'delete' } });
  expect(confirmButton).toBeEnabled();

  fireEvent.click(confirmButton);
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
});
