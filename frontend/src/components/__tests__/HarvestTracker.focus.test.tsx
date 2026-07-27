import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import { installFetchMock, clearFetchMock } from '../Dashboard/testUtils';
import { ToastProvider } from '../common/Toast';
import HarvestTracker from '../HarvestTracker';

const initialHarvests = [
  {
    id: 7,
    plantId: 'lettuce',
    harvestDate: '2026-04-14T00:00:00Z',
    quantity: 12,
    unit: 'count',
    quality: 'excellent',
    notes: '',
  },
  {
    id: 8,
    plantId: 'tomato-1',
    harvestDate: '2026-04-13T00:00:00Z',
    quantity: 5,
    unit: 'lbs',
    quality: 'good',
    notes: '',
  },
];

const plants = [
  { id: 'lettuce', name: 'Lettuce', category: 'leafy' },
  { id: 'tomato-1', name: 'Tomato', category: 'fruiting' },
];

const readyTask = {
  plantingEventId: 42,
  plantId: 'tomato-1',
  plantName: 'Tomato',
  variety: 'Roma',
  bedId: 3,
  bedName: 'North Bed',
  expectedHarvestDate: '2026-04-13T00:00:00Z',
  quantity: 2,
  position: { x: 1, y: 2 },
  harvestCompleted: false,
  existingHarvestRecordIds: [],
  plantedItems: [
    {
      id: 99,
      quantity: 2,
      status: 'growing',
      position: { x: 1, y: 2 },
    },
  ],
};

function renderWithProviders(props: React.ComponentProps<typeof HarvestTracker>) {
  return render(
    <ToastProvider>
      <HarvestTracker {...props} />
    </ToastProvider>
  );
}

describe('HarvestTracker harvest-ready focus integration', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('focus ids clear filters and render a highlighted ready-to-harvest card', async () => {
    installFetchMock([
      { match: '/api/harvests/ready', response: { tasks: [readyTask] } },
      { match: '/api/harvests/stats', response: {} },
      { match: '/api/harvests', response: initialHarvests },
      { match: '/api/plants', response: plants },
    ]);

    const { rerender } = renderWithProviders({ focusSignal: null });

    await screen.findByTestId('harvest-row-7');
    const searchInput = screen.getByPlaceholderText(/search by plant name/i);
    fireEvent.change(searchInput, { target: { value: 'lettuce' } });

    await waitFor(() => {
      expect(screen.queryByTestId('harvest-row-8')).not.toBeInTheDocument();
    });

    rerender(
      <ToastProvider>
        <HarvestTracker focusSignal={42} focusPlantingEventIds={[42]} />
      </ToastProvider>
    );

    const card = await screen.findByTestId('ready-harvest-focus-card');
    await waitFor(() => {
      expect(card).toHaveTextContent(/ready to harvest/i);
    });
    expect(card).toHaveTextContent(/tomato/i);
    expect(card).toHaveTextContent(/roma/i);
    expect(card).toHaveTextContent(/north bed/i);
    expect((searchInput as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('harvest-row-7')).toBeInTheDocument();
    expect(screen.getByTestId('harvest-row-8')).toBeInTheDocument();
  });

  test('logging from the ready card posts the planted item and highlights the created row', async () => {
    const createdHarvest = {
      id: 55,
      plantId: 'tomato-1',
      plantedItemId: 99,
      harvestDate: '2026-04-14T00:00:00Z',
      quantity: 2,
      unit: 'count',
      quality: 'good',
      notes: 'Dashboard harvest reminder: Ready to harvest: Tomato (Roma) in North Bed',
    };
    let harvests = [...initialHarvests];
    const fetchMock = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof url === 'string' ? url : url.toString();
      const method = init?.method || 'GET';

      if (href.includes('/api/harvests/ready')) {
        return { ok: true, status: 200, json: async () => ({ tasks: [readyTask] }) } as any;
      }
      if (href.includes('/api/harvests/stats')) {
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }
      if (href.includes('/api/plants')) {
        return { ok: true, status: 200, json: async () => plants } as any;
      }
      if (href.includes('/api/harvests') && method === 'POST') {
        harvests = [createdHarvest, ...harvests];
        return { ok: true, status: 201, json: async () => createdHarvest } as any;
      }
      if (href.includes('/api/harvests')) {
        return { ok: true, status: 200, json: async () => harvests } as any;
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not mocked', url: href }) } as any;
    });
    (global as any).fetch = fetchMock;

    renderWithProviders({ focusSignal: 42, focusPlantingEventIds: [42] });

    fireEvent.click(await screen.findByTestId('ready-harvest-log-button'));

    expect(await screen.findByRole('dialog')).toHaveTextContent(/log new harvest/i);
    await waitFor(() => {
      expect(screen.getByLabelText(/plant/i)).toHaveValue('tomato-1');
    });
    expect(screen.getByLabelText(/harvest date/i)).toHaveValue('2026-04-14');
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(2);
    expect(screen.getByLabelText(/unit/i)).toHaveValue('count');

    fireEvent.click(screen.getByTestId('log-harvest-submit'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/harvests'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"plantedItemId":99'),
        })
      );
    });

    const createdRow = await screen.findByTestId('harvest-row-55');
    await waitFor(() => {
      expect(createdRow.className).toMatch(/ring-2/);
      expect(createdRow.className).toMatch(/ring-amber-400/);
    });
  });
});
