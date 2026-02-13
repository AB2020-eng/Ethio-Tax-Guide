import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

export const supabaseAdmin = () => {
  const adminUrl = process.env.SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(adminUrl, service, {
    auth: { persistSession: false },
  });
};
