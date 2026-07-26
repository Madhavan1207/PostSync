import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCoreEnv } from "@/lib/validation/env";

/**
 * Service-role Supabase client. This bypasses Row Level Security, so it must only
 * ever be constructed on the server.
 */
export function createAdminClient() {
  // Validated lazily; throws naming the exact missing variable rather than
  // handing `undefined` to the Supabase client.
  const {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = getCoreEnv();

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
