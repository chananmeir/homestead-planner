import React, { useState, useEffect } from 'react';

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
}

interface Plant {
  id: string;
  name: string;
  category: string;
}

const SeedInventory: React.FC = () => {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load seeds
      const seedResponse = await fetch('http://localhost:5000/api/seeds');
      const seedData = await seedResponse.json();
      setSeeds(seedData);

      // Load plants
      const plantResponse = await fetch('http://localhost:5000/api/plants');
      const plantData = await plantResponse.json();
      setPlants(plantData);
    } catch (error) {
      console.error('Error loading seed inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlantInfo = (plantId: string): Plant | undefined => {
    return plants.find(p => p.id === plantId);
  };

  const getPlantName = (plantId: string): string => {
    const plant = getPlantInfo(plantId);
    return plant?.name || plantId;
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

  const categories = ['all', ...Array.from(new Set(plants.map(p => p.category)))];
  const filteredSeeds = filterCategory === 'all'
    ? seeds
    : seeds.filter(seed => {
        const plant = getPlantInfo(seed.plantId);
        return plant?.category === filterCategory;
      });

  const totalVarieties = seeds.length;
  const lowStock = seeds.filter(s => s.quantity <= 1).length;
  const expiringSoon = seeds.filter(s => isExpiringSoon(s.expirationDate) && !isExpired(s.expirationDate)).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Seed Inventory</h2>
        <p className="text-gray-600 mb-6">
          Manage your seed collection, track germination rates, and monitor expiration dates.
        </p>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-3xl font-bold text-green-700 mb-2">{totalVarieties}</div>
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

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
            Add New Seed
          </button>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-500">
          Full CRUD functionality coming soon. Currently displaying data from backend.
        </p>
      </div>

      {/* Seed Inventory Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Your Seed Collection</h3>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading seed inventory...</p>
          </div>
        ) : filteredSeeds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🌾</div>
            <p className="text-lg">No seeds in inventory yet.</p>
            <p className="text-sm mt-2">Add your seed collection to track varieties and expiration dates!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSeeds.map((seed) => {
              const expired = isExpired(seed.expirationDate);
              const expiring = isExpiringSoon(seed.expirationDate);
              const lowQuantity = seed.quantity <= 1;

              return (
                <div key={seed.id} className="bg-white border-2 border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
                  {/* Header with Alerts */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">{getPlantName(seed.plantId)}</h3>
                      <p className="text-sm text-gray-600">{seed.variety}</p>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
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
    </div>
  );
};

export default SeedInventory;
