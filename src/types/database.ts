export interface Venue {
  id: string;
  name: string;
  location: string;
  category: string | null;
  image_url?: string;
  is_active: boolean;
  description?: string | null;
  capacity?: number | null;
  entry_price?: number | null;
  // ✅ ADDED FOR CLAIMING LOGIC
  owner_id: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  sub_role: string | null;
  role_type: "guest" | "talent" | "manager"; // Added for mode switching logic
}

export interface Post {
  id: string;
  user_id: string;
  venue_id: string;
  media_url: string;
  content: string | null;
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
  qr_code: string;
  status: string;
  price_paid: number;
}
