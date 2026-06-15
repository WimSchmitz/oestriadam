"use client";
import { createClient } from "@supabase/supabase-js";

// Mirror the server-side normalization: strip a trailing slash or /rest/v1 path
// so a project URL pasted with extra path doesn't break every request.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const url = rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");

export const browserSupabase = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
