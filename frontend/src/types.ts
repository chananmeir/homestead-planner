// Core data types for the Homestead Tracker app

// Planting Style Types (NEW: Decoupled from planning method)
export type PlantingStyle = 'grid' | 'row' | 'broadcast' | 'dense_patch' | 'plant_spacing' | 'trellis_linear';

// User Management Types
export interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  lastLogin: string | null;
}

// Seed Inventory Types
export interface SeedInventoryItem {
  id: number;
  plantId: string;  // Backend returns camelCase
  variety: string;
  brand?: string;
  quantity: number;
  purchaseDate?: string;
  expirationDate?: string;
  germinationRate?: number;
  location?: string;
  price?: number;
  seedsPerPacket?: number;  // Seeds per packet (default 50)
  notes?: string;
  isGlobal?: boolean;
  catalogSeedId?: number | null;  // Reference to catalog seed if cloned from catalog
  lastSyncedAt?: string | null;  // Last time agronomic data was synced from catalog
  // Seed provenance
  sourcePlantedItemId?: number;
  isHomegrown?: boolean;
  // Variety-specific agronomic overrides
  daysToMaturity?: number;
  germinationDays?: number;
  plantSpacing?: number;
  rowSpacing?: number;
  plantingDepth?: number;
  germinationTempMin?: number;
  germinationTempMax?: number;
  soilTempMin?: number;
  heatTolerance?: string;
  coldTolerance?: string;
  boltResistance?: string;
  idealSeasons?: string;
  flavorProfile?: string;
  storageRating?: string;
}

export interface UserStatistics {
  totalUsers: number;
  adminUsers: number;
  activeUsers: number;
  recentRegistrations: number;
}

export interface Plant {
  id: string;
  name: string;
  scientificName?: string;
  family?: string; // Botanical family for crop rotation planning
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
  soilTempMin?: number; // Minimum soil temperature for germination (Fahrenheit)
  transplantWeeksBefore: number; // weeks before last frost
  weeksIndoors?: number; // weeks to start indoors before transplanting (0 = direct seed)
  germinationDays?: number; // Days from planting to emergence
  idealSeasons?: ('spring' | 'summer' | 'fall' | 'winter')[]; // Best planting seasons
  heatTolerance?: 'low' | 'medium' | 'high' | 'excellent'; // General heat tolerance
  lifecycle?: 'annual' | 'biennial' | 'perennial'; // Plant lifecycle type
  daysToSeed?: number; // Extra days past harvest for seed maturity
  matureSpacing?: number; // inches between mature plants (for perennials)
  matureRowSpacing?: number; // inches between rows at maturity (for perennials)
  yearsToMaturity?: number; // years until full production (for perennials)
  notes?: string;
  icon?: string; // Emoji icon for visual representation
  iconUrl?: string; // URL or path to custom icon image

  // NEW: MIGardener seed density metadata
  migardener?: {
    plantingStyle: 'row_based' | 'broadcast' | 'dense_patch' | 'plant_spacing' | 'trellis_linear';

    // Row-based seeding (used when plantingStyle = 'row_based')
    seedDensityPerInch?: number;
    rowSpacingInches?: number | null;

    // Broadcast seeding (used when plantingStyle = 'broadcast' or 'dense_patch')
    seedDensityPerSqFt?: number;

    // Plant-spacing seeding (used when plantingStyle = 'plant_spacing')
    // Multi-seed spots with thinning (e.g., beans: 3 seeds per spot, thin to 1)
    seedsPerSpot?: number;        // Number of seeds planted per spot
    plantsKeptPerSpot?: number;   // Number of plants kept after thinning (usually 1)

    // Trellis-based planting (used when plantingStyle = 'trellis_linear')
    linearFeetPerPlant?: number;  // Linear feet required per plant on trellis
    trellisRequired?: boolean;     // Whether this plant requires a trellis structure
    trellisTypes?: Array<'fence' | 'arbor' | 'a-frame' | 'post_wire' | 'espalier'>;

    // Special method-specific metadata
    trenchWidth?: number;          // Width of trench in inches (e.g., for trench-planted potatoes)

    // Common to all styles
    germinationRate: number;
    survivalRate: number;
    finalSpacingInches: number;
    harvestMethod: 'individual_head' | 'cut_and_come_again' | 'leaf_mass' | 'continuous_picking' | 'perennial_cutback' | 'individual_root' | 'partial_harvest';
    maturityDaysFromSeed: number;
  };
}

