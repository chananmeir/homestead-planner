/**
 * Garden Planner Space Calculator
 *
 * Calculates space requirements for manual plant quantity inputs
 * broken down by planning method (Square-Foot, MIGardener, Intensive, Row, Trellis).
 *
 * IMPORTANT: All calculations are normalized to square feet (SFG-cell equivalents)
 * for meaningful cross-method comparison. 1 SFG cell = 1 sq ft = 12" × 12"
 * EXCEPTION: Trellis crops use linear feet measurement instead of square feet.
 */

import { SeedInventoryItem, GardenBed, Plant, SpaceBreakdown, BedSpaceUsage, SuccessionPreference, TrellisStructure, TrellisSpaceUsage, BedAssignment, AllocationMode } from '../types';
import { PLANT_DATABASE } from '../data/plantDatabase';
import { getSFGCellsRequired } from './sfgSpacing';
import { getMIGardenerSpacing } from './migardenerSpacing';
import { getIntensiveSpacing } from './intensiveSpacing';

/**
 * Convert succession preference to succession count
 */
function getSuccessionCount(pref: SuccessionPreference): number {
  // Direct conversion: '0' → 0, '1' → 1, ..., '8' → 8
  const count = parseInt(pref, 10);
  return isNaN(count) ? 1 : Math.max(count, 1); // Never return 0 (treat as 1 planting)
}

/**
 * Detect if a plant is a trellis crop (linear planting style)
 */
export function isTrellisPlanting(plant: Plant | undefined): boolean {
  return plant?.migardener?.plantingStyle === 'trellis_linear';
}

/**
 * Get linear feet required per plant for trellis crops
 */
export function getLinearFeetPerPlant(plant: Plant | undefined): number {
  return plant?.migardener?.linearFeetPerPlant ?? 5.0; // Default 5 feet
}

/**
 * Detect if a plant uses seed-density calculation (not plant-count calculation)
 * Seed-density crops are direct-seeded densely (e.g., lettuce, arugula) where
 * the user specifies number of seeds, not number of mature plants.
 */
export function isSeedDensityPlanting(plant: Plant | undefined, planningMethod: string): boolean {
  if (!plant) return false;
  if (planningMethod !== 'migardener') return false;

  const mg = plant.migardener;
  if (!mg) return false;

  return mg.plantingStyle === 'row_based' &&
         typeof mg.seedDensityPerInch === 'number' &&
         mg.seedDensityPerInch > 0 &&
         typeof mg.rowSpacingInches === 'number' &&
         mg.rowSpacingInches > 0;
}

/**
 * Calculate seeds per square foot for seed-density crops
 * Formula: (rows per foot) × (seeds per row-foot)
 * Example: lettuce with 4" rows, 1 seed/inch = (12÷4) × 12×1 = 36 seeds/sqft
 */
function calculateSeedsPerSqFt(plant: Plant): number {
  const mg = plant.migardener;
  if (!mg || !mg.seedDensityPerInch || !mg.rowSpacingInches) {
    return 1; // Fallback
  }

  // Seeds per sq ft = (rows per foot) × (seeds per row-foot)
  const rowsPerFoot = 12 / mg.rowSpacingInches;
  const seedsPerRowFoot = 12 * mg.seedDensityPerInch;

  return rowsPerFoot * seedsPerRowFoot;
}

/**
 * Calculate space requirements for manual quantities grouped by planning method
 */
