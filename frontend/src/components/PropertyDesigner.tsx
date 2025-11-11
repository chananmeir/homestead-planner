import React, { useState, useEffect } from 'react';

interface Property {
  id: number;
  name: string;
  width: number;
  length: number;
  address?: string;
  zone?: string;
  soilType?: string;
  slope?: string;
  notes?: string;
  placedStructures?: PlacedStructure[];
}

interface PlacedStructure {
  id: number;
  structureId: string;
  name: string;
  positionX: number;
  positionY: number;
  rotation: number;
  cost?: number;
  notes?: string;
}

interface Structure {
  id: string;
  name: string;
  category: string;
  width: number;
  length: number;
  description?: string;
  icon?: string;
}

const PropertyDesigner: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load properties
      const propResponse = await fetch('http://localhost:5000/api/properties');
      const propData = await propResponse.json();
      setProperties(propData);

      // Load structures
      const structResponse = await fetch('http://localhost:5000/api/structures');
      const structData = await structResponse.json();
      setStructures(structData.structures || []);

      // Select first property by default
      if (propData.length > 0) {
        setSelectedProperty(propData[0]);
      }
    } catch (error) {
      console.error('Error loading property data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStructureName = (structureId: string): string => {
    const structure = structures.find(s => s.id === structureId);
    return structure?.name || structureId;
  };

  const getStructureIcon = (structureId: string): string => {
    const structure = structures.find(s => s.id === structureId);
    const categoryIcons: { [key: string]: string } = {
      coops: '🐔',
      greenhouses: '🏡',
      storage: '🏚️',
      water: '💧',
      fencing: '🚧',
      garden: '🌱',
      orchard: '🌳',
      other: '🏗️'
    };
    return structure?.icon || categoryIcons[structure?.category || 'other'] || '🏗️';
  };

  const renderPropertyMap = (property: Property) => {
    const scale = 10; // pixels per foot
    const canvasWidth = property.width * scale;
    const canvasHeight = property.length * scale;

    return (
      <div className="relative bg-green-100 border-4 border-green-700 rounded-lg p-4 inline-block">
        <svg width={canvasWidth} height={canvasHeight}>
          {/* Property background */}
          <rect width="100%" height="100%" fill="#86efac" opacity="0.3" />

          {/* Grid lines (every 10 feet) */}
          {Array.from({ length: Math.floor(property.width / 10) + 1 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * 10 * scale}
              y1="0"
              x2={i * 10 * scale}
              y2={canvasHeight}
              stroke="#d1d5db"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}
          {Array.from({ length: Math.floor(property.length / 10) + 1 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1="0"
              y1={i * 10 * scale}
              x2={canvasWidth}
              y2={i * 10 * scale}
              stroke="#d1d5db"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Placed structures */}
          {property.placedStructures?.map((placed) => {
            const structure = structures.find(s => s.id === placed.structureId);
            const width = (structure?.width || 10) * scale;
            const height = (structure?.length || 10) * scale;
            const x = placed.positionX * scale;
            const y = placed.positionY * scale;

            return (
              <g key={placed.id}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill="#3b82f6"
                  opacity="0.6"
                  stroke="#1e40af"
                  strokeWidth="2"
                  rx="4"
                />
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                >
                  {getStructureIcon(placed.structureId)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dimensions label */}
        <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-gray-600">
          {property.width}' × {property.length}' property
        </div>
      </div>
    );
  };

  const structureCategories = Array.from(new Set(structures.map(s => s.category)));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Property Designer</h2>
            <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold mt-2">
              ⭐ NEW FEATURE
            </span>
          </div>
        </div>
        <p className="text-gray-600 mb-6">
          Master homestead layout designer! Place coops, greenhouses, orchards, sheds, and all structures on your entire property.
        </p>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-3xl font-bold text-green-700 mb-2">{properties.length}</div>
            <div className="text-sm text-green-600 font-medium">Properties</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">
              {properties.reduce((sum, prop) => sum + (prop.placedStructures?.length || 0), 0)}
            </div>
            <div className="text-sm text-blue-600 font-medium">Structures</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="text-3xl font-bold text-purple-700 mb-2">{structures.length}</div>
            <div className="text-sm text-purple-600 font-medium">Available Types</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
            <div className="text-3xl font-bold text-amber-700 mb-2">
              {properties.reduce((sum, prop) => sum + (prop.width * prop.length), 0).toLocaleString()}
            </div>
            <div className="text-sm text-amber-600 font-medium">Total Sq Ft</div>
          </div>
        </div>

        {/* Property Selector */}
        {properties.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Property:
            </label>
            <select
              value={selectedProperty?.id || ''}
              onChange={(e) => {
                const prop = properties.find(p => p.id === parseInt(e.target.value));
                setSelectedProperty(prop || null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {properties.map(prop => (
                <option key={prop.id} value={prop.id}>
                  {prop.name} ({prop.width}' × {prop.length}')
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Full drag-and-drop functionality coming soon. Currently displaying existing property layouts from backend.
        </p>
      </div>

      {/* Designer Canvas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading property designer...</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-lg">No properties created yet.</p>
            <p className="text-sm mt-2">Create your first property to start designing your homestead layout!</p>
            <button className="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
              Create Property
            </button>
          </div>
        ) : selectedProperty ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedProperty.name}</h3>
                <div className="text-sm text-gray-600 mt-1 space-y-1">
                  {selectedProperty.address && <div>📍 {selectedProperty.address}</div>}
                  {selectedProperty.zone && <div>🌡️ Zone: {selectedProperty.zone}</div>}
                  {selectedProperty.soilType && <div>🌱 Soil: {selectedProperty.soilType}</div>}
                  {selectedProperty.slope && <div>⛰️ Slope: {selectedProperty.slope}</div>}
                </div>
              </div>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Add Structure
              </button>
            </div>

            {/* Property Map */}
            <div className="overflow-auto pb-12">
              <div className="flex justify-center">
                {renderPropertyMap(selectedProperty)}
              </div>
            </div>

            {/* Structures List */}
            {selectedProperty.placedStructures && selectedProperty.placedStructures.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Structures on Property:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedProperty.placedStructures.map((placed) => (
                    <div key={placed.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
                      <div className="text-3xl">{getStructureIcon(placed.structureId)}</div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {placed.name || getStructureName(placed.structureId)}
                        </div>
                        <div className="text-xs text-gray-600">
                          Position: ({placed.positionX}', {placed.positionY}')
                          {placed.cost && ` • Cost: $${placed.cost.toLocaleString()}`}
                        </div>
                        {placed.notes && (
                          <div className="text-xs text-gray-500 mt-1">{placed.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProperty.notes && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Property Notes:</h4>
                <p className="text-sm text-blue-800">{selectedProperty.notes}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Available Structures */}
      {structures.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Available Structures ({structures.length})</h3>
          <div className="space-y-4">
            {structureCategories.map(category => {
              const categoryStructures = structures.filter(s => s.category === category);
              return (
                <div key={category}>
                  <h4 className="font-semibold text-gray-700 mb-2 capitalize">{category}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {categoryStructures.map(structure => (
                      <div
                        key={structure.id}
                        className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-center cursor-pointer transition-colors"
                      >
                        <div className="text-2xl mb-1">{getStructureIcon(structure.id)}</div>
                        <div className="text-xs font-medium text-gray-800">{structure.name}</div>
                        <div className="text-xs text-gray-500">{structure.width}' × {structure.length}'</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">Property Design Features</h3>
        <ul className="space-y-2 text-sm text-yellow-800">
          <li>✓ 35+ homestead structures including coops, greenhouses, sheds, orchards, and more</li>
          <li>✓ Master layout view of your entire property at scale</li>
          <li>✓ Track structure costs and build out your homestead incrementally</li>
          <li>✓ Consider sun exposure, water access, and slopes in your design</li>
          <li>✓ Plan zones (annual garden, perennial orchard, livestock, storage, etc.)</li>
          <li>✓ Export property maps for contractors and planning permits</li>
        </ul>
      </div>
    </div>
  );
};

export default PropertyDesigner;
