-- Index for keyset pagination of a message thread.
--
-- fetchMessages currently loads EVERY message in a thread with no limit, which
-- is a structural ceiling rather than a pre-launch concern: it grows with
-- activity in one thread, unbounded, and it grows while nobody is looking. A
-- venue staff thread over a season is plausibly tens of thousands of rows,
-- every one of them fetched on open.
--
-- The cursor is COMPOSITE, (created_at, id), not created_at alone. Two
-- messages sharing a microsecond would make a page boundary ambiguous with a
-- single-column cursor, and the symptom -- one message silently missing at the
-- seam between two pages -- would be close to undiagnosable after the fact.
-- Cheap to do now, effectively impossible to diagnose later.
--
-- WHY A NEW INDEX. idx_messages_conversation_created (conversation_id,
-- created_at) does not serve `ORDER BY created_at DESC, id DESC` without a
-- sort. Verified against the live planner before writing this:
--
--   Limit
--     ->  Incremental Sort
--           Sort Key: created_at DESC, id DESC
--           Presorted Key: created_at
--           ->  Index Scan Backward using idx_messages_conversation_created
--
-- The Incremental Sort is cheap when timestamps are unique, but it is a sort
-- node in the hot path of every thread open, and adding `id` to the index
-- removes it outright.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_id
  ON public.messages (conversation_id, created_at, id);

-- The old index is now strictly redundant: (conversation_id, created_at) is a
-- proper prefix of the new one, so every query it served -- the pagination
-- scan, the view's unread subquery, the last-message lateral -- is served by
-- the replacement. Kept until after the new index exists so there is never a
-- window without one. A redundant index is not free: it costs write throughput
-- on a table that only gets more write-heavy.
DROP INDEX IF EXISTS public.idx_messages_conversation_created;
