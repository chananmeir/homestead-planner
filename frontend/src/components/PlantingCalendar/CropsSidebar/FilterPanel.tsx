import React from 'react';

interface FilterPanelProps {
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  categoryCounts: Record<string, number>;
}

const CATEGORIES = [
  { id: 'vegetable', label: 'Vegetables' },
  { id: 'herb', label: 'Herbs' },
  { id: 'fruit', label: 'Fruits' },
  { id: 'flower', label: 'Flowers' },
  { id: 'cover-crop', label: 'Cover Crops' },
];

const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedCategories,
  onCategoryToggle,
  categoryCounts,
}) => {
  const hasFilters = selectedCategories.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Filter by Category</h3>
        {hasFilters && (
          <button
            onClick={() => selectedCategories.forEach(cat => onCategoryToggle(cat))}
            className="text-xs text-green-600 hover:text-green-700"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="space-y-1">
        {CATEGORIES.map((category) => (
          <label
            key={category.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
          >
            <input
              type="checkbox"
              checked={selectedCategories.includes(category.id)}
              onChange={() => onCategoryToggle(category.id)}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700 flex-1">
              {category.label}
            </span>
            <span className="text-xs text-gray-500">
              ({categoryCounts[category.id] || 0})
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default FilterPanel;
