import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConfirmDialog, useToast, SearchBar, SortDropdown, FilterBar } from './common';
import type { SortOption, SortDirection, FilterGroup } from './common';
import { AnimalFormModal } from './Livestock/AnimalFormModal';
import { API_BASE_URL } from '../config';

interface Animal {
  id: number;
  name: string;
  breed?: string;
  quantity?: number;
  hatchDate?: string;
  purpose?: string;
  sex?: string;
  status?: string;
  coopLocation?: string;
  notes?: string;
  animalType?: string;
}

interface Beehive {
  id: number;
  name: string;
  type?: string;
  installDate?: string;
  queenMarked?: boolean;
  queenColor?: string;
  status?: string;
  location?: string;
  notes?: string;
}

interface LivestockNutrition {
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  by_animal_type: Record<string, {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  production_summary: Array<{
    species: string;
    count: number;
    annual_production: string;
  }>;
  year: number;
}

const CATEGORY_SINGULAR: Record<string, string> = {
  chickens: 'chicken',
  ducks: 'duck',
  bees: 'beehive',
  other: 'other livestock',
};

const CATEGORY_NAME_SINGULAR: Record<string, string> = {
  'Chickens': 'Chicken',
  'Ducks': 'Duck',
  'Beehives': 'Beehive',
  'Other Livestock': 'Other Livestock',
};

const Livestock: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [activeCategory, setActiveCategory] = useState<'chickens' | 'ducks' | 'bees' | 'other'>('chickens');
  const [chickens, setChickens] = useState<Animal[]>([]);
  const [ducks, setDucks] = useState<Animal[]>([]);
  const [beehives, setBeehives] = useState<Beehive[]>([]);
  const [otherLivestock, setOtherLivestock] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | Beehive | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [nutritionData, setNutritionData] = useState<LivestockNutrition | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);

  const loadNutritionData = async () => {
    try {
      setNutritionLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/nutrition/livestock`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch nutrition data: ${response.status}`);
      }
      const data = await response.json();
      setNutritionData(data);
    } catch (error) {
      console.error('Error loading nutrition data:', error);
      // Silently fail - nutrition is optional enhancement
    } finally {
      setNutritionLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadNutritionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Clear filters when tab changes
  useEffect(() => {
    setSearchQuery('');
    setActiveFilters({});
    setSortBy('name');
    setSortDirection('asc');
  }, [activeCategory]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeCategory === 'chickens') {
        const response = await fetch(`${API_BASE_URL}/api/chickens`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch chickens: ${response.status}`);
        }
        const data = await response.json();
        setChickens(data);
      } else if (activeCategory === 'ducks') {
        const response = await fetch(`${API_BASE_URL}/api/ducks`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch ducks: ${response.status}`);
        }
        const data = await response.json();
        setDucks(data);
      } else if (activeCategory === 'bees') {
        const response = await fetch(`${API_BASE_URL}/api/beehives`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch beehives: ${response.status}`);
        }
        const data = await response.json();
        setBeehives(data);
      } else if (activeCategory === 'other') {
        const response = await fetch(`${API_BASE_URL}/api/livestock`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch other livestock: ${response.status}`);
        }
        const data = await response.json();
        setOtherLivestock(data);
      }
    } catch (error) {
      console.error('Error loading livestock:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setModalMode('add');
    setSelectedAnimal(null);
    setIsModalOpen(true);
  };

  const handleEdit = (animal: Animal | Beehive) => {
    setModalMode('edit');
    setSelectedAnimal(animal);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;

    try {
      let endpoint = '';
      switch (activeCategory) {
        case 'chickens':
          endpoint = `${API_BASE_URL}/api/chickens/${deleteConfirm.id}`;
          break;
        case 'ducks':
          endpoint = `${API_BASE_URL}/api/ducks/${deleteConfirm.id}`;
          break;
        case 'bees':
          endpoint = `${API_BASE_URL}/api/beehives/${deleteConfirm.id}`;
          break;
        case 'other':
          endpoint = `${API_BASE_URL}/api/livestock/${deleteConfirm.id}`;
          break;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        showSuccess(`${CATEGORY_SINGULAR[activeCategory]} deleted successfully!`);
        loadData();
      } else {
        showError('Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      showError('Network error occurred');
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  // Filter and Sort Configuration
  const getSortOptions = (): SortOption[] => {
    const baseOptions = [
      { value: 'name', label: 'Name' },
      { value: 'breed', label: activeCategory === 'bees' ? 'Type' : 'Breed' },
    ];

    if (activeCategory === 'bees') {
      baseOptions.push(
        { value: 'installDate', label: 'Install Date' },
        { value: 'status', label: 'Status' }
      );
    } else {
      baseOptions.push(
        { value: 'hatchDate', label: 'Date' },
        { value: 'quantity', label: 'Quantity' }
      );
    }

    return baseOptions;
  };

  const getFilterGroups = (): FilterGroup[] => {
    if (activeCategory === 'chickens') {
      const statusOptions = Array.from(new Set(chickens.map(c => c.status).filter(Boolean)));
      const sexOptions = Array.from(new Set(chickens.map(c => c.sex).filter(Boolean)));
      const purposeOptions = Array.from(new Set(chickens.map(c => c.purpose).filter(Boolean)));

      return [
        {
          id: 'status',
          label: 'Status',
          options: statusOptions.map(s => ({
            value: s!,
            label: s!,
            count: chickens.filter(c => c.status === s).length,
          })),
        },
        {
          id: 'sex',
          label: 'Sex',
          options: sexOptions.map(s => ({
            value: s!,
            label: s!,
            count: chickens.filter(c => c.sex === s).length,
          })),
        },
        {
          id: 'purpose',
          label: 'Purpose',
          options: purposeOptions.map(p => ({
            value: p!,
            label: p!,
            count: chickens.filter(c => c.purpose === p).length,
          })),
        },
      ].filter(group => group.options.length > 0);
    } else if (activeCategory === 'ducks') {
      const statusOptions = Array.from(new Set(ducks.map(d => d.status).filter(Boolean)));
      const sexOptions = Array.from(new Set(ducks.map(d => d.sex).filter(Boolean)));
      const purposeOptions = Array.from(new Set(ducks.map(d => d.purpose).filter(Boolean)));

      return [
        {
          id: 'status',
          label: 'Status',
          options: statusOptions.map(s => ({
            value: s!,
            label: s!,
            count: ducks.filter(d => d.status === s).length,
          })),
        },
        {
          id: 'sex',
          label: 'Sex',
          options: sexOptions.map(s => ({
            value: s!,
            label: s!,
            count: ducks.filter(d => d.sex === s).length,
          })),
        },
        {
          id: 'purpose',
          label: 'Purpose',
          options: purposeOptions.map(p => ({
            value: p!,
            label: p!,
            count: ducks.filter(d => d.purpose === p).length,
          })),
        },
      ].filter(group => group.options.length > 0);
    } else if (activeCategory === 'bees') {
      const statusOptions = Array.from(new Set(beehives.map(b => b.status).filter(Boolean)));
      const typeOptions = Array.from(new Set(beehives.map(b => b.type).filter(Boolean)));

      return [
        {
          id: 'status',
          label: 'Status',
          options: statusOptions.map(s => ({
            value: s!,
            label: s!,
            count: beehives.filter(b => b.status === s).length,
          })),
        },
        {
          id: 'type',
          label: 'Hive Type',
          options: typeOptions.map(t => ({
            value: t!,
            label: t!,
            count: beehives.filter(b => b.type === t).length,
          })),
        },
      ].filter(group => group.options.length > 0);
    } else {
      const statusOptions = Array.from(new Set(otherLivestock.map(o => o.status).filter(Boolean)));
      const purposeOptions = Array.from(new Set(otherLivestock.map(o => o.purpose).filter(Boolean)));

      return [
        {
          id: 'status',
          label: 'Status',
          options: statusOptions.map(s => ({
            value: s!,
            label: s!,
            count: otherLivestock.filter(o => o.status === s).length,
          })),
        },
        {
          id: 'purpose',
          label: 'Purpose',
          options: purposeOptions.map(p => ({
            value: p!,
            label: p!,
            count: otherLivestock.filter(o => o.purpose === p).length,
          })),
        },
      ].filter(group => group.options.length > 0);
    }
  };

  const handleFilterChange = (groupId: string, values: string[]) => {
    setActiveFilters(prev => ({ ...prev, [groupId]: values }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
  };

  const handleSortChange = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
  };

  // Apply filters and sorting to animals
  const getFilteredAndSortedAnimals = useCallback((animals: Animal[]): Animal[] => {
    let result = [...animals];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => {
        const name = a.name?.toLowerCase() || '';
        const breed = a.breed?.toLowerCase() || '';
        const notes = a.notes?.toLowerCase() || '';
        return name.includes(query) || breed.includes(query) || notes.includes(query);
      });
    }

    // Apply active filters
    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        result = result.filter(a => {
          const fieldValue = (a as any)[key];
          return fieldValue && values.includes(fieldValue);
        });
      }
    });

    // Sorting
    result.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      switch (sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'breed':
          aValue = a.breed?.toLowerCase() || '';
          bValue = b.breed?.toLowerCase() || '';
          break;
        case 'hatchDate':
          aValue = a.hatchDate ? new Date(a.hatchDate).getTime() : 0;
          bValue = b.hatchDate ? new Date(b.hatchDate).getTime() : 0;
          break;
        case 'quantity':
          aValue = a.quantity || 0;
          bValue = b.quantity || 0;
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, activeFilters, sortBy, sortDirection]);

  // Apply filters and sorting to beehives
  const getFilteredAndSortedBeehives = useCallback((hives: Beehive[]): Beehive[] => {
    let result = [...hives];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(h => {
        const name = h.name?.toLowerCase() || '';
        const type = h.type?.toLowerCase() || '';
        const notes = h.notes?.toLowerCase() || '';
        return name.includes(query) || type.includes(query) || notes.includes(query);
      });
    }

    // Apply active filters
    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        result = result.filter(h => {
          const fieldValue = (h as any)[key];
          return fieldValue && values.includes(fieldValue);
        });
      }
    });

    // Sorting
    result.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      switch (sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'breed': // Treat as type for bees
          aValue = a.type?.toLowerCase() || '';
          bValue = b.type?.toLowerCase() || '';
          break;
        case 'installDate':
          aValue = a.installDate ? new Date(a.installDate).getTime() : 0;
          bValue = b.installDate ? new Date(b.installDate).getTime() : 0;
          break;
        case 'status':
          aValue = a.status?.toLowerCase() || '';
          bValue = b.status?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, activeFilters, sortBy, sortDirection]);

  // Compute filtered data for each tab
  const filteredChickens = useMemo(() => getFilteredAndSortedAnimals(chickens), [chickens, getFilteredAndSortedAnimals]);
  const filteredDucks = useMemo(() => getFilteredAndSortedAnimals(ducks), [ducks, getFilteredAndSortedAnimals]);
  const filteredBeehives = useMemo(() => getFilteredAndSortedBeehives(beehives), [beehives, getFilteredAndSortedBeehives]);
  const filteredOther = useMemo(() => getFilteredAndSortedAnimals(otherLivestock), [otherLivestock, getFilteredAndSortedAnimals]);

  const sortOptions = getSortOptions();
  const filterGroups = getFilterGroups();

  const categories = [
    { id: 'chickens' as const, name: 'Chickens', icon: '🐔', color: 'amber' },
    { id: 'ducks' as const, name: 'Ducks', icon: '🦆', color: 'blue' },
    { id: 'bees' as const, name: 'Beehives', icon: '🐝', color: 'yellow' },
    { id: 'other' as const, name: 'Other Livestock', icon: '🐐', color: 'green' },
  ];

  // Color mappings for Tailwind JIT compatibility
  const categoryColorClasses: Record<string, string> = {
    amber: 'bg-amber-500 text-white shadow-md',
    blue: 'bg-blue-500 text-white shadow-md',
    yellow: 'bg-yellow-500 text-white shadow-md',
    green: 'bg-green-500 text-white shadow-md',
  };

  const queenColorClasses: Record<string, string> = {
    white: 'bg-white text-gray-800 border border-gray-300',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
  };

  const renderAnimals = (animals: Animal[]) => {
    const allAnimals = activeCategory === 'chickens' ? chickens :
                       activeCategory === 'ducks' ? ducks :
                       otherLivestock;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {animals.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            {allAnimals.length === 0
              ? `No ${activeCategory} recorded yet. Click "Add New" to get started.`
              : `No ${activeCategory} match your filters. Try adjusting your search or filters.`}
          </div>
        ) : (
        animals.map((animal) => (
          <div key={animal.id} data-testid={`animal-card-${animal.id}`} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">{animal.name}</h3>
                {animal.breed && <p className="text-sm text-gray-600">{animal.breed}</p>}
              </div>
              <div className="flex items-center gap-2">
                {animal.quantity && animal.quantity > 1 && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {animal.quantity}
                  </span>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(animal)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                    data-testid={`btn-edit-animal-${animal.id}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(animal.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                    data-testid={`btn-delete-animal-${animal.id}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {animal.purpose && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Purpose:</span>
                  <span className="font-medium">{animal.purpose}</span>
                </div>
              )}
              {animal.sex && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Sex:</span>
                  <span className="font-medium">{animal.sex}</span>
                </div>
              )}
              {animal.coopLocation && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{animal.coopLocation}</span>
                </div>
              )}
              {animal.status && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${animal.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                    {animal.status}
                  </span>
                </div>
              )}
            </div>

            {animal.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">{animal.notes}</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
    );
  };

  const renderBeehives = (hives: Beehive[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {hives.length === 0 ? (
        <div className="col-span-full text-center py-8 text-gray-500">
          {beehives.length === 0
            ? 'No beehives recorded yet. Click "Add New" to get started.'
            : 'No beehives match your filters. Try adjusting your search or filters.'}
        </div>
      ) : (
        hives.map((hive) => (
          <div key={hive.id} data-testid={`hive-card-${hive.id}`} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800">{hive.name}</h3>
                {hive.type && <p className="text-sm text-gray-600">{hive.type}</p>}
              </div>
              <div className="flex items-center gap-2">
                {hive.queenMarked && hive.queenColor && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${queenColorClasses[hive.queenColor.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
                    Queen: {hive.queenColor}
                  </span>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(hive)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                    data-testid={`btn-edit-hive-${hive.id}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(hive.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                    data-testid={`btn-delete-hive-${hive.id}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {hive.location && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{hive.location}</span>
                </div>
              )}
              {hive.installDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Installed:</span>
                  <span className="font-medium">{new Date(hive.installDate).toLocaleDateString()}</span>
                </div>
              )}
              {hive.status && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${hive.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                    {hive.status}
                  </span>
                </div>
              )}
            </div>

            {hive.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">{hive.notes}</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Livestock Management</h2>
        <p className="text-gray-600 mb-6">
          Track your chickens, ducks, beehives, and other livestock. Monitor health, production, and management.
        </p>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              data-testid={`livestock-tab-${category.id}`}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeCategory === category.id
                  ? categoryColorClasses[category.color] || 'bg-gray-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* Nutrition Summary Card */}
        {nutritionData && nutritionData.production_summary.length > 0 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 mb-6 border border-green-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📊</span>
              Annual Production & Nutrition Estimates
            </h3>

            {nutritionLoading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Production Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nutritionData.production_summary.map((item) => (
                    <div key={item.species} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="font-semibold text-gray-800 capitalize mb-1">
                        {item.species}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.count} {item.count === 1 ? 'animal' : 'animals'}
                      </div>
                      <div className="text-sm text-green-700 font-medium mt-2">
                        → {item.annual_production}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nutritional Totals */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="font-semibold text-gray-800 mb-3">Total Annual Nutrition:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {nutritionData.totals.calories.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">Calories</div>
                      <div className="text-xs text-gray-500 mt-1">
                        ≈ {Math.round(nutritionData.totals.calories / 2000)} person-days
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round(nutritionData.totals.protein_g).toLocaleString()}g
                      </div>
                      <div className="text-xs text-gray-600">Protein</div>
                      <div className="text-xs text-gray-500 mt-1">
                        ≈ {Math.round(nutritionData.totals.protein_g / 50)} person-days
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(nutritionData.totals.carbs_g).toLocaleString()}g
                      </div>
                      <div className="text-xs text-gray-600">Carbs</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-600">
                        {Math.round(nutritionData.totals.fat_g).toLocaleString()}g
                      </div>
                      <div className="text-xs text-gray-600">Fat</div>
                    </div>
                  </div>
                </div>

                {/* Breakdown by Animal Type */}
                {Object.keys(nutritionData.by_animal_type).length > 0 && (
                  <details className="bg-white rounded-lg p-4 shadow-sm">
                    <summary className="font-semibold text-gray-800 cursor-pointer hover:text-green-600">
                      View Breakdown by Animal Type →
                    </summary>
                    <div className="mt-4 space-y-3">
                      {Object.entries(nutritionData.by_animal_type).map(([species, nutrition]) => (
                        <div key={species} className="border-l-4 border-green-500 pl-4">
                          <div className="font-medium text-gray-800 capitalize">{species}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {nutrition.calories.toLocaleString()} cal • {Math.round(nutrition.protein_g)}g protein • {Math.round(nutrition.carbs_g)}g carbs • {Math.round(nutrition.fat_g)}g fat
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="text-xs text-gray-500 italic mt-2">
                  * Estimates based on industry averages. Actual production varies by breed, age, management, and environmental conditions.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add New Button */}
        <div className="mb-6">
          <button
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
            onClick={handleAddNew}
            data-testid="btn-add-livestock"
          >
            Add New {CATEGORY_NAME_SINGULAR[categories.find(c => c.id === activeCategory)?.name || ''] || 'Animal'}
          </button>
        </div>

        {/* Search, Filter, Sort Controls */}
        <div className="space-y-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, breed, or notes..."
            className="mb-4"
          />

          <div className="flex flex-wrap gap-4 items-start">
            {filterGroups.length > 0 && (
              <FilterBar
                filterGroups={filterGroups}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onClearAll={handleClearAllFilters}
              />
            )}

            <SortDropdown
              options={sortOptions}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading {activeCategory}...</p>
          </div>
        ) : (
          <>
            {activeCategory === 'chickens' && renderAnimals(filteredChickens)}
            {activeCategory === 'ducks' && renderAnimals(filteredDucks)}
            {activeCategory === 'bees' && renderBeehives(filteredBeehives)}
            {activeCategory === 'other' && renderAnimals(filteredOther)}
          </>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Livestock Features</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ Track multiple animal types (chickens, ducks, bees, goats, sheep, etc.)</li>
          <li>✓ Record egg production and honey harvests</li>
          <li>✓ Monitor hive inspections and health records</li>
          <li>✓ Track breeding, hatching, and lifecycle events</li>
          <li>✓ Manage coop locations and feeding schedules</li>
        </ul>
      </div>

      {/* Modals */}
      <AnimalFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        category={activeCategory}
        mode={modalMode}
        animalData={selectedAnimal}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${CATEGORY_SINGULAR[activeCategory]}`}
        message="Are you sure you want to delete this? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default Livestock;
