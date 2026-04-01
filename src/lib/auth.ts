import { supabase } from "./supabaseClient";

export type Role = "student" | "educator";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
};

/**
 * Sign in using Supabase Auth (email + password).
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign out current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Fetch the currently logged-in user's profile row from public.profiles.
 * This is where role (student/educator) is stored.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data as Profile;
}


export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function upsertMyProfile(
  role: "student" | "educator",
  displayName: string | null
) {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("No user session after signup.");

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      role,
      display_name: displayName?.trim() ? displayName.trim() : null,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}