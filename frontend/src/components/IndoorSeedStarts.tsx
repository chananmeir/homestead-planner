import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { useToast } from './common/Toast';
import { Modal } from './common/Modal';
import { ConfirmDialog } from './common/ConfirmDialog';
import { ImportFromGardenModal } from './IndoorSeedStarts/ImportFromGardenModal';
import PlantIcon from './common/PlantIcon';
import { API_BASE_URL } from '../config';

interface Plant {
  id: string;
  name: string;
  icon?: string;
  daysToMaturity?: number;
  germinationDays?: number;
  weeksIndoors?: number;
}

interface SeedInventoryItem {
  id: number;
  plantId: string;
  variety: string;
  quantity: number;
  brand?: string;
  location?: string;
}

interface IndoorSeedStart {
  id: number;
  plantId: string;
  variety?: string;
  seedInventoryId?: number;
  startDate: string;
  expectedGerminationDate?: string;
  expectedTransplantDate?: string;
  actualGerminationDate?: string;
  actualTransplantDate?: string;
  seedsStarted: number;  // Renamed from quantity to match backend
  seedsGerminated?: number;  // Renamed from germinatedCount to match backend
  expectedGerminationRate?: number;
  actualGerminationRate?: number;
  containerType?: string;
  cellSize?: string;
  lightHours?: number;  // Renamed from lightHoursPerDay to match backend
  temperature?: number;
  humidity?: number;
  location?: string;
  notes?: string;
  status: 'started' | 'germinating' | 'growing' | 'hardening' | 'transplanted' | 'failed' | 'seeded';
  plantingEventId?: number;
  // Live sync fields
  gardenPlanCount?: number;
  gardenPlanExpectedSeeds?: number;
  gardenPlanInSync?: boolean;
  gardenPlanWarning?: string;
}

