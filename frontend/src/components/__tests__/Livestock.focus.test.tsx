/**
 * Focus-prop integration test for Livestock.
 *
 * Unlike the other destinations, Livestock focuses on a CATEGORY SECTION
 * (identified by a string id like 'egg-collection'), not a database row. The
 * focused element is the chickens panel container, not a per-animal row.
 *
 * The component also auto-switches activeCategory when focusType maps to one
 * (FOCUS_TYPE_TO_CATEGORY['egg-collection'] → 'chickens'). We verify both
 * the scroll + highlight AND that the chickens panel is the active one after
 * focus flips.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { installFetchMock, clearFetchMock } from '../Dashboard/testUtils';
import { ToastProvider } from '../common/Toast';
import Livestock from '../Livestock';

describe('Livestock focus integration', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  function renderComponent(focusType: string | null) {
    return render(
      <ToastProvider>
        <Livestock focusType={focusType} onFocusConsumed={() => {}} />
      </ToastProvider>
    );
  }

  test("focusType='egg-collection' scrolls + highlights the chickens section", async () => {
    // Livestock fetches one endpoint per active category; chickens is the
    // initial default, so we mock that + the nutrition endpoint.
    installFetchMock([
      { match: '/api/chickens', response: [] },
      { match: '/api/ducks', response: [] },
      { match: '/api/beehives', response: [] },
      { match: '/api/livestock', response: [] },
      {
        match: '/api/nutrition/livestock',
        response: {
          totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          by_animal_type: {},
          production_summary: [],
          year: 2026,
        },
      },
    ]);

    const { rerender } = renderComponent(null);

    // Wait for initial load to settle — the egg-collection container only gets
    // its data-focus-id when activeCategory === 'chickens' (which is the default).
    await waitFor(() => {
      expect(
        document.querySelector('[data-focus-id="egg-collection"]')
      ).not.toBeNull();
    });
    expect((Element.prototype as any).scrollIntoView).not.toHaveBeenCalled();

    // Flip focusType. The hook should scroll the chickens panel and add the
    // highlight ring.
    rerender(
      <ToastProvider>
        <Livestock focusType="egg-collection" onFocusConsumed={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    const panel = document.querySelector(
      '[data-focus-id="egg-collection"]'
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toMatch(/ring-2/);
    expect(panel.className).toMatch(/ring-amber-400/);
  });

  test("focusType='egg-collection' after user switched to 'ducks' still scrolls + highlights chickens", async () => {
    // Regression test: previously, if the user was viewing a non-chickens
    // category when the focusType flipped, the hook's scroll effect fired on
    // the same commit as the setActiveCategory effect — the egg-collection ref
    // wasn't registered yet (ducks panel was active), so scrollIntoView was
    // silently skipped. The gated effectiveFocusId defers the scroll/highlight
    // until activeCategory has settled on 'chickens'.
    installFetchMock([
      { match: '/api/chickens', response: [] },
      { match: '/api/ducks', response: [] },
      { match: '/api/beehives', response: [] },
      { match: '/api/livestock', response: [] },
      {
        match: '/api/nutrition/livestock',
        response: {
          totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          by_animal_type: {},
          production_summary: [],
          year: 2026,
        },
      },
    ]);

    const { rerender } = renderComponent(null);

    // Wait for initial chickens panel (default category) to settle.
    await waitFor(() => {
      expect(
        document.querySelector('[data-focus-id="egg-collection"]')
      ).not.toBeNull();
    });

    // User clicks the Ducks tab — activeCategory flips to 'ducks', the
    // egg-collection data-focus-id disappears because the ref is only
    // registered on the chickens panel.
    fireEvent.click(screen.getByTestId('livestock-tab-ducks'));

    await waitFor(() => {
      expect(
        document.querySelector('[data-focus-id="egg-collection"]')
      ).toBeNull();
    });
    expect((Element.prototype as any).scrollIntoView).not.toHaveBeenCalled();

    // Dashboard deep-link fires: focusType flips to 'egg-collection'. The
    // component must: (1) switch activeCategory back to 'chickens',
    // (2) scroll the chickens panel into view, (3) apply the highlight ring.
    rerender(
      <ToastProvider>
        <Livestock focusType="egg-collection" onFocusConsumed={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    const panel = document.querySelector(
      '[data-focus-id="egg-collection"]'
    ) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toMatch(/ring-2/);
    expect(panel.className).toMatch(/ring-amber-400/);
  });
});
