/**
 * Garden Season Planner Component - Streamlined Implementation
 *
 * Helps users plan their entire growing season starting from their seed inventory.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import type { GardenPlan, SeedInventoryItem, PlanningStrategy, SuccessionPreference, CalculatePlanResponse, RotationWarning as RotationWarningType, GardenBed, SpaceBreakdown, BedSpaceUsage, TrellisStructure, TrellisSpaceUsage, BedAssignment, AllocationMode, SeasonProgressResponse, Conflict } from '../types';
import RotationWarning from './common/RotationWarning';
import ConflictWarning from './common/ConflictWarning';
import { Modal } from './common/Modal';
import { ConfirmDialog, useToast } from './common';
import { SearchBar } from './common/SearchBar';
import { FilterBar, FilterGroup } from './common/FilterBar';
import { SortDropdown, SortOption, SortDirection } from './common/SortDropdown';
import { getPlantById, resolveAlias } from '../utils/plantIdResolver';
import { calculateSpaceForQuantities, calculateSpacePerBed, calculateTrellisSpaceRequirement, isTrellisPlanting, getLinearFeetPerPlant, calculateSeedRowOptimization, SeedRowOptimization, refineBedSpaceWithDates } from '../utils/gardenPlannerSpaceCalculator';
import { calculateSuggestedInterval } from './PlantingCalendar/utils/successionCalculations';
import { PlanNutritionCard } from './GardenPlanner/PlanNutritionCard';
import GardenSnapshot from './GardenPlanner/GardenSnapshot';
import { useActivePlan } from '../contexts/ActivePlanContext';

// Debug flag for Season Planner diagnostics
// To enable: In browser console, run: localStorage.setItem('DEBUG_SEASON_PLANNER', 'true')
// To disable: localStorage.removeItem('DEBUG_SEASON_PLANNER')
const DEBUG_SEASON_PLANNER = typeof window !== 'undefined' && localStorage.getItem('DEBUG_SEASON_PLANNER') === 'true';

const GardenPlanner: React.FC = () => {
  const { activePlanId, setActivePlan: setContextActivePlan, clearActivePlan } = useActivePlan();
  const [view, setView] = useState<'list' | 'create' | 'detail' | 'snapshot'>('list');
  const [plans, setPlans] = useState<GardenPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<GardenPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [seedInventory, setSeedInventory] = useState<SeedInventoryItem[]>([]);
  const [selectedSeeds, setSelectedSeeds] = useState<Set<number>>(new Set());

  // Hardcoded defaults (Step 2 "Configure Strategy" removed from UI)
  const DEFAULT_STRATEGY: PlanningStrategy = 'balanced';
  const DEFAULT_SUCCESSION: SuccessionPreference = '4';
  const [perSeedSuccession, setPerSeedSuccession] = useState<Map<number, SuccessionPreference>>(new Map());
  const [calculatedPlan, setCalculatedPlan] = useState<CalculatePlanResponse | null>(null);
  const [planName, setPlanName] = useState('');
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [selectedRotationWarnings, setSelectedRotationWarnings] = useState<RotationWarningType[]>([]);

  // Manual quantity input state
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([]);
  const [manualQuantities, setManualQuantities] = useState<Map<number, number>>(new Map());
  const [spaceEstimates, setSpaceEstimates] = useState<SpaceBreakdown | null>(null);

  // Per-bed allocation state
  const [bedAssignments, setBedAssignments] = useState<Map<number, number[]>>(new Map());
  const [bedSpaceUsage, setBedSpaceUsage] = useState<Map<number, BedSpaceUsage>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rotationWarnings, setRotationWarnings] = useState<Map<string, RotationWarningType[]>>(new Map());
  const [perSeedBedFilter, setPerSeedBedFilter] = useState<Map<number, number | null>>(new Map());
  const [editingBedsForSeedId, setEditingBedsForSeedId] = useState<number | null>(null);

  // Per-bed quantity allocation state (keyed by seedId / seed.id)
  const [bedAllocations, setBedAllocations] = useState<Map<number, BedAssignment[]>>(new Map());
  const [allocationModes, setAllocationModes] = useState<Map<number, AllocationMode>>(new Map());

  // Trellis state
  const [trellisStructures, setTrellisStructures] = useState<TrellisStructure[]>([]);
  const [trellisAssignments, setTrellisAssignments] = useState<Map<number, number[]>>(new Map());
  const [trellisSpaceUsage, setTrellisSpaceUsage] = useState<Map<number, TrellisSpaceUsage>>(new Map());

  // Optimization suggestion state (per-seed-row)
  const [seedRowOptimizations, setSeedRowOptimizations] = useState<Map<number, SeedRowOptimization | null>>(new Map());

  // Nutrition state
  const [nutritionEstimates, setNutritionEstimates] = useState<{
    totalCalories: number;
    totalProtein: number;
    byPlant: { [plantId: string]: { calories: number; protein: number; yieldLbs: number } };
    missingNutritionData: string[];
  } | null>(null);

  // Search, filter, and sort state for Step 1
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState('plantId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Hide incompatible beds toggle - default ON
  const [hideIncompatibleBeds, setHideIncompatibleBeds] = useState(true);

  // Detail view expand/collapse state
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Season progress data for detail view (actual placed vs planned)
  const [detailProgress, setDetailProgress] = useState<SeasonProgressResponse | null>(null);

  // Edit mode state
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editingPlanName, setEditingPlanName] = useState<string>('');
  const [missingSeeds, setMissingSeeds] = useState<string[]>([]);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; planId: number | null }>({
    isOpen: false,
    planId: null,
  });

  // Export conflict warning state
  const [exportConflicts, setExportConflicts] = useState<Conflict[]>([]);
  const [showExportConflictWarning, setShowExportConflictWarning] = useState(false);
  const [pendingExportPlanId, setPendingExportPlanId] = useState<number | null>(null);

  // Toast notifications
  const { showSuccess, showError } = useToast();

  // Helper function to get display-friendly name for planning methods
  const getPlanningMethodDisplay = (method: string | undefined): string => {
    if (!method) return 'SFG';

    const methodMap: { [key: string]: string } = {
      'square-foot': 'SFG',
      'migardener-intensive': 'MIGardener',
      'migardener': 'MIGardener',
      'intensive': 'Intensive',
      'row': 'Row',
    };

    return methodMap[method] || method;
  };

  // Get effective succession for a seed (per-seed override or global default)
  const getEffectiveSuccession = (seedId: number): SuccessionPreference => {
    return perSeedSuccession.get(seedId) || DEFAULT_SUCCESSION;
  };

  /**
   * Get succession suitability info for a seed/plant
   * Returns suitability level, message, and recommended options
   * Checks seed-specific DTM override first, then falls back to plant database
   */
  const getSuccessionSuitability = (seed: SeedInventoryItem): {
    level: 'ideal' | 'good' | 'limited' | 'unsuitable';
    message: string;
    allowedOptions: SuccessionPreference[];
    suggestedDefault: SuccessionPreference;
  } => {
    // Get plant from database (with alias resolution)
    const plant = getPlantById(seed.plantId);

    // Get DTM - prioritize seed-specific override, fall back to plant database
    const dtm = seed.daysToMaturity ?? plant?.daysToMaturity;
    const plantName = seed.variety || plant?.name || 'Unknown plant';

    // If no DTM available, return unsuitable
    if (!dtm) {
      return {
        level: 'unsuitable',
        message: `Days to maturity not available for ${plantName}`,
        allowedOptions: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], // Allow all since we don't know
        suggestedDefault: '0'
      };
    }

    // Calculate interval info (need plant object for this)
    const intervalInfo = plant
      ? calculateSuggestedInterval(plant)
      : { reasoning: 'Based on days to maturity only.' };

    // Quick crops (< 50 days) - ideal for succession
    if (dtm < 50) {
      return {
        level: 'ideal',
        message: `⭐ ${plantName} is ideal for succession planting (${dtm} days to maturity). ${intervalInfo.reasoning}`,
        allowedOptions: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], // All options
        suggestedDefault: '4'
      };
    }

    // Medium crops (50-80 days) - good for succession
    if (dtm >= 50 && dtm < 80) {
      return {
        level: 'good',
        message: `✅ ${plantName} is well-suited for succession planting (${dtm} days). ${intervalInfo.reasoning}`,
        allowedOptions: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], // All options
        suggestedDefault: '2'
      };
    }

    // Long crops (80-120 days) - limited succession (2-3 plantings max)
    if (dtm >= 80 && dtm < 120) {
      return {
        level: 'limited',
        message: `⚠️ ${plantName} has limited succession potential (${dtm} days). Most growing seasons only support 2-3 plantings. ${intervalInfo.reasoning}`,
        allowedOptions: ['0', '1', '2', '3'],  // Limit to 0-3
        suggestedDefault: '0'
      };
    }

    // Very long crops (>= 120 days) - not suitable for succession
    return {
      level: 'unsuitable',
      message: `❌ ${plantName} is not suitable for succession planting (${dtm} days). ${intervalInfo.reasoning}`,
      allowedOptions: ['0'],
      suggestedDefault: '0'
    };
  };

  // Handle per-seed succession change
  const handleSeedSuccessionChange = (seedId: number, preference: SuccessionPreference) => {
    setCalculatedPlan(null); // Invalidate stale Tier 2 data
    setPerSeedSuccession(prev => {
      const updated = new Map(prev);
      updated.set(seedId, preference);

      // Recalculate space breakdown with the NEW updated map (avoid race condition)
      calculateSpaceBreakdown(manualQuantities, updated);

      return updated;
    });
  };

  useEffect(() => {
    loadPlans();
    loadSeedInventory();
    loadGardenBeds();
    loadTrellisStructures();
  }, []);

  // Fetch season progress when detail view opens
  useEffect(() => {
    if (view === 'detail' && selectedPlan) {
      const fetchProgress = async () => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/garden-planner/season-progress?year=${selectedPlan.year}`,
            { credentials: 'include' }
          );
          if (response.ok) {
            setDetailProgress(await response.json());
          }
        } catch (err) {
          console.error('[GardenPlanner] Error fetching season progress:', err);
        }
      };
      fetchProgress();
    } else {
      setDetailProgress(null);
    }
  }, [view, selectedPlan]);

  const loadPlans = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-plans`, { credentials: 'include' });
      if (response.ok) setPlans(await response.json());
    } catch (err) {
      console.error('Error loading plans:', err);
    }
  };

  const loadSeedInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/my-seeds`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        console.log(`[GardenPlanner] Loaded ${data.length} seeds from /api/my-seeds`);
        setSeedInventory(data);
      } else {
        console.error(`[GardenPlanner] Failed to load seeds: ${response.status} ${response.statusText}`);
        const errorData = await response.json().catch(() => ({}));
        console.error('[GardenPlanner] Error details:', errorData);
        setError(`Failed to load seed inventory: ${errorData.error || response.statusText}`);
      }
    } catch (err) {
      console.error('[GardenPlanner] Error loading seed inventory:', err);
      setError('Network error while loading seed inventory');
    }
  };

  const loadGardenBeds = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-beds`, { credentials: 'include' });
      if (response.ok) {
        setGardenBeds(await response.json());
      }
    } catch (err) {
      console.error('[GardenPlanner] Error loading garden beds:', err);
    }
  };

  const loadTrellisStructures = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trellis-structures`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        console.log(`[GardenPlanner] Loaded ${data.length} trellis structures`);
        setTrellisStructures(data);
      }
    } catch (err) {
      console.error('[GardenPlanner] Error loading trellis structures:', err);
    }
  };

  /**
   * Reconstruct wizard state from a saved garden plan
   * Used when editing or duplicating an existing plan
   */
  const reconstructWizardState = (
    plan: GardenPlan,
    seedInventory: SeedInventoryItem[]
  ): {
    selectedSeeds: Set<number>;
    manualQuantities: Map<number, number>;
    perSeedSuccession: Map<number, SuccessionPreference>;
    bedAssignments: Map<number, number[]>;
    trellisAssignments: Map<number, number[]>;
    missingSeeds: string[];
  } => {
    const selectedSeeds = new Set<number>();
    const manualQuantities = new Map<number, number>();
    const perSeedSuccession = new Map<number, SuccessionPreference>();
    const bedAssignments = new Map<number, number[]>();
    const trellisAssignments = new Map<number, number[]>();
    const missingSeeds: string[] = [];

    // Build a lookup map of seed inventory by ID
    const seedLookup = new Map(seedInventory.map(s => [s.id, s]));

    // Map succession counts to preference levels
    const successionCountToPreference = (count: number): SuccessionPreference => {
      // Clamp to valid range 0-8
      const clampedCount = Math.max(0, Math.min(8, count));
      return String(clampedCount) as SuccessionPreference;
    };

    // Process each plan item
    for (const item of plan.items || []) {
      const seedId = item.seedInventoryId;

      if (!seedId) continue; // Skip items without seed reference

      // Check if seed still exists in inventory
      if (!seedLookup.has(seedId)) {
        const itemName = item.variety || item.plantId;
        missingSeeds.push(itemName);
        continue; // Don't add to wizard state
      }

      // Add to selected seeds
      selectedSeeds.add(seedId);

      // Reconstruct manual quantity (use targetValue)
      manualQuantities.set(seedId, item.targetValue);

      // Reconstruct per-seed succession preference
      // Infer from succession count vs. plan default
      const itemSuccessionPref = successionCountToPreference(item.successionCount || 1);
      const planDefaultPref = plan.successionPreference || DEFAULT_SUCCESSION;

      // Only store if different from plan default (treat as override)
      if (itemSuccessionPref !== planDefaultPref) {
        perSeedSuccession.set(seedId, itemSuccessionPref);
      }

      // Reconstruct bed assignments
      if (item.bedsAllocated && item.bedsAllocated.length > 0) {
        bedAssignments.set(seedId, item.bedsAllocated);
      }

      // Reconstruct trellis assignments
      if (item.trellisAssignments && item.trellisAssignments.length > 0) {
        trellisAssignments.set(seedId, item.trellisAssignments);
      }
    }

    return {
      selectedSeeds,
      manualQuantities,
      perSeedSuccession,
      bedAssignments,
      trellisAssignments,
      missingSeeds
    };
  };

  /**
   * Check if the user has any beds compatible with a plant's sun requirements
   * Returns null if compatible beds exist, or a warning message if not
   */
  const checkSunExposureCompatibility = (
    plantId: string,
    beds: GardenBed[]
  ): string | null => {
    const plant = getPlantById(plantId); // Uses alias resolution
    if (!plant || !plant.sunRequirement) {
      return null; // Can't validate without plant data
    }

    // Filter beds that have sun exposure set
    const bedsWithSunData = beds.filter(b => b.sunExposure);
    if (bedsWithSunData.length === 0) {
      return null; // No beds have sun exposure data, can't validate
    }

    // Compatibility matrix: plant requirement -> acceptable bed exposures
    const compatibilityMap: { [key: string]: string[] } = {
      'full': ['full'],
      'partial': ['full', 'partial'],
      'shade': ['full', 'partial', 'shade']
    };

    const acceptable = compatibilityMap[plant.sunRequirement] || ['full'];

    // Check if ANY bed matches the requirement
    const hasCompatibleBed = bedsWithSunData.some(bed =>
      acceptable.includes(bed.sunExposure!)
    );

    if (hasCompatibleBed) {
      return null; // At least one compatible bed exists
    }

    // No compatible beds - generate warning message
    const bedExposureSummary = bedsWithSunData
      .reduce((acc, bed) => {
        acc[bed.sunExposure!] = (acc[bed.sunExposure!] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

    const exposureList = Object.entries(bedExposureSummary)
      .map(([exposure, count]) => `${count} ${exposure}`)
      .join(', ');

    return `${plant.name} requires ${plant.sunRequirement} sun but no compatible beds available (${exposureList} sun beds).`;
  };

  /**
   * Check if a specific bed is compatible with a plant's sun requirements
   *
   * Returns:
   * - 'compatible': Bed's sun exposure matches plant's requirement
   * - 'incompatible': Bed's sun exposure is explicitly incompatible
   * - 'unknown': Can't determine (plant data missing OR bed has no sunExposure set)
   *
   * IMPORTANT: 'unknown' beds are NOT filtered out by getCompatibleBeds().
   * This means beds without sunExposure set are treated as compatible (flexible).
   *
   * Compatibility matrix (plant requirement → acceptable bed exposures):
   * - 'full': ['full'] only
   * - 'partial': ['full', 'partial']
   * - 'shade': ['full', 'partial', 'shade'] (shade-tolerant plants accept any)
   */
  const checkBedSunCompatibility = (
    plantId: string,
    bed: GardenBed
  ): 'compatible' | 'incompatible' | 'unknown' => {
    const plant = getPlantById(plantId); // Uses alias resolution
    if (!plant || !plant.sunRequirement) {
      return 'unknown'; // Can't validate without plant data
    }

    if (!bed.sunExposure) {
      return 'unknown'; // Bed doesn't have sun exposure set → treated as flexible
    }

    // Compatibility matrix: plant requirement -> acceptable bed exposures
    const compatibilityMap: { [key: string]: string[] } = {
      'full': ['full'],
      'partial': ['full', 'partial'],
      'shade': ['full', 'partial', 'shade']
    };

    const acceptable = compatibilityMap[plant.sunRequirement] || ['full'];

    return acceptable.includes(bed.sunExposure) ? 'compatible' : 'incompatible';
  };

  /**
   * Get beds compatible with a seed's planning methods and sun exposure
   *
   * FILTERING LOGIC:
   * - INCLUDES: 'compatible' beds (explicit match)
   * - INCLUDES: 'unknown' beds (no sunExposure set → treated as flexible/compatible)
   * - EXCLUDES: 'incompatible' beds (explicit mismatch)
   *
   * This means beds WITHOUT sunExposure set are NOT filtered out.
   */
  const getCompatibleBeds = (seed: SeedInventoryItem): GardenBed[] | null => {
    const plant = getPlantById(seed.plantId); // Uses alias resolution
    if (!plant) {
      if (DEBUG_SEASON_PLANNER) {
        console.warn('[SeasonPlanner] getCompatibleBeds: Plant not found', { seedId: seed.id, plantId: seed.plantId, resolvedId: resolveAlias(seed.plantId) });
      }
      return null; // Return null to indicate "unknown plant" vs empty array "no compatible beds"
    }

    // Filter out beds with explicit incompatible sun exposure
    const compatibleBeds = gardenBeds.filter(bed => {
      const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);
      // Include compatible and unknown (undefined sun exposure) beds
      // Exclude only explicitly incompatible beds
      return sunCompatibility !== 'incompatible';
    });

    // Debug logging when enabled
    if (DEBUG_SEASON_PLANNER && compatibleBeds.length === 0) {
      console.group(`[SeasonPlanner] No Compatible Beds Found`);
      console.log('Seed:', { id: seed.id, plantId: seed.plantId, variety: seed.variety });
      console.log('Plant:', { name: plant.name, sunRequirement: plant.sunRequirement });
      console.log('Total beds:', gardenBeds.length);
      console.log('Bed compatibility analysis:');
      gardenBeds.forEach(bed => {
        const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);
        console.log(`  - Bed "${bed.name}" (ID: ${bed.id}):`, {
          sunExposure: bed.sunExposure || 'NOT SET',
          compatibility: sunCompatibility,
          reason: !bed.sunExposure
            ? 'No sunExposure set (treated as unknown/compatible)'
            : sunCompatibility === 'incompatible'
            ? `Incompatible: plant needs ${plant.sunRequirement}, bed has ${bed.sunExposure}`
            : 'Compatible'
        });
      });
      console.groupEnd();
    }

    return compatibleBeds;
  };

  /**
   * Get all beds for display (includes incompatible beds, but marked)
   * This is used for the bed selector to show ALL beds with visual indicators
   */
  const getAllBedsForDisplay = (seed: SeedInventoryItem): Array<GardenBed & { isCompatible: boolean }> => {
    return gardenBeds.map(bed => {
      const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);
      return {
        ...bed,
        isCompatible: sunCompatibility !== 'incompatible'
      };
    });
  };

  /**
   * Get beds for the "Assign to Bed(s)" list with hide incompatible beds logic
   *
   * When hideIncompatibleBeds is ON:
   * - Only show compatible beds (compatible or unknown sun compatibility)
   * - ALWAYS show already-assigned beds even if incompatible
   * - Sort assigned-but-incompatible beds to the top with warning
   *
   * Returns: { visibleBeds, hiddenCount, assignedIncompatibleBeds }
   */
  const getBedsForAssignment = (seed: SeedInventoryItem): {
    visibleBeds: Array<GardenBed & { isCompatible: boolean; isAssignedIncompatible: boolean }>;
    hiddenCount: number;
    assignedIncompatibleBeds: Array<GardenBed & { isCompatible: boolean; isAssignedIncompatible: boolean }>;
  } => {
    const allBeds = getAllBedsForDisplay(seed);
    const filterBedId = perSeedBedFilter.get(seed.id);
    const assignedBedIds = bedAssignments.get(seed.id) || [];

    // Mark which beds are assigned but incompatible
    const bedsWithAssignmentStatus = allBeds.map(bed => ({
      ...bed,
      isAssignedIncompatible: !bed.isCompatible && assignedBedIds.includes(bed.id)
    }));

    // Apply per-seed bed filter (if any) while ALWAYS preserving assigned beds
    // This ensures changing the filter never removes assigned beds from visibility
    let filteredBeds = filterBedId
      ? bedsWithAssignmentStatus.filter(bed => bed.id === filterBedId || assignedBedIds.includes(bed.id))
      : bedsWithAssignmentStatus;

    if (!hideIncompatibleBeds) {
      // When toggle is OFF, show all beds (current behavior)
      return {
        visibleBeds: filteredBeds,
        hiddenCount: 0,
        assignedIncompatibleBeds: filteredBeds.filter(b => b.isAssignedIncompatible)
      };
    }

    // When toggle is ON, filter out incompatible beds BUT keep assigned ones
    const compatibleBeds = filteredBeds.filter(bed => bed.isCompatible);
    const assignedIncompatibleBeds = filteredBeds.filter(bed => bed.isAssignedIncompatible);

    // Count how many incompatible beds are being hidden (not assigned)
    const hiddenCount = filteredBeds.filter(bed => !bed.isCompatible && !assignedBedIds.includes(bed.id)).length;

    // Combine: assigned incompatible beds first (with warning), then compatible beds
    const visibleBeds = [...assignedIncompatibleBeds, ...compatibleBeds];

    return {
      visibleBeds,
      hiddenCount,
      assignedIncompatibleBeds
    };
  };

  /**
   * Get beds for the Bed Filter dropdown with hide incompatible beds logic
   * When hideIncompatibleBeds is ON, only show compatible beds plus any that are assigned
   */
  const getBedsForFilterDropdown = (seed: SeedInventoryItem): GardenBed[] => {
    const assignedBedIds = bedAssignments.get(seed.id) || [];

    if (!hideIncompatibleBeds) {
      return gardenBeds;
    }

    // Return compatible beds + any assigned beds (even if incompatible)
    return gardenBeds.filter(bed => {
      const compatibility = checkBedSunCompatibility(seed.plantId, bed);
      const isCompatible = compatibility !== 'incompatible';
      const isAssigned = assignedBedIds.includes(bed.id);
      return isCompatible || isAssigned;
    });
  };

  /**
   * Get sun exposure warning text for a bed-seed combination
   * Returns warning message or null if compatible
   */
  const getSunExposureWarning = (seedId: number, bedId: number): string | null => {
    const seed = seedInventory.find(s => s.id === seedId);
    const bed = gardenBeds.find(b => b.id === bedId);
    if (!seed || !bed) return null;

    const plant = getPlantById(seed.plantId); // Uses alias resolution
    if (!plant || !plant.sunRequirement) return null;

    if (!bed.sunExposure) {
      return `Sun exposure not set for ${bed.name}`;
    }

    const compatibility = checkBedSunCompatibility(seed.plantId, bed);

    if (compatibility === 'incompatible') {
      return `${plant.name} needs ${plant.sunRequirement} sun but ${bed.name} has ${bed.sunExposure} sun`;
    }

    return null;
  };


  /**
   * Fetch rotation warnings for a seed and its assigned beds
   */
  const fetchRotationWarnings = async (seedId: number, bedIds: number[]) => {
    const seed = seedInventory.find(s => s.id === seedId);
    if (!seed) return;

    const currentYear = new Date().getFullYear();

    for (const bedId of bedIds) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rotation/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: seed.plantId,
            bedId,
            year: currentYear
          })
        });

        if (response.ok) {
          const data = await response.json();

          if (data.has_conflict) {
            const key = `${seedId}-${bedId}`;
            setRotationWarnings(prev => {
              const newMap = new Map(prev);
              newMap.set(key, [{
                bed_id: bedId,
                bed_name: data.bed_name || '',
                message: data.recommendation || '',
                family: data.family || '',
                conflict_years: data.last_planted_year ? [data.last_planted_year] : [],
                safe_year: data.safe_year || (currentYear + 3)
              }]);
              return newMap;
            });
          }
        }
      } catch (error) {
        console.error(`Failed to check rotation for seed ${seedId} in bed ${bedId}:`, error);
      }
    }
  };

  /**
   * Distribute quantity evenly across beds with integer remainder handling
   * First N beds get +1 to handle remainder (deterministic distribution)
   */
  const distributeEvenly = (total: number, bedIds: number[]): BedAssignment[] => {
    if (bedIds.length === 0) return [];
    const base = Math.floor(total / bedIds.length);
    const remainder = total % bedIds.length;
    return bedIds.map((bedId, idx) => ({
      bedId,
      quantity: base + (idx < remainder ? 1 : 0)
    }));
  };

  /**
   * Get allocated sum for a seed
   */
  const getAllocatedSum = (seedId: number): number => {
    const allocations = bedAllocations.get(seedId) || [];
    return allocations.reduce((acc, a) => acc + a.quantity, 0);
  };

  /**
   * Check if allocation is valid (sum equals total quantity)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isAllocationValid = (seedId: number): boolean => {
    const mode = allocationModes.get(seedId) || 'even';
    if (mode === 'even') return true; // Even mode auto-calculates
    const total = manualQuantities.get(seedId) || 0;
    return getAllocatedSum(seedId) === total;
  };

  /**
   * Handle bed selection change for a seed
   */
  const handleBedSelection = (seedId: number, bedIds: number[]) => {
    setBedAssignments(prev => {
      const newMap = new Map(prev);
      if (bedIds.length === 0) {
        newMap.delete(seedId);
      } else {
        newMap.set(seedId, bedIds);
      }
      return newMap;
    });

    const mode = allocationModes.get(seedId) || 'even';
    const quantity = manualQuantities.get(seedId) || 0;

    if (bedIds.length === 0) {
      // Clear allocations when no beds selected
      setBedAllocations(prev => {
        const newMap = new Map(prev);
        newMap.delete(seedId);
        return newMap;
      });
    } else if (mode === 'even' && quantity > 0) {
      // Redistribute evenly
      const allocations = distributeEvenly(quantity, bedIds);
      setBedAllocations(prev => new Map(prev).set(seedId, allocations));
    } else if (mode === 'custom') {
      // Prune stale bedIds from custom allocations (prevent saving stale data)
      setBedAllocations(prev => {
        const next = new Map(prev);
        const existing = next.get(seedId) || [];
        const filtered = existing.filter(a => bedIds.includes(a.bedId));
        next.set(seedId, filtered);
        return next;
      });
    }

    // Recalculate space for all beds
    updateBedSpaceUsage();

    // Fetch rotation warnings for each bed-crop pair
    if (bedIds.length > 0) {
      fetchRotationWarnings(seedId, bedIds);
    }
  };

  /**
   * Handle trellis selection change for a trellis crop
   */
  const handleTrellisSelection = (seedId: number, trellisIds: number[]) => {
    setTrellisAssignments(prev => {
      const newMap = new Map(prev);
      if (trellisIds.length === 0) {
        newMap.delete(seedId);
      } else {
        newMap.set(seedId, trellisIds);
      }
      return newMap;
    });

    // Recalculate space breakdown to update trellis usage
    calculateSpaceBreakdown(manualQuantities);
  };

  /**
   * Get trellis capacity status for display in selector
   */
  const getTrellisCapacityStatus = (trellisId: number, seed: SeedInventoryItem): string => {
    const trellis = trellisStructures.find(t => t.id === trellisId);
    if (!trellis) return 'N/A';

    const usage = trellisSpaceUsage.get(trellisId);
    if (!usage) {
      return `${trellis.totalLengthFeet} ft available`;
    }

    const available = usage.totalLength - usage.usedSpace;
    const utilization = (usage.usedSpace / usage.totalLength) * 100;

    if (utilization < 80) {
      return `${available.toFixed(0)} ft available ✓`;
    } else if (utilization <= 100) {
      return `${available.toFixed(0)} ft available ⚠️`;
    } else {
      return `Overbooked by ${(usage.usedSpace - usage.totalLength).toFixed(0)} ft ❌`;
    }
  };

  /**
   * Apply optimization suggestion - reduces bed assignment to minimum needed
   */
  const handleApplyOptimization = (seedId: number, requiredBedIds: number[]) => {
    // Use existing handleBedSelection to update assignments
    // This ensures all side effects (allocations, space usage, rotation warnings) are handled
    handleBedSelection(seedId, requiredBedIds);
  };

  /**
   * Update bed space usage based on current assignments
   * Bug fixes applied:
   * - Now passes bedAllocations for custom per-bed quantities (Bug #2)
   * - Now passes allocationModes to distinguish even vs custom (Bug #2)
   * - Now passes DEFAULT_SUCCESSION for seeds not in perSeedSuccession Map (Bug #1)
   */
  const updateBedSpaceUsage = () => {
    const usage = calculateSpacePerBed(
      seedInventory,
      manualQuantities,
      bedAssignments,
      gardenBeds,
      perSeedSuccession,
      bedAllocations,
      allocationModes,
      DEFAULT_SUCCESSION
    );

    // Tier 2: Refine with date-aware peak calculation when plan has been calculated
    if (calculatedPlan?.items && calculatedPlan.items.length > 0) {
      refineBedSpaceWithDates(
        usage,
        calculatedPlan,
        seedInventory,
        bedAssignments,
        gardenBeds,
        bedAllocations,
        allocationModes
      );
    }

    setBedSpaceUsage(usage);
  };

  // Update bed space usage when relevant state changes
  // Bug #3 fix: Added bedAllocations and allocationModes to dependencies
  useEffect(() => {
    if (gardenBeds.length > 0 && manualQuantities.size > 0) {
      updateBedSpaceUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualQuantities, bedAssignments, gardenBeds, seedInventory, perSeedSuccession, bedAllocations, allocationModes, calculatedPlan]);

  // Update space breakdown summary when succession preferences change
  useEffect(() => {
    if (manualQuantities.size > 0 && (gardenBeds.length > 0 || trellisStructures.length > 0)) {
      calculateSpaceBreakdown(manualQuantities, perSeedSuccession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perSeedSuccession, manualQuantities, gardenBeds, trellisStructures, seedInventory]);

  // Calculate per-seed-row optimization suggestions
  useEffect(() => {
    const calculateOptimizations = async () => {
      const newOptimizations = new Map<number, SeedRowOptimization | null>();

      for (const seedId of Array.from(selectedSeeds)) {
        const seed = seedInventory.find(s => s.id === seedId);
        if (!seed) continue;

        const quantity = manualQuantities.get(seedId) || 0;
        const succession = perSeedSuccession.get(seedId) || DEFAULT_SUCCESSION;
        const assignedBeds = bedAssignments.get(seedId) || [];

        const opt = await calculateSeedRowOptimization(
          seed,
          quantity,
          succession,
          assignedBeds,
          gardenBeds,
          seedInventory
        );
        newOptimizations.set(seedId, opt);
      }

      setSeedRowOptimizations(newOptimizations);
    };

    if (selectedSeeds.size > 0 && gardenBeds.length > 0) {
      calculateOptimizations();
    } else {
      setSeedRowOptimizations(new Map());
    }
  }, [selectedSeeds, manualQuantities, perSeedSuccession, bedAssignments, gardenBeds, seedInventory]);

  // Calculate nutrition estimates when quantities change (via backend API)
  useEffect(() => {
    if (manualQuantities.size === 0) {
      setNutritionEstimates(null);
      return;
    }

    // Build items array for API request
    const items: Array<{ plantId: string; quantity: number; successionCount: number; variety?: string }> = [];
    manualQuantities.forEach((quantity, seedId) => {
      const seed = seedInventory.find(s => s.id === seedId);
      if (!seed || !quantity) return;

      const successionPref = perSeedSuccession.get(seedId) || DEFAULT_SUCCESSION;
      const successionCount = Math.max(1, parseInt(successionPref, 10));

      items.push({
        plantId: seed.plantId,
        quantity,
        successionCount,
        variety: seed.variety || undefined
      });
    });

    if (items.length === 0) {
      setNutritionEstimates(null);
      return;
    }

    // AbortController to cancel pending requests when dependencies change
    const abortController = new AbortController();

    // Debounce API calls
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/nutrition/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ items, year: new Date().getFullYear() }),
          signal: abortController.signal
        });

        if (!response.ok) {
          console.error('Failed to fetch nutrition estimates');
          setNutritionEstimates(null); // Clear stale data on failure
          return;
        }

        const data = await response.json();

        // Map backend response (camelCase) to local state format
        const estimates = {
          totalCalories: data.totals?.calories || 0,
          totalProtein: data.totals?.proteinG || 0,
          byPlant: {} as { [plantId: string]: { calories: number; protein: number; yieldLbs: number } },
          missingNutritionData: data.missingNutritionData || []
        };

        // Convert byPlant from backend format
        if (data.byPlant) {
          Object.entries(data.byPlant).forEach(([plantId, plantData]: [string, any]) => {
            estimates.byPlant[plantId] = {
              calories: plantData.calories || 0,
              protein: plantData.proteinG || 0,
              yieldLbs: plantData.totalYieldLbs || 0
            };
          });
        }

        setNutritionEstimates(estimates);
      } catch (err) {
        // Don't clear estimates or log error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching nutrition estimates:', err);
        setNutritionEstimates(null); // Clear stale data on error
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [manualQuantities, seedInventory, perSeedSuccession]);

  const toggleSeedSelection = (seedId: number) => {
    const newSelection = new Set(selectedSeeds);
    if (newSelection.has(seedId)) {
      newSelection.delete(seedId);
      // Also remove manual quantity if unchecked
      const newQuantities = new Map(manualQuantities);
      newQuantities.delete(seedId);
      setManualQuantities(newQuantities);
      // Also remove bed assignments
      const newAssignments = new Map(bedAssignments);
      newAssignments.delete(seedId);
      setBedAssignments(newAssignments);
      // Also remove trellis assignments
      const newTrellisAssignments = new Map(trellisAssignments);
      newTrellisAssignments.delete(seedId);
      setTrellisAssignments(newTrellisAssignments);
    } else {
      newSelection.add(seedId);
    }
    setSelectedSeeds(newSelection);
    // Recalculate space when selection changes
    if (newSelection.size > 0) {
      calculateSpaceBreakdown(manualQuantities);
    } else {
      setSpaceEstimates(null);
    }
  };

  const handleQuantityChange = (seedId: number, quantity: number) => {
    const updated = new Map(manualQuantities);
    if (quantity > 0) {
      updated.set(seedId, quantity);
    } else {
      updated.delete(seedId);
    }
    setManualQuantities(updated);
    setCalculatedPlan(null); // Invalidate stale Tier 2 data

    // Redistribute bed allocations when quantity changes
    const mode = allocationModes.get(seedId) || 'even';
    const bedIds = bedAssignments.get(seedId) || [];

    if (quantity === 0) {
      // Clear allocations when quantity is 0
      setBedAllocations(prev => {
        const newMap = new Map(prev);
        newMap.delete(seedId);
        return newMap;
      });
    } else if (bedIds.length > 0) {
      if (mode === 'even') {
        // Redistribute evenly
        const allocations = distributeEvenly(quantity, bedIds);
        setBedAllocations(prev => new Map(prev).set(seedId, allocations));
      } else if (mode === 'custom') {
        // Auto-rebalance custom allocations: adjust last bed by delta
        setBedAllocations(prev => {
          const existing = prev.get(seedId) || [];
          if (existing.length === 0) {
            // No existing allocations - distribute evenly
            return new Map(prev).set(seedId, distributeEvenly(quantity, bedIds));
          }

          const currentSum = existing.reduce((acc, a) => acc + a.quantity, 0);
          const delta = quantity - currentSum;

          if (delta === 0) return prev; // No change needed

          // Adjust last bed's quantity by delta
          const rebalanced = existing.map((a, idx) => {
            if (idx === existing.length - 1) {
              return { ...a, quantity: Math.max(0, a.quantity + delta) };
            }
            return a;
          });

          // Verify sum - if last bed went to 0 and we still need more adjustment, redistribute evenly
          const newSum = rebalanced.reduce((acc, a) => acc + a.quantity, 0);
          if (newSum !== quantity) {
            // Fallback to even distribution
            return new Map(prev).set(seedId, distributeEvenly(quantity, bedIds));
          }

          return new Map(prev).set(seedId, rebalanced);
        });
      }
    }

    // Recalculate space breakdown with current succession preferences
    calculateSpaceBreakdown(updated, perSeedSuccession);
  };

  const calculateSpaceBreakdown = async (
    quantities: Map<number, number>,
    successionPrefs?: Map<number, SuccessionPreference>
  ) => {
    // Use parameter if provided, otherwise fall back to state
    const effectiveSuccession = successionPrefs !== undefined ? successionPrefs : perSeedSuccession;

    if (quantities.size === 0 || (gardenBeds.length === 0 && trellisStructures.length === 0)) {
      setSpaceEstimates(null);
      setTrellisSpaceUsage(new Map());
      return;
    }

    try {
      const breakdown = await calculateSpaceForQuantities(
        seedInventory,
        quantities,
        gardenBeds,
        effectiveSuccession,
        trellisStructures
      );
      setSpaceEstimates(breakdown);

      // Calculate trellis space usage
      const trellisUsage = calculateTrellisSpaceRequirement(
        seedInventory,
        quantities,
        trellisAssignments,
        trellisStructures,
        effectiveSuccession
      );
      setTrellisSpaceUsage(trellisUsage);
    } catch (err) {
      console.error('[GardenPlanner] Error calculating space breakdown:', err);
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Convert Maps to plain objects for JSON serialization
      const manualQuantitiesObj: { [key: number]: number } = {};
      manualQuantities.forEach((quantity, seedId) => {
        manualQuantitiesObj[seedId] = quantity;
      });

      const perSeedSuccessionObj: { [key: number]: SuccessionPreference } = {};
      perSeedSuccession.forEach((pref, seedId) => {
        perSeedSuccessionObj[seedId] = pref;
      });

      // DEBUG: Log what we're sending
      console.log('=== SENDING TO BACKEND ===');
      console.log('Manual Quantities:', manualQuantitiesObj);
      console.log('Per-Seed Succession:', perSeedSuccessionObj);
      console.log('Selected Seeds:', seedInventory.filter(s => selectedSeeds.has(s.id)).map(s => ({ id: s.id, plantId: s.plantId, variety: s.variety })));
      console.log('==========================');

      const response = await fetch(`${API_BASE_URL}/api/garden-plans/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          seedSelections: seedInventory.filter(s => selectedSeeds.has(s.id)),
          strategy: DEFAULT_STRATEGY,
          successionPreference: DEFAULT_SUCCESSION,
          manualQuantities: Object.keys(manualQuantitiesObj).length > 0 ? manualQuantitiesObj : undefined,
          perSeedSuccession: Object.keys(perSeedSuccessionObj).length > 0 ? perSeedSuccessionObj : undefined
        })
      });
      if (response.ok) {
        setCalculatedPlan(await response.json());
        setStep(2);
      } else setError('Failed to calculate plan');
    } catch (err) {
      setError('Error calculating plan');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!calculatedPlan || !planName.trim()) {
      setError('Please enter a plan name');
      return;
    }

    // Detect edit mode
    const isEditMode = editingPlanId !== null;

    setLoading(true);
    try {
      // Merge bed assignments and allocations into plan items
      const itemsWithBeds = calculatedPlan.items.map(item => {
        // Find the original seed to get bed assignments and allocations
        const seed = seedInventory.find(s =>
          s.plantId === item.plantId && s.variety === item.variety
        );

        if (seed) {
          const beds = bedAssignments.get(seed.id) || [];
          const mode = allocationModes.get(seed.id) || 'even';
          let allocations = bedAllocations.get(seed.id) || [];
          const total = manualQuantities.get(seed.id) || item.targetValue || 0;

          // Ensure allocations sum correctly for both even and custom modes
          if (beds.length > 0 && total > 0) {
            const sum = allocations.reduce((acc, a) => acc + a.quantity, 0);

            if (mode === 'even') {
              // Even mode: always redistribute if needed
              if (allocations.length === 0 || sum !== total) {
                allocations = distributeEvenly(total, beds);
              }
            } else if (mode === 'custom') {
              // Custom mode: auto-rebalance if sum doesn't match
              if (sum !== total) {
                console.warn(`[GardenPlanner] Auto-rebalancing custom allocation: sum=${sum}, target=${total}`);
                if (allocations.length === 0) {
                  // No allocations - distribute evenly
                  allocations = distributeEvenly(total, beds);
                } else {
                  // Adjust last bed by delta
                  const delta = total - sum;
                  allocations = allocations.map((a, idx) => {
                    if (idx === allocations.length - 1) {
                      return { ...a, quantity: Math.max(0, a.quantity + delta) };
                    }
                    return a;
                  });
                  // Final check - if still wrong, fall back to even
                  const newSum = allocations.reduce((acc, a) => acc + a.quantity, 0);
                  if (newSum !== total) {
                    allocations = distributeEvenly(total, beds);
                  }
                }
              }
            }
          }

          return {
            ...item,
            bedsAllocated: beds.length > 0 ? beds : undefined,
            bedAssignments: allocations.length > 0 ? allocations : undefined,
            allocationMode: beds.length > 0 ? mode : undefined,
            trellisAssignments: trellisAssignments.get(seed.id) || undefined
          };
        }

        return item;
      });

      // Build URL and method based on mode
      const url = isEditMode
        ? `${API_BASE_URL}/api/garden-plans/${editingPlanId}`
        : `${API_BASE_URL}/api/garden-plans`;
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: planName,
          year: new Date().getFullYear(),
          strategy: DEFAULT_STRATEGY,
          successionPreference: DEFAULT_SUCCESSION,
          targetTotalPlants: calculatedPlan.summary.totalPlants,
          targetDiversity: calculatedPlan.summary.cropDiversity,
          items: itemsWithBeds
        })
      });

      if (response.ok) {
        const savedPlan = await response.json();

        // Update plans array based on mode
        if (isEditMode) {
          // Update existing plan in array
          setPlans(prev => prev.map(p => p.id === editingPlanId ? savedPlan : p));
        } else {
          // Reload all plans to get new plan
          await loadPlans();
        }

        setSelectedPlan(savedPlan);
        setView('detail');
        resetWizard();

        // Show success message
        setError(null);
        console.log(`[GardenPlanner] Successfully ${isEditMode ? 'updated' : 'created'} plan: ${savedPlan.name}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Failed to ${isEditMode ? 'update' : 'save'} plan: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`[GardenPlanner] Error ${isEditMode ? 'updating' : 'saving'} plan:`, err);
      setError(`Error ${isEditMode ? 'updating' : 'saving'} plan`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToCalendar = async (planId: number, conflictOverride = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${planId}/export-to-calendar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictOverride }),
      });

      if (response.status === 409) {
        // Conflicts detected — show warning modal
        const conflictResult = await response.json();
        setExportConflicts(conflictResult.conflicts || []);
        setPendingExportPlanId(planId);
        setShowExportConflictWarning(true);
      } else if (response.ok) {
        const result = await response.json();
        showSuccess(`Successfully exported ${result.totalEvents} events to calendar!`);
        // Clear any previous conflict state
        setExportConflicts([]);
        setShowExportConflictWarning(false);
        setPendingExportPlanId(null);

        // Refresh plans list from server
        await loadPlans();

        // Update selectedPlan items to reflect exported status
        setSelectedPlan(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items?.map(item => ({ ...item, status: 'exported' as const })) ?? []
          };
        });
      } else {
        setError('Failed to export');
      }
    } catch (err) {
      setError('Error exporting');
    } finally {
      setLoading(false);
    }
  };

  const handleExportConflictOverride = () => {
    if (pendingExportPlanId !== null) {
      setShowExportConflictWarning(false);
      handleExportToCalendar(pendingExportPlanId, true);
    }
  };

  const handleExportConflictCancel = () => {
    setShowExportConflictWarning(false);
    setExportConflicts([]);
    setPendingExportPlanId(null);
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedSeeds(new Set());
    setCalculatedPlan(null);
    setPlanName('');
    setSearchQuery('');
    setActiveFilters({});
    setSortBy('plantId');
    setSortDirection('asc');
    setManualQuantities(new Map());
    setSpaceEstimates(null);
    setBedAssignments(new Map());
    setBedSpaceUsage(new Map());
    setRotationWarnings(new Map());
    setTrellisAssignments(new Map());
    setTrellisSpaceUsage(new Map());
    setBedAllocations(new Map());
    setAllocationModes(new Map());
    setEditingPlanId(null);
    setEditingPlanName('');
    setMissingSeeds([]);
    setPerSeedSuccession(new Map());
  };

  /**
   * Load an existing plan into the wizard for editing
   */
  const handleEditPlan = async (plan: GardenPlan) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch full plan details (includes items)
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${plan.id}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load plan details');
      }

      const fullPlan: GardenPlan = await response.json();

      // Check if plan has any exported items
      const hasExportedItems = fullPlan.items?.some(item => item.status === 'exported');
      if (hasExportedItems) {
        setError('⚠️ This plan was exported to calendar. Editing may create duplicate events.');
      }

      // Reconstruct wizard state from plan data
      const reconstructed = reconstructWizardState(fullPlan, seedInventory);

      // Show warning if seeds are missing
      if (reconstructed.missingSeeds.length > 0) {
        setMissingSeeds(reconstructed.missingSeeds);
        setError(`Warning: ${reconstructed.missingSeeds.length} seed(s) from this plan are no longer in your inventory.`);
      }

      // Populate wizard state
      setSelectedSeeds(reconstructed.selectedSeeds);
      setManualQuantities(reconstructed.manualQuantities);
      setPerSeedSuccession(reconstructed.perSeedSuccession);
      setBedAssignments(reconstructed.bedAssignments);
      setTrellisAssignments(reconstructed.trellisAssignments);
      setPlanName(fullPlan.name);

      // Set edit mode
      setEditingPlanId(fullPlan.id);
      setEditingPlanName(fullPlan.name);

      // Switch to wizard
      setView('create');
      setStep(1);

      // Trigger space calculation
      await calculateSpaceBreakdown(reconstructed.manualQuantities, reconstructed.perSeedSuccession);

    } catch (err) {
      console.error('[GardenPlanner] Error loading plan for editing:', err);
      setError('Failed to load plan for editing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Duplicate an existing plan as a new plan
   */
  const handleDuplicatePlan = async (plan: GardenPlan) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch full plan details
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${plan.id}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load plan details');
      }

      const fullPlan: GardenPlan = await response.json();

      // Reconstruct wizard state (same as edit)
      const reconstructed = reconstructWizardState(fullPlan, seedInventory);

      // Show warning if seeds are missing
      if (reconstructed.missingSeeds.length > 0) {
        setMissingSeeds(reconstructed.missingSeeds);
        setError(`Warning: ${reconstructed.missingSeeds.length} seed(s) from this plan are no longer in your inventory.`);
      }

      // Populate wizard state
      setSelectedSeeds(reconstructed.selectedSeeds);
      setManualQuantities(reconstructed.manualQuantities);
      setPerSeedSuccession(reconstructed.perSeedSuccession);
      setBedAssignments(reconstructed.bedAssignments);
      setTrellisAssignments(reconstructed.trellisAssignments);

      // Pre-fill name with "(Copy)" suffix - DON'T set editingPlanId (creates new plan)
      setPlanName(`${fullPlan.name} (Copy)`);

      // Switch to wizard
      setView('create');
      setStep(1);

      // Trigger space calculation
      await calculateSpaceBreakdown(reconstructed.manualQuantities, reconstructed.perSeedSuccession);

    } catch (err) {
      console.error('[GardenPlanner] Error duplicating plan:', err);
      setError('Failed to duplicate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculatePlan = async (plan: GardenPlan) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${plan.id}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to recalculate');
      }

      const updatedPlan: GardenPlan = await response.json();
      setSelectedPlan(updatedPlan);
      await loadPlans();
    } catch (err: unknown) {
      console.error('[GardenPlanner] Error recalculating plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to recalculate plan.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open delete confirmation dialog for a plan
   */
  const handleDeleteClick = (planId: number) => {
    setDeleteConfirm({ isOpen: true, planId });
  };

  /**
   * Execute plan deletion after confirmation
   */
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.planId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${deleteConfirm.planId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        showSuccess('Garden plan deleted successfully!');
        await loadPlans(); // Refresh the list
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete plan' }));
        showError(errorData.error || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('[GardenPlanner] Error deleting plan:', error);
      showError('Network error occurred while deleting plan');
    } finally {
      setDeleteConfirm({ isOpen: false, planId: null });
    }
  };

  /**
   * Cancel editing and return to list view
   */
  const handleCancelEdit = () => {
    if (window.confirm('Discard all changes to this plan?')) {
      resetWizard();
      setView('list');
    }
  };

  // Helper functions for search and filter (uses alias resolution)
  const getPlantInfo = useCallback((plantId: string) => {
    return getPlantById(plantId);
  }, []);

  const getPlantName = useCallback((plantId: string) => {
    return getPlantInfo(plantId)?.name || plantId;
  }, [getPlantInfo]);

  const isExpired = (expirationDate: string | null | undefined): boolean => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  const isExpiringSoon = (expirationDate: string | null | undefined): boolean => {
    if (!expirationDate) return false;
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    const expDate = new Date(expirationDate);
    return expDate < threeMonthsFromNow && expDate >= new Date();
  };

  // Phase 1: Base filtered (search only)
  const baseFilteredSeeds = useMemo(() => {
    if (!searchQuery.trim()) return seedInventory;

    const query = searchQuery.toLowerCase();
    return seedInventory.filter(seed => {
      const plant = getPlantInfo(seed.plantId);

      // Build searchable string from all relevant fields
      const searchableFields = [
        seed.variety || '',
        plant?.name || '',
        seed.plantId || '', // Include plantId as fallback
        seed.brand || '',
        seed.notes || '',
        plant?.category || '',
      ];

      const searchableText = searchableFields.join(' ').toLowerCase();
      return searchableText.includes(query);
    });
  }, [seedInventory, searchQuery, getPlantInfo]);

  // Phase 2: Build filter groups dynamically
  const filterGroups: FilterGroup[] = useMemo(() => {
    // Extract unique categories
    const categoryList = baseFilteredSeeds
      .map(s => getPlantInfo(s.plantId)?.category)
      .filter(cat => cat !== undefined) as string[];
    const categories = Array.from(new Set(categoryList)).sort();

    // Extract unique plant types (crop types) efficiently
    const plantTypeCounts: Record<string, number> = {};
    baseFilteredSeeds.forEach(s => {
      const plant = getPlantInfo(s.plantId);
      if (plant?.name) {
        plantTypeCounts[plant.name] = (plantTypeCounts[plant.name] || 0) + 1;
      }
    });
    const plantTypes = Object.keys(plantTypeCounts).sort();

    // Extract unique locations
    const locationList = baseFilteredSeeds
      .map(s => s.location)
      .filter(loc => loc != null && loc.trim() !== '') as string[];
    const locations = Array.from(new Set(locationList)).sort();

    return [
      {
        id: 'category',
        label: 'Category',
        options: categories.map(cat => ({
          value: cat as string,
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          count: baseFilteredSeeds.filter(s => getPlantInfo(s.plantId)?.category === cat).length,
        })),
      },
      {
        id: 'plantType',
        label: 'Crop Type',
        options: plantTypes.map(plantType => ({
          value: plantType,
          label: plantType,
          count: plantTypeCounts[plantType],
        })),
      },
      {
        id: 'expiration',
        label: 'Expiration',
        options: [
          { value: 'fresh', label: 'Fresh', count: baseFilteredSeeds.filter(s => s.expirationDate && !isExpiringSoon(s.expirationDate)).length },
          { value: 'expiring', label: 'Expiring Soon', count: baseFilteredSeeds.filter(s => isExpiringSoon(s.expirationDate) && !isExpired(s.expirationDate)).length },
          { value: 'expired', label: 'Expired', count: baseFilteredSeeds.filter(s => isExpired(s.expirationDate)).length },
          { value: 'unknown', label: 'Unknown', count: baseFilteredSeeds.filter(s => !s.expirationDate).length },
        ].filter(opt => opt.count > 0), // Only show options with seeds
      },
      {
        id: 'location',
        label: 'Location',
        options: locations.map(loc => ({
          value: loc,
          label: loc,
          count: baseFilteredSeeds.filter(s => s.location === loc).length,
        })),
      },
    ].filter(group => group.options.length > 0); // Only show groups with options
  }, [baseFilteredSeeds, getPlantInfo]);

  // Phase 3: Final filtered and sorted
  const filteredAndSortedSeeds = useMemo(() => {
    let result = [...baseFilteredSeeds];

    // Apply category filters
    const categoryFilters = activeFilters['category'] || [];
    if (categoryFilters.length > 0) {
      result = result.filter(s => {
        const plant = getPlantInfo(s.plantId);
        return plant && categoryFilters.includes(plant.category);
      });
    }

    // Apply plant type (crop type) filters
    const plantTypeFilters = activeFilters['plantType'] || [];
    if (plantTypeFilters.length > 0) {
      result = result.filter(s => {
        const plant = getPlantInfo(s.plantId);
        return plant && plantTypeFilters.includes(plant.name);
      });
    }

    // Apply expiration filters
    const expirationFilters = activeFilters['expiration'] || [];
    if (expirationFilters.length > 0) {
      result = result.filter(s => {
        if (expirationFilters.includes('fresh') && s.expirationDate && !isExpiringSoon(s.expirationDate)) return true;
        if (expirationFilters.includes('expiring') && isExpiringSoon(s.expirationDate) && !isExpired(s.expirationDate)) return true;
        if (expirationFilters.includes('expired') && isExpired(s.expirationDate)) return true;
        if (expirationFilters.includes('unknown') && !s.expirationDate) return true;
        return false;
      });
    }

    // Apply location filters
    const locationFilters = activeFilters['location'] || [];
    if (locationFilters.length > 0) {
      result = result.filter(s => s.location && locationFilters.includes(s.location));
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'plantId':
          aValue = getPlantName(a.plantId).toLowerCase();
          bValue = getPlantName(b.plantId).toLowerCase();
          break;
        case 'variety':
          aValue = a.variety.toLowerCase();
          bValue = b.variety.toLowerCase();
          break;
        case 'quantity':
          aValue = a.quantity || 0;
          bValue = b.quantity || 0;
          break;
        case 'expiration':
          aValue = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
          bValue = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [baseFilteredSeeds, activeFilters, sortBy, sortDirection, getPlantInfo, getPlantName]);

  // Handler functions
  const handleFilterChange = (groupId: string, values: string[]) => {
    setActiveFilters(prev => ({
      ...prev,
      [groupId]: values,
    }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
  };

  const handleSortChange = (newSortBy: string, newDirection: SortDirection) => {
    setSortBy(newSortBy);
    setSortDirection(newDirection);
  };

  // Sort options for dropdown
  const sortOptions: SortOption[] = [
    { value: 'plantId', label: 'Plant Name' },
    { value: 'variety', label: 'Variety' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'expiration', label: 'Expiration Date' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Garden Season Planner</h1>

        {view === 'list' && (
          <div>
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-bold">Plans</h2>
              <div className="flex gap-2">
                <button onClick={() => setView('snapshot')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Garden Snapshot</button>
                <button data-testid="create-plan-btn" onClick={() => { setView('create'); resetWizard(); }} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create Plan</button>
              </div>
            </div>
            {plans.length === 0 ? (
              <div className="bg-gray-50 rounded p-8 text-center">
                <p className="text-gray-600 mb-4">No plans yet.</p>
                <button onClick={() => { setView('create'); resetWizard(); }} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">Create First Plan</button>
              </div>
            ) : (
              <div className="grid gap-4">
                {plans.map(plan => (
                  <div key={plan.id} data-testid={`plan-card-${plan.id}`} className="bg-white border rounded-lg p-6 hover:shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                        <div className="text-sm text-gray-600">Year: {plan.year} | Crops: {plan.items?.length || 0}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (activePlanId === plan.id) {
                              clearActivePlan();
                            } else {
                              setContextActivePlan(plan);
                            }
                          }}
                          className={`px-4 py-2 rounded ${
                            activePlanId === plan.id
                              ? 'bg-green-700 text-white ring-2 ring-green-400'
                              : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                          }`}
                          title={activePlanId === plan.id ? 'This plan is active in the Designer' : 'Set as active plan for the Designer'}
                        >
                          {activePlanId === plan.id ? 'Active' : 'Set Active'}
                        </button>
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                          Edit
                        </button>
                        <button
                          data-testid={`plan-view-${plan.id}`}
                          onClick={() => { setSelectedPlan(plan); setView('detail'); }}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          View
                        </button>
                        <button
                          data-testid={`plan-delete-${plan.id}`}
                          onClick={() => handleDeleteClick(plan.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              {[1, 2].map(num => (
                <React.Fragment key={num}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${step >= num ? 'bg-green-600 text-white' : 'border-gray-300 text-gray-400'}`}>{num}</div>
                  {num < 2 && <div className={`w-20 h-1 ${step > num ? 'bg-green-600' : 'bg-gray-300'}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* Edit Mode Banner */}
            {editingPlanId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-yellow-900">📝 Editing Plan:</span>
                    <span className="ml-2 text-yellow-800">{editingPlanName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <a
                      href={`?tab=designer&planId=${editingPlanId}`}
                      className="text-sm text-green-700 hover:text-green-900 underline"
                      title="Open Garden Designer with this plan's bed assignments"
                    >
                      View in Designer
                    </a>
                    <button
                      onClick={handleCancelEdit}
                      className="text-sm text-yellow-700 hover:text-yellow-900 underline"
                    >
                      Cancel Edit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Missing Seeds Warning */}
            {missingSeeds.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-red-900 mb-2">⚠️ Missing Seeds</h4>
                <p className="text-sm text-red-700 mb-2">
                  The following seeds from this plan are no longer in your inventory:
                </p>
                <ul className="list-disc list-inside text-sm text-red-700 mb-2">
                  {missingSeeds.map(seed => <li key={seed}>{seed}</li>)}
                </ul>
                <p className="text-sm text-red-700">
                  You can continue editing but must remove these items or re-add the seeds before saving.
                </p>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-8">
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Select Seeds & Configure Quantities</h2>
                  <p className="text-gray-600 mb-4">Choose seeds from your inventory and set planting quantities</p>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      <svg className="inline-block w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      How It Works
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-1 ml-6">
                      <li>✓ Check the seeds you want to plant this season</li>
                      <li>✓ Enter the total number of plants you want (across all succession plantings)</li>
                      <li>✓ Choose succession frequency - this determines how many staggered plantings you'll do</li>
                      <li>✓ <strong>Space shown is per planting</strong> - succession reuses the same space at different times</li>
                      <li>✓ Example: 40 lettuce with "Moderate (4x)" = 10 plants per planting = ~3 sq ft per planting</li>
                    </ul>
                  </div>

                  {/* Bed Sun Exposure Status Panel */}
                  {(() => {
                    const totalBeds = gardenBeds.length;
                    const bedsWithoutSun = gardenBeds.filter(b => !b.sunExposure);
                    const hasMissingExposure = bedsWithoutSun.length > 0;

                    if (totalBeds === 0) {
                      return (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ No Garden Beds Found</h3>
                          <p className="text-sm text-yellow-800">
                            You need to create garden beds first. Go to <strong>Garden Designer</strong> to add beds.
                          </p>
                        </div>
                      );
                    }

                    if (hasMissingExposure) {
                      return (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                          <h3 className="font-semibold text-orange-900 mb-2">
                            ⚠️ Bed Sun Exposure: {bedsWithoutSun.length} of {totalBeds} bed(s) missing configuration
                          </h3>
                          <div className="text-sm text-orange-800 space-y-2">
                            <div className="bg-orange-100 border border-orange-300 rounded p-2">
                              <p className="font-medium text-orange-900">These beds are treated as UNKNOWN for sun compatibility.</p>
                              <p className="text-orange-700 text-xs mt-1">
                                They are NOT filtered out and may be assigned plants with incompatible sun requirements.
                              </p>
                            </div>
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium text-orange-900 hover:text-orange-700">
                                View beds needing configuration ({bedsWithoutSun.length})
                              </summary>
                              <ul className="mt-2 ml-4 space-y-1 text-orange-700">
                                {bedsWithoutSun.map(bed => (
                                  <li key={bed.id}>• {bed.name} (ID: {bed.id})</li>
                                ))}
                              </ul>
                            </details>
                            <p className="mt-2 text-orange-900 font-medium">
                              → Go to <strong>Garden Designer</strong> → Edit bed → Set sun exposure (full-sun, part-sun, or shade)
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // All beds have sun exposure - show success
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <h3 className="font-semibold text-green-900 mb-2">
                          ✅ Bed Sun Exposure: Fully Configured
                        </h3>
                        <p className="text-sm text-green-800">
                          All {totalBeds} bed(s) have sun exposure set. Plants will only show if compatible with your bed configurations.
                        </p>
                        {DEBUG_SEASON_PLANNER && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-green-700 text-xs hover:text-green-900">
                              Debug: View bed sun exposure details
                            </summary>
                            <ul className="mt-2 ml-4 space-y-1 text-xs text-green-700">
                              {gardenBeds.map(bed => (
                                <li key={bed.id}>• {bed.name}: {bed.sunExposure}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    );
                  })()}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                      <p className="text-red-700 font-medium">Error Loading Seeds</p>
                      <p className="text-red-600 text-sm mt-1">{error}</p>
                      <button
                        onClick={loadSeedInventory}
                        className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {seedInventory.length === 0 && !error ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                      <p className="text-yellow-800 font-medium">No seeds found in your inventory.</p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Please add seeds to your inventory first in the "Seeds" tab.
                      </p>
                    </div>
                  ) : !error && (
                    <>
                      {/* Search Bar */}
                      <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search by variety, plant, brand, or notes..."
                        className="mb-4"
                      />

                      {/* Filters and Sort */}
                      <div className="flex flex-wrap gap-4 items-start mb-4">
                        <FilterBar
                          filterGroups={filterGroups}
                          activeFilters={activeFilters}
                          onFilterChange={handleFilterChange}
                          onClearAll={handleClearAllFilters}
                        />

                        <SortDropdown
                          options={sortOptions}
                          sortBy={sortBy}
                          sortDirection={sortDirection}
                          onSortChange={handleSortChange}
                        />

                        {/* Hide Incompatible Beds Toggle */}
                        <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={hideIncompatibleBeds}
                            onChange={(e) => setHideIncompatibleBeds(e.target.checked)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            Hide incompatible beds
                          </span>
                        </label>
                      </div>

                      {/* Results Count */}
                      <div className="text-sm text-gray-600 mb-2">
                        Showing {filteredAndSortedSeeds.length} of {seedInventory.length} seeds
                      </div>

                      {/* Seed List */}
                      {filteredAndSortedSeeds.length === 0 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                          <p className="text-yellow-800">No seeds match your search or filters.</p>
                          <button onClick={handleClearAllFilters} className="mt-2 text-yellow-600 underline hover:text-yellow-700">
                            Clear all filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredAndSortedSeeds.map(seed => {
                            const isSelected = selectedSeeds.has(seed.id);
                            const quantity = manualQuantities.get(seed.id) || 0;
                            const plant = getPlantById(seed.plantId); // Uses alias resolution
                            const assignedBeds = bedAssignments.get(seed.id) || [];
                            const compatibleBeds = getCompatibleBeds(seed);

                            return (
                              <div key={seed.id} className="border rounded hover:bg-gray-50">
                                <div className="flex items-center p-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSeedSelection(seed.id)}
                                    className="mr-3"
                                  />
                                  <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-3">
                                      <div className="font-medium">{seed.variety}</div>
                                      <div className="text-sm text-gray-600">
                                        {getPlantName(seed.plantId)}
                                        {seed.expirationDate && isExpired(seed.expirationDate) && (
                                          <span className="ml-2 text-red-600 font-medium">⚠️ Expired</span>
                                        )}
                                        {seed.expirationDate && isExpiringSoon(seed.expirationDate) && !isExpired(seed.expirationDate) && (
                                          <span className="ml-2 text-yellow-600 font-medium">⚠️ Expiring Soon</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="col-span-2">
                                      <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={quantity || ''}
                                        onChange={(e) => handleQuantityChange(seed.id, parseInt(e.target.value) || 0)}
                                        disabled={!isSelected}
                                        placeholder="Enter #"
                                        className="w-full px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400"
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <label className="text-xs text-gray-500 block mb-1">Succession</label>
                                      {isSelected ? (
                                        <>
                                          <select
                                            value={getEffectiveSuccession(seed.id)}
                                            onChange={(e) => handleSeedSuccessionChange(seed.id, e.target.value as SuccessionPreference)}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                          >
                                            {(() => {
                                              const suitability = getSuccessionSuitability(seed);
                                              const allowedOptions = suitability.allowedOptions;

                                              return (
                                                <>
                                                  <option value="0">None (0x)</option>
                                                  {[1, 2, 3, 4, 5, 6, 7, 8].map(count => (
                                                    <option
                                                      key={count}
                                                      value={String(count)}
                                                      disabled={!allowedOptions.includes(String(count) as SuccessionPreference)}
                                                    >
                                                      {count} succession{count !== 1 ? 's' : ''} ({count}x)
                                                      {!allowedOptions.includes(String(count) as SuccessionPreference) ? ' (Not recommended)' : ''}
                                                    </option>
                                                  ))}
                                                </>
                                              );
                                            })()}
                                          </select>
                                        </>
                                      ) : (
                                        <span className="text-gray-400 text-sm italic">—</span>
                                      )}
                                    </div>
                                    <div className="col-span-2">
                                      <label className="text-xs text-gray-500 block mb-1">Bed Filter</label>
                                      {isSelected && quantity > 0 ? (
                                        <select
                                          value={perSeedBedFilter.get(seed.id) || ''}
                                          onChange={(e) => {
                                            const newFilter = new Map(perSeedBedFilter);
                                            if (e.target.value === '') {
                                              newFilter.delete(seed.id);
                                            } else {
                                              const filteredBedId = parseInt(e.target.value);
                                              newFilter.set(seed.id, filteredBedId);

                                              // Auto-add filtered bed to assignments if not already selected
                                              // This removes double-work (filter + assign separately)
                                              const currentAssigned = bedAssignments.get(seed.id) || [];
                                              if (!currentAssigned.includes(filteredBedId)) {
                                                handleBedSelection(seed.id, [...currentAssigned, filteredBedId]);
                                              }
                                            }
                                            setPerSeedBedFilter(newFilter);
                                          }}
                                          className="w-full border rounded px-2 py-1 text-sm"
                                        >
                                          <option value="">All Beds</option>
                                          {getBedsForFilterDropdown(seed).map(bed => {
                                            const compatibility = checkBedSunCompatibility(seed.plantId, bed);
                                            const isIncompatible = compatibility === 'incompatible';
                                            const isAssigned = (bedAssignments.get(seed.id) || []).includes(bed.id);
                                            return (
                                              <option
                                                key={bed.id}
                                                value={bed.id}
                                                className={isIncompatible && isAssigned ? 'text-yellow-600' : ''}
                                              >
                                                {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)})
                                                {isIncompatible && isAssigned ? ' ⚠️' : ''}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      ) : (
                                        <span className="text-gray-400 text-sm italic">—</span>
                                      )}
                                    </div>
                                    <div className="col-span-3 text-sm">
                                      {isSelected && quantity > 0 ? (
                                        <div>
                                          <div className="flex items-center gap-1 mb-1">
                                            <span className="text-xs text-gray-500">Beds:</span>
                                            {assignedBeds.length === 0 && editingBedsForSeedId !== seed.id && (
                                              <button
                                                type="button"
                                                onClick={() => setEditingBedsForSeedId(seed.id)}
                                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                                              >
                                                + Add
                                              </button>
                                            )}
                                            {assignedBeds.length > 0 && editingBedsForSeedId !== seed.id && (
                                              <button
                                                type="button"
                                                onClick={() => setEditingBedsForSeedId(seed.id)}
                                                className="text-xs text-gray-500 hover:text-gray-700 ml-1"
                                                title="Edit bed assignments"
                                              >
                                                ✏️
                                              </button>
                                            )}
                                            {editingBedsForSeedId === seed.id && (
                                              <button
                                                type="button"
                                                onClick={() => setEditingBedsForSeedId(null)}
                                                className="text-xs text-green-600 hover:text-green-800 font-medium"
                                              >
                                                Done
                                              </button>
                                            )}
                                          </div>
                                          {/* Bed chips */}
                                          {assignedBeds.length > 0 && editingBedsForSeedId !== seed.id && (
                                            <div className="flex flex-wrap gap-1">
                                              {assignedBeds.map(bedId => {
                                                const bed = gardenBeds.find(b => b.id === bedId);
                                                if (!bed) return null;
                                                const opt = seedRowOptimizations.get(seed.id);
                                                const isExtraBed = opt?.extraBedIds?.includes(bedId) || false;
                                                return (
                                                  <span
                                                    key={bedId}
                                                    className={`inline-block px-1.5 py-0.5 text-xs rounded border ${
                                                      isExtraBed
                                                        ? 'bg-amber-50 text-amber-700 border-amber-300 border-dashed opacity-70'
                                                        : 'bg-green-100 text-green-800 border-green-300'
                                                    }`}
                                                    title={isExtraBed ? 'Optional - could be removed' : undefined}
                                                  >
                                                    {bed.name}
                                                    {isExtraBed && ' (optional)'}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {/* Optimization suggestion callout */}
                                          {(() => {
                                            const opt = seedRowOptimizations.get(seed.id);
                                            if (!opt || opt.extraBedIds.length === 0) return null;
                                            return (
                                              <div className="mt-1 flex items-center gap-2 text-xs text-amber-600">
                                                <span>
                                                  Could fit in {opt.minBedsNeeded} bed{opt.minBedsNeeded > 1 ? 's' : ''}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => handleApplyOptimization(seed.id, opt.requiredBedIds)}
                                                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                                                >
                                                  Apply
                                                </button>
                                              </div>
                                            );
                                          })()}
                                          {/* Inline checkbox list when editing */}
                                          {editingBedsForSeedId === seed.id && (
                                            <div className="border border-gray-300 rounded p-1 max-h-32 overflow-y-auto bg-white">
                                              {getBedsForAssignment(seed).visibleBeds.map(bed => {
                                                const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);
                                                const isAssignedIncompatible = bed.isAssignedIncompatible;
                                                const isChecked = assignedBeds.includes(bed.id);
                                                const isDisabled = !bed.isCompatible && !isAssignedIncompatible;
                                                return (
                                                  <label
                                                    key={bed.id}
                                                    className={`flex items-center gap-1.5 px-1 py-0.5 text-xs cursor-pointer hover:bg-gray-50 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${isAssignedIncompatible ? 'text-yellow-700' : ''}`}
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={isChecked}
                                                      disabled={isDisabled}
                                                      onChange={() => {
                                                        const next = isChecked
                                                          ? assignedBeds.filter(id => id !== bed.id)
                                                          : [...assignedBeds, bed.id];
                                                        handleBedSelection(seed.id, next);
                                                      }}
                                                      className="w-3 h-3"
                                                    />
                                                    <span>
                                                      {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)})
                                                      {sunCompatibility === 'incompatible' ? ' ⚠️' : ''}
                                                    </span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      ) : isSelected ? (
                                        <div className="text-gray-400 italic text-xs">Enter qty first</div>
                                      ) : (
                                        <div className="text-gray-400">—</div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Succession Suitability Indicator */}
                                {isSelected && (() => {
                                  const suitability = getSuccessionSuitability(seed);
                                  const selectedSuccession = getEffectiveSuccession(seed.id);

                                  // Color coding by suitability level
                                  const colorClass = {
                                    'ideal': 'bg-green-50 border-green-300 text-green-800',
                                    'good': 'bg-green-50 border-green-300 text-green-800',
                                    'limited': 'bg-yellow-50 border-yellow-300 text-yellow-800',
                                    'unsuitable': 'bg-red-50 border-red-300 text-red-800'
                                  }[suitability.level];

                                  return (
                                    <div className="px-3 pb-2 border-t">
                                      <div className={`mt-2 p-2 rounded border text-xs ${colorClass}`}>
                                        <div className="font-medium mb-1">
                                          {suitability.level === 'ideal' && '⭐ Ideal for Succession'}
                                          {suitability.level === 'good' && '✅ Good for Succession'}
                                          {suitability.level === 'limited' && '⚠️ Limited Succession'}
                                          {suitability.level === 'unsuitable' && '❌ Not Suitable for Succession'}
                                        </div>
                                        <div>{suitability.message}</div>
                                      </div>

                                      {/* Succession selection warning */}
                                      {selectedSuccession !== '0' && !suitability.allowedOptions.includes(selectedSuccession) && (
                                        <div className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                                          ⚠️ {selectedSuccession} succession{selectedSuccession !== '1' ? 's' : ''} not recommended for this plant.
                                          Backend may adjust to fewer plantings based on growing season length.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Bed Selector - Show when seed is selected and has quantity */}
                                {isSelected && quantity > 0 && (
                                  <div className="px-3 pb-3 pt-0 border-t bg-gray-50">
                                    {compatibleBeds === null ? (
                                      // Missing plant definition - distinct from "no compatible beds"
                                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded">
                                        <p className="text-sm text-amber-800 font-medium mb-1">
                                          Missing Plant Definition
                                        </p>
                                        <p className="text-xs text-amber-700">
                                          Plant ID "{seed.plantId}" not found in database. Cannot evaluate bed compatibility.
                                          This seed may reference a plant not yet synced to the frontend.
                                        </p>
                                      </div>
                                    ) : compatibleBeds.length === 0 ? (
                                      // True "no compatible beds" (plant exists but no beds match sun requirements)
                                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                        <p className="text-sm text-red-800 font-medium mb-1">
                                          No Compatible Beds Available
                                        </p>
                                        <p className="text-xs text-red-700">
                                          {(() => {
                                            const plant = getPlantById(seed.plantId); // Uses alias resolution

                                            // Plant should always exist here since compatibleBeds !== null
                                            if (!plant) {
                                              return `Unexpected error: plant lookup failed.`;
                                            }

                                            if (!plant.sunRequirement) {
                                              if (DEBUG_SEASON_PLANNER) {
                                                console.warn('[SeasonPlanner] Plant missing sunRequirement', {
                                                  plantId: plant.id,
                                                  plant
                                                });
                                              }
                                              return `Plant ${plant.name} missing sun requirement data.`;
                                            }

                                            // Use actual compatibility function - don't duplicate logic!
                                            const compatibilityResults = gardenBeds.map(bed => ({
                                              bed,
                                              compatibility: checkBedSunCompatibility(seed.plantId, bed)
                                            }));

                                            const compatibleCount = compatibilityResults.filter(r => r.compatibility === 'compatible').length;
                                            const incompatibleCount = compatibilityResults.filter(r => r.compatibility === 'incompatible').length;
                                            const unknownCount = compatibilityResults.filter(r => r.compatibility === 'unknown').length;

                                            // Build list of actual sun exposures present (from beds WITH sunExposure set)
                                            const bedsWithExposure = compatibilityResults.filter(r => r.bed.sunExposure);
                                            const exposureList = bedsWithExposure.length > 0
                                              ? bedsWithExposure.map(r => r.bed.sunExposure).join(', ')
                                              : 'none';

                                            // Build error message entirely from compatibility results
                                            let msg = `${plant.name} requires ${plant.sunRequirement} sun. `;

                                            if (bedsWithExposure.length === 0) {
                                              // All beds have no sunExposure set (all "unknown")
                                              msg += `No beds have sun exposure configured. These beds are treated as UNKNOWN for compatibility and may reduce accuracy. `;
                                              msg += `Set sun exposure in Garden Designer.`;
                                            } else {
                                              // Some/all beds have sunExposure set
                                              msg += `Your beds have: ${exposureList}. `;
                                              msg += `(${compatibleCount} compatible, ${incompatibleCount} incompatible, ${unknownCount} unknown)`;
                                            }

                                            return msg;
                                          })()}
                                        </p>
                                      </div>
                                    ) : assignedBeds.length > 0 ? (
                                      <>
                                        {/* Sun exposure warnings for assigned beds */}
                                        {(() => {
                                          const warnings = assignedBeds
                                            .map(bedId => getSunExposureWarning(seed.id, bedId))
                                            .filter(w => w !== null);

                                          if (warnings.length > 0) {
                                            return (
                                              <div className="mt-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                                                ⚠️ {warnings[0]}
                                                {warnings.length > 1 && ` (+${warnings.length - 1} more)`}
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()}

                                        {/* Allocation Mode Toggle - show when 2+ beds assigned and quantity > 0 */}
                                        {assignedBeds.length > 1 && quantity > 0 && (
                                          <div className="mt-2">
                                            <label className="text-xs text-gray-600 block mb-1">Allocation:</label>
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAllocationModes(prev => new Map(prev).set(seed.id, 'even'));
                                                  // Redistribute evenly when switching to even mode
                                                  const allocations = distributeEvenly(quantity, assignedBeds);
                                                  setBedAllocations(prev => new Map(prev).set(seed.id, allocations));
                                                }}
                                                className={`px-2 py-1 text-xs rounded ${
                                                  (allocationModes.get(seed.id) || 'even') === 'even'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                              >
                                                Even Split
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAllocationModes(prev => new Map(prev).set(seed.id, 'custom'));
                                                  // Initialize with even distribution if no allocations exist
                                                  const existing = bedAllocations.get(seed.id) || [];
                                                  if (existing.length === 0) {
                                                    const allocations = distributeEvenly(quantity, assignedBeds);
                                                    setBedAllocations(prev => new Map(prev).set(seed.id, allocations));
                                                  }
                                                }}
                                                className={`px-2 py-1 text-xs rounded ${
                                                  allocationModes.get(seed.id) === 'custom'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                              >
                                                Custom
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Custom Allocation Inputs */}
                                        {assignedBeds.length > 1 && quantity > 0 && allocationModes.get(seed.id) === 'custom' && (
                                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                            <p className="text-xs font-medium text-blue-800 mb-2">
                                              Allocate {quantity} plants:
                                            </p>
                                            {assignedBeds.map(bedId => {
                                              const bed = gardenBeds.find(b => b.id === bedId);
                                              const allocations = bedAllocations.get(seed.id) || [];
                                              const alloc = allocations.find(a => a.bedId === bedId);
                                              const allocQty = alloc?.quantity || 0;

                                              return (
                                                <div key={bedId} className="flex items-center gap-2 mb-1">
                                                  <span className="text-xs w-24 truncate" title={bed?.name}>{bed?.name}</span>
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    value={allocQty}
                                                    onChange={(e) => {
                                                      const newQty = parseInt(e.target.value) || 0;
                                                      setBedAllocations(prev => {
                                                        const existing = prev.get(seed.id) || [];
                                                        const updated = existing.filter(a => a.bedId !== bedId);
                                                        updated.push({ bedId, quantity: newQty });
                                                        return new Map(prev).set(seed.id, updated);
                                                      });
                                                    }}
                                                    className="w-16 px-2 py-1 text-sm border rounded"
                                                  />
                                                  <span className="text-xs text-gray-500">plants</span>
                                                </div>
                                              );
                                            })}
                                            {/* Validation */}
                                            {(() => {
                                              const sum = getAllocatedSum(seed.id);
                                              const diff = quantity - sum;
                                              if (diff !== 0) {
                                                return (
                                                  <p className={`text-xs mt-1 ${diff > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                                    {diff > 0
                                                      ? `⚠️ ${diff} plants unallocated`
                                                      : `❌ ${Math.abs(diff)} plants over-allocated`}
                                                  </p>
                                                );
                                              }
                                              return <p className="text-xs mt-1 text-green-600">✓ All {quantity} plants allocated</p>;
                                            })()}
                                          </div>
                                        )}
                                      </>
                                    ) : null}
                                  </div>
                                )}

                                {/* Trellis Selector - Show when seed is selected and is a trellis crop */}
                                {isSelected && quantity > 0 && plant && isTrellisPlanting(plant) && (
                                  <div className="px-3 pb-3 pt-0 border-t bg-purple-50">
                                    <label className="block text-xs font-medium text-gray-700 mb-1 mt-2">
                                      🌿 Trellis Assignment Required (Vertical Growing Crop)
                                    </label>

                                    {trellisStructures.length === 0 ? (
                                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <p className="text-sm text-yellow-800 font-medium mb-1">
                                          ⚠️ No Trellises Available
                                        </p>
                                        <p className="text-xs text-yellow-700">
                                          {plant.name} requires a trellis structure. Create trellises in Property Designer first.
                                        </p>
                                      </div>
                                    ) : (
                                      <>
                                        <select
                                          multiple
                                          size={Math.min(trellisStructures.length, 4)}
                                          value={(trellisAssignments.get(seed.id) || []).map(String)}
                                          onChange={(e) => {
                                            const selectedIds = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                                            handleTrellisSelection(seed.id, selectedIds);
                                          }}
                                          className="w-full border border-gray-300 rounded p-2 text-sm"
                                        >
                                          {trellisStructures.map(trellis => {
                                            const capacity = getTrellisCapacityStatus(trellis.id, seed);
                                            return (
                                              <option key={trellis.id} value={trellis.id}>
                                                {trellis.name} ({trellis.totalLengthFeet} ft) - {capacity}
                                              </option>
                                            );
                                          })}
                                        </select>

                                        {/* Linear feet requirement display */}
                                        {quantity > 0 && (
                                          <div className="mt-1 text-xs text-purple-700">
                                            Requires: {(quantity * getLinearFeetPerPlant(plant)).toFixed(0)} linear ft
                                            ({quantity} plants × {getLinearFeetPerPlant(plant)} ft/plant)
                                          </div>
                                        )}

                                        {/* Assignment confirmation */}
                                        {(() => {
                                          const assignedTrellises = trellisAssignments.get(seed.id) || [];
                                          return assignedTrellises.length > 0 && (
                                            <div className="mt-1 text-xs text-green-700">
                                              ✓ Assigned to {assignedTrellises.length} trellis{assignedTrellises.length > 1 ? 'es' : ''}
                                            </div>
                                          );
                                        })()}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bed Sun Exposure Summary */}
                      {gardenBeds.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">Garden Beds Summary:</p>
                          <div className="flex flex-wrap gap-2">
                            {gardenBeds.map(bed => (
                              <span key={bed.id} className="text-xs px-2 py-1 rounded border">
                                <span className="font-medium">
                                  {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)}):
                                </span>
                                {bed.sunExposure ? (
                                  <span className={`ml-1 ${
                                    bed.sunExposure === 'full' ? 'text-yellow-600' :
                                    bed.sunExposure === 'partial' ? 'text-orange-600' :
                                    'text-gray-600'
                                  }`}>
                                    {bed.sunExposure === 'full' ? '☀️ Full' :
                                     bed.sunExposure === 'partial' ? '⛅ Partial' :
                                     '🌙 Shade'}
                                  </span>
                                ) : (
                                  <span className="ml-1 text-gray-400">❓ Not set</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Per-Bed Space Summary */}
                      {bedSpaceUsage.size > 0 && Array.from(bedSpaceUsage.values()).some(usage => usage.crops.length > 0) && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded">
                          <h3 className="font-semibold text-purple-900 mb-3">Per-Bed Space Usage</h3>
                          <div className="space-y-3">
                            {Array.from(bedSpaceUsage.values())
                              .filter(usage => usage.crops.length > 0)
                              .map(usage => {
                                const utilization = (usage.usedSpace / usage.totalSpace) * 100;
                                const statusColor = utilization < 80 ? 'green' : utilization <= 100 ? 'yellow' : 'red';

                                return (
                                  <div key={usage.bedId} className="bg-white rounded p-2 border border-purple-100">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-medium text-sm">{usage.bedName}</span>
                                      <span className={`text-sm text-${statusColor}-700 font-medium`}>
                                        Peak: {usage.usedSpace.toFixed(1)} / {usage.totalSpace} sq ft ({Math.round(utilization)}%)
                                      </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                      <div
                                        className={`bg-${statusColor}-500 h-2 rounded-full transition-all`}
                                        style={{ width: `${Math.min(utilization, 100)}%` }}
                                      />
                                    </div>

                                    {/* Season total note (only when succession crops make it differ) */}
                                    {usage.seasonTotalSpace > usage.usedSpace + 0.1 && (
                                      <div className="text-xs text-purple-600 mb-1">
                                        Season total: {usage.seasonTotalSpace.toFixed(1)} sq ft
                                      </div>
                                    )}

                                    {/* Crops in this bed */}
                                    <div className="text-xs text-gray-600">
                                      {usage.crops.map((crop, idx) => (
                                        <span key={idx}>
                                          {crop.plantName} ({crop.spaceUsed.toFixed(1)} sq ft{crop.successionCount > 1 ? `/planting, ${crop.successionCount}x` : ''})
                                          {idx < usage.crops.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Trellis Space Summary */}
                      {trellisSpaceUsage.size > 0 && Array.from(trellisSpaceUsage.values()).some(usage => usage.crops.length > 0) && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded">
                          <h3 className="font-semibold text-purple-900 mb-3">Trellis Space Usage</h3>
                          <div className="space-y-3">
                            {Array.from(trellisSpaceUsage.values())
                              .filter(usage => usage.crops.length > 0)
                              .map(usage => {
                                const utilization = (usage.usedSpace / usage.totalLength) * 100;
                                const statusColor = utilization < 80 ? 'green' : utilization <= 100 ? 'yellow' : 'red';

                                return (
                                  <div key={usage.trellisId} className="bg-white rounded p-2 border border-purple-100">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-medium text-sm">{usage.trellisName}</span>
                                      <span className={`text-sm text-${statusColor}-700 font-medium`}>
                                        {usage.usedSpace.toFixed(1)} / {usage.totalLength} ft ({Math.round(utilization)}%)
                                      </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                      <div
                                        className={`bg-${statusColor}-500 h-2 rounded-full transition-all`}
                                        style={{ width: `${Math.min(utilization, 100)}%` }}
                                      />
                                    </div>

                                    {/* Crops on this trellis */}
                                    <div className="text-xs text-gray-600">
                                      {usage.crops.map((crop, idx) => (
                                        <span key={idx}>
                                          {crop.plantName}{crop.variety ? ` - ${crop.variety}` : ''} ({crop.quantity} × {crop.linearFeetPerPlant} ft = {crop.linearFeetUsed.toFixed(1)} ft)
                                          {idx < usage.crops.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Space Requirements Summary (Method-Level) */}
                      {spaceEstimates && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                          <h3 className="font-semibold text-blue-900 mb-1">
                            Space Requirements by Method
                            <span className="text-xs font-normal text-blue-700 ml-2">(per planting)</span>
                          </h3>
                          <p className="text-xs text-blue-700 mb-3">
                            Space shown is per planting. Succession plantings use the same space at different times.
                          </p>
                          <div className="space-y-2">
                            {Object.entries(spaceEstimates.byMethod).map(([method, stats]) => {
                              const utilization = stats.utilization;
                              const status = utilization > 100 ? '❌' : utilization > 80 ? '⚠️' : '✓';
                              const colorClass = utilization > 100 ? 'text-red-700' : utilization > 80 ? 'text-yellow-700' : 'text-green-700';

                              // Special handling for trellis method (linear feet instead of cells)
                              if (method === 'trellis') {
                                return (
                                  <div key={method} className={`text-sm ${colorClass}`}>
                                    <span className="font-medium">
                                      {status} Trellis:
                                    </span>{' '}
                                    {Math.ceil(stats.linearFeet || 0)} linear ft needed / {stats.linearFeetAvailable || 0} available ({utilization.toFixed(0)}%)
                                  </div>
                                );
                              }

                              // Regular grid-based methods
                              return (
                                <div key={method} className={`text-sm ${colorClass}`}>
                                  <span className="font-medium">
                                    {status} {method.charAt(0).toUpperCase() + method.slice(1).replace('-', ' ')}:
                                  </span>{' '}
                                  {Math.ceil(stats.cellsNeeded)} cells needed / {stats.cellsAvailable} available ({utilization.toFixed(0)}%)
                                </div>
                              );
                            })}
                            <div className="pt-2 border-t border-blue-300 font-semibold text-blue-900">
                              Overall: {Math.ceil(spaceEstimates.overall.cellsNeeded)} cells / {spaceEstimates.overall.cellsAvailable} total ({spaceEstimates.overall.utilization.toFixed(0)}%)
                              {spaceEstimates.overall.linearFeetNeeded && spaceEstimates.overall.linearFeetNeeded > 0 && (
                                <span className="block mt-1">
                                  Trellis: {Math.ceil(spaceEstimates.overall.linearFeetNeeded)} linear ft / {spaceEstimates.overall.linearFeetAvailable || 0} available
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Nutrition Estimates Summary */}
                      {nutritionEstimates && (nutritionEstimates.totalCalories > 0 || nutritionEstimates.totalProtein > 0 || nutritionEstimates.missingNutritionData.length > 0) && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                          <h3 className="font-semibold text-green-900 mb-1">
                            🥬 Nutritional Output Estimate
                            <span className="text-xs font-normal text-green-700 ml-2">(annual)</span>
                          </h3>
                          <p className="text-xs text-green-700 mb-3">
                            Estimated nutrition from this garden plan based on average yields
                          </p>

                          {/* Totals */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-white rounded p-3 border border-green-100">
                              <div className="text-2xl font-bold text-green-900">
                                {Math.round(nutritionEstimates.totalCalories).toLocaleString()}
                              </div>
                              <div className="text-xs text-green-700">Total Calories</div>
                              <div className="text-xs text-green-600 mt-1">
                                ~{Math.round(nutritionEstimates.totalCalories / 2000)} person-days
                              </div>
                            </div>
                            <div className="bg-white rounded p-3 border border-green-100">
                              <div className="text-2xl font-bold text-green-900">
                                {Math.round(nutritionEstimates.totalProtein).toLocaleString()}g
                              </div>
                              <div className="text-xs text-green-700">Total Protein</div>
                              <div className="text-xs text-green-600 mt-1">
                                ~{Math.round(nutritionEstimates.totalProtein / 50)} person-days
                              </div>
                            </div>
                          </div>

                          {/* By Plant Breakdown */}
                          {Object.keys(nutritionEstimates.byPlant).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-green-800 cursor-pointer hover:text-green-900 font-medium">
                                View breakdown by crop ({Object.keys(nutritionEstimates.byPlant).length} crops)
                              </summary>
                              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                {Object.entries(nutritionEstimates.byPlant)
                                  .sort((a, b) => b[1].calories - a[1].calories)
                                  .map(([plantId, data]) => {
                                    const plant = getPlantById(plantId); // Uses alias resolution
                                    return (
                                      <div key={plantId} className="text-xs text-green-800 flex justify-between bg-white bg-opacity-50 rounded px-2 py-1">
                                        <span className="font-medium">
                                          {plant?.icon} {plant?.name || plantId}:
                                        </span>
                                        <span>
                                          {Math.round(data.calories).toLocaleString()} cal, {Math.round(data.protein)}g protein
                                          <span className="text-green-600 ml-1">
                                            (~{data.yieldLbs.toFixed(1)} lbs)
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </details>
                          )}

                          {/* Warning for missing nutrition data */}
                          {nutritionEstimates.missingNutritionData.length > 0 && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-xs text-yellow-800 font-medium">
                                ⚠️ {nutritionEstimates.missingNutritionData.length} crop{nutritionEstimates.missingNutritionData.length > 1 ? 's' : ''} missing nutrition data:
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                {nutritionEstimates.missingNutritionData.map(plantId => {
                                  const plant = getPlantById(plantId);
                                  return plant ? `${plant.name} (${plantId})` : plantId;
                                }).join(', ')}
                              </p>
                              <p className="text-xs text-yellow-600 mt-1 italic">
                                Totals exclude crops missing nutrition data.
                              </p>
                            </div>
                          )}

                          <div className="mt-3 pt-2 border-t border-green-300 text-xs text-green-700">
                            💡 Estimates based on average yields. Actual production varies by conditions, experience, and weather.
                          </div>
                        </div>
                      )}

                      {/* Succession Planning Summary */}
                      {selectedSeeds.size > 0 && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded">
                          <h3 className="font-semibold text-purple-900 mb-3">Succession Planting Summary</h3>
                          <div className="space-y-2">
                            {Array.from(selectedSeeds).map(seedId => {
                              const seed = seedInventory.find(s => s.id === seedId);
                              if (!seed) return null;

                              const suitability = getSuccessionSuitability(seed);
                              const selectedSuccession = getEffectiveSuccession(seedId);
                              const plant = getPlantById(seed.plantId); // Uses alias resolution

                              // Get DTM - prioritize seed override
                              const dtm = seed.daysToMaturity ?? plant?.daysToMaturity;
                              const displayName = seed.variety || plant?.name || 'Unknown';

                              // Icon and color by suitability
                              const icon = {
                                'ideal': '⭐',
                                'good': '✅',
                                'limited': '⚠️',
                                'unsuitable': '❌'
                              }[suitability.level];

                              const colorClass = {
                                'ideal': 'text-green-700',
                                'good': 'text-green-700',
                                'limited': 'text-yellow-700',
                                'unsuitable': 'text-red-700'
                              }[suitability.level];

                              return (
                                <div key={seedId} className={`text-sm ${colorClass} flex justify-between items-center`}>
                                  <span>
                                    {icon} {displayName} {dtm ? `(${dtm} days)` : '(DTM unknown)'}
                                  </span>
                                  <span className="font-medium">
                                    {selectedSuccession === '0' ? 'No succession' : `${selectedSuccession} succession${selectedSuccession !== '1' ? 's' : ''} (${selectedSuccession}x)`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 pt-3 border-t border-purple-300 text-xs text-purple-700">
                            <p><strong>Note:</strong> Actual succession count may be adjusted by the backend based on your growing season length and frost dates.</p>
                          </div>
                        </div>
                      )}

                      {gardenBeds.length === 0 && selectedSeeds.size > 0 && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-yellow-800 text-sm">
                            ℹ️ No garden beds found. Create beds first to see space calculations.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between mt-6">
                    <button onClick={() => { setView('list'); resetWizard(); }} className="px-4 py-2 border rounded hover:bg-gray-100">
                      Cancel
                    </button>
                    <button
                      onClick={handleCalculate}
                      disabled={selectedSeeds.size === 0 || loading}
                      className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300 hover:bg-green-700 disabled:hover:bg-gray-300"
                    >
                      {loading ? 'Calculating...' : `Next - Review Plan (${selectedSeeds.size} selected)`}
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && calculatedPlan && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Review & Save</h2>
                  <div className="bg-blue-50 border rounded p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>Plants: <strong>{calculatedPlan.summary.totalPlants}</strong></div>
                      <div>Crops: <strong>{calculatedPlan.summary.cropDiversity}</strong></div>
                      <div>Space: <strong>{calculatedPlan.summary.totalSpaceUsed} cells</strong></div>
                      <div>Utilization: <strong>{calculatedPlan.summary.spaceUtilization.toFixed(1)}%</strong></div>
                    </div>
                    {calculatedPlan.summary.methodBreakdown && (
                      <div className="pt-3 border-t border-blue-300">
                        <div className="text-xs font-semibold text-blue-900 mb-2">Space by Planning Method:</div>
                        <div className="space-y-1">
                          {Object.entries(calculatedPlan.summary.methodBreakdown).map(([method, stats]) => (
                            <div key={method} className="text-xs text-blue-800">
                              <span className="font-medium capitalize">{method.replace('-', ' ')}:</span>{' '}
                              {stats.used} / {stats.available} cells ({stats.utilization.toFixed(0)}%)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mb-6">
                    <label className="block font-medium mb-2">Plan Name</label>
                    <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="2026 Spring Garden" className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="border rounded overflow-hidden mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Crop</th>
                          <th className="px-4 py-2 text-right">Season Total</th>
                          <th className="px-4 py-2 text-right">Succession</th>
                          <th className="px-4 py-2 text-right">Per Planting</th>
                          <th className="px-4 py-2 text-right">Seeds</th>
                          <th className="px-4 py-2 text-center">Rotation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedPlan.items.map((item, idx) => {
                          const sunWarning = checkSunExposureCompatibility(item.plantId, gardenBeds);

                          return (
                            <React.Fragment key={idx}>
                              <tr className="border-t">
                                <td className="px-4 py-2">{item.variety || item.plantId}</td>
                                <td className="px-4 py-2 text-right">{item.plantEquivalent}</td>
                                <td className="px-4 py-2 text-right">{item.successionEnabled ? `${item.successionCount}x` : 'None'}</td>
                                <td className="px-4 py-2 text-right">
                                  {item.successionEnabled && item.successionCount > 1
                                    ? Math.round(item.plantEquivalent / item.successionCount)
                                    : item.plantEquivalent}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <div>{item.seedsRequired || 0}</div>
                                  {item.rowSeedingInfo && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      {item.rowSeedingInfo.seedsPerRow} seeds/row × {item.rowSeedingInfo.rowsNeeded} rows
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {item.rotation_warnings && item.rotation_warnings.length > 0 ? (
                                    <button
                                      onClick={() => {
                                        setSelectedRotationWarnings(item.rotation_warnings || []);
                                        setShowRotationModal(true);
                                      }}
                                      className="text-yellow-600 hover:text-yellow-700 font-medium flex items-center justify-center gap-1 mx-auto"
                                      title="View rotation warnings"
                                    >
                                      <span>⚠️</span>
                                      <span className="text-sm">Warning</span>
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-sm" title="Bed allocation needed for rotation checking">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {sunWarning && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-2 bg-red-50">
                                    <div className="border-l-4 border-red-400 p-3 rounded">
                                      <div className="flex items-start">
                                        <span className="text-red-400 text-xl mr-2 flex-shrink-0">☀️</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-red-800">Sun Exposure Mismatch</p>
                                          <p className="text-sm text-red-700 mt-1">{sunWarning}</p>
                                          <p className="text-xs text-red-600 mt-1">
                                            Consider: Add a bed with appropriate sun exposure, or choose different plants for your available beds.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {error && <div className="bg-red-50 border rounded p-3 mb-4 text-red-700">{error}</div>}
                  <div className="flex justify-between">
                    <button onClick={() => setStep(1)} className="px-4 py-2 border rounded">Back</button>
                    <button onClick={handleSavePlan} disabled={loading || !planName.trim()} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300">
                      {loading ? 'Saving...' : (editingPlanId ? 'Update Plan' : 'Save Plan')}
                    </button>
                  </div>

                  {/* Rotation Warnings Modal */}
                  {showRotationModal && (
                    <Modal
                      isOpen={showRotationModal}
                      onClose={() => {
                        setShowRotationModal(false);
                        setSelectedRotationWarnings([]);
                      }}
                      title="Crop Rotation Warnings"
                    >
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 mb-4">
                          The following rotation conflicts were detected. You can still proceed with this plan,
                          but following crop rotation guidelines helps prevent soil-borne diseases and pest buildup.
                        </p>
                        <RotationWarning warnings={selectedRotationWarnings} />
                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={() => {
                              setShowRotationModal(false);
                              setSelectedRotationWarnings([]);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </Modal>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'detail' && selectedPlan && (
          <div>
            <button onClick={() => { setView('list'); setSelectedPlan(null); setExpandedItems(new Set()); }} className="mb-4 text-blue-600">← Back</button>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    {selectedPlan.name}
                    {activePlanId === selectedPlan.id && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-normal">Active</span>
                    )}
                  </h2>
                  <div className="text-gray-600 text-sm">Year: {selectedPlan.year} | Strategy: {selectedPlan.strategy}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (activePlanId === selectedPlan.id) {
                        clearActivePlan();
                      } else {
                        setContextActivePlan(selectedPlan);
                      }
                    }}
                    className={`px-4 py-2 rounded ${
                      activePlanId === selectedPlan.id
                        ? 'bg-green-700 text-white ring-2 ring-green-400'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    }`}
                  >
                    {activePlanId === selectedPlan.id ? 'Active' : 'Set Active'}
                  </button>
                  <button
                    onClick={() => handleEditPlan(selectedPlan)}
                    disabled={loading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-300"
                  >
                    Edit Plan
                  </button>
                  <button
                    onClick={() => handleRecalculatePlan(selectedPlan)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                    title="Recalculate quantities using current garden beds and improved space allocation"
                  >
                    {loading ? 'Recalculating...' : 'Recalculate'}
                  </button>
                  <button
                    onClick={() => handleDuplicatePlan(selectedPlan)}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300"
                  >
                    Duplicate
                  </button>
                  {(() => {
                    const allExported = (selectedPlan.items?.length ?? 0) > 0 &&
                      selectedPlan.items!.every(item => item.status === 'exported');
                    return (
                      <button
                        data-testid="export-to-calendar-btn"
                        onClick={() => handleExportToCalendar(selectedPlan.id)}
                        disabled={loading}
                        className={`px-4 py-2 text-white rounded disabled:bg-gray-300 ${
                          allExported ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {loading ? 'Exporting...' : allExported ? 'Re-Export to Calendar' : 'Export to Calendar'}
                      </button>
                    );
                  })()}
                </div>
              </div>
              {error && <div className="bg-red-50 border rounded p-3 mb-4 text-red-700">{error}</div>}

              {/* Summary stats bar */}
              {detailProgress && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{detailProgress.summary.totalAdded}</div>
                    <div className="text-sm text-green-600">In Garden</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {selectedPlan.items?.filter((item) => {
                        const p = item.id !== undefined && detailProgress.byPlanItemId
                          ? detailProgress.byPlanItemId[String(item.id)]
                          : undefined;
                        return (p?.placedSeason ?? 0) > 0;
                      }).length ?? 0}
                    </div>
                    <div className="text-sm text-blue-600">Crops Planted</div>
                  </div>
                </div>
              )}

              <table className="w-full border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Crop</th>
                    <th className="px-4 py-2 text-right">In Garden</th>
                    <th className="px-4 py-2 text-right">Succession</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlan.items?.map((item) => {
                    const isExpanded = item.id !== undefined && expandedItems.has(item.id);
                    const progress = item.id !== undefined && detailProgress?.byPlanItemId
                      ? detailProgress.byPlanItemId[String(item.id)]
                      : undefined;
                    const inGarden = progress?.placedSeason ?? 0;

                    // Derive status from progress
                    let statusLabel: string;
                    let statusClass: string;
                    if (inGarden > 0) {
                      statusLabel = 'planted';
                      statusClass = 'bg-green-100 text-green-800';
                    } else if (item.status === 'exported') {
                      statusLabel = 'exported';
                      statusClass = 'bg-yellow-100 text-yellow-800';
                    } else {
                      statusLabel = 'planned';
                      statusClass = 'bg-gray-100 text-gray-700';
                    }

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className="border-t cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            if (item.id === undefined) return;
                            setExpandedItems(prev => {
                              const next = new Set(prev);
                              if (next.has(item.id!)) {
                                next.delete(item.id!);
                              } else {
                                next.add(item.id!);
                              }
                              return next;
                            });
                          }}
                        >
                          <td className="px-4 py-2">
                            <span className="inline-block w-4 text-gray-400 mr-1">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                            {item.variety || item.plantId}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className="font-semibold">{inGarden}</span>
                          </td>
                          <td className="px-4 py-2 text-right">{item.successionEnabled ? `${item.successionCount}x` : 'None'}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${statusClass}`}>{statusLabel}</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={4} className="px-4 py-3">
                              <div className="ml-5">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per-Bed Counts</span>
                                {item.bedAssignments && item.bedAssignments.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    {item.bedAssignments.map((ba) => {
                                      const bedName = gardenBeds.find(b => b.id === ba.bedId)?.name || `Bed #${ba.bedId}`;
                                      const bedPlaced = progress?.placedByBed?.[String(ba.bedId)] ?? 0;
                                      return (
                                        <div key={ba.bedId} className="flex items-center justify-between text-sm">
                                          <span className="font-medium">{bedName}</span>
                                          <span className="text-gray-600">
                                            {bedPlaced > 0 ? (
                                              <span className="text-green-700 font-semibold">{bedPlaced} planted</span>
                                            ) : (
                                              <span className="text-gray-400">{ba.quantity} assigned</span>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-sm text-gray-400 italic">No beds assigned</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Nutrition estimates */}
              <PlanNutritionCard
                planId={selectedPlan.id}
                planYear={selectedPlan.year}
              />
            </div>
          </div>
        )}

        {view === 'snapshot' && (
          <div>
            <button onClick={() => setView('list')} className="mb-4 text-blue-600">&larr; Back to Plans</button>
            <h2 className="text-2xl font-bold mb-4">Garden Snapshot</h2>
            <p className="text-gray-600 mb-6">See what&apos;s in the ground on any date across all your beds.</p>
            <GardenSnapshot />
          </div>
        )}

        {/* Export Conflict Warning */}
        <ConflictWarning
          conflicts={exportConflicts}
          onOverride={handleExportConflictOverride}
          onCancel={handleExportConflictCancel}
          isOpen={showExportConflictWarning}
          title="Export Conflicts Detected"
          warningMessage={`${exportConflicts.length} temporal conflict${exportConflicts.length !== 1 ? 's' : ''} found. Some plantings in this plan overlap with existing or other planned plantings in the same bed during the same time period.`}
          overrideButtonText="Export Anyway"
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, planId: null })}
          onConfirm={handleDeleteConfirm}
          title="Delete Garden Plan"
          message={`Are you sure you want to delete this plan? This will permanently remove all ${
            deleteConfirm.planId
              ? (plans.find(p => p.id === deleteConfirm.planId)?.items?.length || 0)
              : 0
          } crops from the plan.\n\nThis action cannot be undone.`}
          confirmText="Delete Plan"
          variant="danger"
        />
      </div>
    </div>
  );
};

export default GardenPlanner;
