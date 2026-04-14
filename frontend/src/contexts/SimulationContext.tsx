/**
 * SimulationContext
 *
 * Provides simulated date state across the app for time-machine testing.
 * When simulation is OFF (default), getNow() returns real Date and
 * getToday() returns real today string. Zero behavior change.
 * When simulation is ON, all consumers see the simulated date.
 */
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface SimulationContextType {
  isSimulating: boolean;
  simulatedDate: string | null;
  realDate: string;
  getNow: () => Date;
  getToday: () => string;
  setSimulatedDate: (dateStr: string) => Promise<void>;
  clearSimulation: () => Promise<void>;
  advanceDays: (days: number) => Promise<void>;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};

/** Lightweight hook — returns simulated Date or real Date */
export const useNow = (): Date => {
  const { getNow } = useSimulation();
  return getNow();
};

/** Lightweight hook — returns simulated YYYY-MM-DD or real today */
export const useToday = (): string => {
  const { getToday } = useSimulation();
  return getToday();
};

export const SimulationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [simulatedDate, setSimDate] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const realDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  // On mount, check if simulation is already active (server state survives page reload)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/simulation/status`)
      .then(r => r.json())
      .then(data => {
        setIsSimulating(data.active);
        setSimDate(data.simulatedDate);
      })
      .catch(() => { /* simulation endpoint not available, that's fine */ });
  }, []);

  const getNow = useCallback((): Date => {
    if (isSimulating && simulatedDate) {
      return new Date(simulatedDate + 'T12:00:00');
    }
    return new Date();
  }, [isSimulating, simulatedDate]);

  const getToday = useCallback((): string => {
    if (isSimulating && simulatedDate) {
      return simulatedDate;
    }
    return new Date().toISOString().split('T')[0];
  }, [isSimulating, simulatedDate]);

  const setSimulatedDate = useCallback(async (dateStr: string) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/simulation/set-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr })
      });
      if (resp.ok) {
        const data = await resp.json();
        setSimDate(data.simulatedDate);
        setIsSimulating(data.active);
      }
    } catch (e) {
      console.error('Failed to set simulation date:', e);
    }
  }, []);

  const clearSimulation = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/simulation/set-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: null })
      });
      if (resp.ok) {
        setSimDate(null);
        setIsSimulating(false);
      }
    } catch (e) {
      console.error('Failed to clear simulation:', e);
    }
  }, []);

  const advanceDays = useCallback(async (days: number) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/simulation/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });
      if (resp.ok) {
        const data = await resp.json();
        setSimDate(data.simulatedDate);
        setIsSimulating(true);
      }
    } catch (e) {
      console.error('Failed to advance simulation:', e);
    }
  }, []);

  const value = useMemo<SimulationContextType>(() => ({
    isSimulating, simulatedDate, realDate,
    getNow, getToday, setSimulatedDate, clearSimulation, advanceDays,
  }), [isSimulating, simulatedDate, realDate, getNow, getToday,
       setSimulatedDate, clearSimulation, advanceDays]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};
