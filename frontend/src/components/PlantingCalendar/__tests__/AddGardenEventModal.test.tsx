import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AddGardenEventModal from '../AddGardenEventModal';
import type { GardenBed } from '../../../types';

const gardenBeds = [
  { id: 1, name: 'North Bed', length: 8, width: 4 },
] as GardenBed[];

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ id: 123 }),
  })) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AddGardenEventModal', () => {
  test('submits a typed fertilizing event payload', async () => {
    const onEventAdded = jest.fn();

    render(
      <AddGardenEventModal
        isOpen
        onClose={jest.fn()}
        onEventAdded={onEventAdded}
        gardenBeds={gardenBeds}
      />
    );

    fireEvent.click(screen.getByLabelText('Fertilizing'));
    fireEvent.change(screen.getByLabelText(/Garden Bed/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Application Date/), { target: { value: '2026-05-15' } });
    fireEvent.change(screen.getByLabelText(/Fertilizer Type/), { target: { value: 'fish-emulsion' } });
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Unit/), { target: { value: 'tbsp' } });
    fireEvent.change(screen.getByLabelText(/NPK/), { target: { value: '5-1-1' } });
    fireEvent.change(screen.getByLabelText(/Application Method/), { target: { value: 'soil-drench' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      eventType: 'fertilizing',
      gardenBedId: 1,
      applicationDate: '2026-05-15',
      fertilizerType: 'fish-emulsion',
      amount: 2,
      amountUnit: 'tbsp',
      applicationMethod: 'soil-drench',
      npk: '5-1-1',
    });
    expect(onEventAdded).toHaveBeenCalledTimes(1);
  });

  test('submits a typed irrigation event payload', async () => {
    render(
      <AddGardenEventModal
        isOpen
        onClose={jest.fn()}
        onEventAdded={jest.fn()}
        gardenBeds={gardenBeds}
      />
    );

    fireEvent.click(screen.getByLabelText('Irrigation'));
    fireEvent.change(screen.getByLabelText(/Garden Bed/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Application Date/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/Irrigation Method/), { target: { value: 'soaker-hose' } });
    fireEvent.change(screen.getByLabelText(/Duration/), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText(/Gallons/), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText(/Zone/), { target: { value: 'Valve 2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      eventType: 'irrigation',
      gardenBedId: 1,
      applicationDate: '2026-06-01',
      method: 'soaker-hose',
      durationMinutes: 45,
      amountGallons: 12.5,
      zone: 'Valve 2',
    });
  });
});
