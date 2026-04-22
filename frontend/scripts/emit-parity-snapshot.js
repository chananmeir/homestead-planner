#!/usr/bin/env node
/**
 * Emit Cross-Stack Parity Snapshot
 *
 * Reads the frontend TypeScript lookup tables and space calculator and writes
 * a JSON snapshot that the Python test suite can assert against. This lets the
 * backend parity test run under plain pytest (no Node required at test time)
 * while still guaranteeing the frontend numbers are the source of truth.
 *
 * Scope (must stay in sync with backend counterparts):
 *   frontend/src/utils/sfgSpacing.ts                ↔ backend/sfg_spacing.py + garden_methods.py
 *   frontend/src/utils/migardenerSpacing.ts         ↔ backend/migardener_spacing.py
 *   frontend/src/utils/intensiveSpacing.ts          ↔ backend/intensive_spacing.py
 *   frontend/src/data/plantDatabase.ts              ↔ backend/plant_database.py
 *   frontend/src/utils/gardenPlannerSpaceCalculator.ts ↔ backend/services/space_calculator.py
 *
 * Output: backend/tests/fixtures/frontend_parity_snapshot.json
 *
 * Usage:
 *   cd frontend && npm run parity:emit
 *   (or)  node scripts/emit-parity-snapshot.js
 *
 * When this fixture drifts from what the backend computes, the pytest suite
 * will fail with a per-entry diff — that's the whole point.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ts = require('typescript');

// Repo layout: this file lives at <repo>/frontend/scripts/
const FRONTEND_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(FRONTEND_DIR, '..');
const OUTPUT_PATH = path.join(
  REPO_DIR,
  'backend',
  'tests',
  'fixtures',
  'frontend_parity_snapshot.json'
);

/**
 * Recursive TS loader.
 *
 * Transpiles a TS source file to CJS and executes it in a freshly-constructed
 * Node module whose `require` resolves relative imports back into this loader.
 * Bare imports go through the normal node_modules resolver. Relative imports
 * that resolve to something other than a real .ts/.tsx file (e.g. a type-only
 * `../types`) fall back to a benign empty-exports stub — those files are
 * pulled in only for their types, so leaving the runtime value undefined is
 * safe for the pure-logic modules we snapshot.
 */
const TS_MODULE_CACHE = new Map();
const STUB_EXPORTS = new Proxy(
  {},
  {
    get: () => undefined,
  }
);

