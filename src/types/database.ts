export interface Venue {
  id: string;
  name: string;
  location: string;
  category: string | null;
  image_url?: string;
  is_active: boolean;
  description?: string | null;
  capacity?: number | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  sub_role: string | null;
}

export interface Post {
  id: string;
  user_id: string; // Removed nullability for B2B referral logic
  venue_id: string;
  media_url: string; // Aligned with VideoCard src
  content: string | null; // Aligned with VideoCard overlay
  created_at: string;
  likes_count: number | null;
  ai_vibe_score: number | null;
  status: string | null;
}

export interface PostWithVenue extends Post {
  venues: Venue | null;
  profiles: Profile | null;
}

export interface Ticket {
  id: string;
  user_id: string;
  venue_id: string;
  promoter_id: string | null;
  qr_code: string; // Matches Bouncer.tsx scan logic
  status: string; // Matches 'Valid' | 'Scanned'
  price_paid: number;
}