export async function calculateSpaceForQuantities(
  seeds: SeedInventoryItem[],
  quantities: Map<number, number>, // seedId -> quantity
  beds: GardenBed[],
  successionPreferences?: Map<number, SuccessionPreference>, // seedId -> succession preference
  trellisStructures?: TrellisStructure[] // Available trellis structures
): Promise<SpaceBreakdown> {
  // Group beds by planning method
  const bedsByMethod = groupBedsByMethod(beds);

  // Calculate space needed per method
  const byMethod: { [method: string]: any } = {};

  // Separate trellis crops from bed-based crops
  let totalTrellisLinearFeet = 0;
  const totalTrellisAvailableFeet = trellisStructures?.reduce((sum, t) => sum + (t.totalLengthFeet || 0), 0) || 0;

  for (const [method, methodBeds] of Object.entries(bedsByMethod)) {
    const cellsAvailable = calculateTotalCells(methodBeds);
    let cellsNeeded = 0;

    // For each seed with quantity
    quantities.forEach((quantity, seedId) => {
      const seed = seeds.find(s => s.id === seedId);
      if (!seed) return;

      const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
      if (!plant) return;

      // Skip trellis crops for bed-based methods
      if (isTrellisPlanting(plant)) return;

      const gridSize = 12; // Always use 12 for SFG-cell equivalent calculations

      // Apply succession adjustment
      let effectiveQuantity = quantity;
      const successionPref = successionPreferences?.get(seedId);
      if (successionPref && successionPref !== '0') {
        const successionCount = getSuccessionCount(successionPref);
        effectiveQuantity = quantity / successionCount;
      }

      // Check if this is a seed-density planting (e.g., MIGardener lettuce)
      if (isSeedDensityPlanting(plant, method)) {
        // Seed-density calculation: quantity = number of seeds
        const seedsPerSqFt = calculateSeedsPerSqFt(plant);
        const sqFtNeeded = effectiveQuantity / seedsPerSqFt;
        cellsNeeded += sqFtNeeded;
      } else {
        // Plant-based calculation: quantity = number of plants
        const cellsPerPlant = calculateSpaceRequirement(plant, gridSize, method);
        cellsNeeded += cellsPerPlant * effectiveQuantity;
      }
    });

    byMethod[method] = {
      cellsNeeded,
      cellsAvailable,
      utilization: cellsAvailable > 0 ? (cellsNeeded / cellsAvailable) * 100 : 0
    };
  }

  // Calculate trellis space requirements
  quantities.forEach((quantity, seedId) => {
    const seed = seeds.find(s => s.id === seedId);
    if (!seed) return;

    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
    if (!plant || !isTrellisPlanting(plant)) return;

    // Apply succession adjustment
    let effectiveQuantity = quantity;
    const successionPref = successionPreferences?.get(seedId);
    if (successionPref && successionPref !== '0') {
      const successionCount = getSuccessionCount(successionPref);
      effectiveQuantity = quantity / successionCount;
    }

    const linearFeetPerPlant = getLinearFeetPerPlant(plant);
    totalTrellisLinearFeet += effectiveQuantity * linearFeetPerPlant;
  });

  // Add trellis to methods if any trellis crops exist
  if (totalTrellisLinearFeet > 0) {
    byMethod['trellis'] = {
      cellsNeeded: 0, // Not used for trellis
      cellsAvailable: 0, // Not used for trellis
      linearFeet: totalTrellisLinearFeet,
      linearFeetAvailable: totalTrellisAvailableFeet,
      utilization: totalTrellisAvailableFeet > 0 ? (totalTrellisLinearFeet / totalTrellisAvailableFeet) * 100 : 0
    };
  }

  // Calculate overall totals
  const overall = {
    cellsNeeded: Object.values(byMethod)
      .filter((m: any) => m.cellsNeeded !== undefined)
      .reduce((sum: number, m: any) => sum + m.cellsNeeded, 0),
    cellsAvailable: Object.values(byMethod)
      .filter((m: any) => m.cellsAvailable !== undefined)
      .reduce((sum: number, m: any) => sum + m.cellsAvailable, 0),
    utilization: 0, // calculated below
    linearFeetNeeded: totalTrellisLinearFeet > 0 ? totalTrellisLinearFeet : undefined,
    linearFeetAvailable: totalTrellisLinearFeet > 0 ? totalTrellisAvailableFeet : undefined
  };
  overall.utilization = overall.cellsAvailable > 0 ? (overall.cellsNeeded / overall.cellsAvailable) * 100 : 0;

  return { byMethod, overall };
}

