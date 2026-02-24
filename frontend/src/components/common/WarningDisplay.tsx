import React from 'react';
import { ValidationWarning, DateSuggestion } from '../../types';

interface WarningDisplayProps {
  warnings: ValidationWarning[];
  suggestion?: DateSuggestion;
  onChangeDateClick?: (suggestedDate: string) => void;
  currentPlantingDate?: string; // ISO date string for calculating suggested dates
  className?: string;
}

/**
 * WarningDisplay Component
 *
 * Displays validation warnings with appropriate styling based on severity.
 * Can also display optimal date suggestions with action button.
 * Used in PlantConfigModal to show planting date warnings.
 */
const WarningDisplay: React.FC<WarningDisplayProps> = ({
  warnings,
  suggestion,
  onChangeDateClick,
  currentPlantingDate,
  className = ''
}) => {
  // Only return null if there are no warnings AND no suggestion
  if ((!warnings || warnings.length === 0) && !suggestion) {
    return null;
  }

  /**
   * Parse warning message to extract "waiting X more days" and make it clickable
   */
  const renderWarningMessage = (message: string) => {
    // Match pattern: "Consider waiting X more days"
    const waitingMatch = message.match(/waiting (\d+) more days/);

    if (!waitingMatch || !currentPlantingDate || !onChangeDateClick) {
      // No match or no callback, return plain text
      return message;
    }

    const daysToWait = parseInt(waitingMatch[1], 10);
    const currentDate = new Date(currentPlantingDate);
    const suggestedDate = new Date(currentDate.getTime() + daysToWait * 24 * 60 * 60 * 1000);
    const suggestedDateStr = suggestedDate.toISOString().split('T')[0];
    const displayDate = suggestedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Split message around the "waiting X more days" part
    const parts = message.split(waitingMatch[0]);

    return (
      <>
        {parts[0]}
        <button
          onClick={() => onChangeDateClick(suggestedDateStr)}
          className="inline font-semibold underline hover:text-blue-600 transition-colors cursor-pointer"
          title={`Change planting date to ${displayDate}`}
        >
          waiting {daysToWait} more days
        </button>
        {parts[1]}
      </>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {warnings.map((warning, index) => {
        // Determine styling based on severity
        let bgColor, borderColor, textColor, iconColor, icon;
        if (warning.severity === 'error') {
          bgColor = 'bg-red-50';
          borderColor = 'border-red-400';
          textColor = 'text-red-800';
          iconColor = 'text-red-400';
          icon = '❌';
        } else if (warning.severity === 'warning') {
          bgColor = 'bg-yellow-50';
          borderColor = 'border-yellow-400';
          textColor = 'text-yellow-800';
          iconColor = 'text-yellow-400';
          icon = '⚠️';
        } else {
          bgColor = 'bg-blue-50';
          borderColor = 'border-blue-400';
          textColor = 'text-blue-800';
          iconColor = 'text-blue-400';
          icon = 'ℹ️';
        }

        return (
          <div
            key={index}
            className={`${bgColor} border-l-4 ${borderColor} p-3 rounded`}
          >
            <div className="flex items-start">
              <span className={`${iconColor} text-xl mr-2 flex-shrink-0`}>{icon}</span>
              <p className={`text-sm ${textColor} flex-1`}>
                {renderWarningMessage(warning.message)}
              </p>
            </div>
          </div>
        );
      })}

      {/* Display optimal date suggestion if available */}
      {suggestion && (suggestion.optimal_range || suggestion.reason || suggestion.earliest_safe_date) && (
        <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
          <div className="flex items-start">
            <span className="text-green-500 text-xl mr-2 flex-shrink-0">📅</span>
            <div className="flex-1">
              <div className="text-sm text-green-800">
                {suggestion.optimal_range || suggestion.earliest_safe_date ? (
                  <>
                    <p className="font-medium mb-2">Planting Options:</p>

                    {/* Show earliest safe date */}
                    {suggestion.earliest_safe_date && (
                      <div className="mb-3 pb-3 border-b border-green-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-medium text-green-700 mb-1">
                              Earliest (Risky):
                              {suggestion.earliest_safe_date === suggestion.optimal_start && (
                                <span className="ml-1 text-xs font-normal">(also optimal)</span>
                              )}
                            </p>
                            <p className="font-semibold text-sm text-green-900">
                              {new Date(suggestion.earliest_safe_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="mt-1 text-xs text-green-600">
                              {suggestion.earliest_safe_date === suggestion.optimal_start
                                ? 'Soil reaches minimum temperature (optimal window begins)'
                                : 'Soil reaches minimum temperature'
                              }
                            </p>
                          </div>
                          {onChangeDateClick && (
                            <button
                              onClick={() => onChangeDateClick(suggestion.earliest_safe_date!)}
                              className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded hover:bg-yellow-700 transition-colors whitespace-nowrap flex-shrink-0"
                            >
                              Use {new Date(suggestion.earliest_safe_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Show optimal range */}
                    {suggestion.optimal_range && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-green-700 mb-1">Optimal:</p>
                          <p className="font-semibold text-sm text-green-900">{suggestion.optimal_range}</p>
                          {suggestion.reason && (
                            <p className="mt-1 text-xs text-green-600">{suggestion.reason}</p>
                          )}
                        </div>
                        {onChangeDateClick && suggestion.optimal_start && (
                          <button
                            onClick={() => onChangeDateClick(suggestion.optimal_start!)}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors whitespace-nowrap flex-shrink-0"
                          >
                            Use {new Date(suggestion.optimal_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="font-medium text-sm text-green-900">{suggestion.reason}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarningDisplay;
