import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
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
      console.error("No stripe-signature header");
      return new Response(JSON.stringify({ error: "No signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(JSON.stringify({ error: `Signature verification failed: ${errorMessage}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Received event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log("Processing checkout.session.completed:", session.id);
      console.log("Session metadata:", JSON.stringify(session.metadata));

      const metadata = session.metadata || {};
      const userId = metadata.user_id;
      const venueId = metadata.venue_id;
      const venueName = metadata.venue_name || "Unknown Venue";
      const ticketType = metadata.ticket_type || "General Admission";
      const promoterId = metadata.promoter_id || null;

      if (!userId || !venueId) {
        console.error("Missing required metadata: user_id or venue_id");
        return new Response(JSON.stringify({ error: "Missing required metadata" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // Return 200 so Stripe stops retrying
        });
      }

      // Use Service Role Key to bypass RLS
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Check for existing ticket with same session ID (idempotency)
      const { data: existingTicket } = await supabase
        .from("tickets")
        .select("id")
        .eq("stripe_session_id", session.id)
        .single();

      if (existingTicket) {
        console.log("Ticket already exists for session:", session.id);
        return new Response(JSON.stringify({ received: true, message: "Ticket already created" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const pricePaid = (session.amount_total || 0) / 100;
      const qrCode = crypto.randomUUID();

      const { data: ticket, error: insertError } = await supabase
        .from("tickets")
        .insert({
          user_id: userId,
          venue_id: venueId,
          venue_name: venueName,
          event_name: ticketType,
          price_paid: pricePaid,
          status: "active",
          stripe_session_id: session.id,
          qr_code: qrCode,
          promoter_id: promoterId || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert ticket:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // Return 200 so Stripe stops retrying
        });
      }

      console.log("Ticket created successfully:", ticket.id);
      
      return new Response(JSON.stringify({ received: true, ticket_id: ticket.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For other event types, acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 to prevent Stripe from retrying on unexpected errors
    });
  }
});