/**
 * Calculate space requirement for a single plant based on planning method
 * Returns SFG-cell equivalents (1 cell = 1 sq ft = 12" × 12")
 */
export function calculateSpaceRequirement(
  plant: Plant,
  gridSize: number,
  planningMethod: string
): number {
  const plantId = plant.id;

  // SQUARE FOOT GARDENING: Use SFG lookup table (already in SFG cells)
  if (planningMethod === 'square-foot') {
    return getSFGCellsRequired(plantId);
  }

  // MIGARDENER METHOD: Ultra-dense spacing
  if (planningMethod === 'migardener') {
    const spacing = plant.spacing || 12;
    const rowSpacing = plant.rowSpacing;
    const mgSpacing = getMIGardenerSpacing(plantId, spacing, rowSpacing);

    // Calculate actual square footage per plant
    const rowSpacingValue = mgSpacing.rowSpacing;
    if (rowSpacingValue === null || rowSpacingValue === undefined || rowSpacingValue === 0) {
      // Broadcast/intensive planting: space equally in all directions
      const sqInches = mgSpacing.plantSpacing * mgSpacing.plantSpacing;
      return sqInches / 144; // Convert to sq ft (SFG-cell equivalents)
    } else {
      // Row-based planting: rowSpacing × plantSpacing
      const sqInches = rowSpacingValue * mgSpacing.plantSpacing;
      return sqInches / 144; // Convert to sq ft (SFG-cell equivalents)
    }
  }

  // INTENSIVE METHOD: Bio-intensive spacing
  if (planningMethod === 'intensive') {
    const spacing = plant.spacing || 12;
    const onCenter = getIntensiveSpacing(plantId, spacing);
    // Assuming equidistant spacing (circular area per plant)
    const sqInches = onCenter * onCenter;
    return sqInches / 144; // Convert to sq ft (SFG-cell equivalents)
  }

  // ROW / TRADITIONAL METHOD (default)
  const spacing = plant.spacing || 12;
  const rowSpacingValue = plant.rowSpacing || spacing;
  const sqInches = rowSpacingValue * spacing;
  return sqInches / 144; // Convert to sq ft (SFG-cell equivalents)
}

/**
 * Group beds by planning method
 */
function groupBedsByMethod(beds: GardenBed[]): { [method: string]: GardenBed[] } {
  return beds.reduce((acc, bed) => {
    const method = bed.planningMethod || 'square-foot';
    if (!acc[method]) acc[method] = [];
    acc[method].push(bed);
    return acc;
  }, {} as { [method: string]: GardenBed[] });
}

/**
 * Calculate total cells available across beds
 * Returns SFG-cell equivalents (1 cell = 1 sq ft)
 */
function calculateTotalCells(beds: GardenBed[]): number {
  return beds.reduce((sum, bed) => {
    // Calculate bed area in square feet (1 sq ft = 1 SFG-cell equivalent)
    const sqFeet = bed.width * bed.length;
    return sum + sqFeet;
  }, 0);
}

/**
 * Get per-seed space estimate (for display in UI)
 */