export type PlantCategory =
  | 'vegetable'
  | 'herb'
  | 'fruit'
  | 'nut'
  | 'flower'
  | 'cover-crop';

export type FrostTolerance =
  | 'very-tender' // Killed by light frost
  | 'tender' // Damaged by frost
  | 'half-hardy' // Tolerates light frost
  | 'hardy' // Tolerates frost
  | 'very-hardy'; // Thrives in frost

export interface GardenBed {
  id: number;
  name: string;
  width: number; // feet
  length: number; // feet
  height?: number; // inches - raised bed height (default: 12)
  location?: string;
  sunExposure?: 'full' | 'partial' | 'shade';
  soilType?: 'sandy' | 'loamy' | 'clay';
  mulchType?: 'none' | 'straw' | 'wood-chips' | 'leaves' | 'grass' | 'compost' | 'black-plastic' | 'clear-plastic';
  planningMethod: string; // 'square-foot', 'row', 'intensive', etc.
  defaultPlantingStyle?: PlantingStyle; // NEW Phase 2: Optional bed-level default planting style
  gridSize: number; // inches per grid cell (default: 12 for square foot gardening)
  zone?: 'zone0' | 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5'; // Permaculture zone classification
  plantedItems?: PlantedItem[];
  seasonExtension?: SeasonExtension;
}

export interface PlantedItem {
  id: number;
  plantId: string;
  variety?: string; // Specific variety (e.g., "Buttercrunch", "Romaine")
  plantedDate: Date;
  transplantDate?: Date;
  harvestDate?: Date;
  position: { x: number; y: number }; // grid position
  quantity: number;
  status: 'planned' | 'seeded' | 'transplanted' | 'growing' | 'harvested' | 'saving-seed';
  notes?: string;

  // Seed saving fields
  saveForSeed?: boolean;
  seedMaturityDate?: string;
  seedsCollected?: boolean;
  seedsCollectedDate?: string;

  // NEW: Planting method determines which fields are used
  plantingMethod?: 'individual_plants' | 'seed_density' | 'seed_density_broadcast';

  // For individual_plants method (Square-Foot, Row, Intensive)
  spacing?: number;

  // For seed_density method (MIGardener)
  seedCount?: number;
  seedDensity?: number;
  uiSegmentLengthInches?: number;  // UI grid segment size (not full row length)
  expectedGerminationRate?: number;
  expectedSurvivalRate?: number;
  expectedFinalCount?: number;
  harvestMethod?: 'individual_head' | 'cut_and_come_again' | 'leaf_mass';

  // Row continuity tracking (links adjacent cells into continuous rows)
  rowGroupId?: string;  // UUID linking adjacent segments into continuous rows
  rowSegmentIndex?: number;  // Position within continuous row (0, 1, 2...)
  totalRowSegments?: number;  // How many segments in this continuous row

  // Link to season plan item for progress tracking
  sourcePlanItemId?: number;
}

export interface SeasonExtension {
  type: 'none' | 'row-cover' | 'cold-frame' | 'low-tunnel' | 'high-tunnel' | 'greenhouse';
  innerType?: 'none' | 'row-cover' | 'cold-frame' | 'low-tunnel' | 'high-tunnel' | 'greenhouse';
  installDate?: Date;
  // Eliot Coleman's layer system - each layer adds ~10-15°F
  layers: number;
  material?: string;
  notes?: string;
  // Heat protection
  shadeCloth?: {
    installed: boolean;
    shadeFactor: number; // 30, 40, 50, 60, 70, 80
  };
}

export interface PlantingCalendar {
  id: number;

  // Event type discriminator - supports different types of garden events
  eventType?: 'planting' | 'mulch' | 'fertilizing' | 'irrigation' | 'maple-tapping';

  // Plant-specific fields (only for eventType='planting' or undefined)
  plantId?: string;
  variety?: string; // e.g., "Brandywine", "Roma", "Cherokee Purple"

  // Common fields for all event types
  gardenBedId?: number;
  notes?: string;
  completed: boolean;
  quantityCompleted?: number;  // How many actually planted (null = not started)

  // Date fields
  seedStartDate?: Date;
  transplantDate?: Date;
  directSeedDate?: Date;
  expectedHarvestDate?: Date;

