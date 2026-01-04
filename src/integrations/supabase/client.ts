import { createClient } from "@supabase/supabase-js";

// Initialize the client - always use external project zfghkkhsdqsrjkbpkujn

// Initialize the client - always use external project zfghkkhsdqsrjkbpkujn
const EXTERNAL_SUPABASE_URL = "https://zfghkkhsdqsrjkbpkujn.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZ2hra2hzZHFzcmprYnBrdWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTE1NjEsImV4cCI6MjA4MTgyNzU2MX0._11rmBT8j87yhmGuLN8R9KLOVLfve8FqQ9EszWQ-Mcc";

export const supabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
);
