import React from 'react';
import { render, screen } from '@testing-library/react';

import RotationWarning from '../RotationWarning';
import type { RotationWarning as RotationWarningType } from '../../../types';

describe('RotationWarning', () => {
  test('renders severity, score, policy, reasons, and conflict history', () => {
    const warnings: RotationWarningType[] = [{
      bed_id: 1,
      bed_name: 'North Bed',
      message: 'High rotation risk: this bed had Solanaceae in 2025.',
      family: 'Solanaceae',
      conflict_years: [2025],
      safe_year: 2029,
      severity: 'high',
      risk_score: 85,
      rotation_window: 3,
      reason_codes: ['same_family_recent', 'mixed_bed_history'],
      conflicts: [{
        plant_id: 'tomato-1',
        plant_name: 'Tomato',
        family: 'Solanaceae',
        category: 'vegetable',
        year: 2025,
        exposure: 'high_exposure',
      }],
    }];

    render(<RotationWarning warnings={warnings} />);

    expect(screen.getByText('High Rotation Risk: North Bed')).toBeInTheDocument();
    expect(screen.getByText('85/100')).toBeInTheDocument();
    expect(screen.getByText('3-year policy')).toBeInTheDocument();
    expect(screen.getByText('Same family recently')).toBeInTheDocument();
    expect(screen.getByText('Mixed bed history')).toBeInTheDocument();
    expect(screen.getByText(/2025: Tomato/)).toBeInTheDocument();
    expect(screen.getByText(/Safe year estimate:/)).toBeInTheDocument();
  });

  test('renders ignored cover crop history', () => {
    const warnings: RotationWarningType[] = [{
      bed_id: 2,
      bed_name: 'South Bed',
      message: 'Recent cover-crop history was ignored.',
      family: 'Fabaceae',
      conflict_years: [],
      severity: 'info',
      risk_score: 0,
      rotation_window: 2,
      reason_codes: ['cover_crop_history_ignored'],
      ignored_history: [{
        plant_id: 'clover-1',
        plant_name: 'Crimson Clover',
        family: 'Fabaceae',
        category: 'cover-crop',
        year: 2025,
      }],
    }];

    render(<RotationWarning warnings={warnings} />);

    expect(screen.getByText('Rotation Note: South Bed')).toBeInTheDocument();
    expect(screen.getByText('Cover crop ignored')).toBeInTheDocument();
    expect(screen.getByText(/Ignored cover crop history: Crimson Clover 2025/)).toBeInTheDocument();
  });
});
