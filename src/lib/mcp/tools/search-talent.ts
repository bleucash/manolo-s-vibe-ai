import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_talent",
  title: "Search talent",
  description: "Search verified talent profiles (DJs, performers, hosts) by name or sub-role.",
  inputSchema: {
    query: z.string().trim().optional().describe("Text to match against display name or username."),
    sub_role: z.string().trim().optional().describe("Optional talent sub-role filter, e.g. 'dj'."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of profiles to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, sub_role, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let request = supabase
      .from("profiles")
      .select("id, username, display_name, bio, sub_role")
      .eq("role_type", "talent")
      .limit(limit ?? 10);

    if (query) request = request.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    if (sub_role) request = request.eq("sub_role", sub_role);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { talent: data ?? [] },
    };
  },
});
