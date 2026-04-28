import * as fs from 'fs';
import * as path from 'path';

interface EditLog {
  timestamp: string;
  file: string;
  repo: string;
  tool: string;
}

interface SyncAlert {
  syncGroup: string;
  editedMember: string;
  pendingSync: string[];
}

/**
 * Synchronized file groups — editing one requires updating the others.
 * Keys are normalized paths (forward slashes) matched via includes().
 */
const SYNC_GROUPS: Record<string, { group: string; members: string[] }> = {
  'backend/services/space_calculator.py': {
    group: 'space-calculation',
    members: [
      'backend/services/space_calculator.py',
      'backend/plant_database.py',
      'frontend/src/utils/gardenPlannerSpaceCalculator.ts',
      'frontend/src/utils/sfgSpacing.ts',
    ],
  },
  'backend/plant_database.py': {
    group: 'plant-database',
    members: [
      'backend/plant_database.py',
      'frontend/src/data/plantDatabase.ts',
    ],
  },
  'frontend/src/data/plantDatabase.ts': {
    group: 'plant-database',
    members: [
      'backend/plant_database.py',
      'frontend/src/data/plantDatabase.ts',
    ],
  },
  'frontend/src/utils/gardenPlannerSpaceCalculator.ts': {
    group: 'space-calculation',
    members: [
      'backend/services/space_calculator.py',
      'backend/plant_database.py',
      'frontend/src/utils/gardenPlannerSpaceCalculator.ts',
      'frontend/src/utils/sfgSpacing.ts',
    ],
  },
  'backend/sfg_spacing.py': {
    group: 'sfg-lookup',
    members: [
      'backend/sfg_spacing.py',
      'frontend/src/utils/sfgSpacing.ts',
    ],
  },
  'frontend/src/utils/sfgSpacing.ts': {
    group: 'sfg-lookup',
    members: [
      'backend/sfg_spacing.py',
      'frontend/src/utils/sfgSpacing.ts',
    ],
  },
  'backend/migardener_spacing.py': {
    group: 'migardener-spacing',
    members: [
      'backend/migardener_spacing.py',
      'frontend/src/utils/migardenerSpacing.ts',
    ],
  },
  'frontend/src/utils/migardenerSpacing.ts': {
    group: 'migardener-spacing',
    members: [
      'backend/migardener_spacing.py',
      'frontend/src/utils/migardenerSpacing.ts',
    ],
  },
  'backend/intensive_spacing.py': {
    group: 'intensive-spacing',
    members: [
      'backend/intensive_spacing.py',
      'frontend/src/utils/intensiveSpacing.ts',
    ],
  },
  'frontend/src/utils/intensiveSpacing.ts': {
    group: 'intensive-spacing',
    members: [
      'backend/intensive_spacing.py',
      'frontend/src/utils/intensiveSpacing.ts',
    ],
  },
};

/**
 * PostToolUse Hook - Track file edits across the project
 *
 * This hook runs after Edit, Write, or MultiEdit tool use.
 * It logs which files were edited so the Stop hook can run
 * appropriate build checks on affected repos.
 */
