"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type JourneyState =
  | "INTAKE_PENDING"
  | "TRIAGE_PENDING"
  | "CLINICIAN_REVIEW"
  | "APPOINTMENT_SCHEDULED"
  | "FOLLOW_UP_REQUIRED"
  | "COMPLETED"
  | "CANCELLED";

type TransitionControlsProps = {
  journeyId: string;
  currentState: JourneyState;
  version: number;
};

type TransitionOption = {
  state: JourneyState;
  label: string;
  reason: string;
};

const transitions: Record<JourneyState, TransitionOption[]> = {
  INTAKE_PENDING: [
    {
      state: "TRIAGE_PENDING",
      label: "Begin triage",
      reason: "Patient intake is ready for triage",
    },
    {
      state: "CANCELLED",
      label: "Cancel journey",
      reason: "Patient journey was cancelled",
    },
  ],

  TRIAGE_PENDING: [
    {
      state: "CLINICIAN_REVIEW",
      label: "Request clinician review",
      reason: "Triage requires clinician review",
    },
    {
      state: "APPOINTMENT_SCHEDULED",
      label: "Schedule appointment",
      reason: "Triage completed and appointment approved",
    },
  ],

  CLINICIAN_REVIEW: [
    {
      state: "APPOINTMENT_SCHEDULED",
      label: "Approve appointment",
      reason: "Clinician approved appointment scheduling",
    },
    {
      state: "FOLLOW_UP_REQUIRED",
      label: "Request follow-up",
      reason: "Clinician requested additional patient information",
    },
  ],

  APPOINTMENT_SCHEDULED: [
    {
      state: "FOLLOW_UP_REQUIRED",
      label: "Require follow-up",
      reason: "Additional follow-up is required after the appointment",
    },
    {
      state: "COMPLETED",
      label: "Complete journey",
      reason: "Appointment and required care activities were completed",
    },
  ],

  FOLLOW_UP_REQUIRED: [
    {
      state: "CLINICIAN_REVIEW",
      label: "Send to clinician",
      reason: "Follow-up information is ready for clinician review",
    },
    {
      state: "APPOINTMENT_SCHEDULED",
      label: "Schedule appointment",
      reason: "Follow-up completed and appointment approved",
    },
    {
      state: "COMPLETED",
      label: "Complete journey",
      reason: "Required follow-up was completed",
    },
  ],

  COMPLETED: [],
  CANCELLED: [],
};

export default function JourneyTransitionControls({
  journeyId,
  currentState,
  version,
}: TransitionControlsProps) {
  const router = useRouter();

  const [loadingState, setLoadingState] =
    useState<JourneyState | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableTransitions = transitions[currentState] ?? [];

  async function transitionJourney(option: TransitionOption) {
    setLoadingState(option.state);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/journeys/${journeyId}/transition`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            expectedVersion: version,
            targetState: option.state,
            idempotencyKey: crypto.randomUUID(),
            reason: option.reason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "The journey could not be updated."
        );
      }

      setMessage(`Journey moved to ${option.label}.`);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoadingState(null);
    }
  }

  if (availableTransitions.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-400">
        This journey has reached a final state.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-medium text-slate-300">
        Available clinician actions
      </p>

      <div className="flex flex-wrap gap-3">
        {availableTransitions.map((option) => (
          <button
            key={option.state}
            type="button"
            disabled={loadingState !== null}
            onClick={() => transitionJourney(option)}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingState === option.state
              ? "Updating..."
              : option.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="mt-4 text-sm text-emerald-400">{message}</p>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}