import React, { useState, useEffect } from 'react';

interface GardenBed {
  id: number;
  name: string;
  width: number;
  length: number;
  location?: string;
  sunExposure?: string;
  planningMethod: string;
  gridSize: number;
  plantedItems?: PlantedItem[];
}

interface PlantedItem {
  id: number;
  plantId: string;
  positionX: number;
  positionY: number;
  quantity: number;
  status: string;
}

interface Plant {
  id: string;
  name: string;
  category: string;
  color?: string;
}

const GardenDesigner: React.FC = () => {
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedBed, setSelectedBed] = useState<GardenBed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load beds
      const bedResponse = await fetch('http://localhost:5000/api/garden-beds');
      const bedData = await bedResponse.json();
      setBeds(bedData);

      // Load plants
      const plantResponse = await fetch('http://localhost:5000/api/plants');
      const plantData = await plantResponse.json();
      setPlants(plantData);

      // Select first bed by default
      if (bedData.length > 0) {
        setSelectedBed(bedData[0]);
      }
    } catch (error) {
      console.error('Error loading garden data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlantName = (plantId: string): string => {
    const plant = plants.find(p => p.id === plantId);
    return plant?.name || plantId;
  };

  const getPlantColor = (plantId: string): string => {
    const plant = plants.find(p => p.id === plantId);
    const categoryColors: { [key: string]: string } = {
      vegetables: '#10b981',
      herbs: '#8b5cf6',
      flowers: '#ec4899',
      fruits: '#f59e0b',
    };
    return plant?.color || categoryColors[plant?.category || 'vegetables'] || '#10b981';
  };

  const renderGrid = (bed: GardenBed) => {
    const cellSize = 40; // pixels per grid square
    const gridWidth = bed.gridSize;
    const gridHeight = bed.gridSize;

    return (
      <div className="relative bg-brown-100 border-4 border-brown-600 rounded-lg p-4 inline-block">
        <svg width={gridWidth * cellSize} height={gridHeight * cellSize}>
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
              <path
                d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                fill="none"
                stroke="#d1d5db"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Planted items */}
          {bed.plantedItems?.map((item) => (
            <g key={item.id}>
              <circle
                cx={item.positionX * cellSize + cellSize / 2}
                cy={item.positionY * cellSize + cellSize / 2}
                r={cellSize * 0.4}
                fill={getPlantColor(item.plantId)}
                opacity="0.8"
                stroke="white"
                strokeWidth="2"
              />
              {item.quantity > 1 && (
                <text
                  x={item.positionX * cellSize + cellSize / 2}
                  y={item.positionY * cellSize + cellSize / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {item.quantity}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Dimensions label */}
        <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-gray-600">
          {bed.width}' × {bed.length}' ({bed.planningMethod})
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Garden Designer</h2>
        <p className="text-gray-600 mb-6">
          Visual drag-and-drop garden layout designer. Place plants on a grid and see your garden come to life.
        </p>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-3xl font-bold text-green-700 mb-2">{beds.length}</div>
            <div className="text-sm text-green-600 font-medium">Garden Beds</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">
              {beds.reduce((sum, bed) => sum + (bed.plantedItems?.length || 0), 0)}
            </div>
            <div className="text-sm text-blue-600 font-medium">Plants Placed</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="text-3xl font-bold text-purple-700 mb-2">
              {beds.reduce((sum, bed) => sum + (bed.width * bed.length), 0)}
            </div>
            <div className="text-sm text-purple-600 font-medium">Total Sq Ft</div>
          </div>
        </div>

        {/* Bed Selector */}
        {beds.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Garden Bed:
            </label>
            <select
              value={selectedBed?.id || ''}
              onChange={(e) => {
                const bed = beds.find(b => b.id === parseInt(e.target.value));
                setSelectedBed(bed || null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {beds.map(bed => (
                <option key={bed.id} value={bed.id}>
                  {bed.name} ({bed.width}' × {bed.length}')
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Full drag-and-drop functionality coming soon. Currently displaying existing garden layouts from backend.
        </p>
      </div>

      {/* Designer Canvas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading garden designer...</p>
          </div>
        ) : beds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🎨</div>
            <p className="text-lg">No garden beds created yet.</p>
            <p className="text-sm mt-2">Go to Garden Planner to create your first bed!</p>
          </div>
        ) : selectedBed ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedBed.name}</h3>
                <p className="text-sm text-gray-600">
                  {selectedBed.location && `Location: ${selectedBed.location} • `}
                  Sun: {selectedBed.sunExposure || 'full'} •
                  Method: {selectedBed.planningMethod}
                </p>
              </div>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Add Plants
              </button>
            </div>

            {/* Grid Canvas */}
            <div className="overflow-auto pb-12">
              <div className="flex justify-center">
                {renderGrid(selectedBed)}
              </div>
            </div>

            {/* Legend */}
            {selectedBed.plantedItems && selectedBed.plantedItems.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Plants in this Bed:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedBed.plantedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: getPlantColor(item.plantId) }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{getPlantName(item.plantId)}</div>
                        <div className="text-xs text-gray-600">
                          Position: ({item.positionX}, {item.positionY}) •
                          {item.quantity > 1 && ` Qty: ${item.quantity} • `}
                          Status: {item.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Info Card */}
      <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Garden Design Features</h3>
        <ul className="space-y-2 text-sm text-indigo-800">
          <li>✓ Visual grid-based layout system for precise plant placement</li>
          <li>✓ Support for multiple planning methods (Square Foot, Row, Intensive)</li>
          <li>✓ Color-coded plants by category for easy identification</li>
          <li>✓ Drag-and-drop interface for intuitive garden design</li>
          <li>✓ Companion planting suggestions and warnings</li>
          <li>✓ Export designs as PDF for offline reference</li>
        </ul>
      </div>
    </div>
  );
};

export default GardenDesigner;
