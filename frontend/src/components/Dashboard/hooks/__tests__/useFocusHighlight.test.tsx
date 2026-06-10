/**
 * Unit tests for useFocusHighlight — the small hook that powers dashboard
 * deep-link highlighting on destination pages.
 *
 * Contract the hook must uphold:
 *  - Registering refs for ids, then scrolling + highlighting when focusId matches a registered id.
 *  - Highlight auto-clears after HIGHLIGHT_DURATION_MS (~2000ms) and calls onConsumed.
 *  - Changing focusId before the timer fires replaces the highlight without leaking the old timer.
 *  - Unmount cancels the timer cleanly (no act warnings, no post-unmount state updates).
 *  - registerRef is referentially stable across re-renders.
 *  - focusId pointing to an unknown id is a no-op (no crash, no scrollIntoView).
 */
import { act, renderHook } from '@testing-library/react';
import { useFocusHighlight } from '../useFocusHighlight';

describe('useFocusHighlight', () => {
  let scrollIntoViewMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    // jsdom doesn't implement scrollIntoView; stub it before each test.
    scrollIntoViewMock = jest.fn();
    (Element.prototype as any).scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('initial render with null focusId: no highlight, no scroll', () => {
    const { result } = renderHook(() => useFocusHighlight<number>(null));
    expect(result.current.highlightedId).toBeNull();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  test('initial render with undefined focusId: no highlight, no scroll', () => {
    const { result } = renderHook(() => useFocusHighlight<number>(undefined));
    expect(result.current.highlightedId).toBeNull();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  test('scrolls + highlights when focusId matches a registered ref', () => {
    const onConsumed = jest.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id, onConsumed),
      { initialProps: { id: null as number | null } }
    );

    // Register a ref for id=5 by calling the returned setter with a real element.
    const el = document.createElement('div');
    act(() => {
      result.current.registerRef(5)(el);
    });

    // Now flip focusId to 5.
    act(() => {
      rerender({ id: 5 });
    });

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(result.current.highlightedId).toBe(5);
    expect(onConsumed).not.toHaveBeenCalled();
  });

  test('after ~2000ms the highlight clears and onConsumed fires', () => {
    const onConsumed = jest.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id, onConsumed),
      { initialProps: { id: null as number | null } }
    );

    const el = document.createElement('div');
    act(() => { result.current.registerRef(5)(el); });
    act(() => { rerender({ id: 5 }); });

    expect(result.current.highlightedId).toBe(5);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.highlightedId).toBeNull();
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  test('changing focusId before timer fires clears the pending timer', () => {
    const onConsumed = jest.fn();
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id, onConsumed),
      { initialProps: { id: null as number | null } }
    );

    const el5 = document.createElement('div');
    const el9 = document.createElement('div');
    act(() => {
      result.current.registerRef(5)(el5);
      result.current.registerRef(9)(el9);
    });

    // First focus: id=5
    act(() => { rerender({ id: 5 }); });
    expect(result.current.highlightedId).toBe(5);

    // Switch to id=9 before 2s elapses — the old timer should be cancelled
    // so it can't reset highlightedId to null prematurely.
    act(() => { jest.advanceTimersByTime(500); });
    act(() => { rerender({ id: 9 }); });
    expect(result.current.highlightedId).toBe(9);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);

    // Advance enough to exceed the ORIGINAL 2s deadline but not the new one.
    act(() => { jest.advanceTimersByTime(1600); });
    // If the old timer had leaked, highlightedId would have become null here.
    expect(result.current.highlightedId).toBe(9);
    expect(onConsumed).not.toHaveBeenCalled();

    // Complete the new timer.
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current.highlightedId).toBeNull();
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  test('unmounting clears pending timer — no calls after unmount', () => {
    const onConsumed = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useFocusHighlight<number>(id, onConsumed),
      { initialProps: { id: null as number | null } }
    );

    const el = document.createElement('div');
    act(() => { result.current.registerRef(5)(el); });
    act(() => { rerender({ id: 5 }); });
    expect(result.current.highlightedId).toBe(5);

    // Unmount before the 2s timer completes.
    unmount();

    // Fast-forward beyond the timer deadline.
    act(() => { jest.advanceTimersByTime(3000); });

    // onConsumed must NOT fire after unmount (timer cleared in cleanup).
    expect(onConsumed).not.toHaveBeenCalled();
  });

  test('registerRef is referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id),
      { initialProps: { id: null as number | null } }
    );

    const first = result.current.registerRef;
    rerender({ id: 1 });
    const second = result.current.registerRef;
    rerender({ id: 2 });
    const third = result.current.registerRef;

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  test('focusId pointing to an unknown id: no scrollIntoView, but highlightedId is set', () => {
    // Register id=5, then focus id=42 (which has no registered ref).
    // Hook still sets highlightedId (consumer may decide how to react to
    // "I want you focused but the row hasn't rendered yet"), but must not
    // crash or call scrollIntoView on a missing element.
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id),
      { initialProps: { id: null as number | null } }
    );

    const el = document.createElement('div');
    act(() => { result.current.registerRef(5)(el); });

    act(() => { rerender({ id: 42 }); });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(result.current.highlightedId).toBe(42);
  });

  test('scrolls when a matching ref registers after focusId was already set', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id),
      { initialProps: { id: null as number | null } }
    );

    act(() => { rerender({ id: 42 }); });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(result.current.highlightedId).toBe(42);

    const el = document.createElement('div');
    act(() => { result.current.registerRef(42)(el); });

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  test('unregistering a ref (passing null) removes it', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFocusHighlight<number>(id),
      { initialProps: { id: null as number | null } }
    );

    const el = document.createElement('div');
    act(() => { result.current.registerRef(5)(el); });
    // Unregister
    act(() => { result.current.registerRef(5)(null); });

    // Now focusing id=5 should not scroll (ref was removed).
    act(() => { rerender({ id: 5 }); });
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
