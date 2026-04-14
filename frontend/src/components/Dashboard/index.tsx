import React from 'react';
import ActivePlanCard from './ActivePlanCard';
import NeedsAttentionPanel from './NeedsAttentionPanel';
import QuickActions from './QuickActions';
import UpcomingTimeline from './UpcomingTimeline';
import DashboardGardenSnapshot from './DashboardGardenSnapshot';
import WeatherSummaryTile from './WeatherSummaryTile';
import PlansSection from './PlansSection';

export interface DashboardNavHandlers {
  openGardenDesigner: () => void;
  openPlantingCalendar: () => void;
  openGardenPlans: () => void;
  openSeasonPlanner: () => void;
  openWeather: () => void;
  openSeeds: () => void;
  openLivestock: () => void;
  openCompost: () => void;
  openHarvests: () => void;
  openPhotos: () => void;
  openIndoorStarts: () => void;
}

const Dashboard: React.FC<DashboardNavHandlers> = (nav) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Section 1: Active Plan (primary) */}
      <ActivePlanCard
        onOpenGarden={nav.openGardenDesigner}
        onViewCalendar={nav.openPlantingCalendar}
        onAddEvent={nav.openPlantingCalendar}
        onManagePlans={nav.openGardenPlans}
      />

      {/* Section 2 + Weather: Needs Attention alongside compact weather tile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NeedsAttentionPanel
            onViewCalendar={nav.openPlantingCalendar}
            onViewHarvests={nav.openHarvests}
            onViewIndoorStarts={nav.openIndoorStarts}
            onViewCompost={nav.openCompost}
            onViewSeeds={nav.openSeeds}
            onViewLivestock={nav.openLivestock}
            onViewWeather={nav.openWeather}
            onViewGardenDesigner={nav.openGardenDesigner}
          />
        </div>
        <div>
          <WeatherSummaryTile onOpenWeather={nav.openWeather} />
        </div>
      </div>

      {/* Section 3: Quick Actions */}
      <QuickActions
        onAddPlanting={nav.openPlantingCalendar}
        onLogHarvest={nav.openHarvests}
        onAddSeed={nav.openSeeds}
        onAddLivestockEntry={nav.openLivestock}
        onAddCompostEntry={nav.openCompost}
        onUploadPhoto={nav.openPhotos}
      />

      {/* Section 4: Two-column row — Upcoming Timeline + Garden Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingTimeline onViewCalendar={nav.openPlantingCalendar} />
        <DashboardGardenSnapshot onOpenGarden={nav.openGardenDesigner} />
      </div>

      {/* Section 6: Plans secondary */}
      <PlansSection onManagePlans={nav.openGardenPlans} />
    </div>
  );
};

export default Dashboard;
