import React, { useState } from 'react';
import { GardenBed, PlantedItem, Plant } from '../types';
import { PLANT_DATABASE } from '../data/plantDatabase';
import { format } from 'date-fns';

const GardenPlanner: React.FC = () => {
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([
    {
      id: '1',
      name: 'Main Garden Bed 1',
      width: 4,
      length: 8,
      location: 'South Yard',
      sunExposure: 'full',
      plants: [],
    },
  ]);

  const [selectedBed, setSelectedBed] = useState<string>('1');
  const [showPlantSelector, setShowPlantSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const currentBed = gardenBeds.find((bed) => bed.id === selectedBed);

  const addNewBed = () => {
    const newBed: GardenBed = {
      id: String(Date.now()),
      name: `Garden Bed ${gardenBeds.length + 1}`,
      width: 4,
      length: 8,
      location: 'New Location',
      sunExposure: 'full',
      plants: [],
    };
    setGardenBeds([...gardenBeds, newBed]);
    setSelectedBed(newBed.id);
  };

  const addPlantToBed = (plant: Plant) => {
    if (!currentBed) return;

    const newPlantedItem: PlantedItem = {
      id: String(Date.now()),
      plantId: plant.id,
      plantedDate: new Date(),
      position: { x: 0, y: 0 },
      quantity: 1,
      status: 'planned',
      notes: '',
    };

    const updatedBeds = gardenBeds.map((bed) =>
      bed.id === selectedBed
        ? { ...bed, plants: [...bed.plants, newPlantedItem] }
        : bed
    );

    setGardenBeds(updatedBeds);
    setShowPlantSelector(false);
  };

  const removePlantFromBed = (plantedItemId: string) => {
    const updatedBeds = gardenBeds.map((bed) =>
      bed.id === selectedBed
        ? { ...bed, plants: bed.plants.filter((p) => p.id !== plantedItemId) }
        : bed
    );
    setGardenBeds(updatedBeds);
  };

  const updatePlantStatus = (plantedItemId: string, status: PlantedItem['status']) => {
    const updatedBeds = gardenBeds.map((bed) =>
      bed.id === selectedBed
        ? {
            ...bed,
            plants: bed.plants.map((p) =>
              p.id === plantedItemId ? { ...p, status } : p
            ),
          }
        : bed
    );
    setGardenBeds(updatedBeds);
  };

  const filteredPlants = PLANT_DATABASE.filter(
    (plant) =>
      plant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plant.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPlantById = (plantId: string): Plant | undefined => {
    return PLANT_DATABASE.find((p) => p.id === plantId);
  };

  const getFrostToleranceColor = (tolerance: string) => {
    switch (tolerance) {
      case 'very-hardy':
        return 'bg-blue-100 text-blue-800';
      case 'hardy':
        return 'bg-green-100 text-green-800';
      case 'half-hardy':
        return 'bg-yellow-100 text-yellow-800';
      case 'tender':
        return 'bg-orange-100 text-orange-800';
      case 'very-tender':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Garden Planner</h2>
        <p className="text-gray-600">
          Design your garden beds, select plants, and track their growth throughout
          the season.
        </p>
      </div>

      {/* Bed Selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-700">Garden Beds</h3>
          <button
            onClick={addNewBed}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add Bed
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gardenBeds.map((bed) => (
            <button
              key={bed.id}
              onClick={() => setSelectedBed(bed.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedBed === bed.id
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <h4 className="font-semibold text-gray-800">{bed.name}</h4>
              <p className="text-sm text-gray-600">
                {bed.width}' × {bed.length}' • {bed.sunExposure} sun
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {bed.plants.length} plants
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Current Bed Details */}
      {currentBed && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-700">
                {currentBed.name}
              </h3>
              <p className="text-sm text-gray-600">
                {currentBed.location} • {currentBed.width}' × {currentBed.length}'
              </p>
            </div>
            <button
              onClick={() => setShowPlantSelector(!showPlantSelector)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {showPlantSelector ? 'Close' : '+ Add Plant'}
            </button>
          </div>

          {/* Plant Selector */}
          {showPlantSelector && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <input
                type="text"
                placeholder="Search plants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg mb-4"
              />
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredPlants.map((plant) => (
                  <div
                    key={plant.id}
                    onClick={() => addPlantToBed(plant)}
                    className="p-3 bg-white rounded border hover:border-green-500 cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">
                          {plant.name}
                        </h4>
                        <p className="text-sm text-gray-600 italic">
                          {plant.scientificName}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {plant.category}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${getFrostToleranceColor(
                              plant.frostTolerance
                            )}`}
                          >
                            {plant.frostTolerance}
                          </span>
                          {plant.winterHardy && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              ❄️ Winter Hardy
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <div>{plant.daysToMaturity} days</div>
                        <div className="text-xs">{plant.spacing}" spacing</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planted Items */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700">Planted Items</h4>
            {currentBed.plants.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No plants added yet. Click "Add Plant" to get started.
              </p>
            ) : (
              currentBed.plants.map((plantedItem) => {
                const plant = getPlantById(plantedItem.plantId);
                if (!plant) return null;

                return (
                  <div
                    key={plantedItem.id}
                    className="p-4 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-800">
                          {plant.name}
                        </h5>
                        <p className="text-sm text-gray-600">
                          Planted: {format(plantedItem.plantedDate, 'MMM d, yyyy')}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                            Qty: {plantedItem.quantity}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              plantedItem.status === 'harvested'
                                ? 'bg-green-100 text-green-800'
                                : plantedItem.status === 'growing'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {plantedItem.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={plantedItem.status}
                          onChange={(e) =>
                            updatePlantStatus(
                              plantedItem.id,
                              e.target.value as PlantedItem['status']
                            )
                          }
                          className="text-sm px-2 py-1 border rounded"
                        >
                          <option value="planned">Planned</option>
                          <option value="seeded">Seeded</option>
                          <option value="transplanted">Transplanted</option>
                          <option value="growing">Growing</option>
                          <option value="harvested">Harvested</option>
                        </select>
                        <button
                          onClick={() => removePlantFromBed(plantedItem.id)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Garden Planning Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Plan succession plantings every 2-3 weeks for continuous harvest</li>
          <li>• Consider companion planting for natural pest control</li>
          <li>• Group plants by water needs for efficient irrigation</li>
          <li>• Rotate crop families each season to prevent soil depletion</li>
        </ul>
      </div>
    </div>
  );
};

export default GardenPlanner;
