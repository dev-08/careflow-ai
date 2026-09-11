import { createServerSupabaseClient } from "@/lib/supabase/server";
import JourneyTransitionControls from "@/components/journey-transition-controls";
import { requireClinician } from "@/lib/auth/require-clinician";
export const dynamic = "force-dynamic";

type CareEvent = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  event_data: Record<string, unknown>;
  occurred_at: string;
};

export default async function PatientsPage() {
  const { supabase } = await requireClinician();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("*")
    .eq("email", "jordan.taylor@example.test")
    .single();

  if (patientError || !patient) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-2xl font-bold">Patient not found</h1>

        <p className="mt-3 text-red-400">
          {patientError?.message ?? "No patient record was returned."}
        </p>
      </main>
    );
  }

  const { data: journey, error: journeyError } = await supabase
    .from("care_journeys")
    .select("*")
    .eq("patient_id", patient.id)
    .single();

  if (journeyError || !journey) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-2xl font-bold">Journey not found</h1>

        <p className="mt-3 text-red-400">
          {journeyError?.message ?? "No care journey was returned."}
        </p>
      </main>
    );
  }

  const { data: events, error: eventsError } = await supabase
    .from("care_events")
    .select(
      "id, event_type, actor_type, actor_id, event_data, occurred_at"
    )
    .eq("journey_id", journey.id)
    .order("occurred_at", { ascending: true });

  if (eventsError) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-2xl font-bold">Unable to load events</h1>

        <p className="mt-3 text-red-400">{eventsError.message}</p>
      </main>
    );
  }

  const careEvents = (events ?? []) as CareEvent[];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            CareFlow AI
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Patient Journey
          </h1>

          <p className="mt-2 text-slate-400">
            Synthetic development data only
          </p>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row">
            <div>
              <p className="text-sm text-slate-400">Patient</p>

              <h2 className="mt-1 text-2xl font-semibold">
                {patient.first_name} {patient.last_name}
              </h2>

              <p className="mt-1 text-slate-400">{patient.email}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Current state</p>

              <span className="mt-2 inline-block rounded-full bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-300">
                {journey.current_state.replaceAll("_", " ")}
              </span>

              <JourneyTransitionControls
  journeyId={journey.id}
  currentState={journey.current_state}
  version={journey.version}
/>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Event timeline</h2>

          <div className="mt-5 space-y-4">
            {careEvents.map((event, index) => (
              <article
                key={event.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400 font-bold text-slate-950">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col justify-between gap-2 md:flex-row">
                      <h3 className="font-semibold text-cyan-300">
                        {event.event_type.replaceAll("_", " ")}
                      </h3>

                      <time className="text-sm text-slate-500">
                        {new Date(event.occurred_at).toLocaleString()}
                      </time>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Performed by {event.actor_type}
                      {event.actor_id ? ` · ${event.actor_id}` : ""}
                    </p>

                    <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                      {JSON.stringify(event.event_data, null, 2)}
                    </pre>
                  </div>
                </div>
              </article>
            ))}

            {careEvents.length === 0 && (
              <p className="rounded-xl border border-slate-800 p-5 text-slate-400">
                No events were found for this journey.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}