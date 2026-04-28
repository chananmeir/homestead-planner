import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Stop Hook - Runs after Claude finishes responding
 *
 * This hook:
 * 1. Checks for TypeScript/Python errors in edited files
 * 2. Provides gentle reminders for error handling
 * 3. Checks for risky patterns in code
 */
export default async function stop(
  _request: unknown,
  context: {
    cwd: string;
    editedFiles?: string[];
  }
): Promise<{ message?: string }> {
  try {
    const { cwd, editedFiles = [] } = context;

    if (editedFiles.length === 0) {
      return {};
    }

    const messages: string[] = [];

    // Determine which repos were modified
    const backendFiles = editedFiles.filter((f) =>
      f.includes('backend') && f.endsWith('.py')
    );
    const frontendFiles = editedFiles.filter((f) =>
      f.includes('frontend/src') && (f.endsWith('.tsx') || f.endsWith('.ts'))
    );

    // Check backend for Python/type errors
    if (backendFiles.length > 0) {
      const backendCheck = await checkBackend(cwd);
      if (backendCheck) {
        messages.push(backendCheck);
      }

      // Check for risky patterns in backend
      const backendReminder = checkBackendPatterns(cwd, backendFiles);
      if (backendReminder) {
        messages.push(backendReminder);
      }
    }

    // Check frontend for TypeScript errors
    if (frontendFiles.length > 0) {
      const frontendCheck = await checkFrontend(cwd);
      if (frontendCheck) {
        messages.push(frontendCheck);
      }

      // Check for risky patterns in frontend
      const frontendReminder = checkFrontendPatterns(cwd, frontendFiles);
      if (frontendReminder) {
        messages.push(frontendReminder);
      }
    }

    // Check for pending sync obligations
    const syncCheck = checkPendingSync(cwd);
    if (syncCheck) {
      messages.push(syncCheck);
    }

    if (messages.length === 0) {
      return {};
    }

    return {
      message: `\n${messages.join('\n\n')}`,
    };
  } catch (error) {
    console.error('Error in stop hook:', error);
    return {};
  }
}

/**
 * Check for pending sync file obligations from post-tool-use hook
 */
function checkPendingSync(cwd: string): string | null {
  try {
    const syncPath = path.join(cwd, '.claude', 'pending-sync.json');
    if (!fs.existsSync(syncPath)) {
      return null;
    }

    const alerts = JSON.parse(fs.readFileSync(syncPath, 'utf-8'));
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return null;
    }

    const lines = alerts.map((alert: { syncGroup: string; editedMember: string; pendingSync: string[] }) =>
      `   ${alert.syncGroup}: edited ${alert.editedMember}\n      Needs sync: ${alert.pendingSync.join(', ')}`
    );

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNC FILES PENDING UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines.join('\n\n')}

These synchronized file pairs must stay in sync (CLAUDE.md rule).
Update the counterpart files or run the sync-validator agent to verify.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  } catch {
    return null;
  }
}

/**
 * Check backend for Python errors
 */
async function checkBackend(cwd: string): Promise<string | null> {
  try {
    const backendPath = path.join(cwd, 'backend');

    // Try to run a simple Python syntax check
    try {
      execSync('python -m py_compile app.py', {
        cwd: backendPath,
        stdio: 'pipe',
      });
      return null; // No errors
    } catch (error) {
      const errorOutput = (error as any).stderr?.toString() || '';
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  BACKEND ERRORS DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorOutput.slice(0, 500)}

Please fix these errors before proceeding.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
  } catch (error) {
    // If we can't check, don't block
    return null;
  }
}

/**
 * Check frontend for TypeScript errors
 */
