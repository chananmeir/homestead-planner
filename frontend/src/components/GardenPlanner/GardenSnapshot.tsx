import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import type { GardenSnapshotResponse } from '../../types';
import { useToday } from '../../contexts/SimulationContext';

const GardenSnapshot: React.FC = () => {
  const today = useToday();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<GardenSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (date) {
      loadSnapshot(date);
    }
  }, [date]);

  const loadSnapshot = async (targetDate: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/api/garden-planner/garden-snapshot?date=${targetDate}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch snapshot');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading garden snapshot:', err);
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Sort entries by totalQuantity descending
  const sortedEntries = data
    ? Object.entries(data.byPlant).sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
    : [];

  return (
    <div>
      {/* Date Picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Snapshot Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-pulse text-gray-500">Loading snapshot...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-green-600 text-sm font-semibold">Total Plants</div>
              <div className="text-3xl font-bold text-green-900">{data.summary.totalPlants}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-blue-600 text-sm font-semibold">Unique Varieties</div>
              <div className="text-3xl font-bold text-blue-900">{data.summary.uniqueVarieties}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-purple-600 text-sm font-semibold">Beds with Plants</div>
              <div className="text-3xl font-bold text-purple-900">{data.summary.bedsWithPlants}</div>
            </div>
          </div>

          {/* Plant Table */}
          {sortedEntries.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600">No plants are active on this date.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Plant</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Variety</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Count</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Beds</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map(([key, entry]) => (
                    <React.Fragment key={key}>
                      <tr
                        className="border-t hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(key)}
                      >
                        <td className="px-4 py-3">
                          <span className="mr-2 text-gray-400 text-xs">
                            {expandedKeys.has(key) ? '▼' : '▶'}
                          </span>
                          {entry.plantName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {entry.variety || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {entry.totalQuantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {entry.beds.length}
                        </td>
                      </tr>
                      {expandedKeys.has(key) && entry.beds.map(bed => (
                        <tr key={`${key}-${bed.bedId}`} className="bg-gray-50 border-t border-gray-100">
                          <td className="px-4 py-2 pl-10 text-sm text-gray-500" colSpan={2}>
                            {bed.bedName}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {bed.quantity}
                          </td>
                          <td className="px-4 py-2" />
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GardenSnapshot;
