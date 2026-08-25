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
        // Gate before ANY write. Previously this overwrote role_type
        // unconditionally, so approving a venue claim for someone already
        // talent silently flipped them to manager.
        const gate = await findRoleConflict(admin, user_id, "manager");
        if (gate.readError) return json({ error: `Role check failed: ${gate.readError}` }, 500);
        if (gate.conflict) return json({ error: gate.conflict }, 409);

        const r1 = await admin.from("venue_claims").update({ status: "approved" }).eq("id", claim_id);
        if (r1.error) return json({ error: r1.error.message }, 500);
        const r2 = await admin.from("venues").update({ owner_id: user_id }).eq("id", venue_id);
        if (r2.error) return json({ error: r2.error.message }, 500);
        const r3 = await admin.from("profiles").update({ role_type: "manager" }).eq("id", user_id);
        if (r3.error) return json({ error: r3.error.message }, 500);
        return json({ ok: true });
      }
      case "reject_venue_claim": {
        const { claim_id } = parsed.data.payload;
        const r = await admin.from("venue_claims").update({ status: "rejected" }).eq("id", claim_id);
        if (r.error) return json({ error: r.error.message }, 500);
        return json({ ok: true });
      }
      case "revoke_venue_claim": {
        const { venue_id, user_id } = parsed.data.payload;

        // Distinct from reject_venue_claim, which only ever applies to a
        // pending claim. This undoes an approval that has already taken
        // effect: a live manager account losing a venue it currently runs.

        // 1. Release the venue first. If a later step fails, the venue is
        //    already re-claimable and the operator can retry; the reverse
        //    order would demote the user while leaving the venue stuck to
        //    them.
        const rVenue = await admin.from("venues").update({ owner_id: null }).eq("id", venue_id);
        if (rVenue.error) return json({ error: rVenue.error.message }, 500);

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

        // 2. Delete the approved claim row rather than marking it terminal.
        //    unique_venue_claim is UNIQUE (venue_id, status), so a retained
        //    row of ANY status permanently occupies that (venue, status)
        //    slot: leaving it "approved" makes the next approval collide,
        //    and a "revoked" status collides on the second revoke of the
        //    same venue. Deleting is what actually leaves the venue
        //    re-claimable, which is the point of this action. The tradeoff
        //    is that revocation leaves no audit row; recording that properly
        //    needs its own table, not a status value this constraint blocks.
        const rClaim = await admin
          .from("venue_claims")
          .delete()
          .eq("venue_id", venue_id)
          .eq("user_id", user_id)
          .eq("status", "approved");
        if (rClaim.error) return json({ error: rClaim.error.message }, 500);

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
