"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

type IntakeResult = {
  patientId: string;
  intakeId: string;
  journeyId: string;
  currentState: string;
  version: number;
  eventId: string;
  duplicate: boolean;
};

const symptomOptions = [
  "Anxiety",
  "Low mood",
  "Sleep difficulty",
  "Stress",
  "Trouble concentrating",
  "Other",
];

export default function IntakePage() {
  const idempotencyKey = useRef<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] =
    useState<IntakeResult | null>(null);

  async function submitIntake(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    setSubmitting(true);
    setError(null);
    setResult(null);

    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }

    const payload = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      dateOfBirth: formData.get("dateOfBirth"),
      reasonForCare: formData.get("reasonForCare"),
      symptoms: formData.getAll("symptoms"),
      symptomDuration: formData.get("symptomDuration"),
      urgencySelfRating: Number(
        formData.get("urgencySelfRating")
      ),
      additionalNotes: formData.get("additionalNotes"),
      consentToContact:
        formData.get("consentToContact") === "on",
      idempotencyKey: idempotencyKey.current,
    };

    try {
      const response = await fetch("/api/intakes", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(
          responseBody.error ??
            "The intake could not be submitted."
        );
      }

      setResult(responseBody.result);
      idempotencyKey.current = null;
      formElement.reset();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "An unexpected error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="w-full max-w-xl rounded-2xl border border-emerald-500/30 bg-slate-900 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Intake received
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Your intake was submitted
          </h1>

          <p className="mt-4 text-slate-400">
            A care journey was created and is ready for
            automated triage.
          </p>

          <div className="mt-6 rounded-xl bg-slate-950 p-4 text-left">
            <p className="text-sm text-slate-400">
              Journey ID
            </p>

            <p className="mt-1 break-all font-mono text-sm text-cyan-300">
              {result.journeyId}
            </p>

            <p className="mt-4 text-sm text-slate-400">
              Current state
            </p>

            <p className="mt-1 font-semibold">
              {result.currentState.replaceAll("_", " ")}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold"
            >
              Submit another intake
            </button>

            <Link
              href="/dashboard"
              className="rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              Clinician dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <form
        onSubmit={submitIntake}
        className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
          CareFlow AI
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Patient intake
        </h1>

        <p className="mt-2 text-slate-400">
          Synthetic development data only. Do not enter real
          medical information.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <label>
            <span className="text-sm text-slate-300">
              First name
            </span>

            <input
              name="firstName"
              required
              maxLength={100}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
          </label>

          <label>
            <span className="text-sm text-slate-300">
              Last name
            </span>

            <input
              name="lastName"
              required
              maxLength={100}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
          </label>

          <label>
            <span className="text-sm text-slate-300">Email</span>

            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
          </label>

          <label>
            <span className="text-sm text-slate-300">
              Date of birth
            </span>

            <input
              name="dateOfBirth"
              type="date"
              required
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        <label className="mt-6 block">
          <span className="text-sm text-slate-300">
            Reason for seeking care
          </span>

          <textarea
            name="reasonForCare"
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          />
        </label>

        <fieldset className="mt-6">
          <legend className="text-sm text-slate-300">
            Current symptoms
          </legend>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {symptomOptions.map((symptom) => (
              <label
                key={symptom}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <input
                  type="checkbox"
                  name="symptoms"
                  value={symptom}
                  className="h-4 w-4"
                />

                <span className="text-sm">{symptom}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label>
            <span className="text-sm text-slate-300">
              Symptom duration
            </span>

            <select
              name="symptomDuration"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            >
              <option value="">Select duration</option>
              <option value="Less than one week">
                Less than one week
              </option>
              <option value="One to four weeks">
                One to four weeks
              </option>
              <option value="One to six months">
                One to six months
              </option>
              <option value="More than six months">
                More than six months
              </option>
            </select>
          </label>

          <label>
            <span className="text-sm text-slate-300">
              Self-rated urgency
            </span>

            <select
              name="urgencySelfRating"
              required
              defaultValue=""
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            >
              <option value="" disabled>
                Select 1–10
              </option>

              {Array.from({ length: 10 }, (_, index) => {
                const value = index + 1;

                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <label className="mt-6 block">
          <span className="text-sm text-slate-300">
            Additional notes
          </span>

          <textarea
            name="additionalNotes"
            maxLength={3000}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          />
        </label>

        <label className="mt-6 flex items-start gap-3">
          <input
            type="checkbox"
            name="consentToContact"
            required
            className="mt-1 h-4 w-4"
          />

          <span className="text-sm text-slate-300">
            I consent to being contacted about this synthetic
            care request.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-7 w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit intake"}
        </button>
      </form>
    </main>
  );
}