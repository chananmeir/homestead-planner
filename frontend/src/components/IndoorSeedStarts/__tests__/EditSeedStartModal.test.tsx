import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditSeedStartModal, IndoorSeedStart } from '../EditSeedStartModal';
import { apiGet, apiPut } from '../../../utils/api';

jest.mock('../../../utils/api', () => ({
  apiGet: jest.fn(),
  apiPut: jest.fn(),
}));

const mockedApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockedApiPut = apiPut as jest.MockedFunction<typeof apiPut>;

const plants = [{ id: 'kale-1', name: 'Kale' }];

const baseSeedStart: IndoorSeedStart = {
  id: 43,
  plantId: 'kale-1',
  variety: 'Bare Necessities',
  startDate: '2026-03-05',
  expectedTransplantDate: '2026-03-24',
  seedsStarted: 8,
  seedsGerminated: 8,
  status: 'growing',
  plantingEventId: 5883,
};

function renderModal(overrides: Partial<IndoorSeedStart> = {}) {
  const props = {
    isOpen: true,
    seedStart: { ...baseSeedStart, ...overrides },
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    plants,
    seedInventory: [],
    showSuccess: jest.fn(),
    showError: jest.fn(),
    onRequestFailedCascade: jest.fn(),
  };

  render(<EditSeedStartModal {...props} />);
  return props;
}

describe('EditSeedStartModal', () => {
  beforeEach(() => {
    mockedApiGet.mockReturnValue(new Promise<Response>(() => {}));
    mockedApiPut.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('blocks Failed transition for already-transplanted seed starts', async () => {
    const props = renderModal({ status: 'transplanted' });

    const failedOption = screen.getByRole('option', {
      name: /Failed \(not available after transplant\)/i,
    }) as HTMLOptionElement;
    expect(failedOption).toBeDisabled();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'failed' } });
    fireEvent.click(screen.getByRole('button', { name: /^Update$/i }));

    await waitFor(() => {
      expect(props.showError).toHaveBeenCalledWith('Seed start is already transplanted');
    });
    expect(props.onRequestFailedCascade).not.toHaveBeenCalled();
    expect(mockedApiPut).not.toHaveBeenCalled();
  });

  test('still opens failed cascade for linked seed starts that are not transplanted', () => {
    const props = renderModal({ status: 'growing' });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'failed' } });
    fireEvent.click(screen.getByRole('button', { name: /^Update$/i }));

    expect(props.onRequestFailedCascade).toHaveBeenCalledTimes(1);
    expect(props.onRequestFailedCascade).toHaveBeenCalledWith(props.seedStart);
    expect(mockedApiPut).not.toHaveBeenCalled();
  });
});
