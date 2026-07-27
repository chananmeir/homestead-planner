import * as fs from 'fs';
import * as path from 'path';

const PROJECT_SRC = path.resolve(__dirname, '..', '..');

const guardedFiles = [
  'contexts/SimulationContext.tsx',
  'utils/urlParams.ts',
  'components/SeedCatalog.tsx',
  'components/MySeedInventory.tsx',
  'components/Livestock.tsx',
  'components/PhotoGallery.tsx',
  'components/common/DateRangePicker.tsx',
  'components/HarvestTracker.tsx',
  'components/Dashboard/UpcomingTimeline.tsx',
  'components/PlantingCalendar/AddCropModal/index.tsx',
  'components/PlantingCalendar/AddCropModal/SuccessionWizard.tsx',
  'components/PlantingCalendar/AddCropModal/PositionSelector.tsx',
  'components/PlantingCalendar/AddGardenEventModal.tsx',
  'components/PlantingCalendar/AddMapleTappingModal.tsx',
  'components/PlantingCalendar/MapleTappingSeasonCard.tsx',
  'components/PlantingCalendar/TimelineView/AvailableSpacesView.tsx',
  'components/PlantingCalendar/ListView/index.tsx',
  'components/GardenDesigner.tsx',
  'components/GardenDesigner/SetSeedDateModal.tsx',
  'components/GardenDesigner/WeatherAlertBanner.tsx',
  'components/GardenDesigner/PlannedPlantsSection.tsx',
  'components/GardenDesigner/utils/designerHelpers.ts',
  'components/PropertyDesigner.tsx',
  'components/IndoorSeedStarts.tsx',
  'components/IndoorSeedStarts/EditSeedStartModal.tsx',
  'components/IndoorSeedStarts/ImportFromGardenModal.tsx',
  'components/IndoorSeedStarts/FailedSeedStartDialog.tsx',
];

const riskyPatterns = [
  {
    name: 'date input parsed through new Date',
    pattern: /new Date\(e\.target\.value\)/,
  },
  {
    name: 'local date formatted through UTC ISO split',
    pattern: /toISOString\(\)\.split\('T'\)\[0\]/,
  },
  {
    name: 'local date formatted through UTC ISO slice',
    pattern: /toISOString\(\)\.slice\(0,\s*10\)/,
  },
  {
    name: 'date-only string displayed through raw Date',
    pattern: /new Date\([^)]*\)\.toLocaleDateString\(/,
  },
];

describe('date-only usage guard', () => {
  test.each(guardedFiles)('%s uses local date helpers for date-only values', (relativePath) => {
    const source = fs.readFileSync(path.join(PROJECT_SRC, relativePath), 'utf8');
    const failures = riskyPatterns
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => name);

    expect(failures).toEqual([]);
  });
});