function resolveTsPath(request, fromDir) {
  const candidates = [
    path.resolve(fromDir, request + '.ts'),
    path.resolve(fromDir, request + '.tsx'),
    path.resolve(fromDir, request, 'index.ts'),
    path.resolve(fromDir, request, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function loadTsModule(tsPath) {
  const absPath = path.resolve(tsPath);
  if (TS_MODULE_CACHE.has(absPath)) {
    return TS_MODULE_CACHE.get(absPath);
  }

  const src = fs.readFileSync(absPath, 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: path.basename(absPath),
  });

  const m = new Module(absPath);
  m.filename = absPath;
  m.paths = Module._nodeModulePaths(path.dirname(absPath));

  // Seed the cache with a placeholder to tolerate cycles (value will be
  // replaced after _compile runs).
  TS_MODULE_CACHE.set(absPath, m.exports);

  const ownRequire = (request) => {
    if (request.startsWith('.') || request.startsWith('/')) {
      const fromDir = path.dirname(absPath);
      const resolved = resolveTsPath(request, fromDir);
      if (resolved) {
        return loadTsModule(resolved);
      }
      // Relative import that doesn't resolve to a real TS file (e.g. type-only
      // `../types`) — return stubbed exports rather than crashing.
      return STUB_EXPORTS;
    }
    // Bare import (node_modules): delegate to standard require relative to
    // the source file's directory.
    return Module.createRequire(absPath)(request);
  };

  // Wrap so the compiled module's `require(...)` calls route through ownRequire.
  // We do this via the standard Node Module wrapper trick: build a function
  // whose `require` parameter is our resolver.
  const wrapper = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    outputText
  );
  wrapper(m.exports, ownRequire, m, absPath, path.dirname(absPath));
  TS_MODULE_CACHE.set(absPath, m.exports);
  return m.exports;
}

function main() {
  const sfg = loadTsModule(
    path.join(FRONTEND_DIR, 'src', 'utils', 'sfgSpacing.ts')
  );
  const mig = loadTsModule(
    path.join(FRONTEND_DIR, 'src', 'utils', 'migardenerSpacing.ts')
  );
  const intensive = loadTsModule(
    path.join(FRONTEND_DIR, 'src', 'utils', 'intensiveSpacing.ts')
  );
  const plantDb = loadTsModule(
    path.join(FRONTEND_DIR, 'src', 'data', 'plantDatabase.ts')
  );
  const spaceCalc = loadTsModule(
    path.join(FRONTEND_DIR, 'src', 'utils', 'gardenPlannerSpaceCalculator.ts')
  );

  // ---- SFG lookup (reshape to {plantId: plantsPerCell}) -------------------
  const sfgTable = {};
  for (const [plantId, plantsPerCell] of Object.entries(sfg.SFG_PLANTS_PER_CELL)) {
    sfgTable[plantId] = plantsPerCell;
  }

  // ---- MIGardener overrides -----------------------------------------------
  const mgOverrides = {};
  for (const [plantId, tuple] of Object.entries(mig.MIGARDENER_SPACING_OVERRIDES)) {
    // Frontend tuple: [rowSpacing | null, plantSpacing]
    mgOverrides[plantId] = {
      rowSpacing: tuple[0],
      plantSpacing: tuple[1],
    };
  }

  // ---- Intensive overrides ------------------------------------------------
  const intensiveOverrides = {};
  for (const [plantId, onCenter] of Object.entries(intensive.INTENSIVE_SPACING_OVERRIDES)) {
    intensiveOverrides[plantId] = onCenter;
  }

  // ---- Plant database (project only parity-relevant fields) ---------------
  // The backend plant DB carries many backend-only fields; we snapshot only
  // the fields the space-calculator relies on so parity tests are meaningful
  // and durable against frontend-only UI fields drifting.
  const plantFields = [
    'id',
    'name',
    'spacing',
    'rowSpacing',
    'daysToMaturity',
    'category',
  ];
  const plantEntries = plantDb.PLANT_DATABASE.map((p) => {
    const entry = {};
    for (const f of plantFields) {
      if (p[f] !== undefined) entry[f] = p[f];
    }
    // migardener override block drives seed-density + trellis detection
    if (p.migardener && typeof p.migardener === 'object') {
      const mg = p.migardener;
      const projected = {};
      for (const k of [
        'plantingStyle',
        'seedDensityPerInch',
        'rowSpacingInches',
        'linearFeetPerPlant',
      ]) {
        if (mg[k] !== undefined) projected[k] = mg[k];
      }
      if (Object.keys(projected).length > 0) {
        entry.migardener = projected;
      }
    }
    return entry;
  });

  // ---- Space calculator parity cases --------------------------------------
  // For every plant that has a method-specific override anywhere, emit the
  // frontend-computed cells-per-plant for all four supported methods. This
  // is the expected-value table the Python test compares against.
  const methods = ['square-foot', 'row', 'intensive', 'migardener'];
  const plantIdsWithOverrides = new Set([
    ...Object.keys(sfgTable),
    ...Object.keys(mgOverrides),
    ...Object.keys(intensiveOverrides),
  ]);
  // Also include every plant in the frontend DB that the other three groups
  // reference, so row/default behavior is exercised.
  const plantById = new Map(plantEntries.map((p) => [p.id, p]));
  const calculatorCases = [];
  const missingFromPlantDb = [];
  const sortedPlantIds = Array.from(plantIdsWithOverrides).sort();
  for (const plantId of sortedPlantIds) {
    const plant = plantById.get(plantId);
    if (!plant) {
      // Plant referenced in a spacing table but not in the frontend plant DB.
      // Record it so backend parity can flag the inconsistency, but skip
      // row/intensive/migardener (those all require `plant.spacing`).
      missingFromPlantDb.push(plantId);
      const sfgCells = spaceCalc.calculateSpaceRequirement(
        { id: plantId },
        12,
        'square-foot'
      );
      calculatorCases.push({
        plantId,
        method: 'square-foot',
        gridSize: 12,
        cells: sfgCells,
      });
      continue;
    }
    for (const method of methods) {
      const cells = spaceCalc.calculateSpaceRequirement(plant, 12, method);
      calculatorCases.push({
        plantId,
        method,
        gridSize: 12,
        cells,
      });
    }
  }

  const snapshot = {
    _meta: {
      generator: 'frontend/scripts/emit-parity-snapshot.js',
      regenerate: 'cd frontend && npm run parity:emit',
      description:
        'Frontend-emitted source of truth for cross-stack parity tests. ' +
        'Do not hand-edit — regenerate after changing any synced lookup table.',
    },
    sfgPlantsPerCell: sfgTable,
    migardenerOverrides: mgOverrides,
    intensiveOverrides: intensiveOverrides,
    plantDatabase: plantEntries,
    spaceCalculator: {
      gridSize: 12,
      cases: calculatorCases,
      plantsReferencedButMissingFromFrontendDb: missingFromPlantDb,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote parity snapshot to ${path.relative(REPO_DIR, OUTPUT_PATH)}`
  );
  console.log(
    `  sfg: ${Object.keys(sfgTable).length} entries | ` +
      `migardener: ${Object.keys(mgOverrides).length} | ` +
      `intensive: ${Object.keys(intensiveOverrides).length} | ` +
      `plants: ${plantEntries.length} | ` +
      `calculator cases: ${calculatorCases.length}`
  );
  if (missingFromPlantDb.length > 0) {
    console.log(
      `  note: ${missingFromPlantDb.length} plant id(s) appear in spacing ` +
        `tables but not in frontend PLANT_DATABASE: ${missingFromPlantDb.join(', ')}`
    );
  }
}

main();
