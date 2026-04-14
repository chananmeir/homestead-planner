import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { apiGet, apiPost } from '../utils/api';
import { GardenPlan } from '../types';
import { useAuth } from './AuthContext';
import { useSimulation } from './SimulationContext';

interface ActivePlanContextType {
  activePlan: GardenPlan | null;
  activePlanId: number | null;
  loading: boolean;
  setActivePlan: (plan: GardenPlan) => void;
  setActivePlanById: (planId: number) => Promise<void>;
  clearActivePlan: () => void;
  refreshActivePlan: () => Promise<void>;
  ensureActivePlan: () => Promise<number | null>;
  planRefreshKey: number;
  bumpPlanRefresh: () => void;
}

const ActivePlanContext = createContext<ActivePlanContextType | undefined>(undefined);

export const useActivePlan = () => {
  const context = useContext(ActivePlanContext);
  if (!context) {
    throw new Error('useActivePlan must be used within an ActivePlanProvider');
  }
  return context;
};

interface ActivePlanProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'homestead-active-plan-id';

export const ActivePlanProvider: React.FC<ActivePlanProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { getNow } = useSimulation();
  const [activePlan, setActivePlanState] = useState<GardenPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);

  const bumpPlanRefresh = useCallback(() => {
    setPlanRefreshKey(prev => prev + 1);
  }, []);

  // Clear plan when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setActivePlanState(null);
    }
  }, [isAuthenticated]);

  // Restore from localStorage or auto-detect current year's plan
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const storedId = localStorage.getItem(STORAGE_KEY);
        const response = await apiGet('/api/garden-plans');

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const plans: GardenPlan[] = await response.json();

        if (storedId) {
          const id = parseInt(storedId, 10);
          const match = plans.find(p => p.id === id);
          if (match) {
            setActivePlanState(match);
            setLoading(false);
            return;
          }
        }

        // Auto-detect: pick current year's plan
        const currentYear = getNow().getFullYear();
        const yearPlan = plans.find(p => p.year === currentYear);
        if (yearPlan) {
          setActivePlanState(yearPlan);
          localStorage.setItem(STORAGE_KEY, String(yearPlan.id));
        }
      } catch {
        // Silently fail - user may not be logged in yet
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isAuthenticated, getNow]);

  const setActivePlan = useCallback((plan: GardenPlan) => {
    setActivePlanState(plan);
    localStorage.setItem(STORAGE_KEY, String(plan.id));
  }, []);

  const setActivePlanById = useCallback(async (planId: number) => {
    try {
      const response = await apiGet(`/api/garden-plans/${planId}`);
      if (response.ok) {
        const plan: GardenPlan = await response.json();
        setActivePlanState(plan);
        localStorage.setItem(STORAGE_KEY, String(plan.id));
      }
    } catch (err) {
      console.error('[ActivePlanContext] Failed to fetch plan:', err);
    }
  }, []);

  const clearActivePlan = useCallback(() => {
    setActivePlanState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshActivePlan = useCallback(async () => {
    if (!activePlan) return;
    try {
      const response = await apiGet(`/api/garden-plans/${activePlan.id}`);
      if (response.ok) {
        const plan: GardenPlan = await response.json();
        setActivePlanState(plan);
      }
    } catch (err) {
      console.error('[ActivePlanContext] Failed to refresh plan:', err);
    }
  }, [activePlan]);

  const ensureActivePlan = useCallback(async (): Promise<number | null> => {
    if (activePlan) return activePlan.id;

    // Auto-create a plan for the current year
    const currentYear = getNow().getFullYear();
    try {
      const response = await apiPost('/api/garden-plans', {
        name: `${currentYear} Garden Plan`,
        year: currentYear,
        strategy: 'manual',
        successionPreference: 'per-seed',
      });

      if (response.ok) {
        const plan: GardenPlan = await response.json();
        setActivePlanState(plan);
        localStorage.setItem(STORAGE_KEY, String(plan.id));
        return plan.id;
      }
    } catch (err) {
      console.error('[ActivePlanContext] Failed to create plan:', err);
    }

    return null;
  }, [activePlan, getNow]);

  const value = useMemo<ActivePlanContextType>(() => ({
    activePlan,
    activePlanId: activePlan?.id ?? null,
    loading,
    setActivePlan,
    setActivePlanById,
    clearActivePlan,
    refreshActivePlan,
    ensureActivePlan,
    planRefreshKey,
    bumpPlanRefresh,
  }), [activePlan, loading, setActivePlan, setActivePlanById, clearActivePlan, refreshActivePlan, ensureActivePlan, planRefreshKey, bumpPlanRefresh]);

  return <ActivePlanContext.Provider value={value}>{children}</ActivePlanContext.Provider>;
};
