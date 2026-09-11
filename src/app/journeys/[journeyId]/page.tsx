import Link from "next/link";
import { notFound } from "next/navigation";

import JourneyTransitionControls from "@/components/journey-transition-controls";
import { requireClinician } from "@/lib/auth/require-clinician";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import AiTriageControls from "@/components/ai-triage-controls";
type JourneyState =
  | "INTAKE_PENDING"
  | "TRIAGE_PENDING"
  | "CLINICIAN_REVIEW"
  | "APPOINTMENT_SCHEDULED"
  | "FOLLOW_UP_REQUIRED"
  | "COMPLETED"
  | "CANCELLED";

type JourneyPageProps = {
  params: Promise<{
    journeyId: string;
  }>;
};

function formatState(value: string) {
  return value.replaceAll("_", " ");
}

function stateColor(state: string) {
  switch (state) {
    case "CLINICIAN_REVIEW":
      return "bg-amber-500/15 text-amber-300";

    case "FOLLOW_UP_REQUIRED":
      return "bg-red-500/15 text-red-300";

    case "APPOINTMENT_SCHEDULED":
      return "bg-cyan-500/15 text-cyan-300";

    case "COMPLETED":
      return "bg-emerald-500/15 text-emerald-300";

    case "CANCELLED":
      return "bg-slate-500/15 text-slate-400";

    default:
      return "bg-blue-500/15 text-blue-300";
  }
}

function urgencyColor(urgency: string) {
    switch (urgency) {
      case "LOW":
        return "bg-emerald-500/15 text-emerald-300";
  
      case "MEDIUM":
        return "bg-amber-500/15 text-amber-300";
  
      case "HIGH":
        return "bg-orange-500/15 text-orange-300";
  
      case "CRITICAL":
        return "bg-red-500/15 text-red-300";
  
      default:
        return "bg-slate-500/15 text-slate-300";
    }
  }

