import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve_venue_claim"),
    payload: z.object({
      claim_id: z.string().uuid(),
      venue_id: z.string().uuid(),
      user_id: z.string().uuid(),
    }),
  }),
  z.object({
    action: z.literal("reject_venue_claim"),
    payload: z.object({ claim_id: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("revoke_venue_claim"),
    payload: z.object({
      venue_id: z.string().uuid(),
      user_id: z.string().uuid(),
    }),
  }),
  z.object({
    action: z.literal("approve_talent"),
    payload: z.object({ user_id: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("reject_talent"),
    payload: z.object({ user_id: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("approve_business"),
    payload: z.object({ venue_id: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("reject_business"),
    payload: z.object({ venue_id: z.string().uuid() }),
  }),
]);

/**
 * Server-side twin of checkOtherTrackConflict in src/lib/roleClaims.ts.
 *
 * Deliberately duplicated rather than imported: that module pulls in the
 * browser Supabase singleton through the "@/" alias, which this Deno bundle
 * cannot resolve, and it queries as the signed-in user while this must query
 * as service role. There is no _shared module convention in this functions
 * directory to hang a common copy on. If the rule changes, BOTH files change.
 *
 * The two differ in one deliberate way: the client copy fails open on a read
 * error, this one fails closed. This is the enforcement point, so a check that
 * could not complete must not become an approval.
 */
type RoleTrack = "talent" | "manager";

/** Legacy value still present in the app_role enum; treat it as manager. */
const MANAGER_ROLES = ["manager", "venue_manager"];

/** Both states block: pending would race, approved already settled the role. */
const OPEN_STATUSES = ["pending", "approved"];

const findRoleConflict = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
  track: RoleTrack,
): Promise<{ conflict: string | null; readError?: string }> => {
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role_type")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) return { conflict: null, readError: profileErr.message };

  const role = (profile as { role_type?: string } | null)?.role_type;

  if (track === "talent") {
    if (role && MANAGER_ROLES.includes(role)) {
      return { conflict: "This account already manages a venue and cannot also be talent." };
    }
    // Same-track stays allowed: this only looks at the OTHER track's table.
    const { data, error } = await admin
      .from("venue_claims")
      .select("id")
      .eq("user_id", userId)
      .in("status", OPEN_STATUSES)
      .limit(1);
    if (error) return { conflict: null, readError: error.message };
    if (data && data.length > 0) {
      return { conflict: "This account has a venue claim pending or approved. Resolve it first." };
    }
    return { conflict: null };
  }

  if (role === "talent") {
    return { conflict: "This account is already talent and cannot also manage a venue." };
  }
  // Note this does NOT look at venue_claims, so an existing manager being
  // approved for a second venue passes, which is the intended behaviour.
  const { data, error } = await admin
    .from("talent_applications")
    .select("id")
    .eq("user_id", userId)
    .in("status", OPEN_STATUSES)
    .limit(1);
  if (error) return { conflict: null, readError: error.message };
  if (data && data.length > 0) {
    return { conflict: "This account has a talent application pending or approved. Resolve it first." };
  }
  return { conflict: null };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ADMIN_USER_ID = Deno.env.get("ADMIN_USER_ID");

    if (!ADMIN_USER_ID) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (userData.user.id !== ADMIN_USER_ID) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    switch (parsed.data.action) {
      case "approve_venue_claim": {
        const { claim_id, venue_id, user_id } = parsed.data.payload;

        // A46. Every check below runs before the first write, so a refusal
        // leaves nothing behind. The claim row is the source of truth; the
        // payload's venue_id and user_id are only a cross-check against it,
        // because this used to write whatever the payload named.
        const { data: claim, error: claimErr } = await admin
          .from("venue_claims")
          .select("id, venue_id, user_id, status")
          .eq("id", claim_id)
          .maybeSingle();
        if (claimErr) return json({ error: `Claim lookup failed: ${claimErr.message}` }, 500);
        if (!claim) return json({ error: "Claim not found." }, 404);
        if (claim.status !== "pending") {
          return json({ error: `This claim is ${claim.status ?? "in an unknown state"}, not pending.` }, 409);
        }
        if (claim.venue_id !== venue_id || claim.user_id !== user_id) {
          return json({ error: "Request does not match the claim. Refresh and try again." }, 409);
        }

        // Gate before ANY write. Previously this overwrote role_type
        // unconditionally, so approving a venue claim for someone already
        // talent silently flipped them to manager.
        const gate = await findRoleConflict(admin, user_id, "manager");
        if (gate.readError) return json({ error: `Role check failed: ${gate.readError}` }, 500);
        if (gate.conflict) return json({ error: gate.conflict }, 409);

        // Refuse a venue someone else already owns. The database refuses it
        // too (prevent_venue_owner_change, A46), but only at the owner write;
        // this says why, before anything is written. Owned by this claimant
        // already is allowed: that is a retry of an approval that set the
        // owner and then failed a later step.
        const { data: venue, error: venueErr } = await admin
          .from("venues")
          .select("id, owner_id")
          .eq("id", venue_id)
          .maybeSingle();
        if (venueErr) return json({ error: `Venue lookup failed: ${venueErr.message}` }, 500);
        if (!venue) return json({ error: "Venue not found." }, 404);
        if (venue.owner_id && venue.owner_id !== user_id) {
          return json({ error: "This venue already has an owner. Revoke it before approving another claim." }, 409);
        }

        // A leftover approved claim would make the LAST step below fail on
        // venue_claims_one_approved_per_venue (A7) after owner_id is already
        // set, and every retry would fail the same way. Refuse it up front.
        const { data: approvedRows, error: approvedErr } = await admin
          .from("venue_claims")
          .select("id")
          .eq("venue_id", venue_id)
          .eq("status", "approved")
          .limit(1);
        if (approvedErr) return json({ error: `Claim check failed: ${approvedErr.message}` }, 500);
        if (approvedRows && approvedRows.length > 0) {
          return json({ error: "This venue already holds an approved claim. Resolve that one first." }, 409);
        }

        // ORDER MATTERS, and is the reverse of what this used to do. These are
        // separate calls with no transaction around them, so each step must
        // leave a state the next attempt can finish. The claim is closed LAST:
        // until then it stays pending in the review queue, and approving it
        // again resumes, since the owner check above lets the same claimant
        // through and setting an owner to itself is not a change.

        // 1. Owner. Conditional on the venue still being unowned or already
        //    this claimant's, so a second approval racing this one matches
        //    zero rows instead of overwriting it. Exactly one row, or stop.
        const rOwner = await admin
          .from("venues")
          .update({ owner_id: user_id })
          .eq("id", venue_id)
          .or(`owner_id.is.null,owner_id.eq.${user_id}`)
          .select("id");
        if (rOwner.error) return json({ error: rOwner.error.message }, 500);
        if ((rOwner.data?.length ?? 0) !== 1) {
          return json({ error: "The venue was taken by another approval while this one ran. Nothing was changed." }, 409);
        }

        // 2. Role.
        const rRole = await admin
          .from("profiles")
          .update({ role_type: "manager" })
          .eq("id", user_id)
          .select("id");
        if (rRole.error) {
          return json({ error: `Venue assigned, but the role update failed: ${rRole.error.message}. Approve again to finish.` }, 500);
        }
        if ((rRole.data?.length ?? 0) !== 1) {
          return json({ error: "Venue assigned, but no profile matched the claimant. Approve again to finish." }, 500);
        }

        // 3. Close the claim, only if it is still pending.
        const rClaim = await admin
          .from("venue_claims")
          .update({ status: "approved" })
          .eq("id", claim_id)
          .eq("status", "pending")
          .select("id");
        if (rClaim.error) {
          return json({ error: `Venue assigned and role set, but closing the claim failed: ${rClaim.error.message}. Approve again to finish.` }, 500);
        }
        if ((rClaim.data?.length ?? 0) !== 1) {
          return json({ error: "Venue assigned and role set, but the claim was no longer pending. Check the review queue." }, 409);
        }
        return json({ ok: true });
      }
      case "reject_venue_claim": {
        const { claim_id } = parsed.data.payload;
        // A7: only a pending claim can be rejected. Rejecting an approved one
        // would leave its venue owned while the claim reads as refused;
        // revoke_venue_claim is the action for that. Conditional on pending,
        // so a claim already decided in another tab matches zero rows and is
        // reported instead of being silently re-stamped.
        const r = await admin
          .from("venue_claims")
          .update({ status: "rejected" })
          .eq("id", claim_id)
          .eq("status", "pending")
          .select("id");
        if (r.error) return json({ error: r.error.message }, 500);
        if ((r.data?.length ?? 0) !== 1) {
          return json({ error: "This claim is not pending, so nothing was rejected. Refresh the queue." }, 409);
        }
        return json({ ok: true });
      }
      case "revoke_venue_claim": {
        const { venue_id, user_id } = parsed.data.payload;

        // Distinct from reject_venue_claim, which only ever applies to a
        // pending claim. This undoes an approval that has already taken
        // effect: a live manager account losing a venue it currently runs.

        // A7. Read before any write. The approved claim matched on venue, user
        // and status is the record this revoke marks, so it must exist; and
        // the venue must be this account's, or already released by an earlier
        // revoke of the same claim that stopped part way (a resumable retry).
        // Before this, the payload's user_id was trusted: a mismatched id
        // released the venue and then deleted nothing.
        const { data: approvedClaim, error: approvedErr } = await admin
          .from("venue_claims")
          .select("id")
          .eq("venue_id", venue_id)
          .eq("user_id", user_id)
          .eq("status", "approved")
          .maybeSingle();
        if (approvedErr) return json({ error: `Claim lookup failed: ${approvedErr.message}` }, 500);
        if (!approvedClaim) {
          return json({ error: "No approved claim for this venue and account. Nothing was changed." }, 409);
        }
        const { data: venueRow, error: venueErr } = await admin
          .from("venues")
          .select("owner_id")
          .eq("id", venue_id)
          .maybeSingle();
        if (venueErr) return json({ error: `Venue lookup failed: ${venueErr.message}` }, 500);
        if (!venueRow) return json({ error: "Venue not found." }, 404);
        if (venueRow.owner_id !== null && venueRow.owner_id !== user_id) {
          return json({ error: "This venue is owned by a different account. Nothing was changed." }, 409);
        }

        // 1. Release the venue first. If a later step fails, the venue is
        //    already re-claimable and the operator can retry; the reverse
        //    order would demote the user while leaving the venue stuck to
        //    them.
        // ORDER MATTERS. These are sequential client calls with no
        // transaction around them, so every step has to leave a recoverable
        // state if the next one fails.
        //
        // Staff are downgraded BEFORE the venue is released. The reverse order
        // fails into exactly the state this action exists to prevent: venue
        // already ownerless with 'active' affiliations still attached, which
        // is the Tangra shape, unmanageable from both sides and still granting
        // tap-in. This way a failure between the two leaves pending staff at a
        // venue that still has an owner, and the owner simply re-approves.
        //
        // Releasing the venue strands every affiliation at it: nobody can
        // approve, remove or invite without an owner. Worse, an 'active'
        // affiliation still grants tap-in, since profiles_enforce_check_in
        // only asks for status = 'active'. So talent could keep marking
        // themselves present at a venue no one controls. That is exactly the
        // state the legacy Tangra row was in.
        //
        // Downgraded to 'pending' rather than deleted. Pending confers
        // nothing, so the tap-in right is removed just as completely, but the
        // relationship survives as a request waiting for whoever claims the
        // venue next. Deleting would destroy every employment relationship
        // irreversibly, with no audit row, and revoke is plausibly used to
        // correct a mis-approval where the venue is re-claimed days later.
        // Talent can still withdraw at any time.
        //
        // Only 'active' rows are touched. pending, pending_talent_action and
        // ignored already confer nothing and are left as they are.
        const rStaff = await admin
          .from("venue_staff")
          .update({ status: "pending" })
          .eq("venue_id", venue_id)
          .eq("status", "active")
          .select("id");
        if (rStaff.error) return json({ error: rStaff.error.message }, 500);
        const downgraded = rStaff.data?.length ?? 0;

        // Only now release the venue.
        const rVenue = await admin
          .from("venues")
          .update({ owner_id: null })
          .eq("id", venue_id)
          .select("id");
        if (rVenue.error) return json({ error: rVenue.error.message }, 500);
        if ((rVenue.data?.length ?? 0) !== 1) {
          return json({ error: "Any active staff were moved to pending, but the venue was not released. Revoke again to finish." }, 500);
        }

        // 2. Mark the approved claim 'revoked' and keep it as history (A7).
        //    This used to DELETE it, as a workaround for the old
        //    UNIQUE (venue_id, status) constraint, under which a retained
        //    'approved' row blocked the next approval and a second 'revoked'
        //    row on the same venue collided. The constraint is now one pending
        //    and one approved claim per venue, so a revoked row blocks nothing
        //    and the venue is claimable again. Matched on the row read above
        //    and still approved, and exactly one row, or stop.
        // Steps 3 and 4 have the same no-transaction exposure but fail safe,
        // so they stay in this order:
        //
        //   claim mark fails    -> venue is released and staff downgraded, but
        //     the claim still reads 'approved', and the one-approved-per-venue
        //     index blocks the next approval on this venue (A46's approve
        //     pre-check says so before any write). Visible, not a rights
        //     leak, and finished by re-running revoke, which the read above
        //     allows because the venue is now unowned.
        //
        //   demote fails        -> the account keeps role_type 'manager' while
        //     owning nothing. Manager surfaces already handle zero owned
        //     venues (that was fixed 2026-08-03), and re-running revoke
        //     re-evaluates it.
        //
        // Neither leaves anyone able to act on a venue they no longer own,
        // which is the property that actually matters here.
        const rClaim = await admin
          .from("venue_claims")
          .update({ status: "revoked" })
          .eq("id", approvedClaim.id)
          .eq("status", "approved")
          .select("id");
        if (rClaim.error) return json({ error: rClaim.error.message }, 500);
        if ((rClaim.data?.length ?? 0) !== 1) {
          return json({ error: "Venue released, but the claim was not marked revoked. Revoke again to finish." }, 500);
        }

        // 3. Demote only if this was their last venue. A manager running
        //    several venues who loses one is still a manager; dropping them
        //    to guest would strand the venues they still own, since those
        //    rows would keep pointing at an account that can no longer reach
        //    the dashboard.
        const remaining = await admin
          .from("venues")
          .select("id")
          .eq("owner_id", user_id)
          .limit(1);
        if (remaining.error) return json({ error: remaining.error.message }, 500);

        const demoted = !remaining.data || remaining.data.length === 0;
        if (demoted) {
          const rRole = await admin.from("profiles").update({ role_type: "guest" }).eq("id", user_id);
          if (rRole.error) return json({ error: rRole.error.message }, 500);
        }

        return json({ ok: true, demoted, downgraded });
      }
      case "approve_talent": {
        const { user_id } = parsed.data.payload;
        // Gate before ANY write, same reason as approve_venue_claim: this
        // used to overwrite role_type unconditionally, so approving talent
        // for an existing manager flipped the role while venues.owner_id
        // kept pointing at that account.
        const gate = await findRoleConflict(admin, user_id, "talent");
        if (gate.readError) return json({ error: `Role check failed: ${gate.readError}` }, 500);
        if (gate.conflict) return json({ error: gate.conflict }, 409);

        // Role first, then close the application. If the second write fails,
        // the applicant still shows as pending and the admin can retry
        // (re-approving is harmless). The reverse order would drop them out
        // of the review queue while leaving them without the role - a silent
        // failure nobody would notice.
        const r = await admin.from("profiles").update({ role_type: "talent" }).eq("id", user_id);
        if (r.error) return json({ error: r.error.message }, 500);
        // talent_applications_one_pending_per_user guarantees at most one
        // pending row per user, so this filtered update targets exactly that
        // row without a separate lookup.
        const app = await admin
          .from("talent_applications")
          .update({ status: "approved" })
          .eq("user_id", user_id)
          .eq("status", "pending");
        if (app.error) return json({ error: app.error.message }, 500);
        return json({ ok: true });
      }
      case "reject_talent": {
        const { user_id } = parsed.data.payload;
        const r = await admin.from("profiles").update({ role_type: "guest" }).eq("id", user_id);
        if (r.error) return json({ error: r.error.message }, 500);
        const app = await admin
          .from("talent_applications")
          .update({ status: "rejected" })
          .eq("user_id", user_id)
          .eq("status", "pending");
        if (app.error) return json({ error: app.error.message }, 500);
        return json({ ok: true });
      }
      case "approve_business": {
        const { venue_id } = parsed.data.payload;
        // Flag first, then close the application. Same ordering as
        // approve_talent: if the second write fails the recoverable state is
        // "verified but still shows pending", not a venue silently dropped
        // from the review queue while still unverified.
        const r = await admin.from("venues").update({ business_verified: true }).eq("id", venue_id);
        if (r.error) return json({ error: r.error.message }, 500);
        // venue_business_applications_one_pending_per_venue guarantees at most
        // one pending row per venue, so this filtered update targets exactly
        // that row without a separate lookup.
        const app = await admin
          .from("venue_business_applications")
          .update({ status: "approved" })
          .eq("venue_id", venue_id)
          .eq("status", "pending");
        if (app.error) return json({ error: app.error.message }, 500);
        return json({ ok: true });
      }
      case "reject_business": {
        const { venue_id } = parsed.data.payload;
        const r = await admin.from("venues").update({ business_verified: false }).eq("id", venue_id);
        if (r.error) return json({ error: r.error.message }, 500);
        const app = await admin
          .from("venue_business_applications")
          .update({ status: "rejected" })
          .eq("venue_id", venue_id)
          .eq("status", "pending");
        if (app.error) return json({ error: app.error.message }, 500);
        return json({ ok: true });
      }
    }
  } catch (err) {
    console.error("admin-actions error", err);
    return json({ error: "Internal error" }, 500);
  }
});
