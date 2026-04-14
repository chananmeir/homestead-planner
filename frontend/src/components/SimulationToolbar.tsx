/**
 * SimulationToolbar - Floating dev tool for Time Machine mode
 *
 * Only renders in development mode.
 * Provides UI to set/advance/clear simulated date.
 */
import React, { useState } from 'react';
import { useSimulation } from '../contexts/SimulationContext';

const SimulationToolbar: React.FC = () => {
  const {
    isSimulating, simulatedDate, realDate,
    setSimulatedDate, clearSimulation, advanceDays
  } = useSimulation();

  const [dateInput, setDateInput] = useState('2024-04-15');
  const [collapsed, setCollapsed] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          padding: '6px 12px', borderRadius: 8, fontWeight: 'bold', fontSize: 12,
          border: 'none', cursor: 'pointer',
          backgroundColor: isSimulating ? '#dc2626' : '#374151',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: isSimulating ? 'pulse 2s infinite' : 'none'
        }}
      >
        {isSimulating ? `SIM: ${simulatedDate}` : 'Time Machine'}
      </button>
    );
  }

  const quickDates = [
    { label: 'Jan 1', date: '2024-01-01' },
    { label: 'Mar 1', date: '2024-03-01' },
    { label: 'Apr 15', date: '2024-04-15' },
    { label: 'Jun 1', date: '2024-06-01' },
    { label: 'Aug 1', date: '2024-08-01' },
    { label: 'Oct 15', date: '2024-10-15' },
    { label: 'Dec 1', date: '2024-12-01' },
  ];

  const btnStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: bg, color: 'white', border: 'none', borderRadius: 4,
    padding: '4px 8px', fontSize: 11, cursor: 'pointer', flex: 1,
  });

  const quickBtnStyle: React.CSSProperties = {
    backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4,
    padding: '3px 6px', fontSize: 10, cursor: 'pointer',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      padding: 12, borderRadius: 8, maxWidth: 300, fontSize: 12,
      backgroundColor: isSimulating ? '#fef2f2' : '#f9fafb',
      border: `2px solid ${isSimulating ? '#dc2626' : '#d1d5db'}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Time Machine</span>
        <button onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>_</button>
      </div>

      {/* Status banner when simulating */}
      {isSimulating && (
        <div style={{
          backgroundColor: '#fee2e2', color: '#991b1b', padding: 6, borderRadius: 4,
          marginBottom: 8, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4,
        }}>
          SIMULATING: <strong>{simulatedDate}</strong>
          <br />Real date: {realDate}
        </div>
      )}

      {/* Date input + Set button */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <input
          type="date"
          value={dateInput}
          onChange={e => setDateInput(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 6px', fontSize: 11, flex: 1 }}
        />
        <button onClick={() => setSimulatedDate(dateInput)} style={btnStyle('#2563eb')}>
          Set
        </button>
      </div>

      {/* Quick date buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {quickDates.map(qd => (
          <button key={qd.date} onClick={() => { setDateInput(qd.date); setSimulatedDate(qd.date); }}
            style={quickBtnStyle}>
            {qd.label}
          </button>
        ))}
      </div>

      {/* Advance buttons (only when simulating) */}
      {isSimulating && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => advanceDays(1)} style={btnStyle('#16a34a')}>+1 Day</button>
            <button onClick={() => advanceDays(7)} style={btnStyle('#16a34a')}>+7 Days</button>
            <button onClick={() => advanceDays(30)} style={btnStyle('#16a34a')}>+30 Days</button>
          </div>
          <button onClick={clearSimulation}
            style={{ ...btnStyle('#dc2626'), width: '100%', padding: '6px 8px' }}>
            Stop Simulation
          </button>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default SimulationToolbar;
