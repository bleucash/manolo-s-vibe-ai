export interface Venue {
  id: string;
  name: string;
  location: string;
  category: string | null;
  image_url?: string;
  is_active: boolean;
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
}

export interface PostWithVenue extends Post {
  venues: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  profiles?: {
    display_name: string | null;
    sub_role: string | null;
    avatar_url: string | null;
  } | null;
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
