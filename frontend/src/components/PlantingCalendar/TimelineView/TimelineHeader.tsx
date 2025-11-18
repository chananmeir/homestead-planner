import React from 'react';
import { getMonthColumns } from './utils';

interface TimelineHeaderProps {
  startDate: Date;
  monthCount: number;
  monthWidth: number;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  startDate,
  monthCount,
  monthWidth,
}) => {
  const months = getMonthColumns(startDate, monthCount);

  return (
    <div className="flex border-b-2 border-gray-300 bg-gray-50 sticky top-0 z-10">
      {/* Label column */}
      <div className="w-48 flex-shrink-0 border-r border-gray-300 px-4 py-3 font-semibold text-gray-700">
        Plant / Variety
      </div>

      {/* Month columns */}
      <div className="flex flex-1">
        {months.map((month, index) => (
          <div
            key={index}
            className="border-r border-gray-200 px-2 py-3 text-center font-medium text-gray-700"
            style={{ width: `${monthWidth}px`, minWidth: `${monthWidth}px` }}
          >
            {month.label}
          </div>
        ))}
      </div>
    </div>
  );
};
