import React from 'react';

interface QuickActionsProps {
  onAddPlanting: () => void;
  onLogHarvest: () => void;
  onAddSeed: () => void;
  onAddLivestockEntry: () => void;
  onAddCompostEntry: () => void;
  onUploadPhoto: () => void;
}

interface ActionButton {
  label: string;
  icon: string;
  onClick: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onAddPlanting,
  onLogHarvest,
  onAddSeed,
  onAddLivestockEntry,
  onAddCompostEntry,
  onUploadPhoto,
}) => {
  const actions: ActionButton[] = [
    { label: 'Add Planting', icon: '🌱', onClick: onAddPlanting },
    { label: 'Log Harvest', icon: '🧺', onClick: onLogHarvest },
    { label: 'Add Seed', icon: '🌾', onClick: onAddSeed },
    { label: 'Add Livestock Entry', icon: '🐔', onClick: onAddLivestockEntry },
    { label: 'Add Compost Entry', icon: '♻️', onClick: onAddCompostEntry },
    { label: 'Upload Photo', icon: '📷', onClick: onUploadPhoto },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <span className="text-xs text-gray-500">One click to log</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="group flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-300 transition-colors"
          >
            <span className="text-2xl" aria-hidden="true">{a.icon}</span>
            <span className="text-xs font-medium text-gray-700 group-hover:text-green-800 text-center leading-tight">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
