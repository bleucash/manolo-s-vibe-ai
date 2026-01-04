import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new Error("Payment service not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Create Supabase client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Not authenticated");
    }

    console.log("Authenticated user:", user.id);

    // Parse request body
    const { venue_id, price_type, quantity, referral_id } = await req.json();

    if (!venue_id) {
      throw new Error("venue_id is required");
    }

    const ticketQuantity = Math.min(Math.max(parseInt(quantity) || 1, 1), 10);

    console.log("Request params:", { venue_id, price_type, quantity: ticketQuantity, referral_id });

    // Fetch venue details for pricing
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, name, entry_price, vip_price")
      .eq("id", venue_id)
      .single();

    if (venueError || !venue) {
      console.error("Venue fetch error:", venueError);
      throw new Error("Venue not found");
    }

    console.log("Venue found:", venue.name);

    // Determine price based on type (default to entry_price)
    let unitPrice: number;
    let ticketType: string;

    if (price_type === "vip" && venue.vip_price) {
      unitPrice = parseFloat(venue.vip_price);
      ticketType = "VIP Admission";
    } else {
      unitPrice = parseFloat(venue.entry_price) || 20.0;
      ticketType = "General Admission";
    }

    console.log("Ticket type:", ticketType, "Unit price:", unitPrice);

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Check if user already has a Stripe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Existing Stripe customer:", customerId);
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
      console.log("Created new Stripe customer:", customerId);
    }

    // Build success/cancel URLs
    const origin = req.headers.get("origin") || "https://lovable.dev";
    const successUrl = `${origin}/wallet?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/venue/${venue_id}`;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${venue.name} - ${ticketType}`,
              description: `Entry ticket to ${venue.name}`,
            },
            unit_amount: Math.round(unitPrice * 100), // Convert to cents
          },
          quantity: ticketQuantity,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        venue_id: venue_id,
        promoter_id: referral_id || "",
        quantity: ticketQuantity.toString(),
        ticket_type: ticketType,
        unit_price: unitPrice.toString(),
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
    console.error("Checkout error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
