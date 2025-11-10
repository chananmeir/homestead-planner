import React, { useState } from 'react';
import { WinterGardenPlan } from '../types';
import { getWinterHardyPlants } from '../data/plantDatabase';
import { format } from 'date-fns';

const WinterGarden: React.FC = () => {
  const [winterPlans, setWinterPlans] = useState<WinterGardenPlan[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [selectedTechnique, setSelectedTechnique] = useState<
    WinterGardenPlan['technique']
  >('quick-hoops');
  const [protectionLayers, setProtectionLayers] = useState(1);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);

  const winterHardyPlants = getWinterHardyPlants();

  const techniques = [
    {
      id: 'quick-hoops' as const,
      name: 'Quick Hoops (Low Tunnels)',
      description:
        'Wire hoops covered with row cover. Easy to install, provides ~10-15°F protection per layer.',
      layers: 1,
      cost: '$',
      difficulty: 'Easy',
    },
    {
      id: 'caterpillar-tunnel' as const,
      name: 'Caterpillar Tunnel',
      description:
        'Moveable hoop house structure. Excellent for extending season and protecting crops.',
      layers: 2,
      cost: '$$',
      difficulty: 'Medium',
    },
    {
      id: 'cold-frame' as const,
      name: 'Cold Frame',
      description:
        'Glass or plastic box that traps solar heat. Ideal for lettuce, spinach, and hardy greens.',
      layers: 1,
      cost: '$$',
      difficulty: 'Medium',
    },
    {
      id: 'four-season-harvest' as const,
      name: 'Four-Season Harvest System',
      description:
        "Eliot Coleman's multi-layer approach: greenhouse + row cover for year-round production.",
      layers: 2,
      cost: '$$$',
      difficulty: 'Advanced',
    },
  ];

  const addWinterPlan = () => {
    if (selectedPlants.length === 0) return;

    const newPlan: WinterGardenPlan = {
      gardenBedId: `bed-${Date.now()}`,
      technique: selectedTechnique,
      plantList: selectedPlants,
      protectionLayers,
      harvestWindow: {
        start: new Date(),
        end: new Date(new Date().setMonth(new Date().getMonth() + 4)),
      },
      notes: '',
    };

    setWinterPlans([...winterPlans, newPlan]);
    setShowAddPlan(false);
    setSelectedPlants([]);
  };

  const removePlan = (index: number) => {
    setWinterPlans(winterPlans.filter((_, i) => i !== index));
  };

  const togglePlantSelection = (plantId: string) => {
    setSelectedPlants((prev) =>
      prev.includes(plantId)
        ? prev.filter((id) => id !== plantId)
        : [...prev, plantId]
    );
  };

  const calculateTemperatureProtection = (layers: number) => {
    return layers * 12; // Approximately 12°F per layer
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          ❄️ Winter Garden Planning
        </h2>
        <p className="text-gray-600 mb-4">
          Extend your growing season using proven techniques from Eliot Coleman and
          Nico Jabour. Grow fresh greens and vegetables throughout winter!
        </p>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            The Four-Season Harvest Principle
          </h3>
          <p className="text-sm text-blue-800">
            Each layer of protection (greenhouse, tunnel, row cover) adds approximately
            10-15°F of frost protection. With proper planning and hardy varieties, you
            can harvest fresh vegetables even in winter climates.
          </p>
        </div>
      </div>

      {/* Season Extension Techniques */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Season Extension Techniques
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {techniques.map((technique) => (
            <div
              key={technique.id}
              className="p-4 border-2 rounded-lg hover:border-green-500 transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-800">{technique.name}</h4>
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {technique.cost}
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {technique.difficulty}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">{technique.description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">Protection:</span>
                <span>+{calculateTemperatureProtection(technique.layers)}°F</span>
                <span className="text-xs text-gray-500">
                  ({technique.layers} {technique.layers === 1 ? 'layer' : 'layers'})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Winter Plan */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <button
          onClick={() => setShowAddPlan(!showAddPlan)}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {showAddPlan ? 'Cancel' : '+ Create Winter Garden Plan'}
        </button>

        {showAddPlan && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Protection Method
                </label>
                <select
                  value={selectedTechnique}
                  onChange={(e) =>
                    setSelectedTechnique(
                      e.target.value as WinterGardenPlan['technique']
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {techniques.map((technique) => (
                    <option key={technique.id} value={technique.id}>
                      {technique.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Protection Layers
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="3"
                    value={protectionLayers}
                    onChange={(e) => setProtectionLayers(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-lg font-semibold text-gray-700 w-12">
                    {protectionLayers}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Temperature protection: ~
                  {calculateTemperatureProtection(protectionLayers)}°F
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Winter-Hardy Plants
                </label>
                <div className="max-h-64 overflow-y-auto space-y-2 p-3 bg-white rounded border">
                  {winterHardyPlants.map((plant) => (
                    <label
                      key={plant.id}
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlants.includes(plant.id)}
                        onChange={() => togglePlantSelection(plant.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {plant.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {plant.frostTolerance} • {plant.daysToMaturity} days
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedPlants.length} plants
                </p>
              </div>

              <button
                onClick={addWinterPlan}
                disabled={selectedPlants.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Create Plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Winter Plans */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Your Winter Garden Plans
        </h3>

        {winterPlans.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No winter plans created yet. Start planning your year-round harvest!
          </p>
        ) : (
          <div className="space-y-4">
            {winterPlans.map((plan, index) => (
              <div key={index} className="p-4 border rounded-lg bg-blue-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {
                        techniques.find((t) => t.id === plan.technique)
                          ?.name
                      }
                    </h4>
                    <p className="text-sm text-gray-600">
                      {plan.protectionLayers}{' '}
                      {plan.protectionLayers === 1 ? 'layer' : 'layers'} •
                      ~{calculateTemperatureProtection(plan.protectionLayers)}°F
                      protection
                    </p>
                  </div>
                  <button
                    onClick={() => removePlan(index)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>

                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Planned Crops ({plan.plantList.length}):
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {plan.plantList.map((plantId) => {
                      const plant = winterHardyPlants.find(
                        (p) => p.id === plantId
                      );
                      return plant ? (
                        <span
                          key={plantId}
                          className="px-2 py-1 bg-white text-sm rounded border"
                        >
                          {plant.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  Harvest window: {format(plan.harvestWindow.start, 'MMM d')} -{' '}
                  {format(plan.harvestWindow.end, 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coleman's Winter Harvest Tips */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">
          🌿 Eliot Coleman's Winter Harvest Wisdom
        </h3>
        <div className="space-y-3 text-sm text-green-800">
          <div>
            <strong>The "Persephone Period":</strong> From late October to mid-February,
            daylight drops below 10 hours. Plant in late summer so crops reach
            maturity before this period, then harvest slowly throughout winter.
          </div>
          <div>
            <strong>Best Winter Crops:</strong> Spinach, mâche (corn salad),
            claytonia, kale, leeks, carrots (in mulch), and winter lettuce varieties.
            These become sweeter after frost!
          </div>
          <div>
            <strong>Layer System:</strong> Greenhouse + row cover = 2 layers (~25°F
            protection). This turns Zone 5 into Zone 7 for winter harvesting.
          </div>
          <div>
            <strong>Ventilation:</strong> Open covers on sunny days to prevent
            overheating and maintain air circulation.
          </div>
        </div>
      </div>

      {/* Nico Jabour's Tips */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <h3 className="font-semibold text-purple-900 mb-3">
          🌨️ Nico Jabour's Season Extension Tips
        </h3>
        <ul className="text-sm text-purple-800 space-y-2">
          <li>
            • <strong>Quick Hoops:</strong> Use 10-foot lengths of 9-gauge wire bent
            into hoops, covered with row cover. Cheap and effective!
          </li>
          <li>
            • <strong>Snow as Insulation:</strong> Don't remove snow from covers -
            it provides excellent insulation.
          </li>
          <li>
            • <strong>Timing:</strong> Plant cold-hardy crops in late August/early
            September for winter harvest.
          </li>
          <li>
            • <strong>Harvest Method:</strong> Pick outer leaves of greens, leaving
            the growing center to regenerate.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default WinterGarden;