async function checkFrontend(cwd: string): Promise<string | null> {
  try {
    const frontendPath = path.join(cwd, 'frontend');

    // Check if TypeScript is available
    if (!fs.existsSync(path.join(frontendPath, 'tsconfig.json'))) {
      return null;
    }

    try {
      // Run TypeScript compiler check (no emit)
      execSync('npx tsc --noEmit', {
        cwd: frontendPath,
        stdio: 'pipe',
      });
      return null; // No errors
    } catch (error) {
      const errorOutput = (error as any).stdout?.toString() || '';
      const errorLines = errorOutput.split('\n').filter((line: string) => line.trim());

      // Count errors
      const errorCount = errorLines.filter((line: string) =>
        line.includes('error TS')
      ).length;

      if (errorCount === 0) {
        return null;
      }

      if (errorCount < 5) {
        // Show errors directly
        return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TYPESCRIPT ERRORS (${errorCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorOutput.slice(0, 1000)}

Please fix these errors before proceeding.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      } else {
        // Too many errors, suggest batch fixing
        return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TYPESCRIPT ERRORS (${errorCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorCount} TypeScript errors detected.

First few errors:
${errorOutput.split('\n').slice(0, 10).join('\n')}

Launch the auto-error-resolver agent to fix these systematically,
or run: cd frontend && npx tsc --noEmit to see all errors.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }
    }
  } catch (error) {
    return null;
  }
}

/**
 * Check backend files for risky patterns
 */
function checkBackendPatterns(cwd: string, files: string[]): string | null {
  const riskyPatterns = {
    tryBlock: /try:/g,
    asyncFunction: /async def/g,
    dbSession: /db\.session/g,
    routeDecorator: /@app\.route/g,
  };

  let hasTryBlock = false;
  let hasAsync = false;
  let hasDbOperation = false;
  let hasRoute = false;

  for (const file of files) {
    try {
      const fullPath = path.join(cwd, file);
      const content = fs.readFileSync(fullPath, 'utf-8');

      if (riskyPatterns.tryBlock.test(content)) hasTryBlock = true;
      if (riskyPatterns.asyncFunction.test(content)) hasAsync = true;
      if (riskyPatterns.dbSession.test(content)) hasDbOperation = true;
      if (riskyPatterns.routeDecorator.test(content)) hasRoute = true;
    } catch (error) {
      continue;
    }
  }

  if (!hasTryBlock && !hasAsync && !hasDbOperation && !hasRoute) {
    return null;
  }

  const reminders: string[] = [];

  if (hasRoute || hasDbOperation) {
    reminders.push('   ❓ Are database operations wrapped in try-except with rollback?');
    reminders.push('   ❓ Do route handlers return proper HTTP status codes?');
  }

  if (hasAsync) {
    reminders.push('   ❓ Are async operations properly awaited?');
    reminders.push('   ❓ Is error handling in place for async functions?');
  }

  if (hasTryBlock || hasDbOperation) {
    reminders.push('   ❓ Are errors logged or returned to the client appropriately?');
  }

  if (reminders.length === 0) {
    return null;
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 BACKEND CODE SELF-CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Backend Changes Detected (${files.length} file${files.length > 1 ? 's' : ''})

${reminders.join('\n')}

💡 Best Practices:
   - All database operations should have try-except with db.session.rollback()
   - Route handlers should validate input and return appropriate status codes
   - Use jsonify() for JSON responses
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Check frontend files for risky patterns
 */
function checkFrontendPatterns(cwd: string, files: string[]): string | null {
  const riskyPatterns = {
    useState: /useState/g,
    useEffect: /useEffect/g,
    fetch: /fetch\(/g,
    apiCall: /api\//g,
  };

  let hasState = false;
  let hasEffect = false;
  let hasFetch = false;
  let hasApi = false;

  for (const file of files) {
    try {
      const fullPath = path.join(cwd, file);
      const content = fs.readFileSync(fullPath, 'utf-8');

      if (riskyPatterns.useState.test(content)) hasState = true;
      if (riskyPatterns.useEffect.test(content)) hasEffect = true;
      if (riskyPatterns.fetch.test(content)) hasFetch = true;
      if (riskyPatterns.apiCall.test(content)) hasApi = true;
    } catch (error) {
      continue;
    }
  }

  if (!hasState && !hasEffect && !hasFetch && !hasApi) {
    return null;
  }

  const reminders: string[] = [];

  if (hasFetch || hasApi) {
    reminders.push('   ❓ Are loading and error states handled?');
    reminders.push('   ❓ Is there proper error handling with try-catch?');
    reminders.push('   ❓ Are HTTP errors checked (response.ok)?');
  }

  if (hasEffect) {
    reminders.push('   ❓ Are useEffect dependencies correct?');
    reminders.push('   ❓ Are there any cleanup functions needed?');
  }

  if (hasState) {
    reminders.push('   ❓ Are state updates immutable?');
  }

  if (reminders.length === 0) {
    return null;
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FRONTEND CODE SELF-CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Frontend Changes Detected (${files.length} file${files.length > 1 ? 's' : ''})

${reminders.join('\n')}

💡 Best Practices:
   - Always handle loading, error, and empty states
   - Use proper TypeScript types for API responses
   - Update state immutably (spread operators)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
