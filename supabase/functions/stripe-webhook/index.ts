import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment configuration");
      throw new Error("Missing environment configuration");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(JSON.stringify({ error: errorMessage }), { status: 400 });
    }

    console.log(`🔔 Received event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      const userId = metadata.user_id;
      const venueId = metadata.venue_id;
      const promoterId = metadata.promoter_id; // UUID of the promoter
      const venueName = metadata.venue_name || "Unknown Venue";
      const ticketType = metadata.ticket_type || "General Admission";

      if (!userId || !venueId) {
        console.error("Missing required metadata: user_id or venue_id");
        return new Response(JSON.stringify({ error: "Missing metadata" }), { status: 200 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Idempotency check: Don't create duplicate tickets for the same session
      const { data: existingTicket } = await supabase
        .from("tickets")
        .select("id")
        .eq("stripe_session_id", session.id)
        .single();

      if (existingTicket) {
        console.log("Ticket already exists for session:", session.id);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // 2. Calculate Pricing and Commissions
      const pricePaid = (session.amount_total || 0) / 100;
      let commissionEarned = 0;

      // Logic for calculating promoter cut
      if (promoterId) {
        const { data: staffData, error: staffError } = await supabase
          .from("venue_staff")
          .select("commission_rate")
          .eq("venue_id", venueId)
          .eq("user_id", promoterId)
          .eq("status", "active") // Only calculate for active staff
          .maybeSingle();

        if (staffError) {
          console.error("Error fetching promoter commission rate:", staffError);
        } else if (staffData?.commission_rate) {
          // Calculate the dollar amount based on their snapshot rate
          const ratePercentage = Number(staffData.commission_rate);
          commissionEarned = pricePaid * (ratePercentage / 100);
          console.log(`💰 Promoter ${promoterId} earned $${commissionEarned.toFixed(2)} (${ratePercentage}%)`);
        }
      }

      // 3. Create the ticket with the "Locked" commission amount
      const { data: ticket, error: insertError } = await supabase
        .from("tickets")
        .insert({
          user_id: userId,
          venue_id: venueId,
          promoter_id: promoterId || null,
          commission_earned: commissionEarned, // Storing the dollar value snapshot
          venue_name: venueName,
          event_name: ticketType,
          price_paid: pricePaid,
          status: "active",
          stripe_session_id: session.id,
          qr_code: crypto.randomUUID(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert ticket:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), { status: 200 });
      }

      console.log(`✅ Ticket ${ticket.id} created successfully.`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 200 });
  }
});
