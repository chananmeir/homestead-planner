import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Plant, PlantedItem, ValidationWarning, ValidationResult, DateSuggestion, GardenBed, SeedInventoryItem, TrellisStructure, TrellisCapacity } from '../../types';
import { API_BASE_URL } from '../../config';
import WarningDisplay from '../common/WarningDisplay';
import { extractCropName } from '../../utils/plantUtils';
import { autoPlacePlants, FillDirection } from './utils/autoPlacement';
import { useToast } from '../common/Toast';
import { coordinateToGridLabel, gridLabelToCoordinate, isValidGridLabel, getGridBoundsDescription } from './utils/gridCoordinates';
import { getMIGardenerSpacing } from '../../utils/migardenerSpacing';
import PlantIcon from '../common/PlantIcon';
import { determineRowContinuity, getRowContinuityMessage } from './utils/rowContinuity';
import { getIntensiveSpacing, HEX_ROW_OFFSET } from '../../utils/intensiveSpacing';
import { getEffectivePlantingStyle, PlantingStyle, PLANTING_STYLES, requiresSeedDensity, getQuantityTerminology } from '../../utils/plantingStyles';

/**
 * Determine if plant should use dense planting (multiple plants in one cell)
 * vs spread planting (one plant per cell)
 */
function shouldUseDensePlanting(plant: Plant, planningMethod: string): boolean {
  if (planningMethod !== 'square-foot' && planningMethod !== 'migardener' && planningMethod !== 'intensive' && planningMethod !== 'permaculture') {
    return false; // Only SFG, MIgardener, Intensive, and Permaculture support dense planting
  }

  // Get spacing based on method
  let spacing = plant.spacing || 12;
  if (planningMethod === 'migardener') {
    const migardenerSpacing = getMIGardenerSpacing(plant.id, spacing, plant.rowSpacing);
    spacing = migardenerSpacing.plantSpacing;
  } else if (planningMethod === 'intensive') {
    spacing = getIntensiveSpacing(plant.id, spacing);
  }

  // Determine grid size threshold based on planning method
  const gridSizeThresholds: Record<string, number> = {
    'square-foot': 12,
    'migardener': 3,
    'intensive': 6,
    'row': 6,
    'raised-bed': 6,
    'permaculture': 12,
  };
  const threshold = gridSizeThresholds[planningMethod] || 12;

  return spacing <= threshold; // Plants with spacing <= grid size can be planted densely
}

interface PlantConfigModalProps {
  isOpen: boolean;
  cropName: string;  // Base crop name (e.g., "Tomato")
  allPlants: Plant[];  // All plants for variety lookup
  position: { x: number; y: number } | null;
  planningMethod?: string;  // Planning method from garden bed (e.g., 'square-foot', 'row', 'intensive')
  plantingDate?: string;  // Date when plant will be placed (from dateFilter)
  bedId?: number;  // Garden bed ID (for protection offset calculation)
  bed?: GardenBed;  // Full bed object (for auto-placement)
  activePlants?: PlantedItem[];  // Date-filtered active plants (respects planning mode)
  rowNumber?: number;  // For MIGardener row planting (if provided, planting entire row)
  sourcePlanItemId?: number;  // Link to GardenPlanItem when placing from planned panel
  initialVariety?: string;  // Pre-filled variety (from Season Planner drag)
  activePlanId?: number;  // When set, shows seed-lot picker and enforces seed linkage
  onDateChange?: (newDate: string) => void;  // Callback to change the planting date
  onPreviewChange?: (positions: { x: number; y: number }[]) => void;  // Callback to show preview in grid
  onSave: (config: PlantConfig) => void;
  onCancel: () => void;
}

export interface PlantConfig {
  variety?: string;
  quantity: number;
  notes: string;
  plantingMethod: 'direct' | 'transplant';
  skipPost?: boolean; // If true, items already created via batch POST - parent should skip POST
  position?: { x: number; y: number }; // Updated position if user edited grid label
  previewPositions?: { x: number; y: number }[]; // Preview positions from auto-placement (parent handles batch POST)
  successionPlanting?: boolean;  // Enable succession planting
  weekInterval?: number;          // Weeks between successive rows/squares
  positionDates?: { x: number; y: number; date: string }[];  // For SFG: date per position
  trellisStructureId?: number;   // For trellis-required plants
  seedInventoryId?: number;      // Selected seed lot for plan linkage

  // NEW: Seed density metadata for MIGardener method
  seedDensityData?: {
    plantingMethod: 'individual_plants' | 'seed_density' | 'seed_density_broadcast';
    seedCount?: number;

    // Row-based seed density fields
    seedDensity?: number;
    uiSegmentLengthInches?: number;

    // Broadcast seed density fields
    seedDensityPerSqFt?: number;
    gridCellAreaInches?: number;

    // Plant-spacing seed density fields
    seedsPerSpot?: number;
    plantsKeptPerSpot?: number;

    plantingStyle?: 'row_based' | 'broadcast' | 'dense_patch' | 'plant_spacing';

    // Common fields
    expectedGerminationRate?: number;
    expectedSurvivalRate?: number;
    expectedFinalCount?: number;
    harvestMethod?: 'individual_head' | 'cut_and_come_again' | 'leaf_mass' | 'continuous_picking' | 'perennial_cutback' | 'individual_root' | 'partial_harvest';
    spacing?: number;
  };
}

