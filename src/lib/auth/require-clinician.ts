import "server-only";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireClinician() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      "/login?error=Please sign in to access clinician pages."
    );
  }

  const {
    data: staffProfile,
    error: staffProfileError,
  } = await supabase
    .from("staff_profiles")
    .select("display_name, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAuthorized =
    !staffProfileError &&
    staffProfile?.is_active === true &&
    ["CLINICIAN", "ADMIN"].includes(staffProfile.role);

  if (!isAuthorized) {
    redirect("/unauthorized");
  }

  return {
    supabase,
    user,
    staffProfile,
  };
}