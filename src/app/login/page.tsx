import { redirect } from "next/navigation";

import { login } from "./actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { error } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A signed-in clinician should not see the login page again.
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            CareFlow AI
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Clinician sign in
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sign in to manage patient care journeys.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <form action={login} className="mt-7 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Email address
            </span>

            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="clinician@careflow.test"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Password
            </span>

            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Synthetic local-development environment
        </p>
      </section>
    </main>
  );
}