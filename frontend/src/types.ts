// Core data types for the Homestead Tracker app

export interface Plant {
  id: string;
  name: string;
  scientificName?: string;
  category: PlantCategory;
  spacing: number; // inches between plants
  rowSpacing: number; // inches between rows
  daysToMaturity: number;
  frostTolerance: FrostTolerance;
  winterHardy: boolean; // For winter gardening
  companionPlants: string[]; // IDs of companion plants
  incompatiblePlants: string[]; // IDs of plants to avoid
  waterNeeds: 'low' | 'medium' | 'high';
  sunRequirement: 'full' | 'partial' | 'shade';
  soilPH: { min: number; max: number };
  plantingDepth: number; // inches
  germinationTemp: { min: number; max: number }; // Fahrenheit
  transplantWeeksBefore: number; // weeks before last frost
  germination_days?: number; // Days from planting to emergence
  ideal_seasons?: ('spring' | 'summer' | 'fall' | 'winter')[]; // Best planting seasons
  heat_tolerance?: 'low' | 'medium' | 'high' | 'excellent'; // General heat tolerance
  notes?: string;
  icon?: string; // Emoji icon for visual representation
}

export type PlantCategory =
  | 'vegetable'
  | 'herb'
  | 'fruit'
  | 'flower'
  | 'cover-crop';

export type FrostTolerance =
  | 'very-tender' // Killed by light frost
  | 'tender' // Damaged by frost
  | 'half-hardy' // Tolerates light frost
  | 'hardy' // Tolerates frost
  | 'very-hardy'; // Thrives in frost

export interface GardenBed {
  id: string;
  name: string;
  width: number; // feet
  length: number; // feet
  location: string;
  soilType?: string;
  sunExposure: 'full' | 'partial' | 'shade';
  plants: PlantedItem[];
  seasonExtension?: SeasonExtension;
}

export interface PlantedItem {
  id: string;
  plantId: string;
  variety?: string; // Specific variety (e.g., "Buttercrunch", "Romaine")
  plantedDate: Date;
  transplantDate?: Date;
  harvestDate?: Date;
  position: { x: number; y: number }; // grid position
  quantity: number;
  status: 'planned' | 'seeded' | 'transplanted' | 'growing' | 'harvested';
  notes?: string;
}

export interface SeasonExtension {
  type: 'row-cover' | 'cold-frame' | 'low-tunnel' | 'high-tunnel' | 'greenhouse';
  installDate?: Date;
  // Eliot Coleman's layer system - each layer adds ~10-15°F
  layers: number;
  material?: string;
  notes?: string;
}

export interface PlantingCalendar {
  id: string;
  plantId: string;
  variety?: string; // e.g., "Brandywine", "Roma", "Cherokee Purple"
  gardenBedId: string;
  seedStartDate?: Date;
  transplantDate?: Date;
  directSeedDate?: Date;
  expectedHarvestDate: Date;
  successionPlanting: boolean;
  successionInterval?: number; // days
  successionGroupId?: string; // UUID linking events in succession series
  positionX?: number; // Grid X coordinate (for space tracking)
  positionY?: number; // Grid Y coordinate (for space tracking)
  spaceRequired?: number; // Grid cells needed (for space tracking)
  conflictOverride?: boolean; // User allowed conflict
  completed: boolean;
  notes?: string;
}

// Conflict detection types (Phase 2B - Timeline Space Awareness)
export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: Conflict[];
}

export interface Conflict {
  eventId: string;
  plantName: string;
  variety?: string;
  dates: string; // Formatted date range
  position: { x: number; y: number };
  type: 'spatial' | 'temporal' | 'both';
}

export interface CompostPile {
  id: string;
  name: string;
  startDate: Date;
  location: string;
  size: { width: number; length: number; height: number }; // feet
  ingredients: CompostIngredient[];
  turnSchedule: Date[];
  lastTurned?: Date;
  estimatedReadyDate: Date;
  temperature?: number; // Fahrenheit
  moisture: 'dry' | 'ideal' | 'wet';
  carbonNitrogenRatio: number; // Ideal is ~30:1
  status: 'building' | 'cooking' | 'curing' | 'ready';
  notes?: string;
}

export interface CompostIngredient {
  name: string;
  amount: number; // cubic feet or lbs
  type: 'green' | 'brown'; // Nitrogen-rich or Carbon-rich
  addedDate: Date;
  carbonNitrogenRatio: number;
}

export interface WeatherAlert {
  id: string;
  type: 'frost' | 'freeze' | 'heat' | 'storm' | 'precipitation';
  severity: 'watch' | 'warning' | 'advisory';
  startDate: Date;
  endDate: Date;
  description: string;
  temperature?: number;
  dismissed: boolean;
}

export interface WeatherData {
  date: Date;
  highTemp: number;
  lowTemp: number;
  precipitation: number; // inches
  humidity: number; // percentage
  windSpeed: number; // mph
  conditions: string;
  growingDegreeDays?: number; // For tracking crop development
}

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  zone: string; // USDA Hardiness Zone
  lastFrostDate: Date; // Average last spring frost
  firstFrostDate: Date; // Average first fall frost
}

// Winter Gardening (Eliot Coleman & Nico Jabour techniques)
export interface WinterGardenPlan {
  gardenBedId: string;
  technique: 'quick-hoops' | 'caterpillar-tunnel' | 'cold-frame' | 'four-season-harvest';
  plantList: string[]; // IDs of cold-hardy plants
  protectionLayers: number; // Each layer = ~15° protection
  harvestWindow: { start: Date; end: Date };
  notes?: string;
}

// Pre-populated data for common compost materials
export const COMPOST_MATERIALS: { [key: string]: { type: 'green' | 'brown'; cnRatio: number } } = {
  'grass-clippings': { type: 'green', cnRatio: 20 },
  'food-scraps': { type: 'green', cnRatio: 15 },
  'coffee-grounds': { type: 'green', cnRatio: 20 },
  'fresh-manure': { type: 'green', cnRatio: 10 },
  'hay-fresh': { type: 'green', cnRatio: 15 },
  'dried-leaves': { type: 'brown', cnRatio: 60 },
  'straw': { type: 'brown', cnRatio: 80 },
  'wood-chips': { type: 'brown', cnRatio: 400 },
  'cardboard': { type: 'brown', cnRatio: 350 },
  'paper': { type: 'brown', cnRatio: 175 },
  'sawdust': { type: 'brown', cnRatio: 500 },
};
