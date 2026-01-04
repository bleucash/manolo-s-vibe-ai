import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// 1. Updated CORS to include all required headers for 2026 browsers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 2. Native Deno.serve prevents "runMicrotasks" and "process" desync errors
Deno.serve(async (req) => {
  // Handle Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing environment configuration");
    }

    // 3. Optimized Stripe Client with FetchHttpClient (Required for Deno)
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Authentication failed");

    // Parse Body
    const { venue_id, price_type, quantity, referral_id } = await req.json();
    if (!venue_id) throw new Error("venue_id is required");

    // 4. Fetch venue details to get the Venue Name for the ticket
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("name, entry_price, vip_price")
      .eq("id", venue_id)
      .single();

    if (venueError || !venue) throw new Error("Venue verification failed");

    // Pricing Logic
    const isVip = price_type === "vip" && venue.vip_price;
    const unitPrice = isVip ? parseFloat(venue.vip_price) : parseFloat(venue.entry_price) || 20.0;
    const ticketType = isVip ? "VIP Admission" : "General Admission";

    // 5. Optimized Customer Handling (Find or Create)
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0
      ? customers.data[0].id
      : (await stripe.customers.create({ 
          email: user.email, 
          metadata: { user_id: user.id } 
        })).id;

    const origin = req.headers.get("origin") || "https://lovable.dev";

    // 6. Updated Stripe Session with Full Identification Metadata
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${venue.name} - ${ticketType}`,
              description: `Digital Entry for ${venue.name}`,
            },
            unit_amount: Math.round(unitPrice * 100), // Stripe expects cents
          },
          quantity: Math.min(Math.max(parseInt(quantity) || 1, 1), 10),
        },
      ],
      mode: "payment",
      success_url: `${origin}/wallet?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/venue/${venue_id}`,
      metadata: {
        user_id: user.id,
        customer_name: user.user_metadata?.full_name || user.email || "Guest", // Fixes Missing Name
        venue_id: venue_id, // UUID persistence
        venue_name: venue.name, // Fixes Missing Venue Name
        promoter_id: referral_id || "",
        ticket_type: ticketType,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Critical Function Error:", errorMessage);
    // 7. Return CORS headers on error to allow frontend debugging
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
