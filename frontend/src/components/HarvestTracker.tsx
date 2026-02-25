import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConfirmDialog, useToast, SearchBar, SortDropdown, FilterBar, DateRangePicker } from './common';
import type { SortOption, SortDirection, FilterGroup, DateRange } from './common';
import { LogHarvestModal } from './HarvestTracker/LogHarvestModal';
import { EditHarvestModal } from './HarvestTracker/EditHarvestModal';

import { API_BASE_URL } from '../config';
interface HarvestRecord {
  id: number;
  plantId: string;
  harvestDate: string;
  quantity: number;
  unit: string;
  quality: string;
  notes?: string;
}

interface Plant {
  id: string;
  name: string;
  category: string;
}

const HarvestTracker: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedHarvest, setSelectedHarvest] = useState<HarvestRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; harvestId: number | null }>({
    isOpen: false,
    harvestId: null,
  });

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [sortBy, setSortBy] = useState<string>('harvestDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load harvests
      const harvestResponse = await fetch(`${API_BASE_URL}/api/harvests`, { credentials: 'include' });
      if (!harvestResponse.ok) {
        showError('Failed to load harvests');
        return;
      }
      const harvestData = await harvestResponse.json();
      setHarvests(harvestData);

      // Load plants
      const plantResponse = await fetch(`${API_BASE_URL}/api/plants`, { credentials: 'include' });
      if (!plantResponse.ok) {
        showError('Failed to load plant data');
        return;
      }
      const plantData = await plantResponse.json();
      setPlants(plantData);

      // Load stats
      const statsResponse = await fetch(`${API_BASE_URL}/api/harvests/stats`, { credentials: 'include' });
      if (!statsResponse.ok) {
        showError('Failed to load harvest statistics');
        return;
      }
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading harvest data:', error);
      showError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getPlantName = useCallback((plantId: string): string => {
    const plant = plants.find(p => p.id === plantId);
    return plant?.name || plantId;
  }, [plants]);

  const getQualityColor = (quality: string): string => {
    switch (quality.toLowerCase()) {
      case 'excellent':
        return 'bg-green-100 text-green-800';
      case 'good':
        return 'bg-blue-100 text-blue-800';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditClick = (harvest: HarvestRecord) => {
    setSelectedHarvest(harvest);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (harvestId: number) => {
    setDeleteConfirm({ isOpen: true, harvestId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.harvestId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/harvests/${deleteConfirm.harvestId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showSuccess('Harvest deleted successfully!');
        loadData(); // Refresh the list and stats
      } else {
        showError('Failed to delete harvest');
      }
    } catch (error) {
      console.error('Error deleting harvest:', error);
      showError('Network error occurred');
    } finally {
      setDeleteConfirm({ isOpen: false, harvestId: null });
    }
  };

  // Filter and Sort Configuration
  const uniquePlants = Array.from(new Set(harvests.map(h => h.plantId)));
  const uniqueUnits = Array.from(new Set(harvests.map(h => h.unit)));

  const sortOptions: SortOption[] = [
    { value: 'harvestDate', label: 'Harvest Date' },
    { value: 'plantId', label: 'Plant Name' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'quality', label: 'Quality' },
  ];

  const filterGroups: FilterGroup[] = [
    {
      id: 'quality',
      label: 'Quality',
      options: ['Excellent', 'Good', 'Fair', 'Poor'].map(q => ({
        value: q.toLowerCase(),
        label: q,
        count: harvests.filter(h => h.quality.toLowerCase() === q.toLowerCase()).length,
      })),
    },
    {
      id: 'plant',
      label: 'Plant',
      options: uniquePlants.map(pid => ({
        value: pid,
        label: getPlantName(pid),
        count: harvests.filter(h => h.plantId === pid).length,
      })),
    },
    {
      id: 'unit',
      label: 'Unit',
      options: uniqueUnits.map(u => ({
        value: u,
        label: u,
        count: harvests.filter(h => h.unit === u).length,
      })),
    },
  ];

  const handleFilterChange = (groupId: string, values: string[]) => {
    setActiveFilters(prev => ({ ...prev, [groupId]: values }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    setDateRange({ startDate: null, endDate: null });
  };

  const handleSortChange = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
  };

  // Apply filters, search, date range, and sorting
  const filteredAndSortedHarvests = useMemo(() => {
    let result = [...harvests];

    // Search filter (plant name, notes)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(h => {
        const plantName = getPlantName(h.plantId).toLowerCase();
        const notes = h.notes?.toLowerCase() || '';
        return plantName.includes(query) || notes.includes(query);
      });
    }

    // Date range filter
    if (dateRange.startDate || dateRange.endDate) {
      result = result.filter(h => {
        const date = new Date(h.harvestDate).toISOString().split('T')[0];
        if (dateRange.startDate && date < dateRange.startDate) return false;
        if (dateRange.endDate && date > dateRange.endDate) return false;
        return true;
      });
    }

    // Quality filter
    const qualityFilters = activeFilters['quality'] || [];
    if (qualityFilters.length > 0) {
      result = result.filter(h => qualityFilters.includes(h.quality.toLowerCase()));
    }

    // Plant filter
    const plantFilters = activeFilters['plant'] || [];
    if (plantFilters.length > 0) {
      result = result.filter(h => plantFilters.includes(h.plantId));
    }

    // Unit filter
    const unitFilters = activeFilters['unit'] || [];
    if (unitFilters.length > 0) {
      result = result.filter(h => unitFilters.includes(h.unit));
    }

    // Sorting
    result.sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      // For plant name sorting, create a lookup map for O(1) access
      if (sortBy === 'plantId') {
        const plantNameMap = new Map(plants.map(p => [p.id, p.name.toLowerCase()]));
        aValue = plantNameMap.get(a.plantId) || a.plantId.toLowerCase();
        bValue = plantNameMap.get(b.plantId) || b.plantId.toLowerCase();
      } else {
        switch (sortBy) {
          case 'harvestDate':
            aValue = new Date(a.harvestDate).getTime();
            bValue = new Date(b.harvestDate).getTime();
            break;
          case 'quantity':
            aValue = a.quantity;
            bValue = b.quantity;
            break;
          case 'quality':
            const qualityOrder: { [key: string]: number } = { excellent: 4, good: 3, fair: 2, poor: 1 };
            aValue = qualityOrder[a.quality.toLowerCase()] || 0;
            bValue = qualityOrder[b.quality.toLowerCase()] || 0;
            break;
          default:
            return 0;
        }
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harvests, searchQuery, activeFilters, dateRange, sortBy, sortDirection, getPlantName]);

  const totalHarvested = harvests.reduce((sum, h) => sum + h.quantity, 0);
  const uniquePlantCount = new Set(harvests.map(h => h.plantId)).size;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Harvest Tracker</h2>
        <p className="text-gray-600 mb-6">
          Log your harvests, track quantities, and monitor quality over time. See what's producing well!
        </p>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div data-testid="harvest-count" className="text-3xl font-bold text-green-700 mb-2">{harvests.length}</div>
            <div className="text-sm text-green-600 font-medium">Total Harvests</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">{uniquePlantCount}</div>
            <div className="text-sm text-blue-600 font-medium">Different Plants</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
            <div className="text-3xl font-bold text-amber-700 mb-2">{totalHarvested.toFixed(1)}</div>
            <div className="text-sm text-amber-600 font-medium">Total Yield (various units)</div>
          </div>
        </div>

        {/* Add New Harvest Button */}
        <div className="mb-6">
          <button
            data-testid="btn-log-harvest"
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
            onClick={() => setIsLogModalOpen(true)}
          >
            Log New Harvest
          </button>
        </div>

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by plant name or notes..."
          className="mb-4"
        />

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-4 items-start mb-6">
          <FilterBar
            filterGroups={filterGroups}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAllFilters}
          />

          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            label="Harvest Date"
          />

          <SortDropdown
            options={sortOptions}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
        </div>
      </div>

      {/* Harvest Records */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Recent Harvests {filteredAndSortedHarvests.length !== harvests.length && `(${filteredAndSortedHarvests.length} of ${harvests.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading harvests...</p>
          </div>
        ) : filteredAndSortedHarvests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🧺</div>
            <p className="text-lg">
              {harvests.length === 0 ? 'No harvests recorded yet.' : 'No harvests match your filters.'}
            </p>
            <p className="text-sm mt-2">
              {harvests.length === 0
                ? 'Start logging your harvests to track your garden\'s productivity!'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedHarvests.map((harvest) => (
                  <tr key={harvest.id} data-testid={`harvest-row-${harvest.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(harvest.harvestDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getPlantName(harvest.plantId)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {harvest.quantity} {harvest.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getQualityColor(harvest.quality)}`}>
                        {harvest.quality}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {harvest.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          data-testid={`btn-edit-harvest-${harvest.id}`}
                          onClick={() => handleEditClick(harvest)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit harvest"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          data-testid={`btn-delete-harvest-${harvest.id}`}
                          onClick={() => handleDeleteClick(harvest.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete harvest"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Producers */}
      {Object.keys(stats).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Top Producers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats).map(([plantId, data]: [string, any]) => (
              <div key={plantId} className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="font-semibold text-gray-800 mb-2">{getPlantName(plantId)}</div>
                <div className="text-2xl font-bold text-green-700 mb-1">
                  {data.total.toFixed(1)} {data.unit}
                </div>
                <div className="text-sm text-gray-600">
                  {data.count} harvest{data.count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
        <h3 className="text-lg font-semibold text-amber-900 mb-2">Harvest Tracking Benefits</h3>
        <ul className="space-y-2 text-sm text-amber-800">
          <li>✓ Track productivity across different plants and varieties</li>
          <li>✓ Identify your best performers to grow more next year</li>
          <li>✓ Monitor harvest quality and timing patterns</li>
          <li>✓ Calculate yield per square foot or per plant</li>
          <li>✓ Plan better by learning from historical data</li>
        </ul>
      </div>

      {/* Modals */}
      <LogHarvestModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onSuccess={loadData}
      />

      {selectedHarvest && (
        <EditHarvestModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={loadData}
          harvestData={selectedHarvest}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, harvestId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Harvest"
        message="Are you sure you want to delete this harvest record? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default HarvestTracker;
