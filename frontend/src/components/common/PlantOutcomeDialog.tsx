import React, { useEffect, useMemo, useState } from 'react';
import type { PlantOutcome, PlantOutcomeReason } from '../../types';
import { Modal } from './Modal';

export interface PlantOutcomeSelection {
  outcome: PlantOutcome;
  outcomeReason: PlantOutcomeReason;
  outcomeDate: string;
  outcomeNotes?: string;
}

interface PlantOutcomeDialogProps {
  isOpen: boolean;
  title?: string;
  plantLabel: string;
  contextLabel?: string;
  allowedOutcomes?: PlantOutcome[];
  initialOutcome?: PlantOutcome;
  initialReason?: PlantOutcomeReason;
  defaultDate: string;
  isSubmitting?: boolean;
  error?: string | null;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (selection: PlantOutcomeSelection) => void;
}

const defaultOutcomes: PlantOutcome[] = ['failed', 'didnt_establish', 'not_planted'];

export const plantOutcomeLabels: Record<PlantOutcome, string> = {
  failed: 'Failed',
  didnt_establish: "Didn't establish",
  not_planted: 'Not planted',
};

export const plantOutcomeReasonLabels: Record<PlantOutcomeReason, string> = {
  pest: 'Pest pressure',
  disease: 'Disease',
  weather_frost: 'Weather/frost',
  drought_neglect: 'Drought or neglect',
  animal_damage: 'Animal damage',
  poor_germination: 'Poor germination',
  damping_off: 'Damping off',
  surplus_no_space: 'Surplus or no space',
  changed_plan: 'Changed plan',
  other: 'Other',
};

export const reasonOptionsByOutcome: Record<PlantOutcome, PlantOutcomeReason[]> = {
  failed: ['pest', 'disease', 'weather_frost', 'drought_neglect', 'animal_damage', 'other'],
  didnt_establish: ['poor_germination', 'damping_off', 'other'],
  not_planted: ['surplus_no_space', 'changed_plan', 'other'],
};

export const defaultReasonByOutcome: Record<PlantOutcome, PlantOutcomeReason> = {
  failed: 'other',
  didnt_establish: 'poor_germination',
  not_planted: 'changed_plan',
};

function isReasonAllowed(outcome: PlantOutcome, reason: PlantOutcomeReason | undefined): reason is PlantOutcomeReason {
  return reason != null && reasonOptionsByOutcome[outcome].includes(reason);
}

export const PlantOutcomeDialog: React.FC<PlantOutcomeDialogProps> = ({
  isOpen,
  title = 'Record Plant Outcome',
  plantLabel,
  contextLabel,
  allowedOutcomes,
  initialOutcome,
  initialReason,
  defaultDate,
  isSubmitting = false,
  error,
  submitLabel = 'Record outcome',
  onClose,
  onSubmit,
}) => {
  const allowedOutcomeKey = (allowedOutcomes?.length ? allowedOutcomes : defaultOutcomes).join('|');
  const outcomes = useMemo(() => {
    const allowed = allowedOutcomeKey.split('|').filter(Boolean) as PlantOutcome[];
    const filtered = allowed
      .filter((outcome, index, list) => list.indexOf(outcome) === index);
    return filtered.length > 0 ? filtered : defaultOutcomes;
  }, [allowedOutcomeKey]);

  const [outcome, setOutcome] = useState<PlantOutcome>(initialOutcome ?? outcomes[0]);
  const [reason, setReason] = useState<PlantOutcomeReason>(
    isReasonAllowed(initialOutcome ?? outcomes[0], initialReason)
      ? initialReason
      : defaultReasonByOutcome[initialOutcome ?? outcomes[0]]
  );
  const [outcomeDate, setOutcomeDate] = useState(defaultDate);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const nextOutcome = initialOutcome && outcomes.includes(initialOutcome)
      ? initialOutcome
      : outcomes[0];
    setOutcome(nextOutcome);
    setReason(isReasonAllowed(nextOutcome, initialReason)
      ? initialReason
      : defaultReasonByOutcome[nextOutcome]);
    setOutcomeDate(defaultDate);
    setNotes('');
  }, [isOpen, initialOutcome, initialReason, defaultDate, outcomes]);

  const handleOutcomeChange = (nextOutcome: PlantOutcome) => {
    setOutcome(nextOutcome);
    setReason(defaultReasonByOutcome[nextOutcome]);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!outcomeDate) return;
    const trimmedNotes = notes.trim();
    onSubmit({
      outcome,
      outcomeReason: reason,
      outcomeDate,
      ...(trimmedNotes ? { outcomeNotes: trimmedNotes } : {}),
    });
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const currentReasons = reasonOptionsByOutcome[outcome];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="small"
      closeOnBackdropClick={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-900">{plantLabel}</div>
          {contextLabel && (
            <div className="text-sm text-gray-500">{contextLabel}</div>
          )}
        </div>

        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Outcome</div>
          <div className="grid grid-cols-1 gap-2">
            {outcomes.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => handleOutcomeChange(option)}
                disabled={isSubmitting}
                className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${
                  outcome === option
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                } disabled:opacity-60`}
              >
                {plantOutcomeLabels[option]}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700">
          <span>Reason</span>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as PlantOutcomeReason)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            {currentReasons.map(option => (
              <option key={option} value={option}>
                {plantOutcomeReasonLabels[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          <span>Date</span>
          <input
            type="date"
            value={outcomeDate}
            onChange={(event) => setOutcomeDate(event.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            required
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !outcomeDate}
            className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            {isSubmitting ? 'Recording...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
