import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function projectUrl(value: string) {
  const input = value.trim();
  if (/^https?:\/\//i.test(input)) return input.replace(/\/+$/, "");
  // Accept the Supabase project reference as well as its full URL.
  if (/^[a-z0-9-]+$/i.test(input)) return `https://${input}.supabase.co`;
  throw new Error("Supabase URL must be a project URL or project reference.");
}

export function getSupabaseBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured. Check the public URL and key.");
  }

  client = createClient(projectUrl(url), key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
}
