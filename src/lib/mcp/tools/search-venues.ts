import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_venues",
  title: "Search venues",
  description: "Search Tampa Bay nightlife venues by name, location, or category.",
  inputSchema: {
    query: z.string().trim().optional().describe("Text to match against venue name or location."),
    category: z.string().trim().optional().describe("Optional venue category filter."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of venues to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("venues")
      .select("id, name, location, category, description, verified, is_active")
      .eq("is_active", true)
      .limit(limit ?? 10);

    if (query) request = request.or(`name.ilike.%${query}%,location.ilike.%${query}%`);
    if (category) request = request.eq("category", category);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { venues: data ?? [] },
    };
  },
});
