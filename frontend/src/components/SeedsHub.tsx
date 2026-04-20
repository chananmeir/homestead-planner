import React, { useEffect, useState } from 'react';
import MySeedInventory from './MySeedInventory';
import SeedCatalog from './SeedCatalog';

type SubTab = 'inventory' | 'catalog';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'inventory', label: 'My Inventory' },
  { id: 'catalog', label: 'Seed Catalog' },
];

interface SeedsHubProps {
  focusSeedId?: number | null;
  onFocusConsumed?: () => void;
}

export default function SeedsHub({ focusSeedId, onFocusConsumed }: SeedsHubProps = {}) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('inventory');

  // Force Inventory tab when a focus request arrives so the target row is visible.
  useEffect(() => {
    if (focusSeedId != null) {
      setActiveSubTab('inventory');
    }
  }, [focusSeedId]);

  return (
    <div>
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-gray-100 rounded-full p-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                activeSubTab === tab.id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-green-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === 'inventory' && (
        <MySeedInventory focusSeedId={focusSeedId} onFocusConsumed={onFocusConsumed} />
      )}
      {activeSubTab === 'catalog' && <SeedCatalog />}
    </div>
  );
}
