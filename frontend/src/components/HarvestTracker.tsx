import React, { useState, useEffect } from 'react';

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
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load harvests
      const harvestResponse = await fetch('http://localhost:5000/api/harvests');
      const harvestData = await harvestResponse.json();
      setHarvests(harvestData);

      // Load plants
      const plantResponse = await fetch('http://localhost:5000/api/plants');
      const plantData = await plantResponse.json();
      setPlants(plantData);

      // Load stats
      const statsResponse = await fetch('http://localhost:5000/api/harvests/stats');
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading harvest data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlantName = (plantId: string): string => {
    const plant = plants.find(p => p.id === plantId);
    return plant?.name || plantId;
  };

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

  const totalHarvested = harvests.reduce((sum, h) => sum + h.quantity, 0);
  const uniquePlants = new Set(harvests.map(h => h.plantId)).size;

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
            <div className="text-3xl font-bold text-green-700 mb-2">{harvests.length}</div>
            <div className="text-sm text-green-600 font-medium">Total Harvests</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">{uniquePlants}</div>
            <div className="text-sm text-blue-600 font-medium">Different Plants</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
            <div className="text-3xl font-bold text-amber-700 mb-2">{totalHarvested.toFixed(1)}</div>
            <div className="text-sm text-amber-600 font-medium">Total Yield (various units)</div>
          </div>
        </div>

        {/* Add New Harvest Button */}
        <div className="mb-6">
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
            Log New Harvest
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Full CRUD functionality coming soon. Currently displaying data from backend.
          </p>
        </div>
      </div>

      {/* Harvest Records */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Harvests</h3>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading harvests...</p>
          </div>
        ) : harvests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🧺</div>
            <p className="text-lg">No harvests recorded yet.</p>
            <p className="text-sm mt-2">Start logging your harvests to track your garden's productivity!</p>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {harvests.map((harvest) => (
                  <tr key={harvest.id} className="hover:bg-gray-50">
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
    </div>
  );
};

export default HarvestTracker;
