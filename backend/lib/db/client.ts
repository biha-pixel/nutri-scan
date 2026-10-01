/**
 * Supabase Client Factory
 *
 * Provides typed Supabase client instances for database operations.
 *
 * Security Principles:
 * 1. Anon Key + User JWT: Used for user-scoped requests. Enforces Row Level Security (RLS).
 * 2. Service Role Key: Kept strictly on the server; never exposed to the client bundle.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey?: string;
}

/**
 * Reads Supabase configuration from environment variables.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey: serviceRoleKey || undefined,
  };
}

/**
 * Creates a standard Supabase client.
 * If an auth token (JWT) is provided, the client executes queries with the authenticated user's context,
 * ensuring PostgreSQL Row Level Security (RLS) policies are active.
 */
export function createSupabaseClient(
  authToken?: string,
  customConfig?: Partial<SupabaseConfig>
): SupabaseClient<Database> {
  const config = { ...getSupabaseConfig(), ...customConfig };

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      "Supabase configuration missing: SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables."
    );
  }

  const options: {
    auth: { persistSession: boolean; autoRefreshToken: boolean };
    global?: { headers: { Authorization: string } };
  } = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  if (authToken) {
    const token = authToken.replace(/^Bearer\s+/i, "");
    options.global = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, options);
}

/**
 * Creates a service-role Supabase client that bypasses Row Level Security.
 * WARNING: Must only be used in trusted server-side environments for administrative/system tasks.
 */
export function createServiceRoleClient(
  customConfig?: Partial<SupabaseConfig>
): SupabaseClient<Database> {
  const config = { ...getSupabaseConfig(), ...customConfig };

  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error(
      "Supabase service role configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
    );
  }

  return createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