const PlantConfigModal: React.FC<PlantConfigModalProps> = ({
  isOpen,
  cropName,
  allPlants,
  position,
  planningMethod = 'square-foot',
  plantingDate,
  bedId,
  bed,
  activePlants = [],
  rowNumber,
  sourcePlanItemId,
  initialVariety,
  activePlanId,
  onDateChange,
  onPreviewChange,
  onSave,
  onCancel
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [variety, setVariety] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [plantingMethod, setPlantingMethod] = useState<'direct' | 'transplant'>('direct');
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [suggestion, setSuggestion] = useState<DateSuggestion | undefined>(undefined);
  const [validating, setValidating] = useState<boolean>(false);

  // Track previous isOpen state to detect modal opening vs re-rendering
  const prevIsOpenRef = useRef<boolean>(false);

  // NEW: Seed density metadata for MIGardener method
  const [seedDensityMetadata, setSeedDensityMetadata] = useState<{
    plantingMethod: 'individual_plants' | 'seed_density' | 'seed_density_broadcast';
    seedCount?: number;

    // Row-based seed density fields
    seedDensity?: number;
    uiSegmentLengthInches?: number;

    // Broadcast seed density fields
    seedDensityPerSqFt?: number;
    gridCellAreaInches?: number;

    // Plant-spacing seed density fields
    seedsPerSpot?: number;
    plantsKeptPerSpot?: number;

    plantingStyle?: 'row_based' | 'broadcast' | 'dense_patch' | 'plant_spacing';

    // Common fields
    expectedGerminationRate?: number;
    expectedSurvivalRate?: number;
    expectedFinalCount?: number;
    harvestMethod?: 'individual_head' | 'cut_and_come_again' | 'leaf_mass' | 'continuous_picking' | 'perennial_cutback' | 'individual_root' | 'partial_harvest';
    spacing?: number;

    // Row continuity fields (only for row-based)
    rowGroupId?: string;
    rowSegmentIndex?: number;
    totalRowSegments?: number;
    rowContinuityMessage?: string | null;
  } | null>(null);

  // Preview state
  const [previewPositions, setPreviewPositions] = useState<{ x: number; y: number }[]>([]);
  const [showingPreview, setShowingPreview] = useState(false);
  const [plantsPerSquare, setPlantsPerSquare] = useState<number>(1); // For dense planting
  const [numberOfSquares, setNumberOfSquares] = useState<number>(1); // For succession planting UI
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-submission

  // Succession planting state (for MIGardener row planting)
  const [successionPlanting, setSuccessionPlanting] = useState<boolean>(false);
  const [weekInterval, setWeekInterval] = useState<number>(1);

  // Position editing state
  const [editedPosition, setEditedPosition] = useState<{ x: number; y: number } | null>(null);
  const [gridLabelInput, setGridLabelInput] = useState<string>('');
  const [positionError, setPositionError] = useState<string>('');

  // Fill direction state for auto-placement
  const [fillDirection, setFillDirection] = useState<FillDirection>('across');

  // User's personal seed inventory
  const [userSeeds, setUserSeeds] = useState<SeedInventoryItem[]>([]);
  const [showCatalogVarieties, setShowCatalogVarieties] = useState<boolean>(false);

  // Trellis selection state (for trellis-required plants like grapes)
  const [selectedTrellisId, setSelectedTrellisId] = useState<number | null>(null);
  const [availableTrellises, setAvailableTrellises] = useState<any[]>([]);
  const [trellisCapacity, setTrellisCapacity] = useState<any>(null);

  // Planting style selection state (NEW: Enable for ALL methods, not just MIGardener)
  const [selectedPlantingStyle, setSelectedPlantingStyle] = useState<PlantingStyle>('grid');

  // Seed-lot selection state (for plan linkage)
  const [selectedSeedId, setSelectedSeedId] = useState<number | undefined>();

  // Find representative plant for this crop
  const representativePlant = useMemo(() => {
    return allPlants.find(p => extractCropName(p.name) === cropName);
  }, [allPlants, cropName]);

  // Fetch user's personal seed inventory + global catalog
  useEffect(() => {
    if (!isOpen) return;

    const fetchUserSeeds = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/my-seeds?includeGlobal=true`, {
          credentials: 'include',
        });

        if (response.ok) {
          const seeds = await response.json();
          setUserSeeds(seeds);
        } else {
          console.error('Failed to fetch user seeds:', response.statusText);
          setUserSeeds([]);
        }
      } catch (error) {
        console.error('Error fetching user seeds:', error);
        setUserSeeds([]);
      }
    };

    fetchUserSeeds();
  }, [isOpen]);

  // Fetch available trellises if plant requires trellis
  useEffect(() => {
    if (!isOpen || !representativePlant) return;

    const trellisRequired = representativePlant.migardener?.trellisRequired;
    if (!trellisRequired) return;

    const fetchTrellises = async () => {
      try {
        // Fetch all trellises (backend will filter by user)
        const response = await fetch(`${API_BASE_URL}/api/trellis-structures`, {
          credentials: 'include',
        });

        if (response.ok) {
          const trellises = await response.json();
          setAvailableTrellises(trellises);
        }
      } catch (error) {
        console.error('Error fetching trellises:', error);
      }
    };

    fetchTrellises();
  }, [isOpen, representativePlant]);

  // Fetch capacity for selected trellis
  useEffect(() => {
    if (!selectedTrellisId) {
      setTrellisCapacity(null);
      return;
    }

    const fetchCapacity = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/trellis-structures/${selectedTrellisId}/capacity`, {
          credentials: 'include',
        });

        if (response.ok) {
          const capacity = await response.json();
          setTrellisCapacity(capacity);
        }
      } catch (error) {
        console.error('Error fetching trellis capacity:', error);
      }
    };

    fetchCapacity();
  }, [selectedTrellisId]);

  // Initialize planting style based on effective planting style (NEW: Enable for ALL methods)
  useEffect(() => {
    if (!representativePlant || !isOpen) return;

    const effectiveStyle = getEffectivePlantingStyle(representativePlant, bed);
    setSelectedPlantingStyle(effectiveStyle);
  }, [representativePlant, bed, isOpen]);

  // Recalculate quantities when planting style changes (user selects different style from dropdown)
  const prevPlantingStyleRef = useRef<PlantingStyle | null>(null);
  useEffect(() => {
    // Skip initial render (handled by modal-open effect) and only react to user-driven changes
    if (!selectedPlantingStyle || !representativePlant || !isOpen) return;
    if (prevPlantingStyleRef.current === null) {
      prevPlantingStyleRef.current = selectedPlantingStyle;
      return;
    }
    if (prevPlantingStyleRef.current === selectedPlantingStyle) return;
    prevPlantingStyleRef.current = selectedPlantingStyle;

    // Not a MIGardener bed - recalculate for permaculture row/grid switch, otherwise just update label
    if (planningMethod !== 'migardener') {
      if (planningMethod === 'permaculture' && representativePlant.spacing && bed) {
        const spacing = representativePlant.spacing;
        let newPlantsPerSquare: number;

        if (selectedPlantingStyle === 'row') {
          // Row placement: plants per row = bed width / plant spacing
          // Rows run horizontally across the bed width (A→Q)
          const bedWidthInches = bed.width * 12;
          newPlantsPerSquare = Math.floor(bedWidthInches / spacing);
        } else {
          // Grid/other: equidistant formula
          newPlantsPerSquare = Math.pow(12 / spacing, 2);
        }

        const newQuantity = Math.max(1, Math.floor(newPlantsPerSquare));
        setPlantsPerSquare(newPlantsPerSquare);
        setNumberOfSquares(1);
        setQuantity(newQuantity);
      }

      setSeedDensityMetadata(prev => prev ? {
        ...prev,
        plantingStyle: selectedPlantingStyle as 'row_based' | 'broadcast' | 'dense_patch' | 'plant_spacing'
      } : null);
      return;
    }

    // MIGardener bed but no migardener metadata - use spacing override fallback
    if (!representativePlant.migardener) {
      const migardenerSpacing = getMIGardenerSpacing(representativePlant.id, representativePlant.spacing, representativePlant.rowSpacing);
      let newPlantsPerSquare: number;
      if (migardenerSpacing.rowSpacing === null || migardenerSpacing.rowSpacing === 0) {
        const plantsPerFoot = 12 / migardenerSpacing.plantSpacing;
        newPlantsPerSquare = plantsPerFoot * plantsPerFoot;
      } else {
        const rowsPerFoot = 12 / migardenerSpacing.rowSpacing;
        const plantsPerFoot = 12 / migardenerSpacing.plantSpacing;
        newPlantsPerSquare = rowsPerFoot * plantsPerFoot;
      }
      const newQuantity = Math.max(1, Math.floor(newPlantsPerSquare));
      setPlantsPerSquare(newPlantsPerSquare);
      setNumberOfSquares(1);
      setQuantity(newQuantity);
      setSeedDensityMetadata({
        plantingMethod: 'individual_plants',
        spacing: migardenerSpacing.plantSpacing,
        plantingStyle: selectedPlantingStyle as 'row_based' | 'broadcast' | 'dense_patch' | 'plant_spacing'
      });
      return;
    }

    const mgData = representativePlant.migardener;
    const gridSize = bed?.gridSize || 3;
    let newQuantity = 1;
    let newPlantsPerSquare = 1;

    if (selectedPlantingStyle === 'broadcast' || selectedPlantingStyle === 'dense_patch') {
      // BROADCAST / DENSE PATCH: area-based seed density
      const gridCellAreaInches = gridSize * gridSize;
      const seedsPerSqFt = mgData.seedDensityPerSqFt || 50;
      const seedsPerSqInch = seedsPerSqFt / 144;
      const seedCount = Math.round(gridCellAreaInches * seedsPerSqInch);
      const expectedGermination = seedCount * mgData.germinationRate;
      const expectedFinalCount = Math.round(expectedGermination * mgData.survivalRate);

      setSeedDensityMetadata({
        plantingMethod: 'seed_density_broadcast',
        seedCount,
        seedDensityPerSqFt: seedsPerSqFt,
        gridCellAreaInches,
        expectedGerminationRate: mgData.germinationRate,
        expectedSurvivalRate: mgData.survivalRate,
        expectedFinalCount,
        harvestMethod: mgData.harvestMethod,
        plantingStyle: selectedPlantingStyle as 'broadcast' | 'dense_patch'
      });

      newQuantity = expectedFinalCount;
      newPlantsPerSquare = expectedFinalCount;

    } else if (selectedPlantingStyle === 'row') {
      // ROW-BASED: seed density along rows (matches 'row_based' agronomic style)
      const uiSegmentLengthInches = gridSize;
      const seedCount = Math.round(uiSegmentLengthInches * (mgData.seedDensityPerInch || 0));
      const expectedGermination = seedCount * mgData.germinationRate;
      const expectedFinalCount = Math.round(expectedGermination * mgData.survivalRate);

      let rowContinuity;
      if (position && activePlants && representativePlant.id) {
        rowContinuity = determineRowContinuity(position, representativePlant.id, activePlants);
      }
      const rowContinuityMessage = rowContinuity
        ? getRowContinuityMessage(rowContinuity.totalRowSegments, uiSegmentLengthInches, rowContinuity.isPartOfRow)
        : null;

      setSeedDensityMetadata({
        plantingMethod: 'seed_density',
        seedCount,
        seedDensity: mgData.seedDensityPerInch,
        uiSegmentLengthInches,
        expectedGerminationRate: mgData.germinationRate,
        expectedSurvivalRate: mgData.survivalRate,
        expectedFinalCount,
        harvestMethod: mgData.harvestMethod,
        plantingStyle: 'row_based',
        rowGroupId: rowContinuity?.rowGroupId,
        rowSegmentIndex: rowContinuity?.rowSegmentIndex,
        totalRowSegments: rowContinuity?.totalRowSegments,
        rowContinuityMessage
      });

      newQuantity = seedCount;
      newPlantsPerSquare = seedCount;

    } else if (selectedPlantingStyle === 'plant_spacing') {
      // PLANT-SPACING: multi-seed spots with thinning
      const seedsPerSpot = mgData.seedsPerSpot || 3;
      const plantsKeptPerSpot = mgData.plantsKeptPerSpot || 1;
      const totalSeeds = seedsPerSpot;
      const finalPlantsAfterThinning = plantsKeptPerSpot;

      setSeedDensityMetadata({
        plantingMethod: 'seed_density',
        seedCount: totalSeeds,
        seedsPerSpot,
        plantsKeptPerSpot,
        expectedGerminationRate: mgData.germinationRate,
        expectedSurvivalRate: mgData.survivalRate,
        expectedFinalCount: finalPlantsAfterThinning,
        harvestMethod: mgData.harvestMethod,
        plantingStyle: 'plant_spacing'
      });

      newQuantity = finalPlantsAfterThinning;
      newPlantsPerSquare = finalPlantsAfterThinning;

    } else {
      // GRID or other: individual plants fallback
      const migardenerSpacing = getMIGardenerSpacing(representativePlant.id, representativePlant.spacing, representativePlant.rowSpacing);

      if (migardenerSpacing.rowSpacing === null || migardenerSpacing.rowSpacing === 0) {
        const plantsPerFoot = 12 / migardenerSpacing.plantSpacing;
        newPlantsPerSquare = plantsPerFoot * plantsPerFoot;
      } else {
        const rowsPerFoot = 12 / migardenerSpacing.rowSpacing;
        const plantsPerFoot = 12 / migardenerSpacing.plantSpacing;
        newPlantsPerSquare = rowsPerFoot * plantsPerFoot;
      }
      newQuantity = Math.max(1, Math.floor(newPlantsPerSquare));

      setSeedDensityMetadata({
        plantingMethod: 'individual_plants',
        spacing: migardenerSpacing.plantSpacing,
        plantingStyle: selectedPlantingStyle as 'row_based' | 'broadcast' | 'dense_patch' | 'plant_spacing'
      });
    }

    setPlantsPerSquare(newPlantsPerSquare);
    setNumberOfSquares(1);
    setQuantity(newQuantity);
  }, [selectedPlantingStyle]);

  // Matching seed lots for the currently selected variety (personal seeds only)
  const matchingSeedLots = useMemo(() => {
    if (!variety || !cropName) return [];
    return userSeeds.filter(s => {
      const plant = allPlants.find(p => p.id === s.plantId);
      if (!plant) return false;
      return extractCropName(plant.name).toLowerCase() === cropName.toLowerCase()
        && (s.variety || '').toLowerCase() === variety.toLowerCase()
        && !s.isGlobal;
    });
  }, [variety, cropName, userSeeds, allPlants]);

  // Auto-select seed lot when exactly one match, clear when zero
  useEffect(() => {
    if (matchingSeedLots.length === 1) {
      setSelectedSeedId(matchingSeedLots[0].id);
    } else {
      setSelectedSeedId(undefined);
    }
  }, [matchingSeedLots]);

  // Get variety options from user's personal seed inventory for this crop
  const varietyOptions = useMemo(() => {
    if (!cropName) return [];

    // Filter user's seeds by matching the crop name from the plant database
    const matchingSeeds = userSeeds.filter(seed => {
      // Filter by catalog setting: if showCatalogVarieties is false, exclude global seeds
      if (!showCatalogVarieties && seed.isGlobal === true) {
        return false;
      }

      // Find the plant in allPlants by plantId
      const plant = allPlants.find(p => p.id === seed.plantId);
      if (!plant) return false;

      // Extract the crop name from the plant's name and compare
      const plantCropName = extractCropName(plant.name);
      return plantCropName.toLowerCase() === cropName.toLowerCase();
    });

    // Extract unique varieties
    const uniqueVarieties = new Set<string>();
    matchingSeeds.forEach(seed => {
      if (seed.variety && seed.variety.trim()) {
        uniqueVarieties.add(seed.variety.trim());
      }
    });

    // Convert to array and sort
    const varieties = Array.from(uniqueVarieties).sort((a, b) => {
      // Put "Generic" first if it exists
      if (a === 'Generic') return -1;
      if (b === 'Generic') return 1;
      return a.localeCompare(b);
    });

    return varieties.map(variety => ({
      variety,
      plantId: cropName, // Use cropName as plantId
      plant: representativePlant // Use representative plant for agronomic data
    }));
  }, [cropName, userSeeds, representativePlant, allPlants, showCatalogVarieties]);

  // Determine if this plant should use dense planting mode
  const isDensePlanting = useMemo(() => {
    return representativePlant && shouldUseDensePlanting(representativePlant, planningMethod);
  }, [representativePlant, planningMethod]);

  // Determine if we should show dual-input UI (for SFG/MIGardener, both dense and spread)
  const usesDualInput = useMemo(() => {
    return (planningMethod === 'square-foot' || planningMethod === 'migardener' || planningMethod === 'intensive' || planningMethod === 'permaculture');
  }, [planningMethod]);

  // Get context-appropriate labels based on selected planting style
  const quantityTerminology = useMemo(() => {
    return getQuantityTerminology(selectedPlantingStyle || 'grid');
  }, [selectedPlantingStyle]);

  // Validate planting conditions when plant, date, or method changes
  useEffect(() => {
    if (!representativePlant || !isOpen || !plantingDate) {
      setWarnings([]);
      setSuggestion(undefined);
      return;
    }

    const validatePlanting = async () => {
      setValidating(true);
      setWarnings([]);
      setSuggestion(undefined);

      try {
        // Get user's zipcode from localStorage (set by Weather Dashboard)
        const zipcode = localStorage.getItem('weatherZipCode');

        if (!zipcode) {
          setWarnings([{
            type: 'no_location',
            message: 'Set your location in Weather Dashboard for planting validation',
            severity: 'info'
          }]);
          setValidating(false);
          return;
        }

        // Call BOTH validation endpoints in parallel
        const [basicValidationResponse, forwardValidationResponse] = await Promise.all([
          // Original validation (frost dates, current soil temp)
          fetch(`${API_BASE_URL}/api/validate-planting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              plantId: representativePlant.id,
              plantingDate: plantingDate,
              zipcode: zipcode,
              bedId: bedId,
              plantingMethod: plantingMethod
            })
          }),
          // Forward-looking validation (future cold snaps using historical data)
          fetch(`${API_BASE_URL}/api/validate-planting-date`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              plant_id: representativePlant.id,
              plant_name: representativePlant.name,
              planting_date: plantingDate,
              zipcode: zipcode,
              current_soil_temp: representativePlant.germinationTemp?.min || 40,
              min_soil_temp: representativePlant.soil_temp_min || representativePlant.germinationTemp?.min || 40,
              days_to_maturity: representativePlant.daysToMaturity || 60
            })
          })
        ]);

        // Collect all warnings
        const allWarnings: ValidationWarning[] = [];
        let mainSuggestion: DateSuggestion | undefined;

        // Process basic validation response
        if (basicValidationResponse.ok) {
          const basicResult: ValidationResult = await basicValidationResponse.json();
          allWarnings.push(...(basicResult.warnings || []));
          mainSuggestion = basicResult.suggestion;
        }

        // Process forward-looking validation response
        if (forwardValidationResponse.ok) {
          const forwardResult = await forwardValidationResponse.json();
          // Add forward-looking warnings if there's danger
          if (forwardResult.future_cold_danger && forwardResult.warnings && forwardResult.warnings.length > 0) {
            forwardResult.warnings.forEach((warningText: string) => {
              allWarnings.push({
                type: 'future_cold_danger',
                message: warningText,
                severity: 'warning'
              });
            });
          }
        }

        // Check sun exposure compatibility
        if (bed && bed.sunExposure && representativePlant.sunRequirement) {
          const plantRequirement = representativePlant.sunRequirement;
          const bedExposure = bed.sunExposure;

          // Compatibility matrix: plant requirement -> acceptable bed exposures
          const compatibilityMap: { [key: string]: string[] } = {
            'full': ['full'],
            'partial': ['full', 'partial'],
            'shade': ['full', 'partial', 'shade']
          };

          const acceptableExposures = compatibilityMap[plantRequirement] || ['full'];
          const compatible = acceptableExposures.includes(bedExposure);

          if (!compatible) {
            let severity: 'error' | 'warning' = 'warning';
            let message = '';

            if (plantRequirement === 'full' && (bedExposure === 'partial' || bedExposure === 'shade')) {
              severity = 'error';
              message = `${representativePlant.name} requires full sun (6+ hours) but this bed has ${bedExposure} sun. Growth will be poor and yields reduced.`;
            } else if (plantRequirement === 'partial' && bedExposure === 'shade') {
              severity = 'warning';
              message = `${representativePlant.name} prefers partial sun but this bed has shade. May grow slowly with reduced yields.`;
            } else {
              severity = 'warning';
              message = `${representativePlant.name} prefers ${plantRequirement} sun but bed has ${bedExposure} sun.`;
            }

            allWarnings.push({
              type: 'sun_exposure_mismatch',
              message: message,
              severity: severity
            });
          }
        }

        setWarnings(allWarnings);
        setSuggestion(mainSuggestion);
      } catch (err) {
        console.error('Error validating planting:', err);
        // Don't block user if validation fails
      } finally {
        setValidating(false);
      }
    };

    validatePlanting();
  }, [representativePlant, plantingDate, plantingMethod, isOpen, bedId, variety]);

  // Calculate grid dimensions from bed
  const gridDimensions = useMemo(() => {
    if (!bed) return null;
    return {
      gridWidth: Math.floor((bed.width * 12) / (bed.gridSize || 12)),
      gridHeight: Math.floor((bed.length * 12) / (bed.gridSize || 12))
    };
  }, [bed]);

  // Get current position (edited or original)
  const currentPosition = editedPosition || position;

  // Convert current position to grid label
  const currentGridLabel = useMemo(() => {
    if (!currentPosition) return '';
    return coordinateToGridLabel(currentPosition.x, currentPosition.y);
  }, [currentPosition]);

  // Handle grid label input change
  const handleGridLabelChange = (value: string) => {
    setGridLabelInput(value);
    setPositionError('');

    // Don't validate empty input
    if (!value.trim()) {
      setEditedPosition(null);
      return;
    }

    // Validate the input
    if (!gridDimensions) {
      setPositionError('Grid dimensions not available');
      return;
    }

    const validation = isValidGridLabel(value, gridDimensions.gridWidth, gridDimensions.gridHeight);

    if (!validation.valid) {
      setPositionError(validation.error || 'Invalid grid label');
      return;
    }

    // Convert to coordinates
    const coord = gridLabelToCoordinate(value);
    if (coord) {
      setEditedPosition(coord);
      setPositionError('');
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    // Only reset form when modal OPENS (transitions from closed to open)
    // Don't reset during re-renders when modal is already open (e.g., during succession planting)
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justOpened && representativePlant) {
      // Calculate plants per square for dual-input UI
      let calculatedPlantsPerSquare = 1;
      let defaultQuantity = 1;

      if (planningMethod === 'square-foot' && representativePlant.spacing) {
        // Square foot gardening: (12 / spacing)²
        // Works for both dense (>1) and spread (<1) planting
        const spacing = representativePlant.spacing;
        calculatedPlantsPerSquare = Math.pow(12 / spacing, 2);
        defaultQuantity = Math.max(1, Math.floor(calculatedPlantsPerSquare));
      } else if (planningMethod === 'migardener') {
        // MIGardener: Seed density planting (row-based or broadcast)
        if (representativePlant.migardener) {
          const mgData = representativePlant.migardener;
          const gridSize = bed?.gridSize || 3;

          // Branch on planting style
          if (mgData.plantingStyle === 'broadcast' || mgData.plantingStyle === 'dense_patch') {
            // BROADCAST: Calculate based on area coverage
            const gridCellAreaInches = gridSize * gridSize;  // e.g., 3" × 3" = 9 sq in
            const seedsPerSqFt = mgData.seedDensityPerSqFt || 50;  // Default to 50 if not specified
            const seedsPerSqInch = seedsPerSqFt / 144;  // Convert sq ft → sq inch
            const seedCount = Math.round(gridCellAreaInches * seedsPerSqInch);

            const expectedGermination = seedCount * mgData.germinationRate;
            const expectedFinalCount = Math.round(expectedGermination * mgData.survivalRate);

            // Store broadcast seed density metadata
            setSeedDensityMetadata({
              plantingMethod: 'seed_density_broadcast',
              seedCount,
              seedDensityPerSqFt: seedsPerSqFt,
              gridCellAreaInches,
              expectedGerminationRate: mgData.germinationRate,
              expectedSurvivalRate: mgData.survivalRate,
              expectedFinalCount,
              harvestMethod: mgData.harvestMethod,
              plantingStyle: 'broadcast'
            });

            defaultQuantity = expectedFinalCount;
            calculatedPlantsPerSquare = expectedFinalCount;

          } else if (mgData.plantingStyle === 'row_based') {
            // ROW-BASED: Existing logic for seed density along rows
            const uiSegmentLengthInches = gridSize; // One grid cell = segment of continuous row
            const seedCount = Math.round(uiSegmentLengthInches * (mgData.seedDensityPerInch || 0));
            const expectedGermination = seedCount * mgData.germinationRate;
            const expectedFinalCount = Math.round(expectedGermination * mgData.survivalRate);

            // Determine row continuity if position and active plants are available
            let rowContinuity;
            if (position && activePlants && representativePlant.id) {
              rowContinuity = determineRowContinuity(position, representativePlant.id, activePlants);
            }

            const rowContinuityMessage = rowContinuity
              ? getRowContinuityMessage(rowContinuity.totalRowSegments, uiSegmentLengthInches, rowContinuity.isPartOfRow)
              : null;

            // Store row-based seed density metadata
            setSeedDensityMetadata({
              plantingMethod: 'seed_density',
              seedCount,
              seedDensity: mgData.seedDensityPerInch,
              uiSegmentLengthInches,
              expectedGerminationRate: mgData.germinationRate,
              expectedSurvivalRate: mgData.survivalRate,
              expectedFinalCount,
              harvestMethod: mgData.harvestMethod,
              // Row continuity fields
              rowGroupId: rowContinuity?.rowGroupId,
              rowSegmentIndex: rowContinuity?.rowSegmentIndex,
              totalRowSegments: rowContinuity?.totalRowSegments,
              rowContinuityMessage
            });

            defaultQuantity = seedCount;
            calculatedPlantsPerSquare = seedCount;

          } else if (mgData.plantingStyle === 'plant_spacing') {
            // PLANT-SPACING: Multi-seed spots with thinning (e.g., beans)
            // Plant N seeds per spot, thin to M plants per spot
            const spotsNeeded = 1;  // One grid cell = one planting spot
            const seedsPerSpot = mgData.seedsPerSpot || 3;
            const plantsKeptPerSpot = mgData.plantsKeptPerSpot || 1;
            const totalSeeds = spotsNeeded * seedsPerSpot;

            const expectedGermination = totalSeeds * mgData.germinationRate;
            const expectedSurvival = expectedGermination * mgData.survivalRate;
            const finalPlantsAfterThinning = spotsNeeded * plantsKeptPerSpot;

            // Store plant-spacing metadata
            setSeedDensityMetadata({
              plantingMethod: 'seed_density',  // Backend treats as seed_density for now
              seedCount: totalSeeds,
              seedsPerSpot,
              plantsKeptPerSpot,
              expectedGerminationRate: mgData.germinationRate,
              expectedSurvivalRate: mgData.survivalRate,
              expectedFinalCount: finalPlantsAfterThinning,
              harvestMethod: mgData.harvestMethod,
              plantingStyle: 'plant_spacing'
            });

            defaultQuantity = finalPlantsAfterThinning;
            calculatedPlantsPerSquare = finalPlantsAfterThinning;
          }
        } else {
          // OLD: Individual plants model (fallback for plants without migardener data)
          const migardenerSpacing = getMIGardenerSpacing(representativePlant.id, representativePlant.spacing, representativePlant.rowSpacing);

          // For intensive crops (null rowSpacing), use grid-based calculation
          if (migardenerSpacing.rowSpacing === null || migardenerSpacing.rowSpacing === 0) {
            // Intensive planting: plants spaced equally in all directions
            const plantsPerFoot = 12 / migardenerSpacing.plantSpacing;
            calculatedPlantsPerSquare = plantsPerFoot * plantsPerFoot;
            defaultQuantity = Math.max(1, Math.floor(calculatedPlantsPerSquare));
          } else {
            // Traditional row-based planting
            const rowsPerFoot = 12 / migardenerSpacing.rowSpacing;
            const plantsPerFoot = 12 / migardenerSpacing.plantSpacing;
            calculatedPlantsPerSquare = rowsPerFoot * plantsPerFoot;
            defaultQuantity = Math.max(1, Math.floor(calculatedPlantsPerSquare));
          }

          // Store individual plants metadata
          setSeedDensityMetadata({
            plantingMethod: 'individual_plants',
            spacing: migardenerSpacing.plantSpacing
          });
        }
      } else if (planningMethod === 'intensive' && representativePlant.spacing) {
        // Intensive/Bio-Intensive: Hexagonal packing with 0.866 row offset
        // More efficient than square spacing: ~15% more plants per area
        const onCenterSpacing = getIntensiveSpacing(representativePlant.id, representativePlant.spacing);
        const rowSpacing = onCenterSpacing * HEX_ROW_OFFSET; // 0.866 × spacing
        const rowsPerFoot = 12 / rowSpacing;
        const plantsPerFoot = 12 / onCenterSpacing;
        calculatedPlantsPerSquare = rowsPerFoot * plantsPerFoot;
        defaultQuantity = Math.max(1, Math.floor(calculatedPlantsPerSquare));
      } else if (planningMethod === 'permaculture' && representativePlant.spacing) {
        // Permaculture: depends on planting style
        const spacing = representativePlant.spacing;
        const effectiveStyle = getEffectivePlantingStyle(representativePlant, bed);

        if (effectiveStyle === 'row' && bed) {
          // Row placement: plants per row = bed width / plant spacing
          // Rows run horizontally across the bed width (A→Q)
          const bedWidthInches = bed.width * 12;
          calculatedPlantsPerSquare = Math.floor(bedWidthInches / spacing);
          defaultQuantity = Math.max(1, calculatedPlantsPerSquare);
        } else {
          // Grid placement: equidistant in all directions
          calculatedPlantsPerSquare = Math.pow(12 / spacing, 2);
          defaultQuantity = Math.max(1, Math.floor(calculatedPlantsPerSquare));
        }
      }
      // For other methods (row, raised-bed, etc.), default to 1

      setQuantity(defaultQuantity);
      setPlantsPerSquare(calculatedPlantsPerSquare); // Store actual plants per square (can be < 1)
      setNumberOfSquares(1); // Initialize squares to 1 for dual-input UI
      // Pre-fill variety from Season Planner drag, or start empty for Plant Palette
      setVariety(initialVariety || '');
      setNotes('');
      setShowCatalogVarieties(false); // Default to personal seeds only

      // Auto-detect planting method based on planning mode and weeksIndoors
      // MIGardener methodology typically uses direct seeding for row crops
      const weeksIndoors = representativePlant.weeksIndoors || 0;
      const defaultMethod = planningMethod === 'migardener'
        ? 'direct'  // MIGardener defaults to direct seed for row crops
        : (weeksIndoors > 0 ? 'transplant' : 'direct');
      setPlantingMethod(defaultMethod);

      // Reset position editing
      setEditedPosition(null);
      setGridLabelInput('');
      setPositionError('');

      // Reset preview state
      setPreviewPositions([]);
      setShowingPreview(false);

      // Reset succession planting state
      setSuccessionPlanting(false);
      setWeekInterval(1);

      // Reset fill direction to default
      setFillDirection('across');

      // Set planting style ref to initial effective style so style-change effect
      // can detect user-driven changes (null would cause first change to be skipped)
      prevPlantingStyleRef.current = getEffectivePlantingStyle(representativePlant, bed);
    }
  }, [isOpen, representativePlant, planningMethod, initialVariety]);

  // Sync handlers for dual-input UI (squares <-> plants)
  const handleSquaresChange = (value: number) => {
    const validated = Math.max(1, Math.min(100, Math.floor(value)));
    setNumberOfSquares(validated);
    setQuantity(validated * plantsPerSquare); // Sync total plants
  };

  const handlePlantsChange = (value: number) => {
    const validated = Math.max(1, Math.min(1600, Math.floor(value)));
    setQuantity(validated);
    setNumberOfSquares(Math.ceil(validated / plantsPerSquare)); // Sync squares (round up)
  };

  const handlePreviewPlacement = () => {
    if (!bed || !representativePlant || !position || quantity <= 1) {
      return;
    }

    // Calculate grid dimensions
    const gridWidth = Math.floor((bed.width * 12) / (bed.gridSize || 12));
    const gridHeight = Math.floor((bed.length * 12) / (bed.gridSize || 12));

    // Determine mode and calculate quantity to pass to auto-placement
    const isRowMode = selectedPlantingStyle === 'row';
    const effectiveFillDirection: FillDirection = fillDirection;

    // For row mode: find grid cells across all requested rows (batch handler distributes plants per cell)
    // For dense planting: use numberOfSquares (each square holds plantsPerSquare)
    // For spread planting: one plant per position
    let numPositions: number;
    if (isRowMode) {
      // Row mode: one position per grid cell in the row; maxRows limits row count
      // Rows always run horizontally in generateMIGardenerCandidates (x varies across width)
      numPositions = gridWidth * numberOfSquares; // All cells across requested rows
    } else {
      numPositions = isDensePlanting ? numberOfSquares : quantity;
    }

    // Run auto-placement algorithm
    // Use activePlants (date-filtered with planning mode) instead of all bed.plantedItems
    const result = autoPlacePlants({
      startPosition: currentPosition,
      plant: representativePlant,
      quantity: numPositions, // Number of grid cell positions to find
      bedDimensions: { gridWidth, gridHeight },
      gridSize: bed.gridSize || 12,
      existingPlants: activePlants, // Only plants active on the planting date (respects planning mode)
      dateFilter: plantingDate,
      planningMethod: bed.planningMethod || planningMethod, // Pass planning method for row-based placement
      plantingStyle: selectedPlantingStyle, // Pass planting style for row-based candidate generation
      fillDirection: effectiveFillDirection, // Pass fill direction for generic grid placement
      maxRows: isRowMode ? numberOfSquares : undefined, // Constrain to N rows when in row mode
    });

    setPreviewPositions(result.positions);
    setShowingPreview(true);

    // Notify parent to show preview
    if (onPreviewChange) {
      onPreviewChange(result.positions);
    }

    // Show warning if not enough cells for all plants
    if (isRowMode) {
      const plantsPerCell = result.placed > 0 ? Math.ceil(quantity / result.placed) : 0;
      const fittablePlants = result.placed * plantsPerCell;
      if (result.placed < numPositions) {
        showWarning(
          `Only ${result.placed} cells available in ${numberOfSquares} row(s) — fits ~${fittablePlants} of ${quantity} plants. Increase rows or reduce total plants.`
        );
      } else {
        showSuccess(`Preview: ${result.placed} cells across ${numberOfSquares} row(s), ~${plantsPerCell} plants per cell (${quantity} total)`);
      }
    } else if (result.placed < numPositions) {
      showWarning(
        `Placed ${result.placed} of ${numPositions} ${quantityTerminology.unitLabel.toLowerCase()} (bed boundary reached)`
      );
    } else {
      const message = isDensePlanting && !isRowMode
        ? `Preview: Will place ${result.placed} squares with ${plantsPerSquare} ${cropName} plants each (${result.placed * plantsPerSquare} total)`
        : `Preview: Will place ${result.placed} ${cropName} plants`;
      showSuccess(message);
    }
  };

  const handleSave = async () => {
    // Prevent double-submission
    if (isSubmitting) {
      return;
    }

    // Validate trellis selection if required
    if (representativePlant?.migardener?.trellisRequired && !selectedTrellisId) {
      showError('Please select a trellis structure for this plant');
      return;
    }

    setIsSubmitting(true);

    try {
      // Track effective preview state (local variable since setState is async)
      let effectiveShowingPreview = showingPreview;
      let effectivePreviewPositions = previewPositions;

      // ROW MODE BYPASS: If row mode without preview, auto-generate cell positions
      // so the batch path is used instead of stacking all plants in one cell
      if (selectedPlantingStyle === 'row' && !showingPreview && bed && representativePlant && quantity > 1) {
        const gridWidth = Math.floor((bed.width * 12) / (bed.gridSize || 12));
        const gridHeight = Math.floor((bed.length * 12) / (bed.gridSize || 12));

        // Rows always run horizontally in generateMIGardenerCandidates (x varies, y is row index)
        const cellsPerRow = gridWidth;
        const numPositions = cellsPerRow * numberOfSquares;

        const result = autoPlacePlants({
          startPosition: currentPosition,
          plant: representativePlant,
          quantity: numPositions,
          bedDimensions: { gridWidth, gridHeight },
          gridSize: bed.gridSize || 12,
          existingPlants: activePlants,
          dateFilter: plantingDate,
          planningMethod: bed.planningMethod || planningMethod,
          plantingStyle: selectedPlantingStyle,
          maxRows: numberOfSquares,
        });

        if (result.positions.length > 0) {
          setPreviewPositions(result.positions);
          setShowingPreview(true);
          effectiveShowingPreview = true;
          effectivePreviewPositions = result.positions;
          if (onPreviewChange) {
            onPreviewChange(result.positions);
          }
        }
      }

      // PATH 1: DENSE PLANTING - Single item with quantity at one position
      if (isDensePlanting && quantity >= 1 && !effectiveShowingPreview) {
        const config: PlantConfig = {
          variety: variety.trim() || undefined,
          quantity, // e.g., 4 for lettuce
          notes: notes.trim(),
          plantingMethod,
          position: editedPosition || undefined, // Include edited position if changed
          successionPlanting: rowNumber ? successionPlanting : false,
          weekInterval: successionPlanting ? weekInterval : undefined,
          seedDensityData: seedDensityMetadata || undefined, // NEW: Include seed density data
          trellisStructureId: selectedTrellisId || undefined, // For trellis-required plants
          seedInventoryId: selectedSeedId, // Seed lot for plan linkage
        };
        onSave(config); // Parent GardenDesigner handles API call
        return;
      }

      // PATH 2: SPREAD PLANTING - Single plant or no preview - use existing logic
      if (quantity === 1 || !effectiveShowingPreview || effectivePreviewPositions.length === 0) {
        const config: PlantConfig = {
          variety: variety.trim() || undefined,
          quantity,
          notes: notes.trim(),
          plantingMethod,
          position: editedPosition || undefined, // Include edited position if changed
          successionPlanting: rowNumber ? successionPlanting : false,
          weekInterval: successionPlanting ? weekInterval : undefined,
          seedDensityData: seedDensityMetadata || undefined, // NEW: Include seed density data
          trellisStructureId: selectedTrellisId || undefined, // For trellis-required plants
          seedInventoryId: selectedSeedId, // Seed lot for plan linkage
        };
        onSave(config);
        return;
      }

      // Multi-plant batch creation
      if (!bed || !bedId || !representativePlant) {
        showError('Missing required information for batch placement');
        setIsSubmitting(false);
        return;
      }

      // Check if SFG succession planting is enabled
      const isSFGSuccession = successionPlanting && !rowNumber && effectivePreviewPositions.length > 1;

      if (isSFGSuccession) {
        // SFG/dual-input Succession: Calculate position-date pairs and let parent handle posting
        const positionDates = effectivePreviewPositions.map((pos, index) => {
          const baseDate = new Date(plantingDate!);
          const offsetDays = index * weekInterval * 7;
          const squareDate = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
          return {
            x: pos.x,
            y: pos.y,
            date: squareDate.toISOString().split('T')[0]
          };
        });

        // Return config with positionDates + previewPositions for multi-square batch path
        const config: PlantConfig = {
          variety: variety.trim() || undefined,
          quantity, // Total plants (e.g., 360 for 4 rows × 90 plants)
          notes: notes.trim(),
          plantingMethod,
          previewPositions: effectivePreviewPositions, // Parent uses these for multi-square batch creation
          successionPlanting: true,
          weekInterval: weekInterval,
          positionDates: positionDates, // Per-position staggered dates
          seedDensityData: seedDensityMetadata || undefined,
          trellisStructureId: selectedTrellisId || undefined,
          seedInventoryId: selectedSeedId,
        };
        onSave(config);
        return;
      }

      // No succession: Return preview positions to parent for batch creation
      // Parent handles designer-sync (planner linkage) + batch POST with sourcePlanItemId
      const config: PlantConfig = {
        variety: variety.trim() || undefined,
        quantity, // Total plants (e.g., 192 for 12 squares of 16 carrots)
        notes: notes.trim(),
        plantingMethod,
        previewPositions: effectivePreviewPositions, // Parent uses these instead of calculating its own
        seedDensityData: seedDensityMetadata || undefined,
        trellisStructureId: selectedTrellisId || undefined,
        seedInventoryId: selectedSeedId,
      };
      onSave(config);
    } catch (error) {
      console.error('Error placing plants:', error);
      showError('Network error while placing plants');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setVariety('');
    setQuantity(1);
    setNotes('');
    setPlantingMethod('direct');
    setError('');
    setPreviewPositions([]);
    setShowingPreview(false);
    setSelectedSeedId(undefined);

    // Clear preview in parent
    if (onPreviewChange) {
      onPreviewChange([]);
    }

    onCancel();
  };

  // For grid-based placement, position is required
  // For MIGardener row planting, rowNumber is required (position will be null)
  if (!cropName || !representativePlant || (!position && !rowNumber)) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={`Configure ${cropName}`}
    >
      <div className="space-y-4">
        {/* Plant Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <PlantIcon plantId={representativePlant.id} plantIcon={representativePlant.icon || '🌱'} size={32} />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{cropName}</p>
              {bed && (
                <>
                  <p className="text-sm text-gray-600 mt-1">
                    Bed: <span className="font-medium text-blue-700">{bed.name}</span>
                    {bed.sunExposure && representativePlant && (
                      <span className="ml-2">
                        {(() => {
                          const plantReq = representativePlant.sunRequirement;
                          const bedExp = bed.sunExposure;
                          const compatibilityMap: { [key: string]: string[] } = {
                            'full': ['full'],
                            'partial': ['full', 'partial'],
                            'shade': ['full', 'partial', 'shade']
                          };
                          const acceptable = compatibilityMap[plantReq] || ['full'];
                          const compatible = acceptable.includes(bedExp);

                          if (compatible) {
                            return <span className="text-xs text-green-600">✓ {bedExp} sun</span>;
                          } else if (plantReq === 'full' && (bedExp === 'partial' || bedExp === 'shade')) {
                            return <span className="text-xs text-red-600">❌ {bedExp} sun (needs full)</span>;
                          } else {
                            return <span className="text-xs text-yellow-600">⚠️ {bedExp} sun (prefers {plantReq})</span>;
                          }
                        })()}
                      </span>
                    )}
                  </p>
                </>
              )}
              {plantingDate && (
                <p className="text-sm text-gray-600 mt-1">
                  Planting for: <span className="font-medium text-green-700">{new Date(plantingDate).toLocaleDateString()}</span>
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {rowNumber !== undefined ? (
                  // MIGardener row planting
                  <>
                    <span className="text-sm text-gray-600">Row:</span>
                    <span className="px-2 py-1 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded">
                      Row {rowNumber}
                    </span>
                    <span className="text-xs text-gray-500">(entire row will be planted)</span>
                  </>
                ) : (
                  // Grid-based planting (SFG)
                  <>
                    <label htmlFor="gridPosition" className="text-sm text-gray-600 whitespace-nowrap">
                      Position:
                    </label>
                    <input
                      id="gridPosition"
                      type="text"
                      value={gridLabelInput || currentGridLabel}
                      onChange={(e) => handleGridLabelChange(e.target.value)}
                      onBlur={() => {
                        // Reset to current position if input is cleared
                        if (!gridLabelInput.trim() && currentPosition) {
                          setGridLabelInput('');
                          setEditedPosition(null);
                        }
                      }}
                      placeholder={currentGridLabel}
                      className={`px-2 py-1 text-sm border rounded w-16 focus:outline-none focus:ring-1 ${
                        positionError
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                      }`}
                      title="Edit grid position (e.g., A1, B2)"
                    />
                    <span className="text-xs text-gray-500">
                      ({currentPosition?.x}, {currentPosition?.y})
                    </span>
                    {gridDimensions && (
                      <span className="text-xs text-gray-400 ml-1">
                        {getGridBoundsDescription(gridDimensions.gridWidth, gridDimensions.gridHeight)}
                      </span>
                    )}
                  </>
                )}
              </div>
              {positionError && !rowNumber && (
                <p className="text-xs text-red-600 mt-1">{positionError}</p>
              )}
              {/* Fill Direction - Only show for grid planting with multiple squares */}
              {!rowNumber && numberOfSquares > 1 && (
                <div className="flex items-center gap-2 mt-2">
                  <label htmlFor="fillDirection" className="text-sm text-gray-600 whitespace-nowrap">
                    Fill direction:
                  </label>
                  <select
                    id="fillDirection"
                    value={fillDirection}
                    onChange={(e) => setFillDirection(e.target.value as FillDirection)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="across">Across (left-to-right)</option>
                    <option value="down">Down (top-to-bottom)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MIGardener Seed Density Information Panel */}
        {planningMethod === 'migardener' && representativePlant.migardener && (seedDensityMetadata?.plantingMethod === 'seed_density' || seedDensityMetadata?.plantingMethod === 'seed_density_broadcast') && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            {seedDensityMetadata.plantingStyle === 'broadcast' ? (
              // BROADCAST PLANTING DISPLAY
              <>
                <h4 className="font-semibold text-blue-900 mb-2">🌱 MIGardener Broadcast Seeding</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    <strong>Broadcast density:</strong> ~{seedDensityMetadata.seedDensityPerSqFt} seeds per square foot
                  </p>
                  <p className="text-xs text-blue-600">
                    ({seedDensityMetadata.seedCount} seeds in this {Math.round(seedDensityMetadata.gridCellAreaInches || 9)} sq in cell)
                  </p>
                  <p>
                    <strong>Germination rate:</strong> {((seedDensityMetadata.expectedGerminationRate || 0) * 100).toFixed(0)}%
                  </p>
                  <p>
                    <strong>Typical survival estimate:</strong> ~{((seedDensityMetadata.expectedSurvivalRate || 0) * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Actual survival varies with soil fertility, moisture, and temperature
                  </p>
                  <p className="font-semibold text-blue-900 mt-2">
                    Expected final: ~{seedDensityMetadata.expectedFinalCount} plants per cell after self-thinning
                  </p>
                  <p className="text-xs mt-2 text-blue-700">
                    <strong>Harvest method:</strong> {(seedDensityMetadata.harvestMethod || '').replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs mt-2 text-blue-600 italic">
                    MIGardener broadcast method covers area densely with no defined rows. Final plant density emerges through natural self-thinning.
                  </p>
                </div>
              </>
            ) : seedDensityMetadata.plantingStyle === 'plant_spacing' ? (
              // PLANT-SPACING PLANTING DISPLAY
              <>
                <h4 className="font-semibold text-blue-900 mb-2">🌱 MIGardener Plant-Spacing Method</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  {seedDensityMetadata.seedsPerSpot === 1 && seedDensityMetadata.plantsKeptPerSpot === 1 ? (
                    // PERENNIAL / SINGLE PLANT CASE (e.g., bee balm)
                    <>
                      <p>
                        <strong>Planting:</strong> 1 plant per spot (transplant or single seed)
                      </p>
                      <p className="bg-green-50 border border-green-200 rounded px-2 py-1 mt-2">
                        <strong>🌿 No thinning needed</strong> - One plant per spot
                      </p>
                      {seedDensityMetadata.harvestMethod === 'perennial_cutback' && (
                        <p className="bg-purple-50 border border-purple-200 rounded px-2 py-1 mt-2">
                          <strong>🌸 Perennial</strong> - Spreads and establishes over time
                        </p>
                      )}
                      <p className="text-xs text-blue-600 mt-2">
                        Spacing represents mature clump size, not initial planting density
                      </p>
                    </>
                  ) : (
                    // MULTI-SEED THINNING CASE (e.g., beans, cucumbers)
                    <>
                      <p>
                        <strong>Planting:</strong> {seedDensityMetadata.seedsPerSpot} seeds per spot
                      </p>
                      <p className="text-xs text-blue-600">
                        Total: {seedDensityMetadata.seedCount} seeds for this planting
                      </p>
                      <p className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-2">
                        <strong>📍 Thinning required:</strong> Thin to {seedDensityMetadata.plantsKeptPerSpot} healthiest plant{seedDensityMetadata.plantsKeptPerSpot === 1 ? '' : 's'} per spot
                      </p>
                      <p>
                        <strong>Germination rate:</strong> {((seedDensityMetadata.expectedGerminationRate || 0) * 100).toFixed(0)}%
                      </p>
                      <p>
                        <strong>Expected germination:</strong> ~{Math.round((seedDensityMetadata.seedCount || 0) * (seedDensityMetadata.expectedGerminationRate || 0))} seedlings
                      </p>
                      <p className="font-semibold text-blue-900 mt-2">
                        Final plants after thinning: {seedDensityMetadata.expectedFinalCount}
                      </p>
                      <p className="text-xs mt-2 text-blue-600 italic">
                        MIGardener plant-spacing method: Plant multiple seeds per spot for insurance, then thin to the healthiest plant.
                      </p>
                    </>
                  )}
                  <p className="text-xs mt-2 text-blue-700">
                    <strong>Harvest method:</strong> {(seedDensityMetadata.harvestMethod || '').replace(/_/g, ' ')}
                  </p>
                </div>
              </>
            ) : (
              // ROW-BASED PLANTING DISPLAY (original)
              <>
                <h4 className="font-semibold text-blue-900 mb-2">🌱 MIGardener Row Density</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    <strong>Seeds per {seedDensityMetadata.uiSegmentLengthInches}" segment:</strong> ~{seedDensityMetadata.seedCount}
                  </p>
                  <p className="text-xs text-blue-600">
                    (UI segment; actual rows are continuous)
                  </p>
                  <p>
                    <strong>Seed density:</strong> {seedDensityMetadata.seedDensity} seeds/inch along row
                  </p>
                  <p>
                    <strong>Row spacing (for {representativePlant.name}):</strong>{' '}
                    {representativePlant.migardener.rowSpacingInches === null ? (
                      <span className="text-green-600 font-medium">Broadcast mode (no rows)</span>
                    ) : (
                      `${representativePlant.migardener.rowSpacingInches}"`
                    )}
                  </p>
                  <p>
                    <strong>Germination rate:</strong> {((seedDensityMetadata.expectedGerminationRate || 0) * 100).toFixed(0)}%
                  </p>
                  <p>
                    <strong>Typical survival estimate:</strong> ~{((seedDensityMetadata.expectedSurvivalRate || 0) * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Actual survival varies with soil fertility, moisture, and temperature
                  </p>
                  <p className="font-semibold text-blue-900 mt-2">
                    Expected final: ~{seedDensityMetadata.expectedFinalCount} plants per {seedDensityMetadata.uiSegmentLengthInches}" segment
                  </p>
                  <p className="text-xs mt-2 text-blue-700">
                    <strong>Harvest method:</strong> {(seedDensityMetadata.harvestMethod || '').replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs mt-2 text-blue-600 italic">
                    MIGardener method plants continuous dense rows (not grid-based). Grid is a UI convenience for planning.
                  </p>
                  <p className="text-xs text-blue-600 mt-2 italic">
                    <strong>Note:</strong> Seeds are sown continuously at ¼″–½″ spacing. Final plant count emerges through natural self-thinning and is not predetermined.
                  </p>
                  {seedDensityMetadata.rowContinuityMessage && (
                    <p className="text-sm mt-2 font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                      🔗 {seedDensityMetadata.rowContinuityMessage}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Companion Plants */}
        {representativePlant && (representativePlant.companionPlants.length > 0 || representativePlant.incompatiblePlants.length > 0) && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-sm font-medium text-green-900 mb-2">🌿 Companion Planting</div>

            {representativePlant.companionPlants.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-green-800 mb-1">✓ Good Companions:</div>
                <div className="flex flex-wrap gap-1">
                  {representativePlant.companionPlants.map((companionId) => {
                    const companion = allPlants.find(p => p.id === companionId);
                    if (!companion) return null;
                    return (
                      <span
                        key={companionId}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-green-300 text-green-700 rounded"
                        title={`${extractCropName(companion.name)} - Plant nearby for mutual benefits`}
                      >
                        <span>{companion.icon || '🌱'}</span>
                        <span>{extractCropName(companion.name)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {representativePlant.incompatiblePlants.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-800 mb-1">✗ Avoid Planting Near:</div>
                <div className="flex flex-wrap gap-1">
                  {representativePlant.incompatiblePlants.map((incompatibleId) => {
                    const incompatible = allPlants.find(p => p.id === incompatibleId);
                    if (!incompatible) return null;
                    return (
                      <span
                        key={incompatibleId}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-red-300 text-red-700 rounded"
                        title={`${extractCropName(incompatible.name)} - Keep away to avoid growth issues`}
                      >
                        <span>{incompatible.icon || '🌱'}</span>
                        <span>{extractCropName(incompatible.name)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-green-700 mt-2">
              Companion planting can improve growth, deter pests, and increase yields.
            </p>
          </div>
        )}

        {/* Variety Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="variety" className="text-sm font-medium text-gray-700">
              Variety {varietyOptions.length >= 1 ? '' : '(optional)'}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCatalogVarieties}
                onChange={(e) => setShowCatalogVarieties(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">Include catalog varieties</span>
            </label>
          </div>

          {varietyOptions.length >= 1 ? (
            <div>
              <select
                id="variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">-- Select variety --</option>
                {varietyOptions.map((opt, index) => (
                  <option key={index} value={opt.variety}>
                    {opt.variety}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {varietyOptions.length} {varietyOptions.length === 1 ? 'variety' : 'varieties'} available for {cropName}
                {showCatalogVarieties && <span className="text-blue-600"> (including catalog)</span>}
                {!showCatalogVarieties && <span className="text-green-600"> (personal seeds only)</span>}
              </p>
            </div>
          ) : (
            <div>
              <input
                type="text"
                id="variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder={`Optional variety name`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {!showCatalogVarieties ? (
                  <>No varieties in your personal inventory. <button type="button" onClick={() => setShowCatalogVarieties(true)} className="text-blue-600 hover:text-blue-700 underline">Check catalog</button> or add a custom variety name.</>
                ) : (
                  'No specific varieties found. You can add a custom variety name.'
                )}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-1 text-sm text-amber-600">{error}</p>
          )}
        </div>

        {/* Seed Lot Selection (only when active plan and variety chosen) */}
        {activePlanId && variety && (
          <div>
            {matchingSeedLots.length > 1 ? (
              <>
                <label htmlFor="seedLot" className="block text-sm font-medium text-gray-700 mb-1">
                  Seed Lot
                </label>
                <select
                  id="seedLot"
                  value={selectedSeedId ?? ''}
                  onChange={(e) => setSelectedSeedId(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">-- Select seed lot --</option>
                  {matchingSeedLots.map((seed) => (
                    <option key={seed.id} value={seed.id}>
                      {seed.brand ? `${seed.brand}` : `Lot #${seed.id}`}
                      {seed.purchaseDate ? ` (purchased ${seed.purchaseDate.slice(0, 10)})` : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : matchingSeedLots.length === 0 ? (
              <p className="text-sm text-amber-600">
                No matching seed in your inventory for {variety}. Add this variety to My Seeds first.
              </p>
            ) : null}
          </div>
        )}

        {/* Trellis Selection (for trellis-required plants) */}
        {representativePlant?.migardener?.trellisRequired && (
          <div>
            <label htmlFor="trellis" className="block text-sm font-medium text-gray-700 mb-1">
              Trellis Structure <span className="text-red-500">*</span>
            </label>
            <select
              id="trellis"
              value={selectedTrellisId || ''}
              onChange={(e) => setSelectedTrellisId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Select a trellis --</option>
              {availableTrellises.map((trellis) => (
                <option key={trellis.id} value={trellis.id}>
                  {trellis.name} ({trellis.totalLengthFeet}ft - {trellis.trellisType.replace('_', ' ')})
                </option>
              ))}
            </select>

            {availableTrellises.length === 0 && (
              <p className="mt-2 text-sm text-orange-600">
                No trellis structures available. Create one in the Property Designer first.
              </p>
            )}

            {trellisCapacity && (
              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm font-medium text-gray-700">Capacity:</p>
                <p className="text-sm text-gray-600">
                  Available: {trellisCapacity.availableFeet.toFixed(1)} ft
                  ({trellisCapacity.percentOccupied.toFixed(0)}% occupied)
                </p>
                {trellisCapacity.availableFeet < (representativePlant.migardener?.linearFeetPerPlant || 5) && (
                  <p className="text-sm text-red-600 mt-1">
                    ⚠️ Insufficient space. This plant requires {representativePlant.migardener?.linearFeetPerPlant || 5} ft.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Planting Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Planting Method
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="plantingMethod"
                value="direct"
                checked={plantingMethod === 'direct'}
                onChange={(e) => setPlantingMethod(e.target.value as 'direct' | 'transplant')}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Direct Seed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="plantingMethod"
                value="transplant"
                checked={plantingMethod === 'transplant'}
                onChange={(e) => setPlantingMethod(e.target.value as 'direct' | 'transplant')}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Transplant</span>
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {plantingMethod === 'direct'
              ? 'Seeds will be sown directly in the garden'
              : 'Seedlings will be transplanted from indoor starts'}
          </p>
        </div>

        {/* Planting Style Selector - Available for ALL methods */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Planting Style
          </label>
          <select
            value={selectedPlantingStyle}
            onChange={(e) => setSelectedPlantingStyle(e.target.value as PlantingStyle)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            {Object.values(PLANTING_STYLES).map(style => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {PLANTING_STYLES[selectedPlantingStyle]?.description}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            💡 Ideal for: {PLANTING_STYLES[selectedPlantingStyle]?.idealFor}
          </p>
        </div>

        {/* Show broadcast density UI if needed */}
        {requiresSeedDensity(selectedPlantingStyle) && selectedPlantingStyle === 'broadcast' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seed Density (seeds per square foot)
            </label>
            <input
              type="number"
              value={seedDensityMetadata?.seedDensityPerSqFt || 16}
              onChange={(e) => setSeedDensityMetadata(prev => ({
                ...prev,
                plantingMethod: 'seed_density_broadcast',
                plantingStyle: 'broadcast',
                seedDensityPerSqFt: Number(e.target.value)
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="1"
              max="100"
            />
            <p className="text-xs text-gray-600 mt-1">
              💡 Typical densities: Spinach 16-20, Lettuce 8-12, Mesclun 25-30, Carrots 30-40
            </p>
          </div>
        )}

        {/* Planting Validation Warnings */}
        {validating && (
          <div className="flex items-center justify-center py-2 text-gray-500">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Checking planting conditions...
          </div>
        )}

        {/* Warnings - Only show after variety selection (if varieties available) */}
        {!validating && warnings.length > 0 && (variety !== '' || varietyOptions.length === 0) && (
          <WarningDisplay
            warnings={warnings}
            onChangeDateClick={onDateChange}
            currentPlantingDate={plantingDate}
          />
        )}

        {/* Planting Date Suggestions - Always show when available, independent of warnings or variety */}
        {!validating && suggestion && (suggestion.optimal_range || suggestion.reason || suggestion.earliest_safe_date) && (
          <WarningDisplay
            warnings={[]}
            suggestion={suggestion}
            onChangeDateClick={onDateChange}
            currentPlantingDate={plantingDate}
          />
        )}

        {/* Quantity - Dual Input for SFG/MIGardener, Single for Others */}
        <div>
          {(planningMethod === 'square-foot' || planningMethod === 'migardener' || planningMethod === 'intensive' || planningMethod === 'permaculture') && !rowNumber ? (
            // Dual-input UI for succession planting (both dense and spread)
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Succession Planting
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="numberOfSquares" className="block text-xs font-medium text-gray-600 mb-1">
                    Number of {quantityTerminology.unitLabel}
                  </label>
                  <input
                    type="number"
                    id="numberOfSquares"
                    min="1"
                    max="100"
                    value={numberOfSquares}
                    onChange={(e) => handleSquaresChange(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label htmlFor="totalPlants" className="block text-xs font-medium text-gray-600 mb-1">
                    {quantityTerminology.totalLabel}
                  </label>
                  <input
                    type="number"
                    id="totalPlants"
                    min="1"
                    max="1600"
                    value={quantity}
                    onChange={(e) => handlePlantsChange(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {quantityTerminology.helpText}
                {plantsPerSquare >= 1 && selectedPlantingStyle !== 'broadcast'
                  ? ` (${Math.floor(plantsPerSquare)} plants per ${quantityTerminology.unitLabel.toLowerCase().slice(0, -1)})`
                  : ''}
              </p>
              {/* Capacity warning when manually-entered quantity exceeds spacing-based capacity */}
              {quantity > Math.max(1, Math.floor(plantsPerSquare)) * numberOfSquares && plantsPerSquare >= 1 && (
                <p className="mt-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Warning: {quantity} plants exceeds the recommended capacity of {Math.max(1, Math.floor(plantsPerSquare)) * numberOfSquares} for {numberOfSquares} cell{numberOfSquares > 1 ? 's' : ''} based on plant spacing.
                </p>
              )}

              {/* Date staggering for dual-input methods (SFG, Intensive, Permaculture, MIGardener grid) */}
              {numberOfSquares > 1 && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="successionPlantingDual"
                      checked={successionPlanting}
                      onChange={(e) => setSuccessionPlanting(e.target.checked)}
                      className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="successionPlantingDual" className="text-sm font-medium text-gray-700">
                      Stagger planting dates
                    </label>
                  </div>

                  {successionPlanting && (
                    <div>
                      <label htmlFor="weekIntervalDual" className="block text-sm font-medium text-gray-700 mb-1">
                        Week Interval
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="weekIntervalDual"
                          min="1"
                          max="8"
                          value={weekInterval}
                          onChange={(e) => setWeekInterval(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <span className="text-sm text-gray-600">week(s) between {quantityTerminology.unitLabel.toLowerCase()}</span>
                      </div>
                      {plantingDate && (
                        <p className="mt-2 text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
                          {quantityTerminology.unitLabel.slice(0, -1)} 1: {new Date(plantingDate).toLocaleDateString()}<br/>
                          {quantityTerminology.unitLabel.slice(0, -1)} {numberOfSquares}: {new Date(new Date(plantingDate).getTime() + (numberOfSquares - 1) * weekInterval * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // Single input for row planting or other methods
            <>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                {rowNumber ? `Number of Rows (starting at Row ${rowNumber})` : 'Quantity'}
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {rowNumber
                  ? `Sow ~${Math.round((bed?.length || 8) * 12 * (representativePlant.migardener?.seedDensityPerInch || 1))} seeds at ~${representativePlant.migardener?.seedDensityPerInch || 1}″ spacing along this ${bed?.length || 8}' row. Final spacing emerges through self-thinning.`
                  : `Number of ${cropName} plants to place at this position`
                }
              </p>

              {/* Succession Planting - Show for MIGardener rows OR SFG multi-square */}
              {((rowNumber && quantity > 1) || (numberOfSquares > 1)) && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="successionPlanting"
                      checked={successionPlanting}
                      onChange={(e) => setSuccessionPlanting(e.target.checked)}
                      className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="successionPlanting" className="text-sm font-medium text-gray-700">
                      Succession Planting (stagger planting dates)
                    </label>
                  </div>

                  {successionPlanting && (
                    <div>
                      <label htmlFor="weekInterval" className="block text-sm font-medium text-gray-700 mb-1">
                        Week Interval
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="weekInterval"
                          min="1"
                          max="8"
                          value={weekInterval}
                          onChange={(e) => setWeekInterval(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <span className="text-sm text-gray-600">week(s) between {quantityTerminology.unitLabel.toLowerCase()}</span>
                      </div>
                      {plantingDate && (
                        <p className="mt-2 text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
                          {rowNumber ? (
                            <>
                              📅 Row {rowNumber}: {new Date(plantingDate).toLocaleDateString()}<br/>
                              📅 Row {rowNumber + quantity - 1}: {new Date(new Date(plantingDate).getTime() + (quantity - 1) * weekInterval * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                            </>
                          ) : (
                            <>
                              📅 {quantityTerminology.unitLabel.slice(0, -1)} 1: {new Date(plantingDate).toLocaleDateString()}<br/>
                              📅 {quantityTerminology.unitLabel.slice(0, -1)} {numberOfSquares}: {new Date(new Date(plantingDate).getTime() + (numberOfSquares - 1) * weekInterval * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this planting..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Cancel
          </button>

          {/* Preview button - show for succession planting (dual-input mode) */}
          {quantity > 1 && !showingPreview && bed && !rowNumber && (
            // For dual-input mode (SFG/MIGardener), show preview when numberOfSquares > 1
            // For single input mode, always show preview when quantity > 1
            // Don't show preview for row planting (rowNumber is set)
            (usesDualInput ? numberOfSquares > 1 : true) && (
              <button
                onClick={handlePreviewPlacement}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {selectedPlantingStyle === 'row'
                  ? `Preview Placement (${quantity} plants, ${numberOfSquares} row${numberOfSquares > 1 ? 's' : ''})`
                  : usesDualInput
                    ? `Preview Placement (${quantity} plants, ${numberOfSquares} ${quantityTerminology.unitLabel.toLowerCase()})`
                    : `Preview Placement (${quantity} plants)`}
              </button>
            )
          )}

          <button
            onClick={handleSave}
            disabled={
              isSubmitting ||
              (activePlanId && variety && matchingSeedLots.length === 0) || // Block: no seed lot for variety
              (activePlanId && variety && matchingSeedLots.length > 1 && !selectedSeedId) || // Block: multiple lots, none selected
              (quantity > 1 &&
                !showingPreview &&
                bed !== undefined &&
                !rowNumber && // Allow saving without preview for MIGardener row planting
                selectedPlantingStyle !== 'row' && // Allow saving without preview for row planting style (auto-generates positions)
                (usesDualInput && numberOfSquares > 1)) // Disable for succession planting without preview
            }
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 ${
              (quantity > 1 && !showingPreview && bed !== undefined && !rowNumber && (usesDualInput && numberOfSquares > 1))
                || (activePlanId && variety && (matchingSeedLots.length === 0 || (matchingSeedLots.length > 1 && !selectedSeedId)))
                ? 'bg-gray-400 cursor-not-allowed'
                : warnings.some(w => w.severity === 'warning')
                ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            }`}
          >
            {warnings.some(w => w.severity === 'warning') && (
              <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-white text-yellow-700 rounded-full">
                {warnings.filter(w => w.severity === 'warning').length}
              </span>
            )}
            {/* Dynamic button text based on planting style */}
            {rowNumber
              ? `Seed ${quantity} Row${quantity > 1 ? 's' : ''}`
              : selectedPlantingStyle === 'broadcast'
                ? 'Seed Coverage Area'
                : selectedPlantingStyle === 'row'
                  ? (showingPreview
                    ? `Place ${previewPositions.length} Plants`
                    : `Place ${quantity} Plants (${numberOfSquares} Row${numberOfSquares > 1 ? 's' : ''})`)
                  : showingPreview
                    ? `Place ${previewPositions.length} Plants`
                    : `Place ${quantity} Plants${usesDualInput && numberOfSquares > 1 ? ` (${numberOfSquares} ${quantityTerminology.unitLabel})` : ''}`}
            {warnings.some(w => w.severity === 'warning') && !showingPreview && !rowNumber ? ' Anyway' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PlantConfigModal;