  // Succession planting fields (planting events only)
  successionPlanting?: boolean;
  successionInterval?: number; // days
  successionGroupId?: string; // UUID linking events in succession series

  // Position fields (planting events only)
  positionX?: number; // Grid X coordinate (for space tracking)
  positionY?: number; // Grid Y coordinate (for space tracking)
  spaceRequired?: number; // Grid cells needed (for space tracking)
  conflictOverride?: boolean; // User allowed conflict

  // Planting method fields (for seed density vs individual plants)
  plantingMethod?: 'individual_plants' | 'seed_density' | 'seed_density_broadcast';
  quantity?: number; // Target quantity to plant
  spacing?: number;
  seedCount?: number;
  seedDensity?: number;
  uiSegmentLengthInches?: number;
  expectedGerminationRate?: number;
  expectedSurvivalRate?: number;
  expectedFinalCount?: number;
  harvestMethod?: 'individual_head' | 'cut_and_come_again' | 'leaf_mass';

  // Row continuity tracking
  rowGroupId?: string;
  rowSegmentIndex?: number;
  totalRowSegments?: number;
  rowNumber?: number;

  // Trellis fields
  trellisStructureId?: number;
  trellisPositionStartInches?: number;
  trellisPositionEndInches?: number;
  linearFeetAllocated?: number;

  // Event-specific details (JSON)
  eventDetails?: string | {
    // For mulch events
    mulchType?: string;
    depthInches?: number;
    coverage?: string;

    // For fertilizing events
    fertilizerType?: string;
    amount?: string;

    // For maple-tapping events
    treeStructureId?: number;
    treeType?: 'sugar' | 'red' | 'black' | 'boxelder';
    tapCount?: number;
    collectionDates?: Array<{
      date: string;
      sapAmount: number;
      notes?: string;
    }>;
    syrupYield?: {
      gallons: number;
      grade: 'Golden' | 'Amber' | 'Dark' | 'VeryDark';
      boilDate: string;
      notes?: string;
    };
    treeHealth?: {
      tapHealing: 'good' | 'fair' | 'poor';
      observations: string;
      diameter?: number;
    };
  };
}

// PlantingEvent interface matching backend model
// Used for date-based garden filtering
export interface PlantingEvent {
  id: number;
  userId: number;

  // Event type discriminator
  eventType?: 'planting' | 'mulch' | 'fertilizing' | 'irrigation' | 'maple-tapping';

  // Event-specific details (JSON string from backend)
  eventDetails?: string;

  // Plant-specific fields (required for planting events, optional for others)
  plantId?: string;
  variety?: string;

  // Common fields
  gardenBedId?: number;
  seedStartDate?: string;  // ISO date string
  transplantDate?: string; // ISO date string
  directSeedDate?: string; // ISO date string
  expectedHarvestDate?: string; // ISO date string
  actualHarvestDate?: string;   // ISO date string
  successionPlanting?: boolean;
  successionInterval?: number;
  successionGroupId?: string;
  positionX?: number;
  positionY?: number;
  spaceRequired?: number;
  conflictOverride?: boolean;
  notes?: string;

  // NEW: Planting method for seed density vs individual plants
  plantingMethod?: 'individual_plants' | 'seed_density' | 'seed_density_broadcast';

  // For individual_plants method
  quantity?: number;
  quantityCompleted?: number;  // How many actually planted (null = not started)
  spacing?: number;

  // For seed_density method (MIGardener)
  seedCount?: number;
  seedDensity?: number;
  uiSegmentLengthInches?: number;  // UI grid segment size (not full row length)
  expectedGerminationRate?: number;
  expectedSurvivalRate?: number;
  expectedFinalCount?: number;
  harvestMethod?: 'individual_head' | 'cut_and_come_again' | 'leaf_mass';

  // Row continuity tracking (links adjacent cells into continuous rows)
  rowGroupId?: string;  // UUID linking adjacent segments into continuous rows
  rowSegmentIndex?: number;  // Position within continuous row (0, 1, 2...)
  totalRowSegments?: number;  // How many segments in this continuous row

  // MIGardener physical row number (independent of grid position)
  rowNumber?: number;  // Physical row index (1, 2, 3...) for MIGardener methodology