export default async function JourneyPage({
    params,
  }: JourneyPageProps) {
    const { journeyId } = await params;

await requireClinician();

const supabase = createAdminSupabaseClient();
  
    const { data: journey, error: journeyError } =
      await supabase
        .from("care_journeys")
        .select(
          `
            id,
            patient_id,
            current_state,
            version,
            started_at,
            completed_at,
            created_at,
            updated_at
          `
        )
        .eq("id", journeyId)
        .maybeSingle();

  if (journeyError) {
    console.error("Journey query failed:", journeyError);

    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <p className="text-red-400">
          The journey could not be loaded.
        </p>
      </main>
    );
  }

  if (!journey) {
    notFound();
  }

  // Get the patient belonging to the journey.
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        date_of_birth
      `
    )
    .eq("id", journey.patient_id)
    .maybeSingle();

  // Get the immutable journey events.
  const { data: events, error: eventsError } = await supabase
    .from("care_events")
    .select(
      `
        id,
        event_type,
        actor_type,
        actor_id,
        event_data,
        occurred_at
      `
    )
    .eq("journey_id", journey.id)
    .order("occurred_at", { ascending: false });

  // The clinician has already been authorized by
  // requireClinician(). The admin client reads the protected
  // AI result on the server.


  const {
    data: triageResult,
    error: triageResultError,
  } = await supabase
    .from("ai_triage_results")
    .select(
      `
        id,
        model_name,
        prompt_version,
        urgency_level,
        confidence,
        recommended_state,
        requires_human_review,
        summary,
        rationale,
        risk_indicators,
        attempt_number,
        created_at
      `
    )
    .eq("journey_id", journey.id)
    .order("attempt_number", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (
    patientError ||
    eventsError ||
    triageResultError
  ) {
    console.error("Journey detail query failed:", {
      patientError,
      eventsError,
      triageResultError,
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-6">
          <p className="text-sm uppercase tracking-wider text-slate-400">
            Patient journey
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            {patient
              ? `${patient.first_name} ${patient.last_name}`
              : "Unknown patient"}
          </h1>

          <p className="mt-2 text-slate-400">
            {patient?.email ?? "Email unavailable"}
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Current state</p>

              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${stateColor(
                  journey.current_state
                )}`}
              >
                {formatState(journey.current_state)}
              </span>
            </div>

            <div>
              <p className="text-sm text-slate-400">
                Journey version
              </p>

              <p className="mt-2 text-2xl font-bold">
                {journey.version}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">
                Last updated
              </p>

              <p className="mt-2 text-sm">
                {new Date(journey.updated_at).toLocaleString()}
              </p>
            </div>
          </div>

          <JourneyTransitionControls
            journeyId={journey.id}
            currentState={journey.current_state as JourneyState}
            version={journey.version}
          />
     <AiTriageControls
            journeyId={journey.id}
            currentState={journey.current_state}
            version={journey.version}
            hasTriageResult={Boolean(triageResult)}
          />
        </section>
        <section className="mt-8 rounded-xl border border-cyan-500/30 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wider text-cyan-400">
                AI workflow support
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                AI Triage Recommendation
              </h2>
            </div>

            {triageResult && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${urgencyColor(
                  triageResult.urgency_level
                )}`}
              >
                {triageResult.urgency_level} urgency
              </span>
            )}
          </div>

          {triageResult ? (
            <>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-sm text-slate-400">
                    Confidence
                  </dt>

                  <dd className="mt-1 text-lg font-semibold">
                    {Math.round(
                      Number(triageResult.confidence) * 100
                    )}
                    %
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-400">
                    Recommended state
                  </dt>

                  <dd className="mt-1 font-semibold text-cyan-300">
                    {formatState(
                      triageResult.recommended_state
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-400">
                    Human review
                  </dt>

                  <dd
                    className={`mt-1 font-semibold ${
                      triageResult.requires_human_review
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {triageResult.requires_human_review
                      ? "Required"
                      : "Not required"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-400">
                    Attempt
                  </dt>

                  <dd className="mt-1 font-semibold">
                    {triageResult.attempt_number}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 space-y-5">
                <div>
                  <h3 className="text-sm font-medium text-slate-400">
                    Summary
                  </h3>

                  <p className="mt-2 leading-7">
                    {triageResult.summary}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-400">
                    Rationale
                  </h3>

                  <p className="mt-2 leading-7 text-slate-300">
                    {triageResult.rationale}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-400">
                    Risk indicators
                  </h3>

                  {triageResult.risk_indicators.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {triageResult.risk_indicators.map(
                        (indicator: string) => (
                          <li
                            key={indicator}
                            className="rounded-full bg-red-500/15 px-3 py-1 text-sm text-red-300"
                          >
                            {indicator}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="mt-2 text-emerald-300">
                      No risk indicators identified.
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">
                AI-generated workflow recommendation only. It is
                not a diagnosis or substitute for clinician
                judgment.
              </p>
            </>
          ) : (
            <p className="mt-5 text-slate-400">
              No AI triage result has been recorded for this
              journey.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Patient information</h2>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-400">Email</dt>
              <dd className="mt-1">
                {patient?.email ?? "Not available"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-400">
                Date of birth
              </dt>
              <dd className="mt-1">
                {patient?.date_of_birth
                  ? new Date(
                      `${patient.date_of_birth}T00:00:00`
                    ).toLocaleDateString()
                  : "Not available"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-400">
                Journey started
              </dt>
              <dd className="mt-1">
                {new Date(journey.started_at).toLocaleString()}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-400">
                Completed
              </dt>
              <dd className="mt-1">
                {journey.completed_at
                  ? new Date(
                      journey.completed_at
                    ).toLocaleString()
                  : "Not completed"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Event timeline</h2>

          <div className="mt-6 space-y-4">
            {(events ?? []).map((event) => (
              <article
                key={event.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold text-cyan-300">
                      {formatState(event.event_type)}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      Actor: {event.actor_type} · {event.actor_id}
                    </p>
                  </div>

                  <time className="text-sm text-slate-400">
                    {new Date(event.occurred_at).toLocaleString()}
                  </time>
                </div>
              </article>
            ))}

            {(events ?? []).length === 0 && (
              <p className="text-slate-400">
                No events have been recorded for this journey.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}