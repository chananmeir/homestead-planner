import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Plant, ValidationWarning, SeedInventoryItem, GardenBed } from '../../types';
import { API_BASE_URL } from '../../config';
import { extractCropName, groupPlantsByCrop, getRepresentativePlant } from '../../utils/plantUtils';
import PlantIcon from './PlantIcon';

interface PlantPaletteProps {
  plants: Plant[];
  plantingDate?: string;  // Current date from date filter
  onPlantSelect?: (plant: Plant) => void;
  onQuickHarvestChange?: (days: number | null) => void;  // Callback for Quick Harvest Filter changes
}

interface PlantValidationStatus {
  seed: {
    valid: boolean;
    warnings: ValidationWarning[];
  };
  transplant: {
    valid: boolean;
    warnings: ValidationWarning[];
  };
  indoor_start?: {
    valid: boolean;
    weeks_until_transplant?: number;
    transplant_target_date?: string;
  };
}

type CategoryFilter = 'all' | 'vegetable' | 'herb' | 'flower' | 'fruit';
type LifecycleFilter = 'all' | 'annual' | 'biennial' | 'perennial';

const PlantPalette: React.FC<PlantPaletteProps> = ({ plants, plantingDate, onPlantSelect, onQuickHarvestChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [selectedLifecycle, setSelectedLifecycle] = useState<LifecycleFilter>('all');
  const [validationStatus, setValidationStatus] = useState<Record<string, PlantValidationStatus>>({});
  const [, setValidating] = useState(false);
  const [showMySeedsOnly, setShowMySeedsOnly] = useState(false);
  const [mySeedData, setMySeedData] = useState<SeedInventoryItem[]>([]);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [plantingMethod, setPlantingMethod] = useState<'seed' | 'transplant'>('seed');
  const [daysToHarvestFilter, setDaysToHarvestFilter] = useState<number | null>(null);
  const [showDaysToHarvestFilter, setShowDaysToHarvestFilter] = useState(false);

  // Collapsible section state - Load from localStorage or default to true
  const [isSearchExpanded, setIsSearchExpanded] = useState(() => {
    const saved = localStorage.getItem('plantPalette_searchExpanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isLifecycleExpanded, setIsLifecycleExpanded] = useState(() => {
    const saved = localStorage.getItem('plantPalette_lifecycleExpanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isQuickHarvestExpanded, setIsQuickHarvestExpanded] = useState(() => {
    const saved = localStorage.getItem('plantPalette_quickHarvestExpanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Persist collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('plantPalette_searchExpanded', JSON.stringify(isSearchExpanded));
  }, [isSearchExpanded]);

  useEffect(() => {
    localStorage.setItem('plantPalette_lifecycleExpanded', JSON.stringify(isLifecycleExpanded));
  }, [isLifecycleExpanded]);

  useEffect(() => {
    localStorage.setItem('plantPalette_quickHarvestExpanded', JSON.stringify(isQuickHarvestExpanded));
  }, [isQuickHarvestExpanded]);

  // Notify parent component when Quick Harvest Filter changes
  useEffect(() => {
    if (onQuickHarvestChange) {
      onQuickHarvestChange(showDaysToHarvestFilter ? daysToHarvestFilter : null);
    }
  }, [daysToHarvestFilter, showDaysToHarvestFilter, onQuickHarvestChange]);

  // Filter plants based on search and category, then deduplicate by crop type
  const filteredPlants = useMemo(() => {
    return plants
      .filter(plant => {
        const matchesSearch = plant.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || plant.category === selectedCategory;
        const matchesLifecycle = selectedLifecycle === 'all' || plant.lifecycle === selectedLifecycle;

        // My Seeds filter - only show plants that have matching personal seeds (exclude global catalog)
        const matchesSeeds = !showMySeedsOnly ||
          mySeedData.some(seed => seed.plantId === plant.id && seed.isGlobal !== true);

        // Days to Harvest filter - only show plants that mature within X days
        const matchesDaysToHarvest = !showDaysToHarvestFilter ||
          daysToHarvestFilter === null ||
          (plant.daysToMaturity && plant.daysToMaturity <= daysToHarvestFilter);

        return matchesSearch && matchesCategory && matchesLifecycle && matchesSeeds && matchesDaysToHarvest;
      });
  }, [plants, searchTerm, selectedCategory, selectedLifecycle, showMySeedsOnly, mySeedData, showDaysToHarvestFilter, daysToHarvestFilter]);

  // Deduplicate plants by crop name (group varieties together)
  const deduplicatedPlants = useMemo(() => {
    const cropMap = groupPlantsByCrop(filteredPlants);

    // Get representative plant for each crop group
    const representatives = Array.from(cropMap.values()).map(varieties =>
      getRepresentativePlant(varieties)
    );

    // Sort alphabetically by crop name
    return representatives.sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredPlants]);

  // Batch validate plants when date changes
  useEffect(() => {
    if (!plantingDate) {
      setValidationStatus({});
      return;
    }

    if (deduplicatedPlants.length === 0) {
      setValidationStatus({});
      return;
    }

    const validatePlants = async () => {
      // Abort any in-flight validation request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setValidating(true);

      try {
        const zipcode = localStorage.getItem('weatherZipCode');

        if (!zipcode) {
          console.warn('[PlantPalette] No zipcode set - validation skipped. Set location in Weather Dashboard.');
          setValidationStatus({});
          setValidating(false);
          return;
        }

        // Validate the deduplicated plants the user actually sees (cap at 50)
        const plantsToValidate = deduplicatedPlants.slice(0, 50);
        const plantIds = plantsToValidate.map(p => p.id);

        const response = await fetch(`${API_BASE_URL}/api/validate-plants-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: abortController.signal,  // Pass abort signal
          body: JSON.stringify({
            plantIds: plantIds,
            plantingDate: plantingDate,
            zipcode: zipcode,
            bedId: selectedBedId || undefined,  // Pass selected bed for season extension
            plantingMethod: plantingMethod  // Use selected planting method
          })
        });

        if (!response.ok) {
          // Silently handle validation endpoint not existing (it was removed during refactoring)
          // Plant palette still works without validation warnings
          if (process.env.NODE_ENV === 'development' && response.status !== 404) {
            console.warn('[PlantPalette] Batch validation endpoint unavailable:', response.status);
          }
          setValidating(false);
          return;
        }

        const data = await response.json();

        // Backend returns { results: { plantId: {...} }, date, zipcode }
        // We need just the results object
        const results = data.results || {};
        setValidationStatus(results);
      } catch (err) {
        // Ignore abort errors - these are expected when a new request supersedes the old one
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Silently handle network errors - validation endpoint may not exist
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PlantPalette] Plant validation unavailable (endpoint may not exist)');
        }
      } finally {
        // Only clear validating state if this request wasn't aborted
        if (!abortController.signal.aborted) {
          setValidating(false);
        }
      }
    };

    validatePlants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantingDate, deduplicatedPlants, selectedBedId, plantingMethod]);

  // Fetch user's seed inventory + global catalog on mount
  useEffect(() => {
    const fetchMySeeds = async () => {
      setLoadingSeeds(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/my-seeds?includeGlobal=true`, {
          credentials: 'include'
        });
        if (response.ok) {
          const seeds = await response.json();
          setMySeedData(seeds);
        } else {
          console.warn('[PlantPalette] Failed to load seed inventory:', response.status);
        }
      } catch (error) {
        console.error('[PlantPalette] Error loading seed inventory:', error);
      } finally {
        setLoadingSeeds(false);
      }
    };

    fetchMySeeds();
  }, []);

  // Fetch user's garden beds on mount
  useEffect(() => {
    const fetchGardenBeds = async () => {
      setLoadingBeds(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/garden-beds`, {
          credentials: 'include'
        });
        if (response.ok) {
          const beds = await response.json();
          setGardenBeds(beds);
        } else {
          console.warn('[PlantPalette] Failed to load garden beds:', response.status);
        }
      } catch (error) {
        console.error('[PlantPalette] Error loading garden beds:', error);
      } finally {
        setLoadingBeds(false);
      }
    };

    fetchGardenBeds();
  }, []);

  // Helper function to count seed varieties for a plant (personal seeds only, exclude global catalog)
  const getSeedVarietyCount = (plantId: string): number => {
    return mySeedData.filter(seed => seed.plantId === plantId && seed.isGlobal !== true).length;
  };

  // Category tabs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const categories: { id: CategoryFilter; label: string; emoji: string }[] = [
    { id: 'all', label: 'All', emoji: '🌱' },
    { id: 'vegetable', label: 'Vegetables', emoji: '🥕' },
    { id: 'herb', label: 'Herbs', emoji: '🌿' },
    { id: 'flower', label: 'Flowers', emoji: '🌸' },
    { id: 'fruit', label: 'Fruits', emoji: '🍓' },
  ];

  return (
    <div className="w-[280px] bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800">Plant Palette</h3>
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
              title={isSearchExpanded ? "Collapse filters" : "Expand filters"}
            >
              <span className="text-sm font-bold">{isSearchExpanded ? '▲' : '▼'}</span>
            </button>
          </div>

          {isSearchExpanded && (
            <>
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search plants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />

              {/* Bed Selector */}
              {gardenBeds.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    View recommendations for:
                  </label>
                  <select
                    value={selectedBedId || ''}
                    onChange={(e) => setSelectedBedId(e.target.value ? Number(e.target.value) : null)}
                    disabled={loadingBeds}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">No Bed (generic conditions)</option>
                    {gardenBeds.map((bed) => (
                      <option key={bed.id} value={bed.id}>
                        {bed.name}
                        {bed.width && bed.length ? ` (${bed.width}'×${bed.length}')` : ''}
                        {bed.seasonExtension?.type && bed.seasonExtension.type !== 'none'
                          ? ` - ${bed.seasonExtension.type.replace('-', ' ')}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Planting Method Toggle */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Planting method:
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="plantingMethod"
                      value="seed"
                      checked={plantingMethod === 'seed'}
                      onChange={(e) => setPlantingMethod('seed')}
                      className="w-3.5 h-3.5 text-green-600 border-gray-300 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Seeds</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="plantingMethod"
                      value="transplant"
                      checked={plantingMethod === 'transplant'}
                      onChange={(e) => setPlantingMethod('transplant')}
                      className="w-3.5 h-3.5 text-green-600 border-gray-300 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Transplants</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* My Seeds Toggle */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showMySeedsOnly}
            onChange={(e) => setShowMySeedsOnly(e.target.checked)}
            disabled={loadingSeeds}
            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-700">
            My Seeds Only
            {loadingSeeds && <span className="text-xs text-gray-500 ml-1">(loading...)</span>}
            {!loadingSeeds && mySeedData.length > 0 && (
              <span className="text-xs text-gray-500 ml-1">({mySeedData.filter(s => s.isGlobal !== true).length} varieties)</span>
            )}
          </span>
        </label>
      </div>

      {/* Category Filter - Compact Dropdown */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Category:
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as CategoryFilter)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">🌱 All Plants</option>
          <option value="vegetable">🥕 Vegetables</option>
          <option value="herb">🌿 Herbs</option>
          <option value="flower">🌸 Flowers</option>
          <option value="fruit">🍓 Fruits</option>
        </select>
      </div>

      {/* Lifecycle Filter - Compact Dropdown */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-600">
            Lifecycle:
          </label>
          <button
            onClick={() => setIsLifecycleExpanded(!isLifecycleExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors p-0.5"
            title={isLifecycleExpanded ? "Collapse" : "Expand"}
          >
            <span className="text-xs font-bold">{isLifecycleExpanded ? '▲' : '▼'}</span>
          </button>
        </div>
        {isLifecycleExpanded && (
          <select
            value={selectedLifecycle}
            onChange={(e) => setSelectedLifecycle(e.target.value as LifecycleFilter)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Lifecycles</option>
            <option value="annual">Annual (1 season)</option>
            <option value="biennial">Biennial (2 years)</option>
            <option value="perennial">Perennial (multi-year)</option>
          </select>
        )}
      </div>

      {/* Days to Harvest Filter */}
      <div className="p-3 border-b border-gray-200 bg-amber-50">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDaysToHarvestFilter}
              onChange={(e) => {
                setShowDaysToHarvestFilter(e.target.checked);
                if (!e.target.checked) {
                  setDaysToHarvestFilter(null);
                } else if (daysToHarvestFilter === null) {
                  setDaysToHarvestFilter(60); // Default to 60 days
                }
              }}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">
              ⏱️ Quick Harvest Filter
            </span>
          </label>
          {showDaysToHarvestFilter && (
            <button
              onClick={() => setIsQuickHarvestExpanded(!isQuickHarvestExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-colors p-0.5"
              title={isQuickHarvestExpanded ? "Collapse" : "Expand"}
            >
              <span className="text-xs font-bold">{isQuickHarvestExpanded ? '▲' : '▼'}</span>
            </button>
          )}
        </div>

        {showDaysToHarvestFilter && !isQuickHarvestExpanded && (
          <p className="text-xs text-amber-700 font-medium">
            ⏱️ {daysToHarvestFilter || 60} days or less
          </p>
        )}

        {showDaysToHarvestFilter && isQuickHarvestExpanded && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 whitespace-nowrap">Ready within:</span>
              <input
                type="number"
                min="7"
                max="365"
                step="7"
                value={daysToHarvestFilter || 60}
                onChange={(e) => setDaysToHarvestFilter(Number(e.target.value))}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-600">days</span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-1">
              {[30, 45, 60, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setDaysToHarvestFilter(days)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    daysToHarvestFilter === days
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-amber-100 border border-gray-300'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            {/* Info text */}
            <p className="text-xs text-gray-600 leading-tight">
              Shows crops that can be harvested in {daysToHarvestFilter || 60} days or less
            </p>
          </div>
        )}
      </div>

      {/* Plant List */}
      <div className="flex-1 overflow-y-auto p-2">
        {deduplicatedPlants.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No plants found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {deduplicatedPlants.map(plant => (
              <DraggablePlantItem
                key={plant.id}
                plant={plant}
                validationStatus={validationStatus[plant.id]}
                onSelect={onPlantSelect}
                showMySeedsOnly={showMySeedsOnly}
                seedVarietyCount={getSeedVarietyCount(plant.id)}
                plantingMethod={plantingMethod}
                showDaysToHarvestFilter={showDaysToHarvestFilter}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-600 text-center">
          Drag plants onto the garden grid
        </p>
      </div>
    </div>
  );
};

// Draggable Plant Item Component
interface DraggablePlantItemProps {
  plant: Plant;
  validationStatus?: PlantValidationStatus;
  onSelect?: (plant: Plant) => void;
  showMySeedsOnly: boolean;
  seedVarietyCount: number;
  plantingMethod: 'seed' | 'transplant';
  showDaysToHarvestFilter: boolean;
}

const DraggablePlantItem: React.FC<DraggablePlantItemProps> = ({
  plant,
  validationStatus,
  onSelect,
  showMySeedsOnly,
  seedVarietyCount,
  plantingMethod,
  showDaysToHarvestFilter
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `plant-${plant.id}`,
    data: {
      ...plant,
      cropName: extractCropName(plant.name), // Include crop name for variety lookup
    },
  });

  // Determine validation indicator based on selected planting method
  const getValidationIndicator = () => {
    if (!validationStatus) {
      // No validation data for this plant
      return null;
    }

    // Use validation for selected planting method (seed or transplant)
    const methodValidation = plantingMethod === 'seed' ? validationStatus.seed : validationStatus.transplant;
    if (!methodValidation) {
      console.warn(`[DraggablePlantItem] No ${plantingMethod} validation for`, plant.id, validationStatus);
      return null;
    }

    const warningLevel = methodValidation.warnings.filter(w => w.severity === 'warning').length;
    const hasWarnings = warningLevel > 0;
    const hasInfo = methodValidation.warnings.some(w => w.severity === 'info');

    if (hasWarnings) {
      return {
        icon: '⚠️',
        color: 'text-yellow-500',
        tooltip: methodValidation.warnings.find(w => w.severity === 'warning')?.message || 'Planting conditions not ideal'
      };
    } else if (hasInfo) {
      return {
        icon: 'ℹ️',
        color: 'text-blue-500',
        tooltip: methodValidation.warnings.find(w => w.severity === 'info')?.message || 'Planting information available'
      };
    } else if (methodValidation.valid) {
      return { icon: '✓', color: 'text-green-500', tooltip: 'Good conditions for planting' };
    }

    return null;
  };

  const indicator = getValidationIndicator();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={!isDragging ? () => onSelect?.(plant) : undefined}
      className={`bg-transparent p-2 rounded cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-0' : 'hover:bg-gray-100'
      } group relative`}
      title={indicator?.tooltip}
    >
      <div className="flex items-center gap-2">
        {/* Plant Icon */}
        <PlantIcon
          plantId={plant.id}
          plantIcon={plant.icon || '🌱'}
          size={32}
          className="flex-shrink-0"
        />

        {/* Plant Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate flex items-center gap-1">
            <span className="truncate">{plant.name}</span>
            {plant.lifecycle === 'perennial' && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 text-xs font-bold text-white bg-purple-600 rounded"
                title="Perennial - Returns year after year"
              >
                P
              </span>
            )}
            {plant.lifecycle === 'biennial' && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 text-xs font-bold text-white bg-blue-600 rounded"
                title="Biennial - 2-year lifecycle"
              >
                B
              </span>
            )}
            {showMySeedsOnly && seedVarietyCount > 0 && (
              <span className="text-xs text-gray-500 ml-1 font-normal">
                ({seedVarietyCount} {seedVarietyCount === 1 ? 'variety' : 'varieties'})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-1 flex-wrap">
            <span>{plant.spacing}" spacing</span>
            <span>•</span>
            {showDaysToHarvestFilter ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                ⏱️ {plant.daysToMaturity}d
              </span>
            ) : (
              <span>{plant.daysToMaturity}d</span>
            )}
            {plant.lifecycle === 'perennial' && plant.yearsToMaturity && (
              <>
                <span>•</span>
                <span className="text-purple-600 font-medium">
                  {plant.yearsToMaturity}y to mature
                </span>
              </>
            )}
          </div>
        </div>

        {/* Validation Indicator */}
        {indicator && (
          <div className={`text-base flex-shrink-0 ${indicator.color}`}>
            {indicator.icon}
          </div>
        )}
      </div>

      {/* Tooltip on hover */}
      {indicator?.tooltip && (
        <div className="absolute left-0 right-0 top-full mt-1 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {indicator.tooltip}
        </div>
      )}
    </div>
  );
};

export default PlantPalette;
