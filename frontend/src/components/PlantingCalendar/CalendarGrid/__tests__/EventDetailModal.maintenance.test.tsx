import React from 'react';
import { render, screen } from '@testing-library/react';

import EventDetailModal from '../EventDetailModal';
import type { PlantingCalendar } from '../../../../types';

describe('EventDetailModal maintenance events', () => {
  test('fertilizing event shows application details instead of harvest phase', () => {
    const event = {
      id: 5001,
      eventType: 'fertilizing',
      plantId: 'fertilizing-event',
      gardenBedId: 1,
      expectedHarvestDate: new Date(2026, 4, 15),
      eventDetails: JSON.stringify({
        fertilizer_type: 'fish-emulsion',
        amount: 2,
        amount_unit: 'tbsp',
        application_method: 'soil-drench',
        npk: '5-1-1',
      }),
      completed: false,
    } as PlantingCalendar;

    render(
      <EventDetailModal
        isOpen
        event={event}
        onClose={jest.fn()}
        gardenBeds={[{ id: 1, name: 'North Bed' }]}
      />
    );

    expect(screen.getByText('Fertilizing')).toBeInTheDocument();
    expect(screen.getByText('Application Date:')).toBeInTheDocument();
    expect(screen.queryByText('Expected Harvest:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Harvested' })).not.toBeInTheDocument();
    expect(screen.getByText('Fertilizer Type:')).toBeInTheDocument();
    expect(screen.getByText('Fish Emulsion')).toBeInTheDocument();
    expect(screen.getByText('Amount:')).toBeInTheDocument();
    expect(screen.getByText('2 tbsp')).toBeInTheDocument();
  });
});
