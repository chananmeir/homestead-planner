The cleanup pass improved `CLAUDE.md`, but it is not finished yet.

## What improved

- The stale `EnterPlanMode` reference was removed from the main planning rule and replaced with tool-agnostic planning guidance.
- Several brittle exact test-count references were reduced or removed.
- The orphaned high-risk sections were relocated into a more appropriate place in the document.
- `Last Updated` is now current.

## What still needs fixing

### 1. Encoding / mojibake cleanup is still required

The file still contains obvious corrupted characters throughout, for example:
- `âŒ`
- `âœ…`
- `ðŸ”´`
- `â†’`
- `â‰¥`
- `donâ€™t`

This is now the highest-priority remaining cleanup item.

It is not just cosmetic:
- it hurts scanability
- it lowers trust in the document
- it makes examples harder to read

### 2. One stale workflow phrase still remains

In `Final Notes`, the file still says:

- `Always use planning mode for multi-file changes`

That should also be converted to tool-agnostic wording so the file is internally consistent.

Suggested replacement:
- `Always plan explicitly for multi-file changes`

## Recommendation

Do one more small cleanup pass only:

1. fix all remaining mojibake / encoding corruption
2. remove the remaining stale `planning mode` wording

Then stop.

Do not jump into a larger structural rewrite yet.
First get the file fully readable and internally consistent.
