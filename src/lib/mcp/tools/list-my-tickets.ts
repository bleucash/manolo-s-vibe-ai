import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_tickets",
  title: "List my tickets",
  description: "List the signed-in user's tickets (wallet passes), optionally filtered by status.",
  inputSchema: {
    status: z.enum(["active", "used", "refunded"]).optional().describe("Optional ticket status filter."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of tickets to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("tickets")
      .select("id, venue_id, status, price_paid, created_at, venues(name, location)")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (status) request = request.eq("status", status);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tickets: data ?? [] },
    };
  },
});
