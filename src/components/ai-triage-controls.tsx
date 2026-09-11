"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type AiTriageControlsProps = {
    journeyId: string;
    currentState: string;
    version: number;
    hasTriageResult: boolean;
  };

  export default function AiTriageControls({
    journeyId,
    currentState,
    version,
    hasTriageResult,
  }: AiTriageControlsProps) {
  const router = useRouter();

  const idempotencyKey = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI triage should only start from a submitted intake.
  const canRunTriage =
  currentState === "INTAKE_PENDING" ||
  (
    currentState === "TRIAGE_PENDING" &&
    !hasTriageResult
  );

if (!canRunTriage) {
  return null;
}

  async function runAiTriage() {
    setIsLoading(true);
    setMessage(null);
    setError(null);

    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }

    try {
      const response = await fetch(
        `/api/journeys/${journeyId}/triage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            expectedVersion: version,
            idempotencyKey: idempotencyKey.current,
          }),
        }
      );

      const result: {
        error?: string;
        message?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "AI triage could not be completed."
        );
      }

      setMessage(
        result.message ?? "AI triage completed successfully."
      );

      idempotencyKey.current = null;

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "An unexpected error occurred."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-800 pt-6">
      <p className="text-sm font-medium text-slate-300">
        AI-assisted intake processing
      </p>

      <p className="mt-1 text-sm text-slate-400">
        Analyze this intake and generate a workflow
        recommendation for clinician review.
      </p>

      <button
        type="button"
        disabled={isLoading}
        onClick={runAiTriage}
        className="mt-4 rounded-lg bg-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Analyzing intake..." : "Run AI triage"}
      </button>

      {message && (
        <p className="mt-3 text-sm text-emerald-400">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}