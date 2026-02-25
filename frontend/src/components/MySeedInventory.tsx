import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConfirmDialog, useToast, SearchBar, SortDropdown, FilterBar } from './common';
import type { SortOption, SortDirection, FilterGroup } from './common';
import { AddSeedModal } from './SeedInventory/AddSeedModal';
import { EditSeedModal } from './SeedInventory/EditSeedModal';
import { SeedImportModal } from './SeedInventory/SeedImportModal';

import { API_BASE_URL } from '../config';
interface Seed {
  id: number;
  plantId: string;
  variety: string;
  brand?: string;
  quantity: number;
  purchaseDate?: string;
  expirationDate?: string;
  germinationRate?: number;
  location?: string;
  price?: number;
  notes?: string;
  /**
   * Whether this variety is part of the global catalog (read-only for all users).
   * Global varieties display a badge and have disabled edit/delete buttons.
   */
  isGlobal?: boolean;
  /**
   * Reference to catalog seed if this personal seed was cloned from catalog.
   * NULL = custom variety added by user
   * NOT NULL = cloned from catalog
   */
  catalogSeedId?: number | null;
  /**
   * Last time agronomic data was synced from catalog.
   * NULL = never synced
   */
  lastSyncedAt?: string | null;

  // Variety-specific agronomic overrides (nullable - undefined means "use plant_id defaults")
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
  seedsPerPacket?: number;
  seedsUsed?: number;
  seedsAvailable?: number;
  totalSeeds?: number;
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
    // Use variety-specific DTM override if available, otherwise use plant default
    const dtm = seed.daysToMaturity !== undefined && seed.daysToMaturity !== null
      ? seed.daysToMaturity
      : getPlantInfo(seed.plantId)?.daysToMaturity;

    // Include seed if DTM data not available
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
    if (!plant || !plant.germinationTemp) return true; // Include seed if plant data not loaded yet

    const plantTempMin = plant.germinationTemp.min;
    const plantTempMax = plant.germinationTemp.max;

    // Overlap logic: Two ranges overlap if the plant can germinate within the user's desired range
    // Example: Plant (40-75°F) overlaps with User (50-60°F) because 75>=50 and 40<=60
    // This means the plant can germinate at temperatures within the user's specified range
    const userMin = soilTempMinVal ?? plantTempMin;
    const userMax = soilTempMaxVal ?? plantTempMax;

    // Two ranges overlap if:
    // - Plant's max temp >= user's min temp (plant can grow at least at user's minimum)
    // - Plant's min temp <= user's max temp (plant can start at user's maximum or lower)
    const overlaps = plantTempMax >= userMin && plantTempMin <= userMax;
    return overlaps;
  });
};

