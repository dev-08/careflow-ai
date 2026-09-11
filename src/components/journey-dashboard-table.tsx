"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type DashboardJourney = {
  id: string;
  patientName: string;
  patientEmail: string;
  currentState: string;
  version: number;
  updatedAt: string;
};

type JourneyDashboardTableProps = {
  journeys: DashboardJourney[];
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

    case "CANCELLED":
      return "bg-slate-500/15 text-slate-400";

    default:
      return "bg-blue-500/15 text-blue-300";
  }
}

export default function JourneyDashboardTable({
  journeys,
}: JourneyDashboardTableProps) {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");

  const availableStates = useMemo(
    () =>
      Array.from(
        new Set(journeys.map((journey) => journey.currentState))
      ).sort(),
    [journeys]
  );

  const filteredJourneys = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return journeys.filter((journey) => {
      const matchesState =
        stateFilter === "ALL" ||
        journey.currentState === stateFilter;

      const matchesSearch =
        normalizedSearch.length === 0 ||
        journey.patientName
          .toLowerCase()
          .includes(normalizedSearch) ||
        journey.patientEmail
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesState && matchesSearch;
    });
  }, [journeys, search, stateFilter]);

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-lg font-semibold">
              Patient journeys
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Showing {filteredJourneys.length} of {journeys.length}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label>
              <span className="sr-only">Search patients</span>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 sm:w-64"
              />
            </label>

            <label>
              <span className="sr-only">Filter by state</span>

              <select
                value={stateFilter}
                onChange={(event) =>
                  setStateFilter(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-cyan-400 sm:w-56"
              >
                <option value="ALL">All states</option>

                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {formatState(state)}
                  </option>
                ))}
              </select>
            </label>

            {(search || stateFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStateFilter("ALL");
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-sm text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Patient</th>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">State</th>
              <th className="px-6 py-4 font-medium">Version</th>
              <th className="px-6 py-4 font-medium">
                Last updated
              </th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredJourneys.map((journey) => (
              <tr
                key={journey.id}
                className="border-t border-slate-800"
              >
                <td className="px-6 py-4 font-medium">
                  {journey.patientName}
                </td>

                <td className="px-6 py-4 text-slate-400">
                  {journey.patientEmail}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stateColor(
                      journey.currentState
                    )}`}
                  >
                    {formatState(journey.currentState)}
                  </span>
                </td>

                <td className="px-6 py-4">
                  {journey.version}
                </td>

                <td className="px-6 py-4 text-slate-400">
                  {new Date(journey.updatedAt).toLocaleString()}
                </td>

                <td className="px-6 py-4">
                  <Link
                    href={`/journeys/${journey.id}`}
                    className="inline-flex rounded-lg border border-cyan-400/40 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-400/10"
                  >
                    View journey
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredJourneys.length === 0 && (
        <div className="p-10 text-center">
          <p className="text-slate-400">
            No journeys match the selected filters.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStateFilter("ALL");
            }}
            className="mt-3 text-sm font-medium text-cyan-400"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}