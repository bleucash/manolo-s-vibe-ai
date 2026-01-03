import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Post {
  id: string;
  user_id: string | null;
  venue_id: string | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  likes_count: number | null;
  ai_vibe_score: number | null;
  status: string | null;
  created_at: string | null;
  venues: {
    id: string;
    name: string;
    category: string | null;
  } | null;
}

async function fetchPosts(category: string): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select(`
      *,
      venues (
        id,
        name,
        category
      )
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (category !== "all") {
    query = query.eq("venues.category", category);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Filter out posts where venue category doesn't match (for non-"all" queries)
  if (category !== "all") {
    return (data ?? []).filter((post) => post.venues?.category === category);
  }

  return data ?? [];
}

export function usePosts(category: string = "all") {
  return useQuery({
    queryKey: ["posts", category],
    queryFn: () => fetchPosts(category),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