  // Trellis-based planting fields (for trellis_linear style crops)
  trellisStructureId?: number;           // Link to trellis structure
  trellisPositionStartInches?: number;   // Start position along trellis (inches from start)
  trellisPositionEndInches?: number;     // End position along trellis (inches from start)
  linearFeetAllocated?: number;          // Linear feet used on trellis

  // Export key for linking PlantingEvent back to GardenPlanItem succession
  // Format: "{planItemId}_{date}_{index}" or "{planItemId}_trellis_{trellisId}_{date}_{index}"
  exportKey?: string;
}

// Trellis structure for linear vine crop allocation
export interface TrellisStructure {
  id: number;
  propertyId: number;
  gardenBedId?: number;  // Optional link to garden bed
  name: string;
  trellisType: 'fence' | 'arbor' | 'a-frame' | 'post_wire' | 'espalier';
  startX: number;  // X coordinate in feet
  startY: number;  // Y coordinate in feet
  endX: number;    // X coordinate in feet
  endY: number;    // Y coordinate in feet
  totalLengthFeet: number;
  totalLengthInches: number;
  heightInches: number;
  wireSpacingInches?: number;
  numWires?: number;
  notes?: string;
  createdAt: string;
}

// Trellis capacity information
export interface TrellisCapacity {
  trellisId: number;
  totalLengthFeet: number;
  allocatedFeet: number;
  availableFeet: number;
  occupiedSegments: Array<{
    id: number;
    plantId: string;
    variety?: string;
    startInches: number;
    endInches: number;
    linearFeet: number;
  }>;
  percentOccupied: number;
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
  position?: { x: number; y: number };
  type: 'spatial' | 'temporal' | 'both';
  bedName?: string;
  conflictWith?: { plantName: string; variety?: string; dates: string };
}

// Auto-adjustment types for conflict resolution
export interface EventAdjustment {
  eventId: number;
  oldHarvestDate: string;  // ISO date
  newHarvestDate: string;  // ISO date
  plantName: string;
  variety?: string;
  daysEarlier: number;
}

