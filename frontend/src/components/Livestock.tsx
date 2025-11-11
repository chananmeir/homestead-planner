import React, { useState, useEffect } from 'react';

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

const Livestock: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'chickens' | 'ducks' | 'bees' | 'other'>('chickens');
  const [chickens, setChickens] = useState<Animal[]>([]);
  const [ducks, setDucks] = useState<Animal[]>([]);
  const [beehives, setBeehives] = useState<Beehive[]>([]);
  const [otherLivestock, setOtherLivestock] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeCategory === 'chickens') {
        const response = await fetch('http://localhost:5000/api/chickens');
        const data = await response.json();
        setChickens(data);
      } else if (activeCategory === 'ducks') {
        const response = await fetch('http://localhost:5000/api/ducks');
        const data = await response.json();
        setDucks(data);
      } else if (activeCategory === 'bees') {
        const response = await fetch('http://localhost:5000/api/beehives');
        const data = await response.json();
        setBeehives(data);
      } else if (activeCategory === 'other') {
        const response = await fetch('http://localhost:5000/api/livestock');
        const data = await response.json();
        setOtherLivestock(data);
      }
    } catch (error) {
      console.error('Error loading livestock:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'chickens' as const, name: 'Chickens', icon: '🐔', color: 'amber' },
    { id: 'ducks' as const, name: 'Ducks', icon: '🦆', color: 'blue' },
    { id: 'bees' as const, name: 'Beehives', icon: '🐝', color: 'yellow' },
    { id: 'other' as const, name: 'Other Livestock', icon: '🐐', color: 'green' },
  ];

  const renderAnimals = (animals: Animal[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {animals.length === 0 ? (
        <div className="col-span-full text-center py-8 text-gray-500">
          No {activeCategory} recorded yet. Click "Add New" to get started.
        </div>
      ) : (
        animals.map((animal) => (
          <div key={animal.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{animal.name}</h3>
                {animal.breed && <p className="text-sm text-gray-600">{animal.breed}</p>}
              </div>
              {animal.quantity && animal.quantity > 1 && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {animal.quantity}
                </span>
              )}
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

  const renderBeehives = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {beehives.length === 0 ? (
        <div className="col-span-full text-center py-8 text-gray-500">
          No beehives recorded yet. Click "Add New" to get started.
        </div>
      ) : (
        beehives.map((hive) => (
          <div key={hive.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{hive.name}</h3>
                {hive.type && <p className="text-sm text-gray-600">{hive.type}</p>}
              </div>
              {hive.queenMarked && hive.queenColor && (
                <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-${hive.queenColor}-100 text-${hive.queenColor}-800`}>
                  Queen: {hive.queenColor}
                </span>
              )}
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
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeCategory === category.id
                  ? `bg-${category.color}-500 text-white shadow-md`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* Add New Button */}
        <div className="mb-6">
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
            Add New {categories.find(c => c.id === activeCategory)?.name.slice(0, -1) || 'Animal'}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Full CRUD functionality coming soon. Currently displaying data from backend.
          </p>
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
            {activeCategory === 'chickens' && renderAnimals(chickens)}
            {activeCategory === 'ducks' && renderAnimals(ducks)}
            {activeCategory === 'bees' && renderBeehives()}
            {activeCategory === 'other' && renderAnimals(otherLivestock)}
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
    </div>
  );
};

export default Livestock;
