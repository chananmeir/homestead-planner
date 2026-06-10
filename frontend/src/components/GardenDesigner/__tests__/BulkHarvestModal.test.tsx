import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkHarvestModal from '../BulkHarvestModal';
import { PlantedItem } from '../../../types';

jest.mock('../../../contexts/SimulationContext', () => ({
  useToday: () => '2026-05-04',
}));

const mockApiPost = jest.fn();
jest.mock('../../../utils/api', () => ({
  apiPost: (...args: any[]) => mockApiPost(...args),
}));

const mkItem = (id: number, position = { x: id - 1, y: 0 }): PlantedItem => ({
  id,
  plantId: 'tomato-1',
  variety: 'Brandywine',
  plantedDate: new Date('2026-02-01'),
  position,
  quantity: 1,
  status: 'growing',
});

function renderModal(overrides: Partial<React.ComponentProps<typeof BulkHarvestModal>> = {}) {
  const props: React.ComponentProps<typeof BulkHarvestModal> = {
    isOpen: true,
    onClose: jest.fn(),
    plantId: 'tomato-1',
    plantName: 'Tomato',
    variety: 'Brandywine',
    eligibleItems: [mkItem(1), mkItem(2), mkItem(3)],
    onSuccess: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<BulkHarvestModal {...props} />) };
}

beforeEach(() => {
  mockApiPost.mockReset();
});

describe('BulkHarvestModal', () => {
  describe('rendering', () => {
    test('shows plant name, variety, and ready-cell count', () => {
      renderModal();
      const banner = screen.getByText(/Harvesting/).closest('p');
      expect(banner).toHaveTextContent('Harvesting Tomato (Brandywine)');
      expect(screen.getByText('3 cells ready')).toBeInTheDocument();
    });

    test('uses singular "cell" when count is 1', () => {
      renderModal({ eligibleItems: [mkItem(1)] });
      expect(screen.getByText('1 cell ready')).toBeInTheDocument();
    });

    test('omits variety in header when none', () => {
      renderModal({ variety: undefined });
      const banner = screen.getByText(/Harvesting/).closest('p');
      expect(banner?.textContent).not.toMatch(/\(/);
    });

    test('submit button shows count', () => {
      renderModal();
      expect(screen.getByTestId('bulk-harvest-submit')).toHaveTextContent('Log Harvest (3)');
    });
  });

  describe('validation', () => {
    test('blocks submit when total quantity is zero', async () => {
      const { props } = renderModal();
      fireEvent.change(screen.getByLabelText(/Total Quantity/), { target: { value: '0' } });
      fireEvent.click(screen.getByTestId('bulk-harvest-submit'));
      expect(await screen.findByText(/Total quantity must be greater than 0/)).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
      expect(props.onSuccess).not.toHaveBeenCalled();
    });

    test('blocks submit when harvest date is empty', async () => {
      renderModal();
      fireEvent.change(screen.getByLabelText('Harvest Date'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('bulk-harvest-submit'));
      expect(await screen.findByText(/Harvest date is required/)).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    test('posts the bulk payload with all eligible item ids', async () => {
      mockApiPost.mockResolvedValueOnce({ ok: true, json: async () => ({ harvestGroupId: 'uuid' }) });
      const { props } = renderModal();
      fireEvent.change(screen.getByLabelText(/Total Quantity/), { target: { value: '12' } });
      fireEvent.click(screen.getByTestId('bulk-harvest-submit'));

      await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
      const [url, body] = mockApiPost.mock.calls[0];
      expect(url).toBe('/api/harvests/bulk');
      expect(body).toEqual({
        plantedItemIds: [1, 2, 3],
        plantId: 'tomato-1',
        harvestDate: '2026-05-04',
        totalQuantity: 12,
        unit: 'lbs',
        quality: 'good',
        notes: undefined,
      });
      await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('shows backend error message on failure', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Items not owned by user' }),
      });
      const { props } = renderModal();
      fireEvent.change(screen.getByLabelText(/Total Quantity/), { target: { value: '5' } });
      fireEvent.click(screen.getByTestId('bulk-harvest-submit'));

      expect(await screen.findByText('Items not owned by user')).toBeInTheDocument();
      expect(props.onSuccess).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });
});