export interface CompostPile {
  id: number;  // Backend returns numeric IDs
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

// Planting Validation Types
export interface ValidationWarning {
  type: 'frost_risk' | 'frost_risk_protected' | 'soil_temp_low' | 'soil_temp_protected' | 'soil_temp_marginal' | 'soil_temp_high' | 'heat_risk' | 'heat_risk_protected' | 'no_location' | 'future_cold_danger' | 'sun_exposure_mismatch';
  message: string;
  severity: 'warning' | 'info' | 'error';
}

export interface DateSuggestion {
  earliest_safe_date: string | null;
  optimal_start: string | null;
  optimal_end: string | null;
  optimal_range: string | null;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
  suggestion?: DateSuggestion;
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

// ==================== GARDEN PLANNER TYPES ====================

export type UnitType = 'plants' | 'row_ft' | 'area_sqft' | 'cells';

export type PlanningStrategy = 'maximize_harvest' | 'use_all_seeds' | 'balanced';

export type SuccessionPreference = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export interface GardenPlan {
  id: number;
  userId: number;
  name: string;
  season?: string; // 'spring', 'summer', 'fall', 'year-round'
  year: number;
  strategy: PlanningStrategy;
  successionPreference: SuccessionPreference;
  targetTotalPlants?: number;
  targetDiversity?: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  items?: GardenPlanItem[];
}

// Per-bed quantity allocation
export interface BedAssignment {
  bedId: number;
  quantity: number;
}

export type AllocationMode = 'even' | 'custom';

export interface GardenPlanItem {
  id?: number;
  gardenPlanId: number;
  seedInventoryId?: number | null;
  plantId: string;
  variety?: string;
  unitType: UnitType;
  targetValue: number; // Quantity in natural units (e.g., 24 plants, 15 row-ft, 10 sqft)
  plantEquivalent: number; // Normalized plant count for calculations
  seedsRequired?: number;
  seedPacketsRequired?: number;
  successionEnabled: boolean;
  successionCount: number;
  successionIntervalDays?: number;
  firstPlantDate?: string | null;
  lastPlantDate?: string | null;
  harvestWindowStart?: string | null;
  harvestWindowEnd?: string | null;
  bedsAllocated?: number[]; // Legacy: derived from bedAssignments for backward compatibility
  bedAssignments?: BedAssignment[]; // NEW: per-bed quantity allocation
  allocationMode?: AllocationMode; // NEW: 'even' or 'custom'
  clientKey?: string; // Stable key for unsaved items (generated from plantId:variety:seedInventoryId)
  spaceRequiredCells?: number;
  trellisAssignments?: number[];
  status: 'planned' | 'exported' | 'completed';
  exportKey?: string;
  createdAt?: string;
  updatedAt?: string;
  rotation_warnings?: RotationWarning[]; // Crop rotation warnings for allocated beds
  rowSeedingInfo?: {
    seedsPerRow: number;
    rowsNeeded: number;
    rowLengthFeet: number;
    totalSeeds: number;
  };
}

export interface PlanNutritionData {
  totals: NutritionTotals;
  byPlant: {
    [plantId: string]: PlantNutritionBreakdown;
  };
  missingNutritionData: string[];
  year: number;
}

export interface PlantNutritionBreakdown {
  name: string;
  variety?: string;
  plantEquivalent: number;
  successionCount: number;
  totalYieldLbs: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  vitaminAIu: number;
  vitaminCMg: number;
  vitaminKMcg: number;
  calciumMg: number;
  ironMg: number;
  potassiumMg: number;
}

export interface NutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  vitaminAIu: number;
  vitaminCMg: number;
  vitaminKMcg: number;
  calciumMg: number;
  ironMg: number;
  potassiumMg: number;
}

export interface SpaceBreakdown {
  byMethod: {
    [method: string]: {
      cellsNeeded: number;
      cellsAvailable: number;
      utilization: number;
      linearFeet?: number;          // NEW: For trellis method only
      linearFeetAvailable?: number; // NEW: For trellis method only
    };
  };
  overall: {
    cellsNeeded: number;
    cellsAvailable: number;
    utilization: number;
    linearFeetNeeded?: number;      // NEW: Total trellis feet needed
    linearFeetAvailable?: number;   // NEW: Total trellis feet available
  };
}

export interface BedSpaceUsage {
  bedId: number;
  bedName: string;
  totalSpace: number;
  usedSpace: number;           // Peak concurrent space (what's in the ground at once)
  seasonTotalSpace: number;    // Full season total (sum of all succession plantings)
  crops: {
    seedId: number;
    plantName: string;
    variety?: string;
    quantity: number;
    spaceUsed: number;
    successionCount: number;   // 1 = no succession
  }[];
}

export interface TrellisSpaceUsage {
  trellisId: number;
  trellisName: string;
  totalLength: number;           // In feet
  usedSpace: number;             // Linear feet allocated
  crops: Array<{
    plantName: string;
    variety?: string;
    quantity: number;
    linearFeetUsed: number;
    linearFeetPerPlant: number;
  }>;
}

export interface CalculatePlanRequest {
  seedSelections: SeedInventoryItem[];
  strategy: PlanningStrategy;
  successionPreference: SuccessionPreference;
  manualQuantities?: { [seedId: number]: number };
  perSeedSuccession?: { [seedId: number]: SuccessionPreference };
}

export interface CalculatePlanResponse {
  items: GardenPlanItem[];
  summary: {
    totalPlants: number;
    totalSpaceUsed: number;
    totalSpaceAvailable: number;
    spaceUtilization: number;
    cropDiversity: number;
    methodBreakdown?: {
      [method: string]: {
        used: number;
        available: number;
        utilization: number;
      };
    };
  };
}

export interface ShoppingListItem {
  plantId: string;
  variety?: string;
  seedsNeeded: number;
  seedsHave: number | null;
  packetsToBuy: number;
  seedsPerPacket: number;
  estimatedCost: number;
  note: string;
}

export interface ExportToCalendarResponse {
  success: boolean;
  eventsCreated: number;
  eventsUpdated: number;
  totalEvents: number;
  error?: string;
}

// ========== CROP ROTATION TYPES ==========

export interface RotationConflict {
  has_conflict: boolean;
  conflict_years: number[];
  last_planted?: string; // ISO date string
  family: string | null;
  recommendation: string;
  safe_year?: number;
}

export interface BedRotationStatus {
  bed_id: number;
  bed_name: string;
  rotation_safe: boolean;
  conflict_info?: RotationConflict;
}

export interface RotationWarning {
  bed_id: number;
  bed_name: string;
  message: string;
  family: string;
  conflict_years: number[];
  safe_year: number;
}

export interface BedHistoryEntry {
  plant_id: string;
  plant_name: string;
  family: string | null;
  year: number;
  planted_date: string; // ISO date string
  variety?: string;
}

// ==================== NUTRITIONAL TRACKING TYPES ====================

/**
 * Nutritional data for food sources (plants, eggs, milk, meat, honey)
 * All nutritional values are per 100g
 */
export interface NutritionalData {
  id: number;
  sourceType: 'plant' | 'egg' | 'milk' | 'meat' | 'honey';
  sourceId: string;  // plant_id, 'chicken_egg', etc.
  name: string;
  usdaFdcId?: number;  // USDA FoodData Central ID