const IndoorSeedStarts: React.FC = () => {
  const [seedStarts, setSeedStarts] = useState<IndoorSeedStart[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [seedInventory, setSeedInventory] = useState<SeedInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSeedStart, setSelectedSeedStart] = useState<IndoorSeedStart | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load seed starts
      const startsResponse = await apiGet('/api/indoor-seed-starts');
      if (startsResponse.ok) {
        const startsData = await startsResponse.json();
        setSeedStarts(startsData);
      }

      // Load plants
      const plantsResponse = await apiGet('/api/plants');
      if (plantsResponse.ok) {
        const plantsData = await plantsResponse.json();
        setPlants(plantsData);
      }

      // Load seed inventory
      const inventoryResponse = await apiGet('/api/seeds');
      if (inventoryResponse.ok) {
        const inventoryData = await inventoryResponse.json();
        setSeedInventory(inventoryData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getPlant = (plantId: string): Plant | undefined => {
    return plants.find(p => p.id === plantId);
  };

  const getPlantName = (plantId: string): string => {
    const plant = getPlant(plantId);
    return plant?.name || plantId;
  };

  const getPlantIcon = (plantId: string): string => {
    const plant = getPlant(plantId);
    return plant?.icon || '🌱';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getDaysUntil = (dateString?: string): number | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      planned: 'bg-indigo-100 text-indigo-800',
      seeded: 'bg-gray-100 text-gray-800',
      started: 'bg-blue-100 text-blue-800',
      germinating: 'bg-yellow-100 text-yellow-800',
      growing: 'bg-green-100 text-green-800',
      hardening: 'bg-purple-100 text-purple-800',
      transplanted: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async () => {
    if (!selectedSeedStart) return;

    try {
      const response = await apiDelete(`/api/indoor-seed-starts/${selectedSeedStart.id}`);
      if (response.ok) {
        showSuccess('Seed start deleted');
        loadData();
      } else {
        showError('Failed to delete seed start');
      }
    } catch (error) {
      console.error('Error deleting seed start:', error);
      showError('Network error');
    } finally {
      setDeleteConfirm(false);
      setSelectedSeedStart(null);
    }
  };

  const filteredStarts = filterStatus === 'all'
    ? seedStarts
    : seedStarts.filter(s => s.status === filterStatus);

  const activeStarts = seedStarts.filter(s => s.status !== 'transplanted' && s.status !== 'failed');
  const transplantedCount = seedStarts.filter(s => s.status === 'transplanted').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading seed starts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Indoor Seed Starting</h2>
            <p className="text-gray-600 mt-1">
              Track seeds started indoors from germination to transplant
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              From Garden Plan
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start Seeds
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">{activeStarts.length}</div>
            <div className="text-sm text-blue-600 font-medium">Active Starts</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">
              {seedStarts.filter(s => s.status === 'germinating').length}
            </div>
            <div className="text-sm text-yellow-600 font-medium">Germinating</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-700">
              {seedStarts.filter(s => s.status === 'growing' || s.status === 'hardening').length}
            </div>
            <div className="text-sm text-green-600 font-medium">Growing</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-700">{transplantedCount}</div>
            <div className="text-sm text-purple-600 font-medium">Transplanted</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {['all', 'seeded', 'started', 'germinating', 'growing', 'hardening', 'transplanted', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Seed Starts List */}
      {filteredStarts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🌱</div>
          <p className="text-lg text-gray-600 mb-4">
            {filterStatus === 'all'
              ? "No seed starts yet. Click 'Start Seeds' to begin!"
              : `No ${filterStatus} seed starts`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStarts.map(start => {
            const daysToGermination = getDaysUntil(start.expectedGerminationDate);
            const daysToTransplant = getDaysUntil(start.expectedTransplantDate);
            const germinationRate = start.seedsStarted > 0
              ? Math.round(((start.seedsGerminated || 0) / start.seedsStarted) * 100)
              : 0;

            return (
              <div
                key={start.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <PlantIcon
                      plantId={start.plantId}
                      plantIcon={getPlantIcon(start.plantId)}
                      size={48}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {getPlantName(start.plantId)}
                      </h3>
                      {start.variety && (
                        <p className="text-sm text-gray-600">{start.variety}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(start.status)}`}>
                    {start.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Started:</span>
                    <span className="font-medium">{formatDate(start.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Seeds Planted:</span>
                    <span className="font-medium">{start.seedsStarted} seeds</span>
                  </div>

                  {/* Live Sync Warning */}
                  {start.gardenPlanWarning && !start.gardenPlanInSync && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-2">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-600 text-lg">⚠️</span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-yellow-800">{start.gardenPlanWarning}</p>
                          {start.gardenPlanCount !== undefined && start.gardenPlanCount > 0 && (
                            <>
                              <p className="text-xs text-yellow-700 mt-1">
                                Current plan: {start.gardenPlanCount} plants → {start.gardenPlanExpectedSeeds} seeds recommended
                              </p>
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Update to ${start.gardenPlanExpectedSeeds} seeds to match current garden plan?`)) {
                                    try {
                                      const response = await fetch(`${API_BASE_URL}/api/indoor-seed-starts/${start.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ seedsStarted: start.gardenPlanExpectedSeeds })
                                      });
                                      if (response.ok) {
                                        showSuccess('Indoor seed start synced with garden plan!');
                                        loadData();
                                      } else {
                                        showError('Failed to sync');
                                      }
                                    } catch (error) {
                                      showError('Error syncing');
                                    }
                                  }
                                }}
                                className="mt-2 text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition-colors"
                              >
                                Sync to {start.gardenPlanExpectedSeeds} seeds
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {start.seedsGerminated !== undefined && start.seedsGerminated > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Germinated:</span>
                      <span className="font-medium text-green-600">
                        {start.seedsGerminated} ({germinationRate}%)
                      </span>
                    </div>
                  )}
                  {daysToGermination !== null && daysToGermination > 0 && start.status === 'started' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected germination:</span>
                      <span className="font-medium text-yellow-600">
                        {daysToGermination} days
                      </span>
                    </div>
                  )}
                  {daysToTransplant !== null && daysToTransplant > 0 && start.status !== 'transplanted' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Transplant in:</span>
                      <span className="font-medium text-blue-600">
                        {daysToTransplant} days
                      </span>
                    </div>
                  )}
                  {start.location && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium">{start.location}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedSeedStart(start);
                      setShowEditModal(true);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSeedStart(start);
                      setDeleteConfirm(true);
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <AddSeedStartModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          loadData();
        }}
        plants={plants}
        seedInventory={seedInventory}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* Edit Modal */}
      {selectedSeedStart && (
        <EditSeedStartModal
          isOpen={showEditModal}
          seedStart={selectedSeedStart}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSeedStart(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedSeedStart(null);
            loadData();
          }}
          plants={plants}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => {
          setDeleteConfirm(false);
          setSelectedSeedStart(null);
        }}
        onConfirm={handleDelete}
        title="Delete Seed Start"
        message={`Are you sure you want to delete this seed start for ${selectedSeedStart ? getPlantName(selectedSeedStart.plantId) : ''}?`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Import from Garden Plan Modal */}
      <ImportFromGardenModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          loadData();
        }}
        showSuccess={showSuccess}
        showError={showError}
      />
    </div>
  );
};

// Add Seed Start Modal Component
interface AddSeedStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plants: Plant[];
  seedInventory: SeedInventoryItem[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const AddSeedStartModal: React.FC<AddSeedStartModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  plants,
  seedInventory,
  showSuccess,
  showError,
}) => {
  const [formData, setFormData] = useState({
    plantId: '',
    variety: '',
    seedInventoryId: '',
    startDate: new Date().toISOString().split('T')[0],
    desiredPlants: 6,
    seedsToPlant: 9,
    containerType: 'cell-tray',
    cellSize: '2-inch',
    lightHours: 14,
    temperature: 70,
    humidity: 60,
    location: '',
    notes: '',
  });

  // Reset start date to current date whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        startDate: new Date().toISOString().split('T')[0]
      }));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.plantId) {
      showError('Please select a plant');
      return;
    }

    try {
      const payload = {
        plantId: formData.plantId,
        variety: formData.variety || undefined,
        seedInventoryId: formData.seedInventoryId ? parseInt(formData.seedInventoryId) : undefined,
        startDate: formData.startDate,
        desiredPlants: formData.desiredPlants,
        seedsStarted: formData.seedsToPlant,
        containerType: formData.containerType,
        cellSize: formData.cellSize,
        lightHours: formData.lightHours,
        temperature: formData.temperature,
        humidity: formData.humidity,
        location: formData.location || undefined,
        notes: formData.notes || undefined,
      };

      const response = await apiPost('/api/indoor-seed-starts', payload);

      if (response.ok) {
        const result = await response.json();
        if (result.inventoryWarning) {
          showError(result.inventoryWarning);
        }
        showSuccess('Seed start created successfully!');
        onSuccess();
        // Reset form
        setFormData({
          plantId: '',
          variety: '',
          seedInventoryId: '',
          startDate: new Date().toISOString().split('T')[0],
          desiredPlants: 6,
          seedsToPlant: 9,
          containerType: 'cell-tray',
          cellSize: '2-inch',
          lightHours: 14,
          temperature: 70,
          humidity: 60,
          location: '',
          notes: '',
        });
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to create seed start');
      }
    } catch (error) {
      console.error('Error creating seed start:', error);
      showError('Network error');
    }
  };

  // Filter seed inventory by selected plant
  const filteredInventory = formData.plantId
    ? seedInventory.filter(s => s.plantId === formData.plantId)
    : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start Seeds Indoors">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plant Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plant *
          </label>
          <select
            value={formData.plantId}
            onChange={(e) => setFormData({ ...formData, plantId: e.target.value, variety: '', seedInventoryId: '' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="">Select a plant...</option>
            {plants.map(plant => (
              <option key={plant.id} value={plant.id}>
                {plant.icon} {plant.name}
              </option>
            ))}
          </select>
        </div>

        {/* Seed Inventory (optional) */}
        {filteredInventory.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Seed Inventory (optional)
            </label>
            <select
              value={formData.seedInventoryId}
              onChange={(e) => {
                const inventoryId = e.target.value;
                const selected = seedInventory.find(s => s.id === parseInt(inventoryId));
                setFormData({
                  ...formData,
                  seedInventoryId: inventoryId,
                  variety: selected?.variety || formData.variety,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">None (enter variety manually)</option>
              {filteredInventory.map(seed => (
                <option key={seed.id} value={seed.id}>
                  {seed.variety} - {seed.quantity} seeds{seed.brand ? ` (${seed.brand})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Variety */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variety (optional)
          </label>
          <input
            type="text"
            value={formData.variety}
            onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
            placeholder="e.g., Brandywine, Cherry Belle"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date *
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Desired Plants *
          </label>
          <input
            type="number"
            value={formData.desiredPlants}
            onChange={(e) => {
              const desired = parseInt(e.target.value) || 1;
              const calculated = Math.ceil(Math.ceil(desired / 0.85) * 1.15);
              setFormData({ ...formData, desiredPlants: desired, seedsToPlant: calculated });
            }}
            min="1"
            max="200"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* Seeds to Plant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seeds to Plant
          </label>
          <input
            type="number"
            value={formData.seedsToPlant}
            onChange={(e) => setFormData({ ...formData, seedsToPlant: parseInt(e.target.value) || 1 })}
            min="1"
            max="1000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Calculated from germination rate. Adjust if planting a different amount.</p>
        </div>

        {/* Container Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container Type
            </label>
            <select
              value={formData.containerType}
              onChange={(e) => setFormData({ ...formData, containerType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="cell-tray">Cell Tray</option>
              <option value="pot">Individual Pots</option>
              <option value="flat">Flat/Open Tray</option>
              <option value="soil-block">Soil Blocks</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cell/Pot Size
            </label>
            <select
              value={formData.cellSize}
              onChange={(e) => setFormData({ ...formData, cellSize: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="1-inch">1 inch</option>
              <option value="2-inch">2 inch</option>
              <option value="3-inch">3 inch</option>
              <option value="4-inch">4 inch</option>
            </select>
          </div>
        </div>

        {/* Growing Conditions */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Light (hrs/day)
            </label>
            <input
              type="number"
              value={formData.lightHours}
              onChange={(e) => setFormData({ ...formData, lightHours: parseInt(e.target.value) })}
              min="0"
              max="24"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temp (°F)
            </label>
            <input
              type="number"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseInt(e.target.value) })}
              min="40"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Humidity (%)
            </label>
            <input
              type="number"
              value={formData.humidity}
              onChange={(e) => setFormData({ ...formData, humidity: parseInt(e.target.value) })}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g., Basement grow rack, South window"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Any additional notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Start Seeds
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Edit Seed Start Modal Component
interface EditSeedStartModalProps {
  isOpen: boolean;
  seedStart: IndoorSeedStart;
  onClose: () => void;
  onSuccess: () => void;
  plants: Plant[];
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const EditSeedStartModal: React.FC<EditSeedStartModalProps> = ({
  isOpen,
  seedStart,
  onClose,
  onSuccess,
  plants,
  showSuccess,
  showError,
}) => {
  const [formData, setFormData] = useState({
    status: seedStart.status,
    startDate: seedStart.startDate?.split('T')[0] || '',
    seedsStarted: seedStart.seedsStarted || 0,
    seedsGerminated: seedStart.seedsGerminated || 0,
    actualGerminationDate: seedStart.actualGerminationDate?.split('T')[0] || '',
    lightHours: seedStart.lightHours || 14,
    temperature: seedStart.temperature || 70,
    humidity: seedStart.humidity || 60,
    notes: seedStart.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        status: formData.status,
        startDate: formData.startDate || undefined,
        seedsStarted: formData.seedsStarted,
        seedsGerminated: formData.seedsGerminated,
        actualGerminationDate: formData.actualGerminationDate || undefined,
        lightHours: formData.lightHours,
        temperature: formData.temperature,
        humidity: formData.humidity,
        notes: formData.notes || undefined,
      };

      const response = await apiPut(`/api/indoor-seed-starts/${seedStart.id}`, payload);

      if (response.ok) {
        showSuccess('Seed start updated successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to update seed start');
      }
    } catch (error) {
      console.error('Error updating seed start:', error);
      showError('Network error');
    }
  };

  const plant = plants.find(p => p.id === seedStart.plantId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update: ${plant?.name || seedStart.plantId}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="planned">Planned (not yet seeded)</option>
            <option value="seeded">Seeded</option>
            <option value="started">Started (not germinated yet)</option>
            <option value="germinating">Germinating</option>
            <option value="growing">Growing</option>
            <option value="hardening">Hardening Off</option>
            <option value="transplanted">Transplanted</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Germination Info */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seeds Planted
            </label>
            <input
              type="number"
              value={formData.seedsStarted}
              onChange={(e) => setFormData({ ...formData, seedsStarted: parseInt(e.target.value) || 0 })}
              min="0"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Germinated Count
            </label>
            <input
              type="number"
              value={formData.seedsGerminated}
              onChange={(e) => setFormData({ ...formData, seedsGerminated: parseInt(e.target.value) || 0 })}
              min="0"
              max={formData.seedsStarted}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">Out of {formData.seedsStarted} seeds</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Germination Date
            </label>
            <input
              type="date"
              value={formData.actualGerminationDate}
              onChange={(e) => setFormData({ ...formData, actualGerminationDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Growing Conditions */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Light (hrs/day)
            </label>
            <input
              type="number"
              value={formData.lightHours}
              onChange={(e) => setFormData({ ...formData, lightHours: parseInt(e.target.value) })}
              min="0"
              max="24"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temp (°F)
            </label>
            <input
              type="number"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseInt(e.target.value) })}
              min="40"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Humidity (%)
            </label>
            <input
              type="number"
              value={formData.humidity}
              onChange={(e) => setFormData({ ...formData, humidity: parseInt(e.target.value) })}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">Expected dates will recalculate if changed.</p>
        </div>

        {/* Expected Dates Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          {seedStart.expectedGerminationDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Expected Germination:</span>
              <span className="font-medium">{new Date(seedStart.expectedGerminationDate).toLocaleDateString()}</span>
            </div>
          )}
          {seedStart.expectedTransplantDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Expected Transplant:</span>
              <span className="font-medium">{new Date(seedStart.expectedTransplantDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Update
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default IndoorSeedStarts;
