import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HarvestPlantModal from '../HarvestPlantModal';
import { PlantedItem, Plant } from '../../../types';

jest.mock('../../../contexts/SimulationContext', () => ({
  useToday: () => '2026-05-04',
}));

const mockApiPost = jest.fn();
jest.mock('../../../utils/api', () => ({
  apiPost: (...args: any[]) => mockApiPost(...args),
}));

const tomatoPlant: Plant = {
  id: 'tomato-1',
  name: 'Tomato',
  category: 'vegetable',
  spacing: 24,
  rowSpacing: 36,
  daysToMaturity: 75,
  frostTolerance: 'tender',
  winterHardy: false,
  companionPlants: [],
  incompatiblePlants: [],
  waterNeeds: 'medium',
  sunRequirement: 'full',
  soilPH: { min: 6, max: 6.8 },
  plantingDepth: 0.25,
  germinationTemp: { min: 70, max: 85 },
  transplantWeeksBefore: 6,
};

const baseItem: PlantedItem = {
  id: 42,
  plantId: 'tomato-1',
  variety: 'Brandywine',
  plantedDate: new Date('2026-04-01'),
  position: { x: 1, y: 2 },
  quantity: 3,
  status: 'growing',
};

function renderModal(overrides: Partial<React.ComponentProps<typeof HarvestPlantModal>> = {}) {
  const props: React.ComponentProps<typeof HarvestPlantModal> = {
    isOpen: true,
    onClose: jest.fn(),
    plantedItem: baseItem,
    plant: tomatoPlant,
    onSuccess: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<HarvestPlantModal {...props} />) };
}

beforeEach(() => {
  mockApiPost.mockReset();
});

describe('HarvestPlantModal', () => {
  describe('rendering and defaults', () => {
    test('shows plant name, variety, and position label in the header', () => {
      renderModal();
      const header = screen.getByText(/Harvesting/).closest('p');
      expect(header).toHaveTextContent('Harvesting Tomato (Brandywine)');
      expect(screen.getByText(/Position B3/)).toBeInTheDocument();
    });

    test('falls back to plantId when plant is undefined', () => {
      renderModal({ plant: undefined });
      const header = screen.getByText(/Harvesting/).closest('p');
      expect(header).toHaveTextContent('Harvesting tomato-1');
    });

    test('omits parens when no variety is set', () => {
      const noVariety: PlantedItem = { ...baseItem, variety: undefined };
      renderModal({ plantedItem: noVariety });
      const header = screen.getByText(/Harvesting/).closest('p');
      expect(header?.textContent).not.toMatch(/\(/);
    });

    test('defaults harvestDate to today, quantity to plantedItem.quantity, unit=lbs, quality=good', () => {
      renderModal();
      expect((screen.getByLabelText('Harvest Date') as HTMLInputElement).value).toBe('2026-05-04');
      expect((screen.getByLabelText('Quantity') as HTMLInputElement).valueAsNumber).toBe(3);
      expect((screen.getByLabelText('Unit') as HTMLSelectElement).value).toBe('lbs');
      expect((screen.getByLabelText('Quality') as HTMLSelectElement).value).toBe('good');
    });

    test('falls back quantity to 1 when plantedItem.quantity is 0/missing', () => {
      const zeroQty: PlantedItem = { ...baseItem, quantity: 0 };
      renderModal({ plantedItem: zeroQty });
      expect((screen.getByLabelText('Quantity') as HTMLInputElement).valueAsNumber).toBe(1);
    });
  });

  describe('validation', () => {
    test('blocks submit when quantity is zero', async () => {
      const { props } = renderModal();
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } });
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));
      expect(await screen.findByText(/Quantity must be greater than 0/)).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
      expect(props.onSuccess).not.toHaveBeenCalled();
    });

    test('blocks submit when harvest date is empty', async () => {
      renderModal();
      fireEvent.change(screen.getByLabelText('Harvest Date'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));
      expect(await screen.findByText(/Harvest date is required/)).toBeInTheDocument();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    test('posts the expected payload shape including plantedItemId', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 99 }),
      });
      const { props } = renderModal();
      fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'first pick' } });
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));

      await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
      const [url, body] = mockApiPost.mock.calls[0];
      expect(url).toBe('/api/harvests');
      expect(body).toEqual({
        plantId: 'tomato-1',
        plantedItemId: 42,
        harvestDate: '2026-05-04',
        quantity: 3,
        unit: 'lbs',
        quality: 'good',
        notes: 'first pick',
        idempotencyKey: expect.any(String),
        finalHarvest: false,
      });
      await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('omits notes when blank', async () => {
      mockApiPost.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) });
      renderModal();
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));
      await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
      const [, body] = mockApiPost.mock.calls[0];
      expect(body.notes).toBeUndefined();
    });

    test('sends finalHarvest when the final harvest checkbox is selected', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 100, plantedItem: { id: 42, clearedAt: '2026-05-04T00:00:00' } }),
      });
      renderModal();

      fireEvent.click(screen.getByLabelText(/Final harvest/i));
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));

      await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
      const [, body] = mockApiPost.mock.calls[0];
      expect(body.finalHarvest).toBe(true);
      expect(screen.getByTestId('harvest-plant-submit')).toHaveTextContent('Log Final Harvest');
    });

    test('shows backend error message when response is not ok and does not call onSuccess', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Plant not found' }),
      });
      const { props } = renderModal();
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));

      expect(await screen.findByText('Plant not found')).toBeInTheDocument();
      expect(props.onSuccess).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    test('records a zero-yield establishment failure from the harvest modal', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plantedItem: { id: 42 }, harvestRecord: { quantity: 0 } }),
      });
      const plannedItem: PlantedItem = { ...baseItem, status: 'planned' };
      const { props } = renderModal({ plantedItem: plannedItem });

      fireEvent.click(screen.getByTestId('zero-yield-toggle'));
      expect(screen.getByRole('button', { name: /Record 0 Yield/i })).toBeInTheDocument();
      expect((screen.getByLabelText('Outcome') as HTMLSelectElement).value).toBe('didnt_establish');
      expect((screen.getByLabelText('Reason') as HTMLSelectElement).value).toBe('poor_germination');

      fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'No germination in A2' } });
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));

      await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
      expect(mockApiPost).toHaveBeenCalledWith('/api/planted-items/42/outcome', {
        outcome: 'didnt_establish',
        outcomeReason: 'poor_germination',
        outcomeDate: '2026-05-04',
        outcomeNotes: 'No germination in A2',
      });
      await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    test('can record a failed-after-growing zero-yield outcome', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plantedItem: { id: 42 }, harvestRecord: { quantity: 0 } }),
      });
      renderModal();

      fireEvent.click(screen.getByTestId('zero-yield-toggle'));
      fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'failed' } });
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'pest' } });
      fireEvent.click(screen.getByTestId('harvest-plant-submit'));

      await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
      expect(mockApiPost).toHaveBeenCalledWith('/api/planted-items/42/outcome', {
        outcome: 'failed',
        outcomeReason: 'pest',
        outcomeDate: '2026-05-04',
      });
    });
  });
});
