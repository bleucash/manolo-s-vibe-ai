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
    action: z.literal("approve_talent"),
    payload: z.object({ user_id: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("reject_talent"),
    payload: z.object({ user_id: z.string().uuid() }),
  }),
]);

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
        const r1 = await admin.from("venue_claims").update({ status: "approved" }).eq("id", claim_id);
        if (r1.error) return json({ error: r1.error.message }, 500);
        const r2 = await admin.from("venues").update({ owner_id: user_id, verified: true }).eq("id", venue_id);
        if (r2.error) return json({ error: r2.error.message }, 500);
        const r3 = await admin.from("profiles").update({ is_verified_manager: true, role_type: "manager" }).eq("id", user_id);
        if (r3.error) return json({ error: r3.error.message }, 500);
        return json({ ok: true });
      }
      case "reject_venue_claim": {
        const { claim_id } = parsed.data.payload;
        const r = await admin.from("venue_claims").update({ status: "rejected" }).eq("id", claim_id);
        if (r.error) return json({ error: r.error.message }, 500);
        return json({ ok: true });
      }
      case "approve_talent": {
        const { user_id } = parsed.data.payload;
        const r = await admin.from("profiles").update({ is_verified_talent: true }).eq("id", user_id);
        if (r.error) return json({ error: r.error.message }, 500);
        return json({ ok: true });
      }
      case "reject_talent": {
        const { user_id } = parsed.data.payload;
        const r = await admin.from("profiles").update({ role_type: "guest" }).eq("id", user_id);
        if (r.error) return json({ error: r.error.message }, 500);
        return json({ ok: true });
      }
    }
  } catch (err) {
    console.error("admin-actions error", err);
    return json({ error: "Internal error" }, 500);
  }
});