export default async function postToolUse(
  request: {
    tool: string;
    result?: {
      path?: string;
      paths?: string[];
    };
  },
  context: {
    cwd: string;
  }
): Promise<void> {
  try {
    const { tool, result } = request;
    const { cwd } = context;

    // Only track file editing tools
    if (!['Edit', 'Write', 'MultiEdit'].includes(tool)) {
      return;
    }

    // Get edited file paths
    const editedFiles: string[] = [];
    if (result?.path) {
      editedFiles.push(result.path);
    }
    if (result?.paths && Array.isArray(result.paths)) {
      editedFiles.push(...result.paths);
    }

    if (editedFiles.length === 0) {
      return;
    }

    // Determine which repo each file belongs to
    const logs: EditLog[] = editedFiles.map((filePath) => {
      const repo = determineRepo(filePath);
      return {
        timestamp: new Date().toISOString(),
        file: filePath,
        repo,
        tool,
      };
    });

    // Append to edit log
    const logPath = path.join(cwd, '.claude', 'edit-log.json');
    let existingLogs: EditLog[] = [];

    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf-8');
        existingLogs = JSON.parse(content);
      } catch (error) {
        existingLogs = [];
      }
    }

    // Keep only recent logs (last 100 edits)
    const allLogs = [...existingLogs, ...logs].slice(-100);

    // Ensure .claude directory exists
    const claudeDir = path.join(cwd, '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Write logs
    fs.writeFileSync(logPath, JSON.stringify(allLogs, null, 2), 'utf-8');

    // Also update a simple "edited files" list for the Stop hook
    const editedFilesPath = path.join(cwd, '.claude', 'edited-files.json');
    const editedFilesSet = new Set<string>(
      existingLogs.map((log) => log.file)
    );
    logs.forEach((log) => editedFilesSet.add(log.file));

    fs.writeFileSync(
      editedFilesPath,
      JSON.stringify(Array.from(editedFilesSet), null, 2),
      'utf-8'
    );

    // Check for sync file group membership
    const syncAlerts = detectSyncObligations(editedFiles, cwd);
    if (syncAlerts.length > 0) {
      const syncAlertsPath = path.join(cwd, '.claude', 'pending-sync.json');
      let existingAlerts: SyncAlert[] = [];

      if (fs.existsSync(syncAlertsPath)) {
        try {
          existingAlerts = JSON.parse(fs.readFileSync(syncAlertsPath, 'utf-8'));
        } catch {
          existingAlerts = [];
        }
      }

      // Merge new alerts (deduplicate by group)
      const alertMap = new Map<string, SyncAlert>();
      for (const alert of [...existingAlerts, ...syncAlerts]) {
        const existing = alertMap.get(alert.syncGroup);
        if (existing) {
          // Merge pending lists
          const pendingSet = new Set([...existing.pendingSync, ...alert.pendingSync]);
          alertMap.set(alert.syncGroup, { ...alert, pendingSync: Array.from(pendingSet) });
        } else {
          alertMap.set(alert.syncGroup, alert);
        }
      }

      // Remove entries where all members have been edited
      const allEditedNormalized = new Set(
        Array.from(editedFilesSet).map((f) => f.replace(/\\/g, '/'))
      );
      for (const [group, alert] of alertMap) {
        const remaining = alert.pendingSync.filter(
          (member) => !Array.from(allEditedNormalized).some((edited) => edited.includes(member))
        );
        if (remaining.length === 0) {
          alertMap.delete(group);
        } else {
          alert.pendingSync = remaining;
        }
      }

      fs.writeFileSync(
        syncAlertsPath,
        JSON.stringify(Array.from(alertMap.values()), null, 2),
        'utf-8'
      );
    }
  } catch (error) {
    console.error('Error in post-tool-use hook:', error);
  }
}

/**
 * Detect sync obligations when a file from a sync group is edited.
 * Returns alerts for counterpart files that need updating.
 */
function detectSyncObligations(editedFiles: string[], _cwd: string): SyncAlert[] {
  const alerts: SyncAlert[] = [];
  const seen = new Set<string>();

  for (const filePath of editedFiles) {
    const normalized = filePath.replace(/\\/g, '/');

    for (const [trigger, config] of Object.entries(SYNC_GROUPS)) {
      if (normalized.includes(trigger) && !seen.has(config.group)) {
        seen.add(config.group);
        const pendingSync = config.members.filter(
          (member) => !editedFiles.some((edited) => edited.replace(/\\/g, '/').includes(member))
        );
        if (pendingSync.length > 0) {
          alerts.push({
            syncGroup: config.group,
            editedMember: trigger,
            pendingSync,
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Determine which repo a file belongs to
 */
function determineRepo(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (normalizedPath.includes('backend/')) {
    return 'backend';
  }

  if (normalizedPath.includes('frontend/')) {
    return 'frontend';
  }

  if (normalizedPath.includes('dev/')) {
    return 'dev-docs';
  }

  if (normalizedPath.includes('.claude/')) {
    return 'claude-config';
  }

  return 'root';
}
