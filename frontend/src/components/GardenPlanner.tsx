/**
 * Garden Season Planner Component - Streamlined Implementation
 *
 * Helps users plan their entire growing season starting from their seed inventory.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import type { GardenPlan, SeedInventoryItem, PlanningStrategy, SuccessionPreference, CalculatePlanResponse, RotationWarning as RotationWarningType, GardenBed, SpaceBreakdown, BedSpaceUsage, TrellisStructure, TrellisSpaceUsage } from '../types';
import RotationWarning from './common/RotationWarning';
import { Modal } from './common/Modal';
import { SearchBar } from './common/SearchBar';
import { FilterBar, FilterGroup } from './common/FilterBar';
import { SortDropdown, SortOption, SortDirection } from './common/SortDropdown';
import { PLANT_DATABASE } from '../data/plantDatabase';
import { calculateSpaceForQuantities, getSpaceEstimateForSeed, calculateSpacePerBed, calculateTrellisSpaceRequirement, isTrellisPlanting, getLinearFeetPerPlant } from '../utils/gardenPlannerSpaceCalculator';
import { calculateSuggestedInterval } from './PlantingCalendar/utils/successionCalculations';

const GardenPlanner: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [plans, setPlans] = useState<GardenPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<GardenPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [seedInventory, setSeedInventory] = useState<SeedInventoryItem[]>([]);
  const [selectedSeeds, setSelectedSeeds] = useState<Set<number>>(new Set());

  // Hardcoded defaults (Step 2 "Configure Strategy" removed from UI)
  const DEFAULT_STRATEGY: PlanningStrategy = 'balanced';
  const DEFAULT_SUCCESSION: SuccessionPreference = 'moderate';
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
  const [rotationWarnings, setRotationWarnings] = useState<Map<string, RotationWarningType[]>>(new Map());

  // Trellis state
  const [trellisStructures, setTrellisStructures] = useState<TrellisStructure[]>([]);
  const [trellisAssignments, setTrellisAssignments] = useState<Map<number, number[]>>(new Map());
  const [trellisSpaceUsage, setTrellisSpaceUsage] = useState<Map<number, TrellisSpaceUsage>>(new Map());

  // Search, filter, and sort state for Step 1
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState('plantId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
    // Get plant from database
    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);

    // Get DTM - prioritize seed-specific override, fall back to plant database
    const dtm = seed.daysToMaturity ?? plant?.daysToMaturity;
    const plantName = seed.variety || plant?.name || 'Unknown plant';

    // If no DTM available, return unsuitable
    if (!dtm) {
      return {
        level: 'unsuitable',
        message: `Days to maturity not available for ${plantName}`,
        allowedOptions: ['none', 'light', 'moderate', 'heavy'], // Allow all since we don't know
        suggestedDefault: 'none'
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
        allowedOptions: ['none', 'light', 'moderate', 'heavy'],
        suggestedDefault: 'moderate'
      };
    }

    // Medium crops (50-80 days) - good for succession
    if (dtm >= 50 && dtm < 80) {
      return {
        level: 'good',
        message: `✅ ${plantName} is well-suited for succession planting (${dtm} days). ${intervalInfo.reasoning}`,
        allowedOptions: ['none', 'light', 'moderate', 'heavy'],
        suggestedDefault: 'light'
      };
    }

    // Long crops (80-120 days) - limited succession (2-3 plantings max)
    if (dtm >= 80 && dtm < 120) {
      return {
        level: 'limited',
        message: `⚠️ ${plantName} has limited succession potential (${dtm} days). Most growing seasons only support 2-3 plantings. ${intervalInfo.reasoning}`,
        allowedOptions: ['none', 'light'],  // Only allow none or light (2x)
        suggestedDefault: 'none'
      };
    }

    // Very long crops (>= 120 days) - not suitable for succession
    return {
      level: 'unsuitable',
      message: `❌ ${plantName} is not suitable for succession planting (${dtm} days). ${intervalInfo.reasoning}`,
      allowedOptions: ['none'],
      suggestedDefault: 'none'
    };
  };

  // Handle per-seed succession change
  const handleSeedSuccessionChange = (seedId: number, preference: SuccessionPreference) => {
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
   * Check if the user has any beds compatible with a plant's sun requirements
   * Returns null if compatible beds exist, or a warning message if not
   */
  const checkSunExposureCompatibility = (
    plantId: string,
    beds: GardenBed[]
  ): string | null => {
    const plant = PLANT_DATABASE.find(p => p.id === plantId);
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
   * Returns: 'compatible' | 'incompatible' | 'unknown'
   */
  const checkBedSunCompatibility = (
    plantId: string,
    bed: GardenBed
  ): 'compatible' | 'incompatible' | 'unknown' => {
    const plant = PLANT_DATABASE.find(p => p.id === plantId);
    if (!plant || !plant.sunRequirement) {
      return 'unknown'; // Can't validate without plant data
    }

    if (!bed.sunExposure) {
      return 'unknown'; // Bed doesn't have sun exposure set
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
   * Filters out beds with explicit incompatible sun exposure
   */
  const getCompatibleBeds = (seed: SeedInventoryItem): GardenBed[] => {
    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
    if (!plant) return [];

    // Filter out beds with explicit incompatible sun exposure
    return gardenBeds.filter(bed => {
      const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);
      // Include compatible and unknown (undefined sun exposure) beds
      // Exclude only explicitly incompatible beds
      return sunCompatibility !== 'incompatible';
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

    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
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
   * Calculate space status for a bed + crop combination
   */
  const getBedSpaceStatus = (bedId: number, seed: SeedInventoryItem): string => {
    const bed = gardenBeds.find(b => b.id === bedId);
    const quantity = manualQuantities.get(seed.id) || 0;
    if (!bed || quantity === 0) return 'N/A';

    const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
    if (!plant) return 'N/A';

    // Get current usage for this bed
    const currentUsage = bedSpaceUsage.get(bedId);
    const currentUsedSpace = currentUsage ? currentUsage.usedSpace : 0;
    const totalSpace = bed.width * bed.length;

    // Calculate utilization percentage
    const utilization = (currentUsedSpace / totalSpace) * 100;

    if (utilization < 80) return `${Math.round(utilization)}% ✓`;
    if (utilization <= 100) return `${Math.round(utilization)}% ⚠️`;
    return `${Math.round(utilization)}% ❌`;
  };

  /**
   * Check if a seed-bed combination has rotation conflicts
   */
  const hasRotationConflict = (seedId: number, bedId: number): boolean => {
    const key = `${seedId}-${bedId}`;
    return rotationWarnings.has(key) && (rotationWarnings.get(key)?.length || 0) > 0;
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
   * Update bed space usage based on current assignments
   */
  const updateBedSpaceUsage = () => {
    const usage = calculateSpacePerBed(
      seedInventory,
      manualQuantities,
      bedAssignments,
      gardenBeds,
      perSeedSuccession
    );
    setBedSpaceUsage(usage);
  };

  // Update bed space usage when relevant state changes
  useEffect(() => {
    if (gardenBeds.length > 0 && manualQuantities.size > 0) {
      updateBedSpaceUsage();
    }
  }, [manualQuantities, bedAssignments, gardenBeds, seedInventory, perSeedSuccession]);

  // Update space breakdown summary when succession preferences change
  useEffect(() => {
    if (manualQuantities.size > 0 && (gardenBeds.length > 0 || trellisStructures.length > 0)) {
      calculateSpaceBreakdown(manualQuantities, perSeedSuccession);
    }
  }, [perSeedSuccession, manualQuantities, gardenBeds, trellisStructures, seedInventory]);

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
    setLoading(true);
    try {
      // Merge bed assignments into plan items
      const itemsWithBeds = calculatedPlan.items.map(item => {
        // Find the original seed to get bed assignments
        const seed = seedInventory.find(s =>
          s.plantId === item.plantId && s.variety === item.variety
        );

        if (seed) {
          const beds = bedAssignments.get(seed.id) || [];
          return {
            ...item,
            bedsAllocated: beds.length > 0 ? beds : undefined
          };
        }

        return item;
      });

      const response = await fetch(`${API_BASE_URL}/api/garden-plans`, {
        method: 'POST',
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
        await loadPlans();
        setSelectedPlan(savedPlan);
        setView('detail');
        resetWizard();
      } else setError('Failed to save plan');
    } catch (err) {
      setError('Error saving plan');
    } finally {
      setLoading(false);
    }
  };

  const handleExportToCalendar = async (planId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/garden-plans/${planId}/export-to-calendar`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        alert(`Successfully exported ${result.totalEvents} events to calendar!`);
      } else setError('Failed to export');
    } catch (err) {
      setError('Error exporting');
    } finally {
      setLoading(false);
    }
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
  };

  // Helper functions for search and filter
  const getPlantInfo = useCallback((plantId: string) => {
    return PLANT_DATABASE.find(p => p.id === plantId);
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
      return (
        seed.variety?.toLowerCase().includes(query) ||
        plant?.name.toLowerCase().includes(query) ||
        seed.brand?.toLowerCase().includes(query) ||
        seed.notes?.toLowerCase().includes(query)
      );
    });
  }, [seedInventory, searchQuery, getPlantInfo]);

  // Phase 2: Build filter groups dynamically
  const filterGroups: FilterGroup[] = useMemo(() => {
    // Extract unique categories
    const categoryList = baseFilteredSeeds
      .map(s => getPlantInfo(s.plantId)?.category)
      .filter(cat => cat !== undefined) as string[];
    const categories = Array.from(new Set(categoryList)).sort();

    // Extract unique locations
    const locationList = baseFilteredSeeds
      .map(s => s.location)
      .filter(loc => loc !== undefined && loc.trim() !== '') as string[];
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
              <button onClick={() => { setView('create'); resetWizard(); }} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create Plan</button>
            </div>
            {plans.length === 0 ? (
              <div className="bg-gray-50 rounded p-8 text-center">
                <p className="text-gray-600 mb-4">No plans yet.</p>
                <button onClick={() => { setView('create'); resetWizard(); }} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">Create First Plan</button>
              </div>
            ) : (
              <div className="grid gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className="bg-white border rounded-lg p-6 hover:shadow-md">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                        <div className="text-sm text-gray-600">Year: {plan.year} | Crops: {plan.items?.length || 0}</div>
                      </div>
                      <button onClick={() => { setSelectedPlan(plan); setView('detail'); }} className="px-4 py-2 bg-blue-600 text-white rounded">View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              {[1, 2].map(num => (
                <React.Fragment key={num}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${step >= num ? 'bg-green-600 text-white' : 'border-gray-300 text-gray-400'}`}>{num}</div>
                  {num < 2 && <div className={`w-20 h-1 ${step > num ? 'bg-green-600' : 'bg-gray-300'}`} />}
                </React.Fragment>
              ))}
            </div>

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
                            const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
                            const spaceEstimate = isSelected && quantity > 0 && gardenBeds.length > 0
                              ? getSpaceEstimateForSeed(seed, quantity, gardenBeds, getEffectiveSuccession(seed.id))
                              : null;

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
                                    <div className="col-span-4">
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
                                    <div className="col-span-3">
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
                                                  <option value="none">None</option>
                                                  <option value="light" disabled={!allowedOptions.includes('light')}>
                                                    Light (2x) {!allowedOptions.includes('light') ? '(Not recommended)' : ''}
                                                  </option>
                                                  <option value="moderate" disabled={!allowedOptions.includes('moderate')}>
                                                    Moderate (4x) {!allowedOptions.includes('moderate') ? '(Not recommended)' : ''}
                                                  </option>
                                                  <option value="heavy" disabled={!allowedOptions.includes('heavy')}>
                                                    Heavy (8x) {!allowedOptions.includes('heavy') ? '(Not recommended)' : ''}
                                                  </option>
                                                </>
                                              );
                                            })()}
                                          </select>
                                        </>
                                      ) : (
                                        <span className="text-gray-400 text-sm italic">—</span>
                                      )}
                                    </div>
                                    <div className="col-span-3 text-sm">
                                      {spaceEstimate ? (
                                        <div className="text-gray-700">
                                          <span className="font-medium">Space:</span> {spaceEstimate}
                                        </div>
                                      ) : isSelected ? (
                                        <div className="text-gray-400 italic">Enter quantity</div>
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
                                      {selectedSuccession !== 'none' && !suitability.allowedOptions.includes(selectedSuccession) && (
                                        <div className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                                          ⚠️ {selectedSuccession.charAt(0).toUpperCase() + selectedSuccession.slice(1)} succession not recommended for this plant.
                                          Backend may adjust to fewer plantings based on growing season length.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Bed Selector - Show when seed is selected and has quantity */}
                                {isSelected && quantity > 0 && (
                                  <div className="px-3 pb-3 pt-0 border-t bg-gray-50">
                                    {compatibleBeds.length === 0 ? (
                                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                        <p className="text-sm text-red-800 font-medium mb-1">
                                          ☀️ No Compatible Beds Available
                                        </p>
                                        <p className="text-xs text-red-700">
                                          {(() => {
                                            const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
                                            if (!plant?.sunRequirement) return 'Plant sun requirement not defined.';

                                            const bedsWithSun = gardenBeds.filter(b => b.sunExposure);
                                            if (bedsWithSun.length === 0) {
                                              return `${plant.name} requires ${plant.sunRequirement} sun. Set sun exposure on your beds to enable assignment.`;
                                            }

                                            return `${plant.name} requires ${plant.sunRequirement} sun, but all your beds have incompatible sun exposure. Consider adding a bed with ${plant.sunRequirement} sun or choosing different plants.`;
                                          })()}
                                        </p>
                                      </div>
                                    ) : (
                                      <>
                                        <label className="block text-xs font-medium text-gray-700 mb-1 mt-2">
                                          Assign to Bed(s) (optional - Ctrl+Click for multiple)
                                        </label>

                                        {/* Show filtered beds information */}
                                        {(() => {
                                          const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);
                                          const totalBeds = gardenBeds.length;
                                          const compatibleCount = compatibleBeds.length;
                                          const filteredCount = totalBeds - compatibleCount;

                                          if (filteredCount > 0 && plant?.sunRequirement) {
                                            return (
                                              <div className="mb-1 text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                                                ☀️ {filteredCount} bed{filteredCount > 1 ? 's' : ''} hidden -
                                                incompatible with {plant.sunRequirement} sun requirement
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()}

                                        <select
                                          multiple
                                          size={Math.min(compatibleBeds.length, 4)}
                                          value={assignedBeds.map(String)}
                                          onChange={(e) => {
                                            const selectedIds = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                                            handleBedSelection(seed.id, selectedIds);
                                          }}
                                          className="w-full border border-gray-300 rounded p-2 text-sm"
                                        >
                                          {compatibleBeds.map(bed => {
                                            const bedStatus = getBedSpaceStatus(bed.id, seed);
                                            const hasConflict = hasRotationConflict(seed.id, bed.id);
                                            const sunCompatibility = checkBedSunCompatibility(seed.plantId, bed);

                                            let sunIndicator = '';
                                            if (sunCompatibility === 'unknown' && !bed.sunExposure) {
                                              sunIndicator = ' ❓ Sun?';
                                            }

                                            return (
                                              <option key={bed.id} value={bed.id}>
                                                {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)}) - {bedStatus}
                                                {hasConflict ? ' ⚠️ Rotation' : ''}
                                                {sunIndicator}
                                              </option>
                                            );
                                          })}
                                        </select>
                                        {assignedBeds.length > 0 && (
                                          <div className="mt-1 text-xs text-gray-600">
                                            ✓ Assigned to {assignedBeds.length} bed{assignedBeds.length > 1 ? 's' : ''}
                                          </div>
                                        )}

                                        {/* Sun exposure warnings for assigned beds */}
                                        {assignedBeds.length > 0 && (() => {
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
                                      </>
                                    )}
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
                                        {usage.usedSpace.toFixed(1)} / {usage.totalSpace} sq ft ({Math.round(utilization)}%)
                                      </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                      <div
                                        className={`bg-${statusColor}-500 h-2 rounded-full transition-all`}
                                        style={{ width: `${Math.min(utilization, 100)}%` }}
                                      />
                                    </div>

                                    {/* Crops in this bed */}
                                    <div className="text-xs text-gray-600">
                                      {usage.crops.map((crop, idx) => (
                                        <span key={idx}>
                                          {crop.plantName} ({crop.spaceUsed.toFixed(1)} sq ft)
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
                              const plant = PLANT_DATABASE.find(p => p.id === seed.plantId);

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
                                    {selectedSuccession === 'none' && 'No succession'}
                                    {selectedSuccession === 'light' && 'Light (2x)'}
                                    {selectedSuccession === 'moderate' && 'Moderate (4x)'}
                                    {selectedSuccession === 'heavy' && 'Heavy (8x)'}
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
                          <th className="px-4 py-2 text-right">Plants</th>
                          <th className="px-4 py-2 text-right">Succession</th>
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
                                <td className="px-4 py-2 text-right">{item.successionCount}</td>
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
                                  <td colSpan={5} className="px-4 py-2 bg-red-50">
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
                    <button onClick={handleSavePlan} disabled={loading || !planName.trim()} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300">{loading ? 'Saving...' : 'Save'}</button>
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
            <button onClick={() => { setView('list'); setSelectedPlan(null); }} className="mb-4 text-blue-600">← Back</button>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedPlan.name}</h2>
                  <div className="text-gray-600 text-sm">Year: {selectedPlan.year} | Strategy: {selectedPlan.strategy}</div>
                </div>
                <button onClick={() => handleExportToCalendar(selectedPlan.id)} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300">{loading ? 'Exporting...' : 'Export to Calendar'}</button>
              </div>
              {error && <div className="bg-red-50 border rounded p-3 mb-4 text-red-700">{error}</div>}
              <table className="w-full border rounded">
                <thead className="bg-gray-50">
                  <tr><th className="px-4 py-2 text-left">Crop</th><th className="px-4 py-2 text-right">Plants</th><th className="px-4 py-2 text-right">Succession</th><th className="px-4 py-2 text-right">Seeds</th><th className="px-4 py-2">Status</th></tr>
                </thead>
                <tbody>
                  {selectedPlan.items?.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">{item.variety || item.plantId}</td>
                      <td className="px-4 py-2 text-right">{item.plantEquivalent}</td>
                      <td className="px-4 py-2 text-right">{item.successionCount}x</td>
                      <td className="px-4 py-2 text-right">{item.seedsRequired || 0}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'exported' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GardenPlanner;