const SeedInventory: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSeed, setSelectedSeed] = useState<Seed | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; seedId: number | null }>({
    isOpen: false,
    seedId: null,
  });

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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load seeds (personal inventory only)
      const seedResponse = await fetch(`${API_BASE_URL}/api/my-seeds`, { credentials: 'include' });
      if (!seedResponse.ok) {
        showError('Failed to load seed inventory');
        return;
      }
      const seedData = await seedResponse.json();
      setSeeds(seedData);

      // Load plants
      const plantResponse = await fetch(`${API_BASE_URL}/api/plants`, { credentials: 'include' });
      if (!plantResponse.ok) {
        showError('Failed to load plant data');
        return;
      }
      const plantData = await plantResponse.json();
      setPlants(plantData);
    } catch (error) {
      console.error('Error loading seed inventory:', error);
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getPlantInfo = useCallback((plantId: string): Plant | undefined => {
    return plants.find(p => p.id === plantId);
  }, [plants]);

  const getPlantName = useCallback((plantId: string): string => {
    const plant = getPlantInfo(plantId);
    return plant?.name || plantId;
  }, [getPlantInfo]);

  // Export filtered/sorted seeds to CSV
  const handleExportCSV = () => {
    try {
      // CSV header
      const headers = [
        'Plant',
        'Variety',
        'Brand',
        'Quantity',
        'Location',
        'Purchase Date',
        'Expiration Date',
        'Germination Rate (%)',
        'Price',
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
        'Storage Rating',
        'Notes'
      ];

      // Build CSV rows from filtered and sorted seeds
      const rows = filteredAndSortedSeeds.map(seed => [
        getPlantName(seed.plantId),
        seed.variety || '',
        seed.brand || '',
        seed.quantity?.toString() || '0',
        seed.location || '',
        seed.purchaseDate || '',
        seed.expirationDate || '',
        seed.germinationRate?.toString() || '',
        seed.price?.toString() || '',
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
        seed.storageRating || '',
        seed.notes || ''
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
      link.setAttribute('download', `my-seed-inventory-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess(`Exported ${filteredAndSortedSeeds.length} varieties to CSV`);
    } catch (error) {
      console.error('Export failed:', error);
      showError('Failed to export seed inventory');
    }
  };

  const isExpiringSoon = (expirationDate?: string): boolean => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return expDate < sixMonthsFromNow;
  };

  const isExpired = (expirationDate?: string): boolean => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  const handleEdit = (seed: Seed) => {
    setSelectedSeed(seed);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (seedId: number) => {
    setDeleteConfirm({ isOpen: true, seedId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.seedId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/seeds/${deleteConfirm.seedId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        showSuccess('Seed deleted successfully!');
        loadData(); // Refresh the list
      } else {
        showError('Failed to delete seed');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting seed:', error);
      }
      showError('Network error occurred');
    } finally {
      setDeleteConfirm({ isOpen: false, seedId: null });
    }
  };

  const handleSync = async (seedId: number) => {
    if (!window.confirm('Sync this seed from catalog? This will update all agronomic data (DTM, spacing, temperatures, etc.) while preserving your personal tracking data (quantity, location, notes).')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/my-seeds/${seedId}/sync-from-catalog`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        showSuccess('Seed synced successfully from catalog!');
        loadData(); // Refresh the list
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to sync seed');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error syncing seed:', error);
      }
      showError('Network error occurred');
    }
  };

  // Base filtered seeds - apply search, DTM, and soil temp filters first
  // This ensures filter counts reflect these "base" filters
  const baseFilteredSeeds = useMemo(() => {
    let result = [...seeds];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(seed => {
        const plantName = getPlantName(seed.plantId).toLowerCase();
        const variety = seed.variety.toLowerCase();
        const brand = seed.brand?.toLowerCase() || '';
        const location = seed.location?.toLowerCase() || '';
        const notes = seed.notes?.toLowerCase() || '';
        return (
          plantName.includes(query) ||
          variety.includes(query) ||
          brand.includes(query) ||
          location.includes(query) ||
          notes.includes(query)
        );
      });
    }

    // Apply DTM range filter
    result = filterByDaysToMaturity(result, getPlantInfo, dtmMin, dtmMax);

    // Apply soil temperature range filter
    result = filterBySoilTemperature(result, getPlantInfo, soilTempMin, soilTempMax);

    return result;
  }, [seeds, searchQuery, getPlantName, getPlantInfo, dtmMin, dtmMax, soilTempMin, soilTempMax]);

  // Filter and Sort Configuration
  // Extract categories and plant names from baseFilteredSeeds so dropdowns only show what's available
  const categories = Array.from(new Set(
    baseFilteredSeeds.map(s => {
      const plant = getPlantInfo(s.plantId);
      return plant?.category;
    }).filter((cat): cat is string => cat !== undefined)
  ));

  const plantNames = Array.from(new Set(
    baseFilteredSeeds.map(s => {
      const plant = getPlantInfo(s.plantId);
      return plant?.name;
    }).filter((name): name is string => name !== undefined)
  )).sort();

  // Extract all unique seasons from plants
  const seasons = Array.from(new Set(
    baseFilteredSeeds.flatMap(s => {
      const plant = getPlantInfo(s.plantId);
      return plant?.idealSeasons || [];
    })
  )).sort();

  const sortOptions: SortOption[] = [
    { value: 'plantId', label: 'Plant Name' },
    { value: 'purchaseDate', label: 'Purchase Date' },
    { value: 'expirationDate', label: 'Expiration Date' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'germinationRate', label: 'Germination Rate' },
  ];

  // Filter groups with counts from baseFilteredSeeds
  // This ensures counts reflect active search, DTM, and soil temp filters
  const filterGroups: FilterGroup[] = useMemo(() => {
    // Cascading filter: If Crop/Plant filter is active, only show varieties from selected crops
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
        options: plantNames.map(plantName => ({
          value: plantName,
          label: plantName,
          count: baseFilteredSeeds.filter(s => {
            const plant = getPlantInfo(s.plantId);
            return plant?.name === plantName;
          }).length,
        })),
      },
      {
        id: 'expiration',
        label: 'Expiration Status',
        options: [
          {
            value: 'expired',
            label: 'Expired',
            count: baseFilteredSeeds.filter(s => isExpired(s.expirationDate)).length,
          },
          {
            value: 'expiring',
            label: 'Expiring Soon',
            count: baseFilteredSeeds.filter(s => isExpiringSoon(s.expirationDate) && !isExpired(s.expirationDate)).length,
          },
          {
            value: 'fresh',
            label: 'Fresh',
            count: baseFilteredSeeds.filter(s => s.expirationDate && !isExpiringSoon(s.expirationDate)).length,
          },
        ],
      },
      {
        id: 'stock',
        label: 'Stock Level',
        options: [
          {
            value: 'low',
            label: 'Low (≤1 packet)',
            count: baseFilteredSeeds.filter(s => s.quantity <= 1).length,
          },
          {
            value: 'medium',
            label: 'Medium (2-5 packets)',
            count: baseFilteredSeeds.filter(s => s.quantity >= 2 && s.quantity <= 5).length,
          },
          {
            value: 'high',
            label: 'High (>5 packets)',
            count: baseFilteredSeeds.filter(s => s.quantity > 5).length,
          },
        ],
      },
      {
        id: 'germination',
        label: 'Germination Rate',
        options: [
          {
            value: 'high',
            label: 'High (≥80%)',
            count: baseFilteredSeeds.filter(s => s.germinationRate !== null && s.germinationRate !== undefined && s.germinationRate >= 80).length,
          },
          {
            value: 'medium',
            label: 'Medium (60-79%)',
            count: baseFilteredSeeds.filter(s => s.germinationRate !== null && s.germinationRate !== undefined && s.germinationRate >= 60 && s.germinationRate < 80).length,
          },
          {
            value: 'low',
            label: 'Low (<60%)',
            count: baseFilteredSeeds.filter(s => s.germinationRate !== null && s.germinationRate !== undefined && s.germinationRate < 60).length,
          },
        ],
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
  }, [baseFilteredSeeds, categories, plantNames, seasons, getPlantInfo, activeFilters]);

  const handleFilterChange = (groupId: string, values: string[]) => {
    setActiveFilters(prev => ({
      ...prev,
      [groupId]: values,
    }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
  };

  const handleSortChange = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
  };

  // Apply filters, search, and sorting
  const filteredAndSortedSeeds = useMemo(() => {
    // Start from baseFilteredSeeds (already has search, DTM, and soil temp applied)
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
      result = result.filter(seed => {
        return varietyFilters.includes(seed.variety);
      });
    }

    // Crop/Plant filters
    const cropFilters = activeFilters['crop'] || [];
    if (cropFilters.length > 0) {
      result = result.filter(seed => {
        const plant = getPlantInfo(seed.plantId);
        return plant && cropFilters.includes(plant.name);
      });
    }

    // Expiration status filters
    const expirationFilters = activeFilters['expiration'] || [];
    if (expirationFilters.length > 0) {
      result = result.filter(seed => {
        if (expirationFilters.includes('expired') && isExpired(seed.expirationDate)) return true;
        if (expirationFilters.includes('expiring') && isExpiringSoon(seed.expirationDate) && !isExpired(seed.expirationDate)) return true;
        if (expirationFilters.includes('fresh') && seed.expirationDate && !isExpiringSoon(seed.expirationDate)) return true;
        return false;
      });
    }

    // Stock level filters
    const stockFilters = activeFilters['stock'] || [];
    if (stockFilters.length > 0) {
      result = result.filter(seed => {
        if (stockFilters.includes('low') && seed.quantity <= 1) return true;
        if (stockFilters.includes('medium') && seed.quantity >= 2 && seed.quantity <= 5) return true;
        if (stockFilters.includes('high') && seed.quantity > 5) return true;
        return false;
      });
    }

    // Germination rate filters
    const germinationFilters = activeFilters['germination'] || [];
    if (germinationFilters.length > 0) {
      result = result.filter(seed => {
        if (seed.germinationRate === null || seed.germinationRate === undefined) return false;
        if (germinationFilters.includes('high') && seed.germinationRate >= 80) return true;
        if (germinationFilters.includes('medium') && seed.germinationRate >= 60 && seed.germinationRate < 80) return true;
        if (germinationFilters.includes('low') && seed.germinationRate < 60) return true;
        return false;
      });
    }

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
        case 'purchaseDate':
          aValue = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
          bValue = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
          break;
        case 'expirationDate':
          aValue = a.expirationDate ? new Date(a.expirationDate).getTime() : 0;
          bValue = b.expirationDate ? new Date(b.expirationDate).getTime() : 0;
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'germinationRate':
          aValue = a.germinationRate ?? -1;
          bValue = b.germinationRate ?? -1;
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

  const totalVarieties = seeds.length;
  const lowStock = seeds.filter(s => s.quantity <= 1).length;
  const expiringSoon = seeds.filter(s => isExpiringSoon(s.expirationDate) && !isExpired(s.expirationDate)).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">My Seed Inventory</h2>
        <p className="text-gray-600 mb-6">
          Your personal seed collection. Add seeds from the catalog or create custom entries.
        </p>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div data-testid="seed-count" className="text-3xl font-bold text-green-700 mb-2">{totalVarieties}</div>
            <div className="text-sm text-green-600 font-medium">Varieties in Stock</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
            <div className="text-3xl font-bold text-amber-700 mb-2">{lowStock}</div>
            <div className="text-sm text-amber-600 font-medium">Low Stock Alerts</div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
            <div className="text-3xl font-bold text-red-700 mb-2">{expiringSoon}</div>
            <div className="text-sm text-red-600 font-medium">Expiring Soon</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-3">
          <button
            data-testid="btn-add-seed"
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
            onClick={() => setIsAddModalOpen(true)}
          >
            Add New Seed
          </button>
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
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
        </div>

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by plant, variety, brand, location, or notes..."
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
            <p className="mt-1 text-xs text-gray-500">
              Filter seeds by time to harvest (e.g., 30-60 days)
            </p>
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
            <p className="mt-1 text-xs text-gray-500">
              Filter by current soil temperature (e.g., 40-75°F)
            </p>
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

      {/* Seed Inventory Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Your Seed Collection {filteredAndSortedSeeds.length !== seeds.length && `(${filteredAndSortedSeeds.length} of ${seeds.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading seed inventory...</p>
          </div>
        ) : filteredAndSortedSeeds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🌾</div>
            <p className="text-lg">
              {seeds.length === 0 ? 'No seeds in inventory yet.' : 'No seeds match your filters.'}
            </p>
            <p className="text-sm mt-2">
              {seeds.length === 0
                ? 'Add your seed collection to track varieties and expiration dates!'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedSeeds.map((seed) => {
              const expired = isExpired(seed.expirationDate);
              const expiring = isExpiringSoon(seed.expirationDate);
              const lowQuantity = seed.quantity <= 1;

              return (
                <div key={seed.id} data-testid={`seed-card-${seed.id}`} className="bg-white border-2 border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
                  {/* Header with Alerts and Actions */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">{getPlantName(seed.plantId)}</h3>
                      <p className="text-sm text-gray-600">{seed.variety}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1">
                        {/* Catalog vs Custom Badge */}
                        {seed.catalogSeedId ? (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                            From Catalog
                          </span>
                        ) : (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                            Custom
                          </span>
                        )}
                        {expired && (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                            Expired
                          </span>
                        )}
                        {!expired && expiring && (
                          <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-semibold">
                            Expiring
                          </span>
                        )}
                        {lowQuantity && (
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                            Low
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          data-testid={`btn-edit-seed-${seed.id}`}
                          onClick={() => handleEdit(seed)}
                          className="p-1 rounded text-blue-600 hover:bg-blue-50"
                          title="Edit seed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {seed.catalogSeedId && (
                          <button
                            onClick={() => handleSync(seed.id)}
                            className="p-1 rounded text-green-600 hover:bg-green-50"
                            title="Sync from catalog"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        <button
                          data-testid={`btn-delete-seed-${seed.id}`}
                          onClick={() => handleDeleteClick(seed.id)}
                          className="p-1 rounded text-red-600 hover:bg-red-50"
                          title="Delete seed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {seed.brand && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Brand:</span>
                        <span className="font-medium">{seed.brand}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Quantity:</span>
                      <span className={`font-medium ${lowQuantity ? 'text-orange-600' : ''}`}>
                        {seed.quantity} packet{seed.quantity !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {seed.totalSeeds !== undefined && seed.totalSeeds > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Seeds:</span>
                        <span className={`font-medium ${(seed.seedsAvailable ?? 0) <= 0 ? 'text-red-600' : ''}`}>
                          {seed.seedsUsed || 0} of {seed.totalSeeds} used
                          {seed.seedsAvailable !== undefined && ` (${seed.seedsAvailable} available)`}
                        </span>
                      </div>
                    )}

                    {seed.germinationRate !== null && seed.germinationRate !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Germination:</span>
                        <span className={`font-medium ${seed.germinationRate >= 80 ? 'text-green-600' : seed.germinationRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {seed.germinationRate}%
                        </span>
                      </div>
                    )}

                    {seed.expirationDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expires:</span>
                        <span className={`font-medium ${expired ? 'text-red-600' : expiring ? 'text-amber-600' : ''}`}>
                          {new Date(seed.expirationDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {seed.location && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-medium">{seed.location}</span>
                      </div>
                    )}

                    {seed.price && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Price:</span>
                        <span className="font-medium">${seed.price.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {seed.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-600">{seed.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-green-50 rounded-lg p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Seed Storage Tips</h3>
        <ul className="space-y-2 text-sm text-green-800">
          <li>✓ Store seeds in a cool, dry, dark place (40-50°F is ideal)</li>
          <li>✓ Use airtight containers with silica gel packets to control moisture</li>
          <li>✓ Label everything with variety name and purchase/harvest date</li>
          <li>✓ Most vegetable seeds remain viable for 2-5 years when stored properly</li>
          <li>✓ Test germination rate before planting old seeds (10 seeds on wet paper towel)</li>
        </ul>
      </div>

      {/* Modals */}
      <AddSeedModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadData}
      />

      <EditSeedModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={loadData}
        seed={selectedSeed}
      />

      <SeedImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadData}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, seedId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Seed"
        message="Are you sure you want to delete this seed? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default SeedInventory;
