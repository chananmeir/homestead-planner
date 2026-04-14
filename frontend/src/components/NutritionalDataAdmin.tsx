/**
 * Nutritional Data Admin Component - Phase 2
 *
 * Full CRUD interface with USDA API integration for nutritional data management.
 * Supports searching USDA FoodData Central and importing nutritional data.
 */

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import type { NutritionalData } from '../types';
import { Modal } from './common/Modal';

interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
}

interface USDASearchResults {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: USDAFood[];
}

const NutritionalDataAdmin: React.FC = () => {
  const [nutritionalData, setNutritionalData] = useState<NutritionalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'plant' | 'livestock'>('all');

  // USDA Search state
  const [showUSDASearch, setShowUSDASearch] = useState(false);
  const [usdaSearchQuery, setUsdaSearchQuery] = useState('');
  const [usdaSearchResults, setUsdaSearchResults] = useState<USDASearchResults | null>(null);
  const [usdaSearchLoading, setUsdaSearchLoading] = useState(false);
  const [usdaSearchError, setUsdaSearchError] = useState<string | null>(null);

  // Import state
  const [importingFdcId, setImportingFdcId] = useState<number | null>(null);
  const [importSourceId, setImportSourceId] = useState('');
  const [importYieldPerPlant, setImportYieldPerPlant] = useState('');
  const [importYieldPerSqft, setImportYieldPerSqft] = useState('');
  const [importIsGlobal, setImportIsGlobal] = useState(true);

  // Load nutritional data from API
  useEffect(() => {
    loadNutritionalData();
  }, [filter]);

  const loadNutritionalData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('source_type', filter);
      }

      const response = await fetch(`${API_BASE_URL}/api/nutrition/data?${params}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Failed to load nutritional data');
      }

      const data = await response.json();
      setNutritionalData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchUSDA = async () => {
    if (!usdaSearchQuery.trim()) {
      setUsdaSearchError('Please enter a search term');
      return;
    }

    setUsdaSearchLoading(true);
    setUsdaSearchError(null);

    try {
      const params = new URLSearchParams({
        query: usdaSearchQuery,
        page_size: '20'
      });

      const response = await fetch(`${API_BASE_URL}/api/nutrition/usda/search?${params}`, { credentials: 'include' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search USDA database');
      }

      const data = await response.json();
      setUsdaSearchResults(data);
    } catch (err) {
      setUsdaSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setUsdaSearchLoading(false);
    }
  };

  const startImport = (food: USDAFood) => {
    setImportingFdcId(food.fdcId);
    // Pre-fill source_id from food description (remove special chars, lowercase)
    const suggestedSourceId = food.description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    setImportSourceId(suggestedSourceId);
    setImportYieldPerPlant('');
    setImportYieldPerSqft('');
  };

  const cancelImport = () => {
    setImportingFdcId(null);
    setImportSourceId('');
    setImportYieldPerPlant('');
    setImportYieldPerSqft('');
  };

  const executeImport = async () => {
    if (!importSourceId.trim()) {
      alert('Please enter a source ID (e.g., "tomato", "broccoli")');
      return;
    }

    setUsdaSearchLoading(true);
    setUsdaSearchError(null);

    try {
      const body = {
        fdc_id: importingFdcId,
        source_id: importSourceId.trim(),
        yield_lbs_per_plant: importYieldPerPlant ? parseFloat(importYieldPerPlant) : undefined,
        yield_lbs_per_sqft: importYieldPerSqft ? parseFloat(importYieldPerSqft) : undefined,
        is_global: importIsGlobal
      };

      const response = await fetch(`${API_BASE_URL}/api/nutrition/usda/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      // Success
      alert('Successfully imported nutritional data!');
      cancelImport();
      loadNutritionalData(); // Reload data
      setShowUSDASearch(false); // Close search modal
    } catch (err) {
      setUsdaSearchError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUsdaSearchLoading(false);
    }
  };

  const deleteEntry = async (id: number, name: string) => {
    if (!window.confirm(`Delete nutritional data for "${name}"?\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/nutrition/data/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      alert('Nutritional data deleted successfully');
      loadNutritionalData();
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            🥬 Nutritional Data Management
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUSDASearch(true)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              🔍 Search USDA Database
            </button>
            <button
              onClick={loadNutritionalData}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setFilter('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All ({nutritionalData.length})
            </button>
            <button
              onClick={() => setFilter('plant')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'plant'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Plants
            </button>
            <button
              onClick={() => setFilter('livestock')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'livestock'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Livestock (Phase 3)
            </button>
          </nav>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Loading nutritional data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Calories
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Protein (g)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Yield/Plant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {nutritionalData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No nutritional data found
                    </td>
                  </tr>
                ) : (
                  nutritionalData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          {item.sourceType}: {item.sourceId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {item.sourceType}
                        </span>
                        {item.userId && (
                          <span className="ml-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.calories ? `${item.calories} cal` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.proteinG ? `${item.proteinG}g` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.averageYieldLbsPerPlant ? `${item.averageYieldLbsPerPlant} lbs` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.dataSource || '-'}
                        {item.usdaFdcId && (
                          <div className="text-xs text-blue-600">
                            USDA: {item.usdaFdcId}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.userId && (
                          <button
                            onClick={() => deleteEntry(item.id, item.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Stats */}
        {!loading && !error && nutritionalData.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <div className="text-2xl font-bold text-blue-900">
                {nutritionalData.length}
              </div>
              <div className="text-sm text-blue-700">Total Entries</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <div className="text-2xl font-bold text-green-900">
                {nutritionalData.filter(d => d.sourceType === 'plant').length}
              </div>
              <div className="text-sm text-green-700">Plant Entries</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded p-4">
              <div className="text-2xl font-bold text-purple-900">
                {nutritionalData.filter(d => d.usdaFdcId).length}
              </div>
              <div className="text-sm text-purple-700">USDA Linked</div>
            </div>
          </div>
        )}
      </div>

      {/* USDA Search Modal */}
      <Modal
        isOpen={showUSDASearch}
        onClose={() => setShowUSDASearch(false)}
        title="🔍 Search USDA FoodData Central"
      >
        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search for food
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={usdaSearchQuery}
                onChange={(e) => setUsdaSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUSDA()}
                placeholder="e.g., tomato raw, broccoli, spinach"
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={searchUSDA}
                disabled={usdaSearchLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {usdaSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tip: Include "raw" in your search for fresh produce (e.g., "tomato raw")
            </p>
          </div>

          {/* Search Error */}
          {usdaSearchError && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">{usdaSearchError}</p>
            </div>
          )}

          {/* Search Results */}
          {usdaSearchResults && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Results ({usdaSearchResults.totalHits} total)
              </h3>

              {usdaSearchResults.foods.length === 0 ? (
                <p className="text-gray-500 text-sm">No results found. Try a different search term.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {usdaSearchResults.foods.map((food) => (
                    <div
                      key={food.fdcId}
                      className="border rounded p-3 hover:bg-gray-50"
                    >
                      {importingFdcId === food.fdcId ? (
                        // Import Form
                        <div className="space-y-3">
                          <div className="font-medium text-gray-900">{food.description}</div>
                          <div className="text-xs text-gray-500">
                            FDC ID: {food.fdcId} | Type: {food.dataType}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Source ID (required)
                              </label>
                              <input
                                type="text"
                                value={importSourceId}
                                onChange={(e) => setImportSourceId(e.target.value)}
                                placeholder="e.g., tomato"
                                className="w-full px-2 py-1 text-sm border rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Yield/Plant (lbs)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={importYieldPerPlant}
                                onChange={(e) => setImportYieldPerPlant(e.target.value)}
                                placeholder="Optional"
                                className="w-full px-2 py-1 text-sm border rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Yield/SqFt (lbs)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={importYieldPerSqft}
                                onChange={(e) => setImportYieldPerSqft(e.target.value)}
                                placeholder="Optional"
                                className="w-full px-2 py-1 text-sm border rounded"
                              />
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={importIsGlobal}
                                onChange={(e) => setImportIsGlobal(e.target.checked)}
                                className="mr-2"
                              />
                              <label className="text-xs text-gray-700">
                                Global (all users)
                              </label>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={executeImport}
                              disabled={usdaSearchLoading}
                              className="flex-1 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400"
                            >
                              {usdaSearchLoading ? 'Importing...' : 'Import'}
                            </button>
                            <button
                              onClick={cancelImport}
                              disabled={usdaSearchLoading}
                              className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Search Result Display
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{food.description}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              FDC ID: {food.fdcId} | Type: {food.dataType}
                              {food.brandOwner && ` | Brand: ${food.brandOwner}`}
                            </div>
                          </div>
                          <button
                            onClick={() => startImport(food)}
                            className="ml-4 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                          >
                            Import
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default NutritionalDataAdmin;
