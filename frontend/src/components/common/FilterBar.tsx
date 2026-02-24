import React, { useRef, useState, useEffect } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

export interface ActiveFilter {
  groupId: string;
  groupLabel: string;
  value: string;
  label: string;
}

interface FilterBarProps {
  filterGroups: FilterGroup[];
  activeFilters: Record<string, string[]>;
  onFilterChange: (groupId: string, values: string[]) => void;
  onClearAll?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterGroups,
  activeFilters,
  onFilterChange,
  onClearAll,
  className = '',
}) => {
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const filterPanelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const filterButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleFilterToggle = (groupId: string, value: string) => {
    const currentValues = activeFilters[groupId] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    onFilterChange(groupId, newValues);
  };

  const handleRemoveFilter = (groupId: string, value: string) => {
    const currentValues = activeFilters[groupId] || [];
    const newValues = currentValues.filter(v => v !== value);
    onFilterChange(groupId, newValues);
  };

  const toggleFilterPanel = (groupId: string) => {
    setOpenFilterId(current => current === groupId ? null : groupId);
  };

  const closeFilterPanel = () => {
    setOpenFilterId(null);
  };

  const handleClearAll = () => {
    closeFilterPanel();
    if (onClearAll) {
      onClearAll();
    }
  };

  // Click-outside and Escape key handling
  useEffect(() => {
    if (!openFilterId) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const panel = filterPanelRefs.current.get(openFilterId);
      const button = filterButtonRefs.current.get(openFilterId);

      // Don't close if clicking inside the panel or button
      if (panel?.contains(target) || button?.contains(target)) {
        return;
      }

      closeFilterPanel();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFilterPanel();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openFilterId]);

  // Build list of active filters for chip display
  const activeFilterChips: ActiveFilter[] = [];
  Object.entries(activeFilters).forEach(([groupId, values]) => {
    const group = filterGroups.find(g => g.id === groupId);
    if (group && values.length > 0) {
      values.forEach(value => {
        const option = group.options.find(opt => opt.value === value);
        if (option) {
          activeFilterChips.push({
            groupId,
            groupLabel: group.label,
            value,
            label: option.label,
          });
        }
      });
    }
  });

  const hasActiveFilters = activeFilterChips.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-3">
        {filterGroups.map((group) => {
          const activeCount = (activeFilters[group.id] || []).length;
          const isOpen = openFilterId === group.id;

          return (
            <div key={group.id} className="relative">
              <button
                ref={(el) => {
                  if (el) {
                    filterButtonRefs.current.set(group.id, el);
                  } else {
                    filterButtonRefs.current.delete(group.id);
                  }
                }}
                type="button"
                onClick={() => toggleFilterPanel(group.id)}
                aria-expanded={isOpen}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">
                  {group.label}
                </span>
                {activeCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-green-600 rounded-full">
                    {activeCount}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Content */}
              {isOpen && (
                <div
                  ref={(el) => {
                    if (el) {
                      filterPanelRefs.current.set(group.id, el);
                    } else {
                      filterPanelRefs.current.delete(group.id);
                    }
                  }}
                  className="absolute z-10 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto"
                >
                  {/* Header with Close Button */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">{group.label}</span>
                    <button
                      type="button"
                      onClick={closeFilterPanel}
                      aria-label="Close filter"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Filter Options */}
                  <div className="p-2 space-y-1">
                    {group.options.map((option) => {
                      const isActive = (activeFilters[group.id] || []).includes(option.value);

                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleFilterToggle(group.id, option.value)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                          />
                          <span className="text-sm text-gray-700 flex-1">
                            {option.label}
                          </span>
                          {option.count !== undefined && (
                            <span className="text-xs text-gray-500">
                              ({option.count})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Clear All Button */}
        {hasActiveFilters && onClearAll && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-600">Active filters:</span>
          {activeFilterChips.map((filter, index) => (
            <span
              key={`${filter.groupId}-${filter.value}-${index}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
            >
              <span className="font-medium">{filter.groupLabel}:</span>
              <span>{filter.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilter(filter.groupId, filter.value)}
                className="ml-1 text-green-600 hover:text-green-800 focus:outline-none"
                aria-label={`Remove ${filter.label} filter`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