export function getSpaceEstimateForSeed(
  seed: SeedInventoryItem,
  quantity: number,
  beds: GardenBed[],
  successionPreference?: SuccessionPreference
): string {
  const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
  if (!plant || quantity === 0) return '0 cells';

  // Apply succession adjustment
  let effectiveQuantity = quantity;
  if (successionPreference && successionPreference !== '0') {
    const successionCount = getSuccessionCount(successionPreference);
    effectiveQuantity = quantity / successionCount;
  }

  // Check if this is a trellis crop
  if (isTrellisPlanting(plant)) {
    const linearFeetPerPlant = getLinearFeetPerPlant(plant);
    const totalLinearFeet = effectiveQuantity * linearFeetPerPlant;
    const suffix = (successionPreference && successionPreference !== '0') ? '/planting' : '';
    return `${totalLinearFeet.toFixed(0)} linear ft (${effectiveQuantity} × ${linearFeetPerPlant} ft/plant)${suffix}`;
  }

  // Calculate average across all bed types
  const bedsByMethod = groupBedsByMethod(beds);
  const methods = Object.keys(bedsByMethod);

  if (methods.length === 0) {
    return '? cells (no beds)';
  }

  // Use the most common method, or first method if tied
  const mostCommonMethod = methods.reduce((a, b) =>
    bedsByMethod[a].length > bedsByMethod[b].length ? a : b
  );

  const gridSize = 12; // Always use 12 for SFG-cell equivalent calculations

  let totalCells: number;
  let unitLabel: string;

  if (isSeedDensityPlanting(plant, mostCommonMethod)) {
    // Seed-density calculation
    const seedsPerSqFt = calculateSeedsPerSqFt(plant);
    totalCells = effectiveQuantity / seedsPerSqFt;
    unitLabel = 'sq ft';
  } else {
    // Plant-based calculation
    const cellsPerPlant = calculateSpaceRequirement(plant, gridSize, mostCommonMethod);
    totalCells = cellsPerPlant * effectiveQuantity;
    unitLabel = 'cells';
  }

  // Add "per planting" label if succession is used
  const suffix = (successionPreference && successionPreference !== '0') ? '/planting' : '';
  return `~${Math.ceil(totalCells)} ${unitLabel}${suffix}`;
}

/**
 * Calculate space requirements per bed (not aggregate by method)
 * This allows tracking which specific beds have been assigned and how full they are
 *
 * IMPORTANT: This function now correctly handles:
 * - Custom bed allocations: Uses per-bed quantities from bedAllocations
 * - Even distribution: Splits total quantity evenly across assigned beds
 * - Succession defaults: Uses defaultSuccession when Map entry is missing
 */
