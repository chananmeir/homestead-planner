import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useToast } from './common';

interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  vitamin_a_iu: number;
  vitamin_c_mg: number;
  vitamin_k_mcg: number;
  calcium_mg: number;
  iron_mg: number;
  potassium_mg: number;
}

interface NutritionBySource {
  garden: NutritionTotals;
  livestock: NutritionTotals;
  trees: NutritionTotals;
}

interface DashboardData {
  totals: NutritionTotals;
  by_source: NutritionBySource;
  year: number;
}

// USDA Recommended Daily Allowances (RDA) for average adult
const RDA = {
  calories: 2000,
  protein_g: 50,
  carbs_g: 300,
  fat_g: 65,
  fiber_g: 28,
  vitamin_a_iu: 3000,
  vitamin_c_mg: 90,
  vitamin_k_mcg: 120,
  calcium_mg: 1000,
  iron_mg: 18,
  potassium_mg: 3500,
};

const NutritionalDashboard: React.FC = () => {
  const { showError } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/nutrition/dashboard?year=${selectedYear}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      console.error('Error loading nutrition dashboard:', error);
      showError('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    const rows = [
      ['Homestead Nutritional Output Summary', selectedYear],
      [],
      ['Total Annual Production'],
      ['Nutrient', 'Amount', 'Unit', 'RDA', '% of RDA', 'Person-Days'],
      [
        'Calories',
        data.totals.calories.toFixed(0),
        'cal',
        RDA.calories,
        ((data.totals.calories / RDA.calories / 365) * 100).toFixed(1) + '%',
        (data.totals.calories / RDA.calories).toFixed(1),
      ],
      [
        'Protein',
        data.totals.protein_g.toFixed(1),
        'g',
        RDA.protein_g,
        ((data.totals.protein_g / RDA.protein_g / 365) * 100).toFixed(1) + '%',
        (data.totals.protein_g / RDA.protein_g).toFixed(1),
      ],
      [
        'Carbohydrates',
        data.totals.carbs_g.toFixed(1),
        'g',
        RDA.carbs_g,
        ((data.totals.carbs_g / RDA.carbs_g / 365) * 100).toFixed(1) + '%',
        (data.totals.carbs_g / RDA.carbs_g).toFixed(1),
      ],
      [
        'Fat',
        data.totals.fat_g.toFixed(1),
        'g',
        RDA.fat_g,
        ((data.totals.fat_g / RDA.fat_g / 365) * 100).toFixed(1) + '%',
        (data.totals.fat_g / RDA.fat_g).toFixed(1),
      ],
      [
        'Fiber',
        data.totals.fiber_g.toFixed(1),
        'g',
        RDA.fiber_g,
        ((data.totals.fiber_g / RDA.fiber_g / 365) * 100).toFixed(1) + '%',
        (data.totals.fiber_g / RDA.fiber_g).toFixed(1),
      ],
      [],
      ['Breakdown by Source'],
      ['Source', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)'],
      [
        'Garden',
        data.by_source.garden.calories.toFixed(0),
        data.by_source.garden.protein_g.toFixed(1),
        data.by_source.garden.carbs_g.toFixed(1),
        data.by_source.garden.fat_g.toFixed(1),
      ],
      [
        'Livestock',
        data.by_source.livestock.calories.toFixed(0),
        data.by_source.livestock.protein_g.toFixed(1),
        data.by_source.livestock.carbs_g.toFixed(1),
        data.by_source.livestock.fat_g.toFixed(1),
      ],
      [
        'Trees',
        data.by_source.trees.calories.toFixed(0),
        data.by_source.trees.protein_g.toFixed(1),
        data.by_source.trees.carbs_g.toFixed(1),
        data.by_source.trees.fat_g.toFixed(1),
      ],
    ];

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `homestead-nutrition-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const calculatePersonDays = (amount: number, rda: number): number => {
    return amount / rda;
  };

  const getSourcePercentage = (sourceValue: number, total: number): number => {
    return total > 0 ? (sourceValue / total) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading nutrition dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-lg">No nutrition data available</p>
            <p className="text-sm mt-2">
              Start by planning your garden, adding livestock, or placing trees on your property!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalCalories = data.totals.calories;
  const hasData = totalCalories > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Nutritional Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Annual nutritional output from your garden, livestock, and trees
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              data-testid="nutrition-year-selector"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {[2024, 2025, 2026, 2027, 2028].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              onClick={exportToCSV}
              disabled={!hasData}
              data-testid="nutrition-export-csv"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Data for {selectedYear}</h3>
          <p className="text-sm text-yellow-800">
            You haven't planned any crops, livestock, or trees for this year yet. Start planning to see
            your nutritional estimates!
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div data-testid="nutrition-summary-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div data-testid="nutrition-calories-card" className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Total Calories</div>
              <div className="text-3xl font-bold text-green-700">
                {totalCalories.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ≈ {Math.round(calculatePersonDays(totalCalories, RDA.calories))} person-days
              </div>
            </div>

            <div data-testid="nutrition-protein-card" className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-200">
              <div className="text-sm text-gray-600 mb-1">Total Protein</div>
              <div className="text-3xl font-bold text-blue-700">
                {Math.round(data.totals.protein_g).toLocaleString()}g
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ≈ {Math.round(calculatePersonDays(data.totals.protein_g, RDA.protein_g))} person-days
              </div>
            </div>

            <div data-testid="nutrition-carbs-card" className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
              <div className="text-sm text-gray-600 mb-1">Total Carbs</div>
              <div className="text-3xl font-bold text-purple-700">
                {Math.round(data.totals.carbs_g).toLocaleString()}g
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ≈ {Math.round(calculatePersonDays(data.totals.carbs_g, RDA.carbs_g))} person-days
              </div>
            </div>

            <div data-testid="nutrition-fat-card" className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-200">
              <div className="text-sm text-gray-600 mb-1">Total Fat</div>
              <div className="text-3xl font-bold text-amber-700">
                {Math.round(data.totals.fat_g).toLocaleString()}g
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ≈ {Math.round(calculatePersonDays(data.totals.fat_g, RDA.fat_g))} person-days
              </div>
            </div>
          </div>

          {/* Breakdown by Source */}
          <div data-testid="nutrition-source-breakdown" className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Production by Source</h3>
            <div className="space-y-4">
              {/* Garden */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🌱</span>
                    <span className="font-semibold text-gray-800">Garden</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {data.by_source.garden.calories.toLocaleString()} cal
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${getSourcePercentage(data.by_source.garden.calories, totalCalories)}%`,
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(data.by_source.garden.protein_g)}g protein • {Math.round(data.by_source.garden.carbs_g)}g carbs • {Math.round(data.by_source.garden.fat_g)}g fat
                </div>
              </div>

              {/* Livestock */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🐔</span>
                    <span className="font-semibold text-gray-800">Livestock</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {data.by_source.livestock.calories.toLocaleString()} cal
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${getSourcePercentage(data.by_source.livestock.calories, totalCalories)}%`,
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(data.by_source.livestock.protein_g)}g protein • {Math.round(data.by_source.livestock.carbs_g)}g carbs • {Math.round(data.by_source.livestock.fat_g)}g fat
                </div>
              </div>

              {/* Trees */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🌳</span>
                    <span className="font-semibold text-gray-800">Trees</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {data.by_source.trees.calories.toLocaleString()} cal
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-amber-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${getSourcePercentage(data.by_source.trees.calories, totalCalories)}%`,
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(data.by_source.trees.protein_g)}g protein • {Math.round(data.by_source.trees.carbs_g)}g carbs • {Math.round(data.by_source.trees.fat_g)}g fat
                </div>
              </div>
            </div>
          </div>

          {/* Nutritional Breakdown */}
          <div data-testid="nutrition-breakdown" className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Nutritional Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Macronutrients */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Macronutrients</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Protein</span>
                      <span className="font-medium">{Math.round(data.totals.protein_g).toLocaleString()}g</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.protein_g, RDA.protein_g) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Carbohydrates</span>
                      <span className="font-medium">{Math.round(data.totals.carbs_g).toLocaleString()}g</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.carbs_g, RDA.carbs_g) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fat</span>
                      <span className="font-medium">{Math.round(data.totals.fat_g).toLocaleString()}g</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.fat_g, RDA.fat_g) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fiber</span>
                      <span className="font-medium">{Math.round(data.totals.fiber_g).toLocaleString()}g</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.fiber_g, RDA.fiber_g) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Micronutrients */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Vitamins & Minerals</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Vitamin A</span>
                      <span className="font-medium">{Math.round(data.totals.vitamin_a_iu).toLocaleString()} IU</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.vitamin_a_iu, RDA.vitamin_a_iu) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Vitamin C</span>
                      <span className="font-medium">{Math.round(data.totals.vitamin_c_mg).toLocaleString()} mg</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.vitamin_c_mg, RDA.vitamin_c_mg) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Calcium</span>
                      <span className="font-medium">{Math.round(data.totals.calcium_mg).toLocaleString()} mg</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.calcium_mg, RDA.calcium_mg) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Iron</span>
                      <span className="font-medium">{Math.round(data.totals.iron_mg).toLocaleString()} mg</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (calculatePersonDays(data.totals.iron_mg, RDA.iron_mg) / 365) * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Understanding These Estimates</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>
                <strong>Person-Days:</strong> Indicates how many days one person's nutritional needs would be met
                (e.g., 365 person-days = 1 person for 1 year)
              </li>
              <li>
                <strong>Estimates Only:</strong> Actual yields vary significantly based on climate, soil,
                management practices, varieties, and experience level
              </li>
              <li>
                <strong>RDA Basis:</strong> Based on USDA recommended daily allowances for average adults. Individual
                needs vary by age, sex, activity level, and health conditions
              </li>
              <li>
                <strong>Progress Bars:</strong> Show annual production as a percentage of daily RDA × 365 days. Bars
                capped at 100% for display
              </li>
              <li>
                <strong>Use for Planning:</strong> Use these estimates to identify gaps and plan a balanced homestead,
                not as guarantees of production
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default NutritionalDashboard;
