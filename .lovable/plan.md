## Security fix: move CEO privileged writes to a server-side edge function

The current `CEODashboard.tsx` performs admin writes (role flips, verification flags, venue ownership transfers) directly from the browser using the anon key. Anyone who can hit those tables under their own JWT — or who edits the React bundle — can escalate. Fix moves all privileged writes behind a server-validated edge function.

---

### 1. New secret: `ADMIN_USER_ID`

Add a Supabase Edge Function secret `ADMIN_USER_ID` containing the CEO's `auth.users.id` (UUID). Not an email, not hardcoded. Requested via the secrets tool — user pastes the UUID.

### 2. New edge function: `supabase/functions/admin-actions/index.ts`

- Uses `SUPABASE_SERVICE_ROLE_KEY` internally (never exposed to client).
- CORS preflight handled.
- Reads `Authorization: Bearer <jwt>` header; calls `supabase.auth.getUser(token)` to resolve the caller.
- If `user.id !== Deno.env.get("ADMIN_USER_ID")` → return `403 { error: "Forbidden" }`.
- Validates body shape: `{ action: string, payload: object }` with Zod. Allowed actions:
  - `approve_venue_claim` → payload `{ claim_id, venue_id, user_id }`
    - `venue_claims.update({ status: 'approved' }).eq('id', claim_id)`
    - `venues.update({ owner_id: user_id, verified: true }).eq('id', venue_id)`
    - `profiles.update({ is_verified_manager: true, role_type: 'manager' }).eq('id', user_id)`
  - `reject_venue_claim` → payload `{ claim_id }`
    - `venue_claims.update({ status: 'rejected' }).eq('id', claim_id)`
  - `approve_talent` → payload `{ user_id }`
    - `profiles.update({ is_verified_talent: true }).eq('id', user_id)`
  - `reject_talent` → payload `{ user_id }`
    - `profiles.update({ role_type: 'guest' }).eq('id', user_id)`
- Unknown action → `400`.
- All responses include CORS headers; errors return JSON `{ error }`.
- Deployed automatically; default `verify_jwt = false` is fine because we validate the JWT in code (so we can return a proper 403 instead of an opaque 401).

### 3. Refactor `src/pages/CEODashboard.tsx`

- Remove all direct `supabase.from("venue_claims" | "venues" | "profiles").update(...)` calls inside `handleVenueApproval` and `handleTalentApproval`.
- Replace with:
  ```ts
  const { data, error } = await supabase.functions.invoke("admin-actions", {
    body: { action, payload },
  });
  if (error || data?.error) { toast.error(...); return; }
  ```
- Keep the existing `fetchOversightData` reads as-is (RLS already gates reads).
- Keep toast UX identical (success / denied / error messages unchanged).

### 4. `CEORoute` wrapper

- Left in place as a UI convenience to hide the dashboard from non-CEO users.
- Comment added clarifying that the **security boundary now lives in the edge function**, not in the route guard.
- No behavioral change to routing.

### Out of scope

- No DB schema changes, no RLS edits, no migration.
- No changes to talent/venue read queries.
- `localStorage`/auth-loop issues from earlier are not touched here.

---

### Files

- **New:** `supabase/functions/admin-actions/index.ts`
- **Edit:** `src/pages/CEODashboard.tsx` (handlers only)
- **Edit:** `src/App.tsx` (one-line comment on `CEORoute`; no logic change)
- **Secret:** `ADMIN_USER_ID` (added via secrets tool, value supplied by user)