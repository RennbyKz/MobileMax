import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabaseClient";
import type { Profile, Role } from "../types";

export interface NewStaffInput {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  address: string;
  role: Role;
}

export class StaffCreationError extends Error {
  accountCreated: boolean;
  constructor(message: string, accountCreated: boolean) {
    super(message);
    this.accountCreated = accountCreated;
  }
}

export async function createStaffAccount(input: NewStaffInput): Promise<Profile> {
  // A throwaway client, scoped to this call only: it never persists a session to
  // localStorage and never touches the main app's AuthContext, so signing up a new
  // user here cannot clobber the admin's own logged-in session.
  const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await isolatedClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName } },
  });

  if (error) {
    throw new StaffCreationError(error.message, false);
  }
  if (!data.user || data.user.identities?.length === 0) {
    throw new StaffCreationError("This email is already registered.", false);
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ phone: input.phone || null, address: input.address || null, role: input.role })
    .eq("id", data.user.id)
    .select()
    .single();

  if (updateError) {
    throw new StaffCreationError(
      "Account created, but details couldn't be saved — edit it from the list.",
      true
    );
  }

  return updated as Profile;
}
