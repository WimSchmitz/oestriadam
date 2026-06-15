import { createClient } from "@supabase/supabase-js";

// Tolerate a project URL pasted with a trailing slash or /rest/v1 path — the
// client adds /rest/v1/<table> itself, so anything extra produces "Invalid path".
export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

// Server-only client using the service role key. Never import this in client code.
export function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(normalizeSupabaseUrl(url), key, { auth: { persistSession: false } });
}
