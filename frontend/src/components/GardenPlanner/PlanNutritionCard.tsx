import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { PlanNutritionData } from '../../types';
import { useToast } from '../common/Toast';
import { getPlantById } from '../../utils/plantIdResolver';

// USDA RDA (from NutritionalDashboard)
const RDA = {
  calories: 2000,
  proteinG: 50,
  carbsG: 300,
  fatG: 65,
};

interface Props {
  planId: number;
  planYear: number;
}

export const PlanNutritionCard: React.FC<Props> = ({ planId, planYear }) => {
  const { showError } = useToast();
  const [data, setData] = useState<PlanNutritionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadNutrition();
  }, [planId]);

  const loadNutrition = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/garden-plans/${planId}/nutrition`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch nutrition data');
      }

      const nutritionData = await response.json();
      setData(nutritionData);
    } catch (error) {
      console.error('Error loading plan nutrition:', error);
      showError('Failed to load nutrition estimates');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const calculatePersonDays = (total: number, rda: number) => {
    return Math.round(total / rda);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <div className="animate-pulse">Loading nutrition estimates...</div>
      </div>
    );
  }

  if (!data || Object.keys(data.byPlant).length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
        <p className="text-yellow-800">
          Nutrition estimates unavailable. Add nutritional data for your plants to see estimates.
        </p>
      </div>
    );
  }

  const { totals, byPlant, missingNutritionData } = data;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      {/* Header with toggle */}
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="text-xl font-bold">Estimated Nutrition Output</h3>
          <p className="text-sm text-gray-600 mt-1">
            Planning estimates for {planYear}
          </p>
        </div>
        <button className="text-2xl text-gray-500 hover:text-gray-700">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Collapsed: Summary only */}
      {!expanded && (
        <div className="mt-4 space-y-2">
          <p className="text-gray-700">
            This plan will produce approximately:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>
              <strong>{formatNumber(totals.calories)}</strong> calories
              (≈ {calculatePersonDays(totals.calories, RDA.calories)} person-days)
            </li>
            <li>
              <strong>{formatNumber(totals.proteinG)}g</strong> protein
              (≈ {calculatePersonDays(totals.proteinG, RDA.proteinG)} person-days)
            </li>
          </ul>
          <button
            className="text-blue-600 hover:underline text-sm mt-2"
            onClick={() => setExpanded(true)}
          >
            Expand to see full breakdown
          </button>
        </div>
      )}

      {/* Expanded: Full details */}
      {expanded && (
        <div className="mt-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <div className="text-blue-600 text-sm font-semibold">Calories</div>
              <div className="text-2xl font-bold text-blue-900">{formatNumber(totals.calories)}</div>
              <div className="text-xs text-blue-700 mt-1">
                {calculatePersonDays(totals.calories, RDA.calories)} days
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <div className="text-green-600 text-sm font-semibold">Protein</div>
              <div className="text-2xl font-bold text-green-900">{formatNumber(totals.proteinG)}g</div>
              <div className="text-xs text-green-700 mt-1">
                {calculatePersonDays(totals.proteinG, RDA.proteinG)} days
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded p-4">
              <div className="text-purple-600 text-sm font-semibold">Carbs</div>
              <div className="text-2xl font-bold text-purple-900">{formatNumber(totals.carbsG)}g</div>
              <div className="text-xs text-purple-700 mt-1">
                {calculatePersonDays(totals.carbsG, RDA.carbsG)} days
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded p-4">
              <div className="text-orange-600 text-sm font-semibold">Fat</div>
              <div className="text-2xl font-bold text-orange-900">{formatNumber(totals.fatG)}g</div>
              <div className="text-xs text-orange-700 mt-1">
                {calculatePersonDays(totals.fatG, RDA.fatG)} days
              </div>
            </div>
          </div>

          {/* Per-crop breakdown table */}
          <div>
            <h4 className="text-lg font-semibold mb-3">Per-Crop Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Crop</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Succ</th>
                    <th className="px-4 py-2 text-right">Yield (lbs)</th>
                    <th className="px-4 py-2 text-right">Calories</th>
                    <th className="px-4 py-2 text-right">Protein (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byPlant).map(([plantId, plant]) => (
                    <tr key={plantId} className="border-t">
                      <td className="px-4 py-2">
                        {plant.variety || plant.name}
                      </td>
                      <td className="px-4 py-2 text-right">{plant.plantEquivalent}</td>
                      <td className="px-4 py-2 text-right">{plant.successionCount}x</td>
                      <td className="px-4 py-2 text-right">{formatNumber(plant.totalYieldLbs)}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(plant.calories)}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(plant.proteinG)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing data warning */}
          {missingNutritionData.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800 font-semibold">
                {missingNutritionData.length} crop{missingNutritionData.length > 1 ? 's' : ''} missing nutrition data
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                {missingNutritionData.map(plantId => {
                  const plant = getPlantById(plantId);
                  return plant ? `${plant.name} (${plantId})` : plantId;
                }).join(', ')}
              </p>
              <p className="text-sm text-yellow-600 mt-2 italic">
                Totals exclude crops missing nutrition data.
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-700">
            <p className="font-semibold">Planning Estimates Only</p>
            <p className="mt-1">
              These are planning-stage estimates based on average yields and succession plantings.
              Actual yields vary by climate, soil, and management practices.
            </p>
            <p className="mt-2">
              After exporting to calendar and harvesting, track actual nutrition in the
              <a href="/nutrition-dashboard" className="text-blue-600 hover:underline ml-1">
                Nutritional Dashboard
              </a>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
