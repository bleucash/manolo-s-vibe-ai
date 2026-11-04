# src/integrations

## Overview

Groups the app's external-service integrations. It holds no source files of its
own; its only child is the Supabase integration.

## Subdirectories & Boundaries

- supabase: [./supabase/EGM.md](./supabase/EGM.md) - The typed browser Supabase
  client (`supabase`, built from `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`, throwing at load if either is missing) and the
  generated `Database` type covering 20 public tables, the
  `conversation_summary` view, 19 RPCs and the `app_role` enum. Types describe
  schema only, not RLS or column grants, and must be regenerated with any
  migration that changes a table, view or RPC.
