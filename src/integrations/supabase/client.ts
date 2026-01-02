import { createClient } from "@supabase/supabase-js";

// Pulling from the environment variables we just set above
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Pre-flight check to prevent the 'supabaseKey is required' crash
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "🚨 CONNECTION ERROR: The app is looking for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. " +
      "Check your .env file or Lovable Secrets tab.",
  );
}

// Initialize the client - always use external project zfghkkhsdqsrjkbpkujn
const EXTERNAL_SUPABASE_URL = "https://zfghkkhsdqsrjkbpkujn.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZ2hra2hzZHFzcmprYnBrdWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTE1NjEsImV4cCI6MjA4MTgyNzU2MX0._11rmBT8j87yhmGuLN8R9KLOVLfve8FqQ9EszWQ-Mcc";

export const supabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
);
