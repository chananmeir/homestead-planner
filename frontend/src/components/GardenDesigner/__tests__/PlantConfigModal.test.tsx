import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PlantConfigModal from '../PlantConfigModal';
import { ToastProvider } from '../../common/Toast';

jest.mock('../../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-30T12:00:00'),
}));

const pumpkinPlant: any = {
  id: 'pumpkin-1',
  name: 'Pumpkin',
  category: 'vegetable',
  spacing: 36,
  rowSpacing: 72,
  daysToMaturity: 100,
  frostTolerance: 'none',
  winterHardy: false,
  companionPlants: [],
  incompatiblePlants: [],
  waterNeeds: 'high',
  sunRequirement: 'full',
  soilPH: { min: 6, max: 6.8 },
  plantingDepth: 1,
  germinationTemp: { min: 70, max: 95 },
  transplantWeeksBefore: 0,
  weeksIndoors: 3,
  germinationDays: 7,
};

function renderModal(props: Partial<React.ComponentProps<typeof PlantConfigModal>> = {}) {
  const defaultProps: React.ComponentProps<typeof PlantConfigModal> = {
    isOpen: true,
    cropName: 'Pumpkin',
    allPlants: [pumpkinPlant],
    position: { x: 0, y: 0 },
    planningMethod: 'square-foot',
    plantingDate: '2026-05-20',
    onDateChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  return render(
    <ToastProvider>
      <PlantConfigModal {...defaultProps} {...props} />
    </ToastProvider>
  );
}

describe('PlantConfigModal indoor-start transplant scheduling', () => {
  beforeEach(() => {
    localStorage.clear();
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [],
    }));
  });

  afterEach(() => {
    delete (global as any).fetch;
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('automatically shifts transplant date later when starting indoors today would be late', async () => {
    const onDateChange = jest.fn();

    renderModal({ onDateChange });

    await waitFor(() => {
      expect(onDateChange).toHaveBeenCalledWith('2026-05-21');
    });
  });

  test('does not shift transplant date when the current date preserves indoor growing time', async () => {
    const onDateChange = jest.fn();

    renderModal({
      plantingDate: '2026-05-21',
      onDateChange,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Transplant')).toBeChecked();
    });
    expect(onDateChange).not.toHaveBeenCalled();
  });

  test('does not shift date when caller initializes direct seeding', async () => {
    const onDateChange = jest.fn();

    renderModal({
      initialPlantingMethod: 'direct',
      onDateChange,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Direct Seed')).toBeChecked();
    });
    expect(onDateChange).not.toHaveBeenCalled();
  });

  test('does not shift date when placing an existing indoor start', async () => {
    const onDateChange = jest.fn();

    renderModal({
      initialPlantingMethod: 'transplant',
      suppressIndoorStartAutoShift: true,
      onDateChange,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Transplant')).toBeChecked();
    });
    expect(screen.getByText('5/20/2026')).toBeInTheDocument();
    expect(onDateChange).not.toHaveBeenCalled();
  });

  test('does not require a matching seed lot when placing an existing indoor start', async () => {
    renderModal({
      activePlanId: 1,
      initialVariety: 'Saved Start Variety',
      initialPlantingMethod: 'transplant',
      suppressIndoorStartAutoShift: true,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Transplant')).toBeChecked();
    });
    expect(screen.queryByText(/No matching seed in your inventory/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Place 1 Plants/ })).toBeEnabled();
  });

  test('keeps the existing indoor-start variety visible when it is not an inventory option', async () => {
    (global as any).fetch = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => String(url).includes('/api/my-seeds')
        ? [{
          id: 1,
          plantId: 'pumpkin-1',
          variety: 'Sweet Spanish',
          quantity: 10,
          isGlobal: false,
        }]
        : [],
    }));

    renderModal({
      initialVariety: 'Yellow Sweet Spanish',
      initialPlantingMethod: 'transplant',
      suppressIndoorStartAutoShift: true,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Variety/)).toHaveValue('Yellow Sweet Spanish');
    });
    expect(screen.getByRole('option', { name: 'Yellow Sweet Spanish (current start)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sweet Spanish' })).toBeInTheDocument();
  });
});
