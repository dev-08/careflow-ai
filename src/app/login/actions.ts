"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  const email =
    typeof emailValue === "string" ? emailValue.trim() : "";

  const password =
    typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Email and password are required."
      )}`
    );
  }

  

  const supabase = await createServerSupabaseClient();




  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Clinician login failed:", error.message);

    redirect(
      `/login?error=${encodeURIComponent(
        "The email or password is incorrect."
      )}`
    );
  }

  redirect("/dashboard");
}


export async function logout() {
    const supabase = await createServerSupabaseClient();
  
    const { error } = await supabase.auth.signOut();
  
    if (error) {
      console.error("Logout failed:", error.message);
    }
  
    redirect("/login");
  }