/**
 * Integration tests for the property save flow (AUDIT-021).
 *
 * These tests cover the save-site contract documented in
 * `weather-zip-propagation-fix-report.md`:
 *
 *   - Successful create/edit invalidates the property cache, pins the
 *     extracted ZIP into both `weatherZipCode` and per-user backup, and
 *     dispatches `weatherZipCodeChanged`.
 *
 *   - Stale-pin overwrite (acceptance criterion #6 — the user's reported
 *     symptom): a previously pinned ZIP MUST be overwritten by the
 *     property ZIP on save.
 *
 *   - Address with no ZIP: pin is preserved, no dispatch.
 *
 * The `useWeatherZipCode` hook is intentionally NOT mocked — we want the
 * real resolver to observe the real localStorage writes and event dispatch.
 * Only the network boundary (fetch) is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PropertyFormModal } from '../PropertyFormModal';
import { ToastProvider } from '../../common';
import { __resetPrimaryPropertyCacheForTests } from '../../../hooks/useProperty';
import { installFetchMock, clearFetchMock } from '../../Dashboard/testUtils';

// Mock useAuth — modal reads `user?.id` and passes it into `pinWeatherZip`.
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, username: 'tester', email: 't@example.com' } }),
}));

function renderModal(props: Partial<React.ComponentProps<typeof PropertyFormModal>> = {}) {
  const onSuccess = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <ToastProvider>
      <PropertyFormModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        mode="add"
        {...props}
      />
    </ToastProvider>
  );
  return { ...utils, onSuccess, onClose };
}

async function fillRequiredFields(name = 'Homestead', width = 100, length = 100) {
  await userEvent.clear(screen.getByLabelText(/Property Name/i));
  await userEvent.type(screen.getByLabelText(/Property Name/i), name);

  const widthEl = screen.getByLabelText(/Width \(ft\)/i);
  await userEvent.clear(widthEl);
  await userEvent.type(widthEl, String(width));

  const lengthEl = screen.getByLabelText(/Length \(ft\)/i);
  await userEvent.clear(lengthEl);
  await userEvent.type(lengthEl, String(length));
}

describe('PropertyFormModal — weather ZIP propagation on save (AUDIT-021)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetPrimaryPropertyCacheForTests();
  });

  afterEach(() => {
    clearFetchMock();
    localStorage.clear();
    __resetPrimaryPropertyCacheForTests();
    jest.restoreAllMocks();
  });

  test('successful create with ZIP-bearing address pins the new ZIP and dispatches event', async () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    const fetchMock = installFetchMock([
      {
        match: '/api/properties',
        response: {
          id: 1,
          name: 'Homestead',
          address: '123 Farm Rd, Town, VT 05001',
          latitude: 43.5,
          longitude: -72.5,
        },
        status: 201,
      },
    ]);

    try {
      const { onSuccess } = renderModal();

      await fillRequiredFields();
      await userEvent.type(
        screen.getByLabelText(/Address/i),
        '123 Farm Rd, Town, VT 05001'
      );

      await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      // POST hit /api/properties
      expect(fetchMock).toHaveBeenCalled();

      // Both pin keys written from the saved address ZIP.
      expect(localStorage.getItem('weatherZipCode')).toBe('05001');
      expect(localStorage.getItem('weatherZipCode__user_7')).toBe('05001');

      // Event fired with the new ZIP in detail.
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[events.length - 1].detail).toBe('05001');
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }
  });

  test('STALE PIN OVERWRITE — saving a property with a different ZIP replaces the old pinned ZIP', async () => {
    // Pre-condition: a stale ZIP was pinned earlier (the bug symptom from
    // the user's report).
    localStorage.setItem('weatherZipCode', '99999');
    localStorage.setItem('weatherZipCode__user_7', '99999');

    installFetchMock([
      {
        match: '/api/properties',
        response: {
          id: 2,
          name: 'New Place',
          address: '500 Orchard Ln, City, NH 03301',
          latitude: 43.2,
          longitude: -71.5,
        },
        status: 201,
      },
    ]);

    const { onSuccess } = renderModal();

    await fillRequiredFields('New Place');
    await userEvent.type(
      screen.getByLabelText(/Address/i),
      '500 Orchard Ln, City, NH 03301'
    );

    await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // The whole point of AUDIT-021: stale pin must NOT survive a property save.
    expect(localStorage.getItem('weatherZipCode')).toBe('03301');
    expect(localStorage.getItem('weatherZipCode__user_7')).toBe('03301');
  });

  test('edit (PUT) path overwrites the pin with the edited address ZIP', async () => {
    localStorage.setItem('weatherZipCode', '11111');

    let putHit = false;
    installFetchMock([
      {
        match: '/api/properties/42',
        response: {
          id: 42,
          name: 'Edited',
          address: '900 Hill Rd, Village, ME 04401',
          latitude: 44.8,
          longitude: -68.7,
        },
        status: 200,
      },
    ]);

    // Wrap with a manual fetch hook so we can also verify it was a PUT.
    const original = (global as any).fetch;
    (global as any).fetch = jest.fn(async (url: any, init: any) => {
      if (init?.method === 'PUT') putHit = true;
      return original(url, init);
    });

    try {
      const { onSuccess } = renderModal({
        mode: 'edit',
        propertyData: {
          id: 42,
          name: 'Edited',
          width: 50,
          length: 50,
          address: '900 Hill Rd, Village, ME 04401',
        },
      });

      // Fields pre-filled in edit mode — submit directly.
      await userEvent.click(screen.getByRole('button', { name: /Update Property/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      expect(putHit).toBe(true);
      expect(localStorage.getItem('weatherZipCode')).toBe('04401');
      expect(localStorage.getItem('weatherZipCode__user_7')).toBe('04401');
    } finally {
      (global as any).fetch = original;
    }
  });

  test('saving a property with NO ZIP in address preserves the existing pin and does not dispatch', async () => {
    localStorage.setItem('weatherZipCode', '12345');

    installFetchMock([
      {
        match: '/api/properties',
        response: {
          id: 3,
          name: 'Foreign Field',
          // No US ZIP in this address
          address: '10 Rue de la Ferme, 75001 Paris, France',
          latitude: 48.86,
          longitude: 2.35,
        },
        status: 201,
      },
    ]);

    // The French postcode "75001" does match the US 5-digit regex (it is a
    // 5-digit number), which is a known limitation of the shared regex.
    // Verify the actual contract: extract returns whatever the regex finds,
    // and the save flow only skips pinning when extract returns null.
    //
    // To exercise the no-ZIP branch we use an address with NO 5-digit run.
    clearFetchMock();
    installFetchMock([
      {
        match: '/api/properties',
        response: {
          id: 3,
          name: 'Foreign Field',
          address: 'No numeric postcode here',
          latitude: 48.86,
          longitude: 2.35,
        },
        status: 201,
      },
    ]);

    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    try {
      const { onSuccess } = renderModal();

      await fillRequiredFields('Foreign Field');
      await userEvent.type(
        screen.getByLabelText(/Address/i),
        'No numeric postcode here'
      );

      await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      // No extracted ZIP -> pin preserved.
      expect(localStorage.getItem('weatherZipCode')).toBe('12345');
      // Per-user backup was never written by this flow (no userId-keyed write
      // happens when extract is null).
      expect(localStorage.getItem('weatherZipCode__user_7')).toBeNull();
      // No dispatch fired.
      expect(events).toHaveLength(0);
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }
  });
});

// ---------------------------------------------------------------------------
// Retest-failure additions (AUDIT-021 second pass).
//
// These cover the four PropertyFormModal scenarios in
// `weather-zip-propagation-retest-failure.md` "Expected Fix Direction" #6:
// the validation-zip capture chain that survives a backend formatted_address
// rewrite, gets cleared on user edit, idempotently overwrites on retry, and
// optionally consumes a backend `zipcode` response field.
//
// Test ordering note: `installFetchMock` uses `routes.find` with substring
// matching. `/api/properties` is a substring of `/api/properties/validate-address`,
// so validate-address routes MUST come first in the route list.
// ---------------------------------------------------------------------------
describe('PropertyFormModal — retest-failure ZIP capture chain (AUDIT-021)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetPrimaryPropertyCacheForTests();
  });

  afterEach(() => {
    clearFetchMock();
    localStorage.clear();
    __resetPrimaryPropertyCacheForTests();
    jest.restoreAllMocks();
  });

  test('ZIP-only validation: formatted_address loses ZIP, capture-time ref still pins', async () => {
    // Scenario #1 from spec: User types `60601`. Validate response returns
    // `formatted_address: "Chicago, IL"` (no ZIP) and the form is updated to
    // that string. On save, `pinWeatherZip` is still called with `60601`
    // because it was captured pre-await.
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    installFetchMock([
      {
        match: '/api/properties/validate-address',
        response: {
          valid: true,
          formatted_address: 'Chicago, IL',
          latitude: 41.8781,
          longitude: -87.6298,
          zone: '6a',
        },
        status: 200,
      },
      {
        match: '/api/properties',
        response: {
          id: 10,
          name: 'ZipOnly',
          // Saved address mirrors what the backend returned — NO ZIP.
          address: 'Chicago, IL',
          latitude: 41.8781,
          longitude: -87.6298,
        },
        status: 201,
      },
    ]);

    try {
      const { onSuccess } = renderModal();

      await fillRequiredFields('ZipOnly');
      const addressEl = screen.getByLabelText(/Address/i);
      await userEvent.type(addressEl, '60601');

      // Trigger validation — this captures `60601` into the ref BEFORE the
      // backend returns `formatted_address: "Chicago, IL"` and rewrites the form.
      await userEvent.click(screen.getByRole('button', { name: /Validate Address/i }));

      // Wait for the form to be rewritten to the formatted_address (proves
      // the capture happened pre-rewrite — without the fix, the ZIP is lost
      // here).
      await waitFor(() =>
        expect((addressEl as HTMLInputElement).value).toBe('Chicago, IL')
      );

      await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());

      // The captured ZIP from the user's original input must win the chain.
      expect(localStorage.getItem('weatherZipCode')).toBe('60601');
      expect(localStorage.getItem('weatherZipCode__user_7')).toBe('60601');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[events.length - 1].detail).toBe('60601');
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }
  });

  test('captured ZIP cleared when user retypes the address without re-validating', async () => {
    // Scenario #2: User types `60601`, clicks Validate, then edits the
    // address to `Madison, WI` without re-validating, then saves. The
    // captured ZIP must NOT be used (it's stale relative to the new input).
    installFetchMock([
      {
        match: '/api/properties/validate-address',
        response: {
          valid: true,
          formatted_address: 'Chicago, IL',
          latitude: 41.8781,
          longitude: -87.6298,
        },
        status: 200,
      },
      {
        match: '/api/properties',
        response: {
          id: 11,
          name: 'Edited',
          address: 'Madison, WI',
          latitude: 43.07,
          longitude: -89.4,
        },
        status: 201,
      },
    ]);

    const { onSuccess } = renderModal();

    await fillRequiredFields('Edited');
    const addressEl = screen.getByLabelText(/Address/i) as HTMLInputElement;

    // First: type a ZIP and validate, capturing 60601 into the ref.
    await userEvent.type(addressEl, '60601');
    await userEvent.click(screen.getByRole('button', { name: /Validate Address/i }));
    await waitFor(() => expect(addressEl.value).toBe('Chicago, IL'));

    // Then user edits the address to a new value with NO ZIP. The
    // `handleChange` side effect must clear the captured ref so the now-stale
    // 60601 cannot mispin.
    await userEvent.clear(addressEl);
    await userEvent.type(addressEl, 'Madison, WI');

    await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // Captured 60601 was cleared by the user's edit. The new input has no
    // ZIP, the saved address has no ZIP, and the backend response has no
    // zipcode field. No `pinWeatherZip` call -> no localStorage write.
    expect(localStorage.getItem('weatherZipCode')).toBeNull();
    expect(localStorage.getItem('weatherZipCode__user_7')).toBeNull();
  });

  test('first validation fails, second succeeds: captured ZIP from second attempt pins on save', async () => {
    // Scenario #3: First POST to validate-address rejects (4xx with valid:false),
    // user clicks Validate again, second response succeeds. Save fires;
    // `pinWeatherZip` is called with `60601` from the second successful
    // capture (which is also identical to the first capture for unchanged input).
    let validateCallCount = 0;
    (global as any).fetch = jest.fn(async (url: any, init: any) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (href.includes('/api/properties/validate-address')) {
        validateCallCount += 1;
        if (validateCallCount === 1) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: 'Address could not be resolved', valid: false }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            valid: true,
            formatted_address: 'Chicago, IL',
            latitude: 41.8781,
            longitude: -87.6298,
          }),
        };
      }
      if (href.includes('/api/properties')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 12,
            name: 'Retry',
            address: 'Chicago, IL',
            latitude: 41.8781,
            longitude: -87.6298,
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not mocked' }) };
    });

    const { onSuccess } = renderModal();

    await fillRequiredFields('Retry');
    const addressEl = screen.getByLabelText(/Address/i) as HTMLInputElement;
    await userEvent.type(addressEl, '60601');

    // First validate attempt — fails. The captured ZIP is still written
    // (capture is pre-await), but the form is NOT rewritten because the
    // response was not ok.
    await userEvent.click(screen.getByRole('button', { name: /Validate Address/i }));
    await waitFor(() => expect(validateCallCount).toBe(1));
    // Wait for the failed-attempt error UI so the loading state has cleared
    // before the next click (otherwise the button is still disabled and the
    // second click is swallowed).
    await waitFor(() =>
      expect(screen.getByText(/Address could not be resolved/i)).toBeInTheDocument()
    );
    // Form input unchanged because validation failed.
    expect(addressEl.value).toBe('60601');

    // Second validate attempt without editing — succeeds. Capture
    // overwrites with the same value; backend rewrites form.
    await userEvent.click(screen.getByRole('button', { name: /Validate Address/i }));
    await waitFor(() => expect(validateCallCount).toBe(2));
    await waitFor(() => expect(addressEl.value).toBe('Chicago, IL'));

    await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(localStorage.getItem('weatherZipCode')).toBe('60601');
    expect(localStorage.getItem('weatherZipCode__user_7')).toBe('60601');
  });

  test('backend response zipcode field used as 4th-source fallback when input has no ZIP', async () => {
    // Scenario #4: Backend response includes `zipcode: "60601"` AND the
    // user's input had no ZIP (so capture-time ref stays null). Save must
    // use the response zipcode through `validationResponseZipRef`.
    //
    // Note: today's backend does not expose `zipcode`, but the implementer
    // added forward-compat handling that ALSO defensively extracts a ZIP
    // from `formatted_address`. To exercise the explicit zipcode field, we
    // use a formatted_address with NO 5-digit run so only the explicit
    // field can supply the ZIP.
    installFetchMock([
      {
        match: '/api/properties/validate-address',
        response: {
          valid: true,
          formatted_address: 'Chicago, IL',
          latitude: 41.8781,
          longitude: -87.6298,
          zipcode: '60601',
        },
        status: 200,
      },
      {
        match: '/api/properties',
        response: {
          id: 13,
          name: 'NoInputZip',
          address: 'Chicago, IL',
          latitude: 41.8781,
          longitude: -87.6298,
        },
        status: 201,
      },
    ]);

    const { onSuccess } = renderModal();

    await fillRequiredFields('NoInputZip');
    const addressEl = screen.getByLabelText(/Address/i) as HTMLInputElement;
    // User input has NO ZIP — capture-time ref stays null.
    await userEvent.type(addressEl, 'downtown chicago');

    await userEvent.click(screen.getByRole('button', { name: /Validate Address/i }));
    await waitFor(() => expect(addressEl.value).toBe('Chicago, IL'));

    await userEvent.click(screen.getByRole('button', { name: /Create Property/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // Resolution chain: capture null -> savedAddress("Chicago, IL") null ->
    // formData.address("Chicago, IL") null -> validationResponseZipRef("60601") wins.
    expect(localStorage.getItem('weatherZipCode')).toBe('60601');
    expect(localStorage.getItem('weatherZipCode__user_7')).toBe('60601');
  });
});
