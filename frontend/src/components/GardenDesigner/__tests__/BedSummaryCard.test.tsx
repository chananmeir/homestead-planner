import React from 'react';
import { render, screen } from '@testing-library/react';
import BedSummaryCard from '../BedSummaryCard';
import { GardenBed, Plant, PlantedItem } from '../../../types';

const bed: GardenBed = {
  id: 1,
  name: 'SFG Bed 1',
  width: 4,
  length: 8,
  planningMethod: 'square-foot',
  gridSize: 12,
};

const plants = [
  { id: 'carrot-1', name: 'Carrot', icon: 'C', family: 'Apiaceae' },
  { id: 'onion-1', name: 'Onion', icon: 'O', family: 'Amaryllidaceae' },
] as Plant[];

const makeItem = (overrides: Partial<PlantedItem>): PlantedItem => ({
  id: 1,
  plantId: 'carrot-1',
  plantedDate: new Date('2026-04-01T00:00:00'),
  position: { x: 0, y: 0 },
  quantity: 1,
  status: 'growing',
  ...overrides,
});

describe('BedSummaryCard', () => {
  test('shows total individual plants separately from filled cells', () => {
    render(
      <BedSummaryCard
        bed={bed}
        plants={plants}
        activePlantedItems={[
          makeItem({ id: 10, plantId: 'carrot-1', quantity: 8, position: { x: 0, y: 0 } }),
          makeItem({ id: 11, plantId: 'onion-1', quantity: 4, position: { x: 1, y: 0 } }),
        ]}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('plants')).toBeInTheDocument();
    expect(screen.getByText('2 cells filled')).toBeInTheDocument();
    expect(screen.queryByText('plants placed')).not.toBeInTheDocument();
  });
});
