-- Drop existing MVP permissive policies on tickets table
DROP POLICY IF EXISTS "MVP_Tickets_Access" ON public.tickets;
DROP POLICY IF EXISTS "Public_Ticket_Access" ON public.tickets;

-- Ensure RLS is enabled on profiles and tickets tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Create Manolo_AI_Owner_Access policy for venue owners to manage their tickets
-- First drop if exists to avoid conflicts
DROP POLICY IF EXISTS "Manolo_AI_Owner_Access" ON public.tickets;

CREATE POLICY "Manolo_AI_Owner_Access"
ON public.tickets
FOR ALL
TO authenticated
USING (
  venue_id IN (
    SELECT id FROM public.venues WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  venue_id IN (
    SELECT id FROM public.venues WHERE owner_id = auth.uid()
  )
);