export function calculateSpacePerBed(
  seeds: SeedInventoryItem[],
  quantities: Map<number, number>,
  bedAssignments: Map<number, number[]>, // seedId → bedIds
  beds: GardenBed[],
  successionPreferences?: Map<number, SuccessionPreference>, // seedId → succession preference
  bedAllocations?: Map<number, BedAssignment[]>, // seedId → per-bed allocations
  allocationModes?: Map<number, AllocationMode>, // seedId → 'even' | 'custom'
  defaultSuccession: SuccessionPreference = '4' // Default succession when not in Map
): Map<number, BedSpaceUsage> {
  const bedUsage = new Map<number, BedSpaceUsage>();

  // Initialize all beds
  beds.forEach(bed => {
    bedUsage.set(bed.id, {
      bedId: bed.id,
      bedName: bed.name,
      totalSpace: bed.width * bed.length,
      usedSpace: 0,
      crops: []
    });
  });

  // For each seed with quantity
  quantities.forEach((quantity, seedId) => {
    const seed = seeds.find(s => s.id === seedId);
    const assignedBeds = bedAssignments.get(seedId) || [];

    if (!seed || assignedBeds.length === 0) return;

    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
    if (!plant) return;

    // Get allocation mode (default to 'even')
    const allocationMode = allocationModes?.get(seedId) || 'even';
    const allocations = bedAllocations?.get(seedId) || [];

    // Get succession count - use default if not in Map (Bug #1 fix)
    const successionPref = successionPreferences?.get(seedId) ?? defaultSuccession;
    const successionCount = (successionPref && successionPref !== '0')
      ? getSuccessionCount(successionPref)
      : 1;

    // Calculate space for each assigned bed
    assignedBeds.forEach(bedId => {
      const bed = beds.find(b => b.id === bedId);
      if (!bed) return;

      const usage = bedUsage.get(bedId)!;

      // Determine quantity for this specific bed (Bug #2 fix)
      let bedQuantity: number;
      if (allocationMode === 'custom') {
        // Custom mode: use per-bed allocation quantity (season-total for this bed)
        const alloc = allocations.find(a => a.bedId === bedId);
        bedQuantity = alloc?.quantity || 0;
      } else {
        // Even mode: distribute total quantity evenly across assigned beds
        bedQuantity = quantity / assignedBeds.length;
      }

      // Skip if no quantity for this bed
      if (bedQuantity <= 0) return;

      // The bedQuantity represents the SEASON TOTAL for this bed.
      // For "Per-Bed Space Usage", we show the space based on season-total quantity.
      // Succession planting reuses the same physical space across plantings,
      // but for planning purposes we show how much space is "dedicated" to this crop.
      //
      // Example: 13 Kale with 4 successions in Bed A
      // - Physical space at any time: 13/4 ≈ 3.25 plants worth
      // - But for planning: show 13 sq ft (the season commitment to this bed)
      //
      // We do NOT divide by succession count here because:
      // 1. bedQuantity is already the season-total for this bed
      // 2. Dividing would show per-planting space (too small for planning view)
      // 3. The user entered "13" meaning "13 plants worth of space for the season"

      // Calculate space needed using dual-mode calculation
      let spaceNeeded: number;
      if (isSeedDensityPlanting(plant, bed.planningMethod || 'square-foot')) {
        const seedsPerSqFt = calculateSeedsPerSqFt(plant);
        spaceNeeded = bedQuantity / seedsPerSqFt;
      } else {
        const gridSize = 12;
        const cellsPerPlant = calculateSpaceRequirement(plant, gridSize, bed.planningMethod || 'square-foot');
        spaceNeeded = cellsPerPlant * bedQuantity;
      }

      // For display, show the per-planting quantity (what's planted at once)
      const quantityPerPlanting = bedQuantity / successionCount;

      usage.usedSpace += spaceNeeded;
      usage.crops.push({
        seedId,
        plantName: plant.name,
        variety: seed.variety,
        quantity: quantityPerPlanting,
        spaceUsed: spaceNeeded
      });
    });
  });

  return bedUsage;
}

/**
 * Calculate trellis space requirements per trellis structure
 * This allows tracking which specific trellises have been assigned and how full they are
 */
export function calculateTrellisSpaceRequirement(
  seeds: SeedInventoryItem[],
  quantities: Map<number, number>,
  trellisAssignments: Map<number, number[]>, // seedId → trellisIds
  allTrellises: TrellisStructure[],
  successionPreferences?: Map<number, SuccessionPreference>
): Map<number, TrellisSpaceUsage> {
  const trellisUsage = new Map<number, TrellisSpaceUsage>();

  // Initialize all trellises
  allTrellises.forEach(trellis => {
    trellisUsage.set(trellis.id, {
      trellisId: trellis.id,
      trellisName: trellis.name,
      totalLength: trellis.totalLengthFeet || 0,
      usedSpace: 0,
      crops: []
    });
  });

  // For each seed with quantity
  quantities.forEach((quantity, seedId) => {
    const seed = seeds.find(s => s.id === seedId);
    const assignedTrellises = trellisAssignments.get(seedId) || [];

    if (!seed || assignedTrellises.length === 0) return;

    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
    if (!plant || !isTrellisPlanting(plant)) return;

    // Apply succession adjustment
    let effectiveQuantity = quantity;
    const successionPref = successionPreferences?.get(seedId);
    if (successionPref && successionPref !== '0') {
      const successionCount = getSuccessionCount(successionPref);
      effectiveQuantity = quantity / successionCount;
    }

    const linearFeetPerPlant = getLinearFeetPerPlant(plant);
    const totalLinearFeet = effectiveQuantity * linearFeetPerPlant;

    // Distribute evenly across assigned trellises
    const linearFeetPerTrellis = totalLinearFeet / assignedTrellises.length;

    assignedTrellises.forEach(trellisId => {
      const usage = trellisUsage.get(trellisId);
      if (!usage) return;

      usage.usedSpace += linearFeetPerTrellis;
      usage.crops.push({
        plantName: plant.name,
        variety: seed.variety,
        quantity: effectiveQuantity,
        linearFeetUsed: linearFeetPerTrellis,
        linearFeetPerPlant
      });
    });
  });

  return trellisUsage;
}

