import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast, SearchBar, SortDropdown, FilterBar } from './common';
import type { SortOption, SortDirection, FilterGroup } from './common';
import { AddFromCatalogModal } from './SeedInventory/AddFromCatalogModal';
import { CSVImportModal } from './SeedInventory/CSVImportModal';
import { useAuth } from '../contexts/AuthContext';

import { API_BASE_URL } from '../config';

interface Seed {
  id: number;
  plantId: string;
  variety: string;
  brand?: string;
  isGlobal: boolean;

  // Variety-specific agronomic data
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

interface Plant {
  id: string;
  name: string;
  category: string;
  daysToMaturity: number;
  germinationTemp: { min: number; max: number };
  idealSeasons?: ('spring' | 'summer' | 'fall' | 'winter')[];
}

// Helper function for DTM filtering
const filterByDaysToMaturity = (
  seeds: Seed[],
  getPlantInfo: (id: string) => Plant | undefined,
  min: string,
  max: string
): Seed[] => {
  const dtmMinVal = min ? parseInt(min, 10) : null;
  const dtmMaxVal = max ? parseInt(max, 10) : null;
  if (dtmMinVal === null && dtmMaxVal === null) return seeds;

  return seeds.filter(seed => {
    const dtm = seed.daysToMaturity !== undefined && seed.daysToMaturity !== null
      ? seed.daysToMaturity
      : getPlantInfo(seed.plantId)?.daysToMaturity;

    if (dtm === undefined || dtm === null) return true;

    if (dtmMinVal !== null && dtm < dtmMinVal) return false;
    if (dtmMaxVal !== null && dtm > dtmMaxVal) return false;
    return true;
  });
};

// Helper function for soil temperature filtering
const filterBySoilTemperature = (
  seeds: Seed[],
  getPlantInfo: (id: string) => Plant | undefined,
  min: string,
  max: string
): Seed[] => {
  const soilTempMinVal = min ? parseFloat(min) : null;
  const soilTempMaxVal = max ? parseFloat(max) : null;
  if (soilTempMinVal === null && soilTempMaxVal === null) return seeds;

  return seeds.filter(seed => {
    const plant = getPlantInfo(seed.plantId);
    if (!plant || !plant.germinationTemp) return true;

    const plantTempMin = plant.germinationTemp.min;
    const plantTempMax = plant.germinationTemp.max;

    const userMin = soilTempMinVal ?? plantTempMin;
    const userMax = soilTempMaxVal ?? plantTempMax;

    const overlaps = plantTempMax >= userMin && plantTempMin <= userMax;
    return overlaps;
  });
};

const SeedCatalog: React.FC = () => {
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeed, setSelectedSeed] = useState<Seed | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVarieties, setTotalVarieties] = useState(0);
  const itemsPerPage = 100;

  // Available crops for filtering
  const [availableCrops, setAvailableCrops] = useState<Array<{plant_id: string, variety_count: number}>>([]);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState<string>('plantId');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Custom range filters
  const [dtmMin, setDtmMin] = useState<string>('');
  const [dtmMax, setDtmMax] = useState<string>('');
  const [soilTempMin, setSoilTempMin] = useState<string>('');
  const [soilTempMax, setSoilTempMax] = useState<string>('');

  useEffect(() => {
    loadPlants();
    loadAvailableCrops();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSeeds(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, activeFilters, searchQuery]);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeFilters]);

  const loadPlants = async () => {
    try {
      // Try loading from cache first
      const cachedPlants = localStorage.getItem('homestead_plants_cache');
      if (cachedPlants) {
        const { data, timestamp } = JSON.parse(cachedPlants);
        // Cache plants for 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setPlants(data);
          return;
        }
      }

      // Load plants from API
      const plantResponse = await fetch(`${API_BASE_URL}/api/plants`, { credentials: 'include' });
      if (!plantResponse.ok) {
        throw new Error('Failed to fetch plants');
      }
      const plantData = await plantResponse.json();
      setPlants(Array.isArray(plantData) ? plantData : []);

      // Cache plants
      localStorage.setItem('homestead_plants_cache', JSON.stringify({
        data: plantData,
        timestamp: Date.now()
      }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading plants:', error);
      }
      showError('Failed to load plant data');
      setPlants([]);
    }
  };

  const loadAvailableCrops = async () => {
    try {
      // Try loading from cache first
      const cachedCrops = localStorage.getItem('homestead_available_crops_cache');
      if (cachedCrops) {
        const { data, timestamp } = JSON.parse(cachedCrops);
        // Cache for 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setAvailableCrops(data);
          return;
        }
      }

      // Load available crops from API
      const response = await fetch(`${API_BASE_URL}/api/seed-catalog/available-crops`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch available crops');
      }
      const data = await response.json();
      setAvailableCrops(Array.isArray(data) ? data : []);

      // Cache available crops
      localStorage.setItem('homestead_available_crops_cache', JSON.stringify({
        data: data,
        timestamp: Date.now()
      }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading available crops:', error);
      }
      setAvailableCrops([]);
    }
  };

  const loadSeeds = async (page: number) => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString()
      });

      // Add crop filter (maps to plant_id)
      const cropFilters = activeFilters['crop'] || [];
      if (cropFilters.length > 0) {
        // For now, send first selected crop (backend doesn't support multiple)
        // TODO: Update backend to support multiple plant_ids
        params.append('plant_id', cropFilters[0]);
      }

      // Add search query
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      // Try loading from cache first (only for page 1 with no filters or search)
      const hasFilters = cropFilters.length > 0 || searchQuery.trim().length > 0;
      if (page === 1 && !hasFilters) {
        const cachedSeeds = localStorage.getItem('homestead_seed_catalog_cache');
        if (cachedSeeds) {
          const { data, pagination, timestamp } = JSON.parse(cachedSeeds);
          // Cache for 1 hour
          if (Date.now() - timestamp < 60 * 60 * 1000) {
            setSeeds(data);
            setTotalPages(pagination.pages);
            setTotalVarieties(pagination.total);
            setLoading(false);
            return;
          }
        }
      }

      // Load catalog seeds with pagination and filters
      const seedResponse = await fetch(
        `${API_BASE_URL}/api/seed-catalog?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!seedResponse.ok) {
        throw new Error('Failed to fetch seed catalog');
      }
      const seedData = await seedResponse.json();

      setSeeds(Array.isArray(seedData.seeds) ? seedData.seeds : []);
      setTotalPages(seedData.pagination?.pages || 1);
      setTotalVarieties(seedData.pagination?.total || 0);

      // Cache first page only (when no filters applied)
      if (page === 1 && !hasFilters) {
        localStorage.setItem('homestead_seed_catalog_cache', JSON.stringify({
          data: seedData.seeds,
          pagination: seedData.pagination,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading seed catalog:', error);
      }
      showError('Failed to load seed catalog');
      setSeeds([]);
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => {
    // Clear cache and reload
    localStorage.removeItem('homestead_seed_catalog_cache');
    loadPlants();
    loadSeeds(currentPage);
  };

  const getPlantInfo = useCallback((plantId: string): Plant | undefined => {
    return plants.find(p => p.id === plantId);
  }, [plants]);

  const getPlantName = useCallback((plantId: string): string => {
    const plant = getPlantInfo(plantId);
    return plant?.name || plantId;
  }, [getPlantInfo]);

  const handleAddToInventory = (seed: Seed) => {
    setSelectedSeed(seed);
    setIsAddModalOpen(true);
  };

  // Export filtered/sorted seeds to CSV
  const handleExportCSV = async () => {
    try {
      setLoading(true);
      showSuccess('Preparing export... fetching all varieties');

      // Fetch all pages with current filters
      const allSeeds: Seed[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '1000' // Fetch in larger batches for export
        });

        // Apply same filters as loadSeeds
        const cropFilters = activeFilters['crop'] || [];
        if (cropFilters.length > 0) {
          params.append('plant_id', cropFilters[0]);
        }

        if (searchQuery.trim()) {
          params.append('search', searchQuery.trim());
        }

        const response = await fetch(`${API_BASE_URL}/api/seed-catalog?${params}`, {
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch seeds');

        const data = await response.json();
        allSeeds.push(...(data.seeds || []));

        hasMore = page < (data.pagination?.pages || 1);
        page++;
      }

      // Apply client-side filters (DTM, soil temp, category, variety, seasons)
      let filtered = [...allSeeds];
      filtered = filterByDaysToMaturity(filtered, getPlantInfo, dtmMin, dtmMax);
      filtered = filterBySoilTemperature(filtered, getPlantInfo, soilTempMin, soilTempMax);

      // Apply category filter
      const categoryFilters = activeFilters['category'] || [];
      if (categoryFilters.length > 0) {
        filtered = filtered.filter(seed => {
          const plant = getPlantInfo(seed.plantId);
          return plant && categoryFilters.includes(plant.category);
        });
      }

      // Apply variety filter
      const varietyFilters = activeFilters['variety'] || [];
      if (varietyFilters.length > 0) {
        filtered = filtered.filter(seed => varietyFilters.includes(seed.variety));
      }

      // Apply season filter
      const seasonFilters = activeFilters['seasons'] || [];
      if (seasonFilters.length > 0) {
        filtered = filtered.filter(seed => {
          const plant = getPlantInfo(seed.plantId);
          if (!plant || !plant.idealSeasons) return false;
          return seasonFilters.some(season =>
            plant.idealSeasons?.includes(season as 'spring' | 'summer' | 'fall' | 'winter')
          );
        });
      }

      // Apply sorting
      filtered.sort((a, b) => {
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
          case 'daysToMaturity':
            aValue = a.daysToMaturity ?? -1;
            bValue = b.daysToMaturity ?? -1;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      // CSV header
      const headers = [
        'Plant',
        'Variety',
        'Brand',
        'Days to Maturity',
        'Germination Days',
        'Germination Temp Min (°F)',
        'Germination Temp Max (°F)',
        'Soil Temp Min (°F)',
        'Plant Spacing (in)',
        'Row Spacing (in)',
        'Planting Depth (in)',
        'Heat Tolerance',
        'Cold Tolerance',
        'Bolt Resistance',
        'Ideal Seasons',
        'Flavor Profile',
        'Storage Rating'
      ];

      // Build CSV rows from filtered data
      const rows = filtered.map(seed => [
        getPlantName(seed.plantId),
        seed.variety || '',
        seed.brand || '',
        seed.daysToMaturity?.toString() || '',
        seed.germinationDays?.toString() || '',
        seed.germinationTempMin?.toString() || '',
        seed.germinationTempMax?.toString() || '',
        seed.soilTempMin?.toString() || '',
        seed.plantSpacing?.toString() || '',
        seed.rowSpacing?.toString() || '',
        seed.plantingDepth?.toString() || '',
        seed.heatTolerance || '',
        seed.coldTolerance || '',
        seed.boltResistance || '',
        seed.idealSeasons || '',
        seed.flavorProfile || '',
        seed.storageRating || ''
      ]);

      // Convert to CSV format
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(field => {
          // Escape fields with commas or quotes
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        }).join(','))
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `seed-catalog-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess(`Exported ${filtered.length} varieties to CSV`);
    } catch (error) {
      console.error('Export failed:', error);
      showError('Failed to export seed catalog');
    } finally {
      setLoading(false);
    }
  };

  // Base filtered seeds - apply DTM and soil temp filters
  // Note: Search and crop filtering are handled server-side in loadSeeds()
  const baseFilteredSeeds = useMemo(() => {
    let result = [...seeds];

    // Search filter is handled server-side (no client-side search needed)

    // Apply DTM range filter
    result = filterByDaysToMaturity(result, getPlantInfo, dtmMin, dtmMax);

    // Apply soil temperature range filter
    result = filterBySoilTemperature(result, getPlantInfo, soilTempMin, soilTempMax);

    return result;
  }, [seeds, getPlantInfo, dtmMin, dtmMax, soilTempMin, soilTempMax]);

  // Extract categories and plant names from baseFilteredSeeds
  const categories = Array.from(new Set(
    baseFilteredSeeds.map(s => {
      const plant = getPlantInfo(s.plantId);
      return plant?.category;
    }).filter((cat): cat is string => cat !== undefined)
  ));

  // const plantNames = Array.from(new Set(
  //   baseFilteredSeeds.map(s => {
  //     const plant = getPlantInfo(s.plantId);
  //     return plant?.name;
  //   }).filter((name): name is string => name !== undefined)
  // )).sort();

  // Extract seasons
  const seasons = Array.from(new Set(
    baseFilteredSeeds.flatMap(s => {
      const plant = getPlantInfo(s.plantId);
      return plant?.idealSeasons || [];
    })
  )).sort();

  const sortOptions: SortOption[] = [
    { value: 'plantId', label: 'Plant Name' },
    { value: 'variety', label: 'Variety' },
    { value: 'daysToMaturity', label: 'Days to Maturity' },
  ];

  // Filter groups
  const filterGroups: FilterGroup[] = useMemo(() => {
    // Recalculate varietySeeds inside useMemo for proper dependency tracking
    const cropFilters = activeFilters['crop'] || [];
    let varietySeeds = baseFilteredSeeds;
    if (cropFilters.length > 0) {
      varietySeeds = baseFilteredSeeds.filter(seed => {
        const plant = getPlantInfo(seed.plantId);
        return plant && cropFilters.includes(plant.name);
      });
    }
    const varieties = Array.from(new Set(
      varietySeeds.map(s => s.variety).filter(v => v !== undefined && v !== null && v.trim() !== '')
    ));

    return [
      {
        id: 'category',
        label: 'Category',
        options: categories.map(cat => ({
          value: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          count: baseFilteredSeeds.filter(s => {
            const plant = getPlantInfo(s.plantId);
            return plant?.category === cat;
          }).length,
        })),
      },
      {
        id: 'variety',
        label: 'Variety/Type',
        options: varieties.map(variety => ({
          value: variety,
          label: variety,
          count: varietySeeds.filter(s => s.variety === variety).length,
        })),
      },
      {
        id: 'crop',
        label: 'Crop/Plant',
        options: availableCrops
          .map(crop => {
            const plant = getPlantInfo(crop.plant_id);
            return plant ? {
              value: crop.plant_id,  // Send plant_id to backend
              label: plant.name,     // Display plant name to user
              count: crop.variety_count,
            } : null;
          })
          .filter((option): option is { value: string; label: string; count: number } => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
      {
        id: 'seasons',
        label: 'Planting Season',
        options: seasons.map(season => ({
          value: season,
          label: season.charAt(0).toUpperCase() + season.slice(1),
          count: baseFilteredSeeds.filter(s => {
            const plant = getPlantInfo(s.plantId);
            return plant?.idealSeasons?.includes(season);
          }).length,
        })),
      },
    ];
  }, [baseFilteredSeeds, categories, seasons, getPlantInfo, activeFilters, availableCrops]);

  const handleFilterChange = (groupId: string, values: string[]) => {
    // For crop filter, only allow single selection (backend limitation)
    if (groupId === 'crop' && values.length > 1) {
      // Keep only the most recent selection
      setActiveFilters(prev => ({
        ...prev,
        [groupId]: [values[values.length - 1]],
      }));
    } else {
      setActiveFilters(prev => ({
        ...prev,
        [groupId]: values,
      }));
    }
    // Reset to page 1 when filters change
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
  };

  const handleSortChange = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
  };

  // Apply filters and sorting
  const filteredAndSortedSeeds = useMemo(() => {
    let result = [...baseFilteredSeeds];

    // Category filters
    const categoryFilters = activeFilters['category'] || [];
    if (categoryFilters.length > 0) {
      result = result.filter(seed => {
        const plant = getPlantInfo(seed.plantId);
        return plant && categoryFilters.includes(plant.category);
      });
    }

    // Variety filters
    const varietyFilters = activeFilters['variety'] || [];
    if (varietyFilters.length > 0) {
      result = result.filter(seed => varietyFilters.includes(seed.variety));
    }

    // Crop filters (server-side filtering via pagination API)
    // Note: Crop filtering is handled server-side in loadSeeds()
    // We don't need to filter again here since the backend already filtered by plant_id
    // Keeping this block for other client-side filters (category, variety, seasons)

    // Season filters
    const seasonFilters = activeFilters['seasons'] || [];
    if (seasonFilters.length > 0) {
      result = result.filter(seed => {
        const plant = getPlantInfo(seed.plantId);
        if (!plant || !plant.idealSeasons) return false;
        return seasonFilters.some(season =>
          plant.idealSeasons?.includes(season as 'spring' | 'summer' | 'fall' | 'winter')
        );
      });
    }

    // Sorting
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
        case 'daysToMaturity':
          aValue = a.daysToMaturity ?? -1;
          bValue = b.daysToMaturity ?? -1;
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

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Global Seed Catalog</h2>
            <p className="text-gray-600 mt-2">
              Browse available seed varieties. Click "Add to My Inventory" to track your own seeds.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              disabled={filteredAndSortedSeeds.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to CSV
            </button>

            {user?.isAdmin && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import Seeds
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">{totalVarieties}</div>
            <div className="text-sm text-blue-600 font-medium">Varieties in Catalog</div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-3xl font-bold text-green-700 mb-2">
              {Array.from(new Set(seeds.map(s => s.plantId))).length}
            </div>
            <div className="text-sm text-green-600 font-medium">Different Plants</div>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by plant, variety, or brand..."
          className="mb-4"
        />

        {/* Custom Range Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Days to Maturity Range */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days to Maturity (DTM)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={dtmMin}
                onChange={(e) => setDtmMin(e.target.value)}
                placeholder="Min"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min="0"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={dtmMax}
                onChange={(e) => setDtmMax(e.target.value)}
                placeholder="Max"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min="0"
              />
              <span className="text-sm text-gray-500">days</span>
              {(dtmMin || dtmMax) && (
                <button
                  onClick={() => {
                    setDtmMin('');
                    setDtmMax('');
                  }}
                  className="ml-2 text-xs text-red-600 hover:text-red-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Soil Temperature Range */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Germination Soil Temperature
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={soilTempMin}
                onChange={(e) => setSoilTempMin(e.target.value)}
                placeholder="Min"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min="0"
                max="120"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={soilTempMax}
                onChange={(e) => setSoilTempMax(e.target.value)}
                placeholder="Max"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min="0"
                max="120"
              />
              <span className="text-sm text-gray-500">°F</span>
              {(soilTempMin || soilTempMax) && (
                <button
                  onClick={() => {
                    setSoilTempMin('');
                    setSoilTempMax('');
                  }}
                  className="ml-2 text-xs text-red-600 hover:text-red-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-4 items-start mb-6">
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
      </div>

      {/* Catalog Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Catalog Varieties {filteredAndSortedSeeds.length !== seeds.length && `(${filteredAndSortedSeeds.length} of ${seeds.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading seed catalog...</p>
          </div>
        ) : filteredAndSortedSeeds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🌾</div>
            <p className="text-lg">
              {seeds.length === 0 ? 'No varieties in catalog yet.' : 'No varieties match your filters.'}
            </p>
            <p className="text-sm mt-2">
              {seeds.length === 0
                ? 'An admin needs to import varieties via CSV.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Search Results Message */}
            {searchQuery.trim() && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Searching for "{searchQuery}"</span>
                  {' '}- Found {filteredAndSortedSeeds.length} {filteredAndSortedSeeds.length === 1 ? 'variety' : 'varieties'}
                  {' '}matching plant name, variety, or brand
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedSeeds.map((seed) => (
                <div key={seed.id} className="bg-white border-2 border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
                  {/* Header */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-800">{getPlantName(seed.plantId)}</h3>
                    <p className="text-sm text-gray-600">
                      {searchQuery.trim() && seed.variety.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                        // Highlight matching text
                        <span dangerouslySetInnerHTML={{
                          __html: seed.variety.replace(
                            new RegExp(`(${searchQuery})`, 'gi'),
                            '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
                          )
                        }} />
                      ) : (
                        seed.variety
                      )}
                    </p>
                    {seed.brand && <p className="text-xs text-gray-500">{seed.brand}</p>}
                  </div>

                  {/* Agronomic Details */}
                  <div className="space-y-2 text-sm mb-4">
                    {seed.daysToMaturity != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Days to Maturity:</span>
                        <span className="font-medium">{seed.daysToMaturity} days</span>
                      </div>
                    )}

                    {seed.flavorProfile && (
                      <div>
                        <span className="text-gray-600">Flavor:</span>
                        <p className="text-xs text-gray-700 mt-1">{seed.flavorProfile}</p>
                      </div>
                    )}

                    {seed.storageRating && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Storage:</span>
                        <span className="font-medium">{seed.storageRating}</span>
                      </div>
                    )}
                  </div>

                  {/* Add to Inventory Button */}
                  <button
                    onClick={() => handleAddToInventory(seed)}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add to My Inventory
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
                <div className="text-sm text-gray-600">
                  Showing page {currentPage} of {totalPages} ({totalVarieties.toLocaleString()} total varieties)
                </div>

                <div className="flex items-center gap-2">
                  {/* Previous Button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ← Previous
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {/* First page */}
                    {currentPage > 3 && (
                      <>
                        <button
                          onClick={() => handlePageChange(1)}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          1
                        </button>
                        {currentPage > 4 && <span className="text-gray-400">...</span>}
                      </>
                    )}

                    {/* Pages around current */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
                      if (pageNum < 1 || pageNum > totalPages) return null;
                      if (currentPage > 3 && pageNum === 1) return null;
                      if (currentPage < totalPages - 2 && pageNum === totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                            pageNum === currentPage
                              ? 'bg-green-600 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {/* Last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && <span className="text-gray-400">...</span>}
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add from Catalog Modal */}
      <AddFromCatalogModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedSeed(null);
        }}
        catalogSeed={selectedSeed}
        onSuccess={() => {
          loadData();
          setIsAddModalOpen(false);
          setSelectedSeed(null);
        }}
      />

      {/* CSV Import Modal (Admin Only) */}
      {user?.isAdmin && (
        <CSVImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            loadData();
            setIsImportModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default SeedCatalog;
