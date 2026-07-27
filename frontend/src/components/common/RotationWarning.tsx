import React from 'react';
import { RotationSeverity, RotationWarning as RotationWarningType } from '../../types';

interface RotationWarningProps {
  warnings: RotationWarningType[];
  className?: string;
}

const severityStyles: Record<RotationSeverity, {
  title: string;
  border: string;
  bg: string;
  text: string;
  badge: string;
}> = {
  ok: {
    title: 'Rotation Good',
    border: 'border-green-400',
    bg: 'bg-green-50',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
  },
  info: {
    title: 'Rotation Note',
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800',
  },
  caution: {
    title: 'Rotation Caution',
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800',
  },
  warning: {
    title: 'Rotation Warning',
    border: 'border-orange-400',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-800',
  },
  high: {
    title: 'High Rotation Risk',
    border: 'border-red-500',
    bg: 'bg-red-50',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
  },
};

const reasonLabels: Record<string, string> = {
  same_family_recent: 'Same family recently',
  repeated_family_history: 'Repeated family',
  low_exposure_history: 'Low exposure',
  lower_risk_family: 'Lower-risk family',
  mixed_bed_history: 'Mixed bed history',
  cover_crop_history_ignored: 'Cover crop ignored',
  no_recent_family_history: 'No recent family history',
  target_cover_crop: 'Cover crop',
};

const formatReason = (reason: string): string =>
  reasonLabels[reason] || reason.replace(/_/g, ' ');

const RotationWarning: React.FC<RotationWarningProps> = ({
  warnings,
  className = ''
}) => {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {warnings.map((warning, index) => {
        const severity = warning.severity || 'warning';
        const styles = severityStyles[severity] || severityStyles.warning;
        const conflicts = warning.conflicts || [];
        const ignoredHistory = warning.ignored_history || [];

        return (
          <div
            key={`${warning.bed_id}-${index}`}
            className={`${styles.bg} border-l-4 ${styles.border} p-3 rounded`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className={`text-sm font-semibold ${styles.text}`}>
                    {styles.title}: {warning.bed_name}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
                    {warning.risk_score ?? 0}/100
                  </span>
                  {warning.rotation_window != null && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-gray-700 border border-gray-200">
                      {warning.rotation_window}-year policy
                    </span>
                  )}
                </div>
                <p className={`text-sm ${styles.text}`}>
                  {warning.message}
                </p>
                {warning.reason_codes && warning.reason_codes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {warning.reason_codes.map(reason => (
                      <span
                        key={reason}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-white/80 text-gray-700 border border-gray-200"
                      >
                        {formatReason(reason)}
                      </span>
                    ))}
                  </div>
                )}
                {conflicts.length > 0 && (
                  <div className="mt-2 text-xs text-gray-700 space-y-1">
                    {conflicts.slice(0, 3).map(entry => (
                      <div key={`${entry.plant_id}-${entry.year}`}>
                        {entry.year}: {entry.plant_name}
                        {entry.variety ? ` (${entry.variety})` : ''}
                        {entry.exposure ? ` - ${entry.exposure.replace(/_/g, ' ')}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {ignoredHistory.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">
                    Ignored cover crop history: {ignoredHistory.map(entry => `${entry.plant_name} ${entry.year}`).join(', ')}
                  </p>
                )}
                {warning.safe_year && (
                  <p className="mt-2 text-xs text-gray-600">
                    Safe year estimate: <span className="font-semibold">{warning.safe_year}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RotationWarning;
