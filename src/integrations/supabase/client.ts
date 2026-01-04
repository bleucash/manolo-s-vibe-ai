import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "🚨 SUPABASE CONNECTION ERROR: Missing required environment variables.\n" +
    "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your Lovable Secrets."
  );
  throw new Error("Missing Supabase configuration. Check console for details.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