/**
 * Result of seed row optimization calculation
 */
export interface SeedRowOptimization {
  minBedsNeeded: number;
  requiredBedIds: number[];
  extraBedIds: number[];
}

/**
 * Calculate minimum beds needed for a single seed row.
 * Returns null if optimization should be skipped.
 *
 * v1 scope:
 * - Skip trellis_linear
 * - Skip seed-density crops
 * - Restrict to square-foot beds only (unit alignment)
 * - Uses calculateSpaceForQuantities() for guaranteed Step 1 consistency
 */
export async function calculateSeedRowOptimization(
  seed: SeedInventoryItem,
  quantity: number,
  successionPref: SuccessionPreference,
  assignedBedIds: number[],
  gardenBeds: GardenBed[],
  seedInventory: SeedInventoryItem[]
): Promise<SeedRowOptimization | null> {
  const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);

  // v1: Skip trellis_linear
  if (isTrellisPlanting(plant)) {
    return null;
  }

  // v1: Skip seed-density crops
  if (isSeedDensityPlanting(plant, 'migardener')) {
    return null;
  }

  // Skip if 0-1 beds assigned (already optimal)
  if (assignedBedIds.length <= 1) {
    return null;
  }

  // Skip if quantity is 0 or invalid
  if (!quantity || quantity <= 0) {
    return null;
  }

  // v1: Restrict to square-foot beds only (guaranteed unit alignment)
  const assignedBeds: (GardenBed | undefined)[] = assignedBedIds.map(id =>
    gardenBeds.find(b => b.id === id)
  );

  for (const bed of assignedBeds) {
    if (!bed || !bed.width || !bed.length) {
      return null; // Missing bed data
    }
    if (bed.planningMethod !== 'square-foot') {
      return null; // v1: only square-foot beds
    }
  }

  // Calculate requiredSpace using calculateSpaceForQuantities() - exact same as Step 1
  // Create single-seed input
  const singleSeedQuantities = new Map<number, number>();
  singleSeedQuantities.set(seed.id, quantity);

  const singleSeedSuccession = new Map<number, SuccessionPreference>();
  singleSeedSuccession.set(seed.id, successionPref);

  // Filter to only square-foot beds for the calculation
  const sfgBeds = assignedBeds.filter((b): b is GardenBed => b !== undefined);

  const breakdown = await calculateSpaceForQuantities(
    seedInventory,
    singleSeedQuantities,
    sfgBeds,
    singleSeedSuccession
  );

  const requiredSpace = breakdown.byMethod['square-foot']?.cellsNeeded || 0;
  if (!requiredSpace || requiredSpace <= 0) {
    return null;
  }

  // Accumulate in STABLE ORDER (no sorting)
  let accumulated = 0;
  let minBedsNeeded = 0;

  for (const bed of assignedBeds) {
    if (!bed) continue;
    const capacity = bed.width * bed.length; // sq ft = SFG cells
    accumulated += capacity;
    minBedsNeeded++;
    if (accumulated >= requiredSpace) {
      break;
    }
  }

  // requiredBedIds = stable prefix
  const requiredBedIds = assignedBedIds.slice(0, minBedsNeeded);

  // extraBedIds = remainder
  const extraBedIds = assignedBedIds.slice(minBedsNeeded);

  // Only return optimization if there are extra beds
  if (extraBedIds.length === 0) {
    return null;
  }

  return {
    minBedsNeeded,
    requiredBedIds,
    extraBedIds
  };
}
