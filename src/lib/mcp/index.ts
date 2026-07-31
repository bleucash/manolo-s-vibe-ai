import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchVenuesTool from "./tools/search-venues";
import getVenueTool from "./tools/get-venue";
import listMyTicketsTool from "./tools/list-my-tickets";
import getMyProfileTool from "./tools/get-my-profile";
import searchTalentTool from "./tools/search-talent";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "manolo-s-vibe-ai",
  title: "Manolo's Vibe AI",
  version: "0.1.0",
  instructions:
    "Tools for Manolo's Vibe AI, a Tampa Bay nightlife marketplace. Use `search_venues` and `get_venue` to browse venues, `search_talent` to find DJs and performers, `list_my_tickets` for the signed-in user's wallet passes, and `get_my_profile` for their account role and verification status. All tools act as the signed-in user under row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchVenuesTool, getVenueTool, searchTalentTool, listMyTicketsTool, getMyProfileTool],
});
