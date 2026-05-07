import { PlantedItem } from '../../../types';
import { isPlantedItemActiveOnDate } from '../utils/designerHelpers';

const baseItem: PlantedItem = {
  id: 1,
  plantId: 'lettuce-1',
  plantedDate: new Date('2026-05-01T00:00:00'),
  harvestDate: new Date('2026-05-06T00:00:00'),
  position: { x: 0, y: 0 },
  quantity: 1,
  status: 'growing',
};

describe('isPlantedItemActiveOnDate', () => {
  test('keeps an unharvested plant visible after its expected harvest date', () => {
    expect(
      isPlantedItemActiveOnDate(baseItem, new Date('2026-05-07T00:00:00'))
    ).toBe(true);
  });

  test('hides a future-dated planned plant before its planting date', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, plantedDate: new Date('2026-05-10T00:00:00'), status: 'planned' },
        new Date('2026-05-07T00:00:00')
      )
    ).toBe(false);
  });

  test('hides a harvested plant after its actual harvest date', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, status: 'harvested' },
        new Date('2026-05-07T00:00:00')
      )
    ).toBe(false);
  });

  test('keeps a harvested plant visible on the actual harvest date', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, status: 'harvested' },
        new Date('2026-05-06T00:00:00')
      )
    ).toBe(true);
  });
});
