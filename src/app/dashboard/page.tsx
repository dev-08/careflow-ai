import { redirect } from "next/navigation";

import { logout } from "@/app/login/actions";
import JourneyDashboardTable from "@/components/journey-dashboard-table";
import { requireClinician } from "@/lib/auth/require-clinician";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import Link from "next/link";
type Journey = {
  id: string;
  patient_id: string;
  current_state: string;
  version: number;
  updated_at: string;
};

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

function formatState(state: string) {
  return state.replaceAll("_", " ");
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

    default:
      return "bg-slate-500/15 text-slate-300";
  }
}

export default async function DashboardPage() {
    const {
        supabase: authenticatedSupabase,
        staffProfile,
      } = await requireClinician();
    
      const {
        data: { user },
        error: authError,
      } = await authenticatedSupabase.auth.getUser();
    
      if (authError || !user) {
        redirect(
          "/login?error=Your session has expired. Please sign in again."
        );
      }
    
      // Authentication and clinician authorization have succeeded.
      // Use the server-only admin client for the operations dashboard.
      const supabase = createAdminSupabaseClient();
    
      const {
        data: journeyData,
        error: journeyError,
      } = await supabase
    .from("care_journeys")
    .select(
      "id, patient_id, current_state, version, updated_at"
    )
    .order("updated_at", { ascending: false });
  
  const {
    data: patientData,
    error: patientError,
  } = await supabase
    .from("patients")
    .select("id, first_name, last_name, email");


  if (journeyError || patientError) {
    console.error("Dashboard query failed:", {
      journeyError,
      patientError,
    });

    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <p className="text-red-400">
          The dashboard data could not be loaded.
        </p>
      </main>
    );
  }

  const journeys = (journeyData ?? []) as Journey[];
  const patients = (patientData ?? []) as Patient[];

  const patientMap = new Map(
    patients.map((patient) => [patient.id, patient])
  );

  const dashboardJourneys = journeys.map((journey) => {
    const patient = patientMap.get(journey.patient_id);
  
    return {
      id: journey.id,
      patientName: patient
        ? `${patient.first_name} ${patient.last_name}`
        : "Unknown patient",
      patientEmail: patient?.email ?? "Not available",
      currentState: journey.current_state,
      version: journey.version,
      updatedAt: journey.updated_at,
    };
  });



  const clinicianReviewCount = journeys.filter(
    (journey) => journey.current_state === "CLINICIAN_REVIEW"
  ).length;




  const followUpCount = journeys.filter(
    (journey) => journey.current_state === "FOLLOW_UP_REQUIRED"
  ).length;

  const scheduledCount = journeys.filter(
    (journey) =>
      journey.current_state === "APPOINTMENT_SCHEDULED"
  ).length;

  const completedCount = journeys.filter(
    (journey) => journey.current_state === "COMPLETED"
  ).length;

  const statistics = [
    {
      label: "Total journeys",
      value: journeys.length,
    },
    {
      label: "Clinician review",
      value: clinicianReviewCount,
    },
    {
      label: "Follow-up required",
      value: followUpCount,
    },
    {
      label: "Appointments",
      value: scheduledCount,
    },
    {
      label: "Completed",
      value: completedCount,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
  <div>
    <p className="text-sm font-medium uppercase tracking-wider text-cyan-400">
      CareFlow AI
    </p>

    <h1 className="mt-2 text-3xl font-bold">
      Operations Dashboard
    </h1>

    <p className="mt-2 text-slate-400">
      Monitor patient journeys and pending clinical actions.
    </p>
  </div>
  <div className="flex flex-col items-start gap-3 sm:items-end">
  <p className="text-sm text-slate-500">
    Signed in as {staffProfile.display_name}
  </p>

  <div className="flex flex-wrap gap-3">
    <Link
      href="/intake"
      className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
    >
      New patient intake
    </Link>

    <form action={logout}>
      <button
        type="submit"
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-red-400 hover:text-red-300"
      >
        Sign out
      </button>
    </form>
  </div>
</div>
</div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statistics.map((statistic) => (
            <div
              key={statistic.label}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">
                {statistic.label}
              </p>

              <p className="mt-2 text-3xl font-bold">
                {statistic.value}
              </p>
            </div>
          ))}
        </section>
        <JourneyDashboardTable journeys={dashboardJourneys} />
      </div>
    </main>
  );
}