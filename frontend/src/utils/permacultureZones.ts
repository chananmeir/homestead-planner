/**
 * Permaculture Zone System
 *
 * Organizes spaces by frequency of use and maintenance needs.
 * Based on Bill Mollison's permaculture design principles.
 */

export type ZoneId = 'zone0' | 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5';

export interface Zone {
  id: ZoneId;
  number: number;
  name: string;
  description: string;
  frequency: string;
  maintenance: string;
  examples: string[];
  plants: string[];
  color: {
    background: string;
    border: string;
    text: string;
    badge: string;
  };
}

/**
 * Permaculture zones with descriptions and color schemes
 */
export const PERMACULTURE_ZONES: Record<ZoneId, Zone> = {
  zone0: {
    id: 'zone0',
    number: 0,
    name: 'Zone 0: House/Center',
    description: 'Living space - kitchen, pantry, indoor plants',
    frequency: 'Multiple times per day',
    maintenance: 'Constant',
    examples: ['Kitchen herb pots', 'Indoor sprouts', 'Windowsill greens'],
    plants: ['Basil', 'Parsley', 'Chives', 'Microgreens', 'Sprouts'],
    color: {
      background: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-700',
      badge: 'bg-red-500'
    }
  },
  zone1: {
    id: 'zone1',
    number: 1,
    name: 'Zone 1: Daily Harvest',
    description: 'Herbs, salad greens, and plants requiring daily care',
    frequency: 'Multiple times per day',
    maintenance: 'Very high',
    examples: ['Herb garden', 'Salad bed', 'Cherry tomatoes', 'Kitchen garden'],
    plants: ['Lettuce', 'Spinach', 'Basil', 'Cilantro', 'Radish', 'Green onions'],
    color: {
      background: 'bg-orange-50',
      border: 'border-orange-500',
      text: 'text-orange-700',
      badge: 'bg-orange-500'
    }
  },
  zone2: {
    id: 'zone2',
    number: 2,
    name: 'Zone 2: Regular Care',
    description: 'Main vegetable garden requiring regular maintenance',
    frequency: 'Daily to every few days',
    maintenance: 'High',
    examples: ['Main vegetable beds', 'Berry bushes', 'Trellised crops'],
    plants: ['Tomatoes', 'Peppers', 'Beans', 'Squash', 'Cucumbers', 'Carrots'],
    color: {
      background: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'text-yellow-700',
      badge: 'bg-yellow-500'
    }
  },
  zone3: {
    id: 'zone3',
    number: 3,
    name: 'Zone 3: Occasional Care',
    description: 'Orchards, chickens, and crops needing occasional attention',
    frequency: 'Weekly',
    maintenance: 'Moderate',
    examples: ['Fruit trees', 'Chicken coop', 'Storage crops', 'Perennial vegetables'],
    plants: ['Apples', 'Pears', 'Rhubarb', 'Asparagus', 'Potatoes', 'Winter squash'],
    color: {
      background: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-700',
      badge: 'bg-green-500'
    }
  },
  zone4: {
    id: 'zone4',
    number: 4,
    name: 'Zone 4: Foraging',
    description: 'Semi-wild areas, pasture, managed foraging',
    frequency: 'Monthly or seasonally',
    maintenance: 'Low',
    examples: ['Nut trees', 'Pasture', 'Woodlot', 'Wild berries'],
    plants: ['Walnuts', 'Hazelnuts', 'Wild edibles', 'Native plants', 'Forage crops'],
    color: {
      background: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-700',
      badge: 'bg-blue-500'
    }
  },
  zone5: {
    id: 'zone5',
    number: 5,
    name: 'Zone 5: Wilderness',
    description: 'Unmanaged wild space for observation and learning',
    frequency: 'Rarely',
    maintenance: 'None',
    examples: ['Wild forest', 'Natural wetlands', 'Wildlife habitat'],
    plants: ['Native wildflowers', 'Wild mushrooms', 'Natural succession'],
    color: {
      background: 'bg-purple-50',
      border: 'border-purple-500',
      text: 'text-purple-700',
      badge: 'bg-purple-500'
    }
  }
};

/**
 * Get zone information by zone ID
 */
export function getZone(zoneId: ZoneId | null | undefined): Zone | null {
  if (!zoneId) return null;
  return PERMACULTURE_ZONES[zoneId] || null;
}

/**
 * Get all zones as array (sorted by number)
 */
export function getAllZones(): Zone[] {
  return Object.values(PERMACULTURE_ZONES);
}

/**
 * Get zone color classes for styling
 */
export function getZoneColors(zoneId: ZoneId | null | undefined): Zone['color'] | null {
  const zone = getZone(zoneId);
  return zone ? zone.color : null;
}

/**
 * Get zone badge text (e.g., "Z1" for zone1)
 */
export function getZoneBadge(zoneId: ZoneId | null | undefined): string {
  const zone = getZone(zoneId);
  return zone ? `Z${zone.number}` : '';
}

/**
 * Get zone short description
 */
export function getZoneShortDesc(zoneId: ZoneId | null | undefined): string {
  const zone = getZone(zoneId);
  return zone ? zone.description : 'No zone assigned';
}