  // Macronutrients (per 100g)
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;

  // Vitamins (per 100g)
  vitaminAIu?: number;
  vitaminCMg?: number;
  vitaminKMcg?: number;
  vitaminEMg?: number;
  folateMcg?: number;

  // Minerals (per 100g)
  calciumMg?: number;
  ironMg?: number;
  magnesiumMg?: number;
  potassiumMg?: number;
  zincMg?: number;

  // Yield estimation data
  averageYieldLbsPerPlant?: number;
  averageYieldLbsPerSqft?: number;
  averageYieldLbsPerTreeYear?: number;

  dataSource?: string;
  notes?: string;
  lastUpdated?: string;
  userId?: number;  // null for global data
}

/**
 * Breakdown of nutritional values
 */
export interface NutritionBreakdown {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  vitaminAIu: number;
  vitaminCMg: number;
  vitaminKMcg: number;
  vitaminEMg: number;
  folateMcg: number;
  calciumMg: number;
  ironMg: number;
  magnesiumMg: number;
  potassiumMg: number;
  zincMg: number;
}

/**
 * Nutritional output per plant type
 */
export interface PlantNutrition extends NutritionBreakdown {
  name: string;
  totalYieldLbs: number;
}

/**
 * Garden nutritional summary
 */
export interface GardenNutritionSummary {
  totals: NutritionBreakdown;
  byPlant: {
    [plantId: string]: PlantNutrition;
  };
  year: number;
}

/**
 * Complete nutritional summary across all sources
 */
export interface NutritionSummary {
  totals: NutritionBreakdown;
  bySource: {
    garden: GardenNutritionSummary | null;
    livestock: any | null;  // Phase 3
    trees: any | null;      // Phase 3
  };
  year: number;
}

// ==================== GARDEN SNAPSHOT TYPES ====================

export interface GardenSnapshotBedDetail {
  bedId: number;
  bedName: string;
  quantity: number;
}

export interface GardenSnapshotPlantEntry {
  plantId: string;
  plantName: string;
  variety: string | null;
  totalQuantity: number;
  beds: GardenSnapshotBedDetail[];
}

export interface GardenSnapshotResponse {
  date: string;
  summary: { totalPlants: number; uniqueVarieties: number; bedsWithPlants: number };
  byPlant: Record<string, GardenSnapshotPlantEntry>;
}

// ==================== PLANNED PLANTS FOR BED ====================

/**
 * Item from Garden Season Planner assigned to a specific bed.
 * Used by Garden Designer to show "Planned for this Bed" section.
 */
export interface PlannedBedItem {
  planItemId: number;
  seedId: number | null;
  plantId: string | null;
  plantName: string;
  varietyName: string | null;
  quantityForBed: number;
  totalQuantity: number;
  successionCount: number | null;
  notes: string | null;
  // Succession timeline fields for date-aware planned counts
  firstPlantDate?: string | null;
  successionIntervalDays?: number | null;
  harvestWindowStart?: string | null;
  harvestWindowEnd?: string | null;
  daysToMaturity?: number | null;
}

/**
 * Progress data for a single GardenPlanItem.
 * Used by sidebar to show "X/Y (Season: A/B)" progress.
 */
export interface PlanItemProgress {
  planItemId: number;
  plantId: string;
  variety: string | null;
  plannedSeason: number;
  placedSeason: number;
  plannedByBed: Record<string, number>;
  placedByBed: Record<string, number>;
}

/**
 * Response from GET /api/garden-planner/season-progress
 */
export interface SeasonProgressResponse {
  year: number;
  summary: {
    totalPlanned: number;
    totalAdded: number;
    totalRemaining: number;
  };
  byPlant: Record<string, unknown>;
  byBed: Record<string, unknown>;
  byPlanItemId: Record<string, PlanItemProgress>;
}
