# Auto Error Resolver Memory

## ESLint Suppression Pattern (CONFIRMED)

This project's ESLint config does NOT honor underscore-prefixed variables as unused-exempt.
Using `_varName` does NOT suppress `@typescript-eslint/no-unused-vars`.

**Correct approach**: Use `// eslint-disable-next-line @typescript-eslint/no-unused-vars` on the line before.

For `useEffect` / `useMemo` missing deps: use `// eslint-disable-next-line react-hooks/exhaustive-deps`
on the line before the dependency array closing `}, [...]`.

## Common Warning Patterns (Feb 2026)

### Unused state values (setter IS used, value is not read)
- Pattern: `const [value, setValue] = useState(...)` where only `setValue` is called
- Fix: `// eslint-disable-next-line @typescript-eslint/no-unused-vars` before the line

### Unused variables (pure computation, no side effects)
- Fix: Remove the assignment entirely if RHS has no side effects
- Example: `expectedGermination` / `expectedSurvival` intermediate calculations

### useEffect "run on mount" pattern
- These are intentional. Do NOT add missing deps (risks infinite loops).
- Fix: `// eslint-disable-next-line react-hooks/exhaustive-deps` before the dep array

### Unused imports
- Fix: Remove the import token (or the entire import line if no other tokens remain)
- Affected files (Feb 2026): CompostTracker, PlantConfigModal, GardenPlanner, PropertyDesigner
