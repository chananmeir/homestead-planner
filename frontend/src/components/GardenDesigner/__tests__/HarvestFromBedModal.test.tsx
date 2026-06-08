import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HarvestFromBedModal from '../HarvestFromBedModal';
import { PlantedItem, Plant } from '../../../types';
import * as api from '../../../utils/api';

jest.mock('../../../contexts/SimulationContext', () => ({
  useToday: () => '2026-06-01',
}));

const item: PlantedItem = {
  id: 42,
  plantId: 'beet-1',
  variety: 'Detroit',
  plantedDate: new Date('2026-04-01'),
  position: { x: 0, y: 0 },
  quantity: 4,
  status: 'growing',
  learnedDtm: 68,
  learnedSampleCount: 3,
} as PlantedItem;

const plant: Plant = { id: 'beet-1', name: 'Beet', daysToMaturity: 55 } as Plant;

describe('HarvestFromBedModal', () => {
  afterEach(() => jest.restoreAllMocks());

  test('renders learned-DTM provenance when present', () => {
    render(
      <HarvestFromBedModal isOpen onClose={() => {}} plantedItem={item} plant={plant} onSuccess={() => {}} />
    );
    expect(screen.getByTestId('learned-dtm-note')).toHaveTextContent('Learned: 68 days from 3 harvests');
    expect(screen.getByTestId('harvest-maturity')).toBeInTheDocument();
  });

  test('POSTs plantedItemId + maturityFeedback to /api/harvests', async () => {
    const postSpy = jest.spyOn(api, 'apiPost').mockResolvedValue({
      ok: true, json: async () => ({ id: 1 }),
    } as Response);
    const onSuccess = jest.fn();

    render(
      <HarvestFromBedModal isOpen onClose={() => {}} plantedItem={item} plant={plant} onSuccess={onSuccess} />
    );

    // Flag "not mature enough" → too_early
    fireEvent.change(screen.getByTestId('harvest-maturity'), { target: { value: 'too_early' } });
    fireEvent.click(screen.getByTestId('harvest-from-bed-submit'));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const [url, payload] = postSpy.mock.calls[0];
    expect(url).toBe('/api/harvests');
    expect(payload).toMatchObject({
      plantId: 'beet-1',
      plantedItemId: 42,
      maturityFeedback: 'too_early',
      harvestDate: '2026-06-01',
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  test('failure outcome surfaces the "what happened?" reason and sends null maturityFeedback', async () => {
    const postSpy = jest.spyOn(api, 'apiPost').mockResolvedValue({
      ok: true, json: async () => ({ id: 1 }),
    } as Response);

    render(
      <HarvestFromBedModal isOpen onClose={() => {}} plantedItem={item} plant={plant} onSuccess={() => {}} />
    );

    fireEvent.change(screen.getByTestId('harvest-maturity'), { target: { value: 'failure' } });
    expect(screen.getByTestId('harvest-failure-reason')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('harvest-from-bed-submit'));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const payload = postSpy.mock.calls[0][1];
    expect(payload.maturityFeedback).toBeNull();
    expect(payload.outcomeReason).toBe('pest');
  });
});
