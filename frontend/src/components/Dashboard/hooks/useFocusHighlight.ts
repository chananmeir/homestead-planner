import { useCallback, useEffect, useRef, useState } from 'react';

const HIGHLIGHT_DURATION_MS = 2000;

/**
 * Scrolls a registered element into view and temporarily highlights it when
 * `focusId` changes to a non-null value.
 *
 * NOTE: `focusId` must be a primitive (string or number). The effect's identity
 * comparison relies on primitive equality — passing an object would produce a
 * new reference on every render and cause re-scroll on every render.
 */
export function useFocusHighlight<T extends string | number>(
  focusId: T | null | undefined,
  onConsumed?: () => void
): {
  registerRef: (id: T) => (el: HTMLElement | null) => void;
  highlightedId: T | null;
} {
  const refsMap = useRef<Map<T, HTMLElement>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onConsumedRef = useRef(onConsumed);
  const [highlightedId, setHighlightedId] = useState<T | null>(null);

  useEffect(() => {
    onConsumedRef.current = onConsumed;
  }, [onConsumed]);

  const registerRef = useCallback(
    (id: T) => (el: HTMLElement | null) => {
      if (el != null) {
        refsMap.current.set(id, el);
      } else {
        refsMap.current.delete(id);
      }
    },
    []
  );

  useEffect(() => {
    if (focusId == null) {
      return;
    }

    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const el = refsMap.current.get(focusId);
    if (el != null) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedId(focusId);

    timerRef.current = setTimeout(() => {
      setHighlightedId(null);
      timerRef.current = null;
      onConsumedRef.current?.();
    }, HIGHLIGHT_DURATION_MS);

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [focusId]);

  return { registerRef, highlightedId };
}
