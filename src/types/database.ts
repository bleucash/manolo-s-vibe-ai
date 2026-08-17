import type { Position } from "@/config/positions";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  hero_reel_url: string | null;
  bio: string | null;
  role_type: "guest" | "talent" | "manager";
  /** Constrained by profiles_sub_role_allowed; see src/config/positions.ts. */
  sub_role: Position | null;
  is_active: boolean;
  current_venue_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  image_url: string | null;
  hero_reel_url: string | null;
  category: string;
  is_active: boolean;
  owner_id: string | null; // NULL = Unclaimed Sector
  verified: boolean;      // TRUE = Official/Authenticated
  created_at: string;
}

export interface VenueClaim {
  id: string;
  user_id: string;
  venue_id: string;
  status: "pending" | "approved" | "rejected";
  instagram_handle: string | null; // Tier 1: Instagram handshake
  legal_name: string | null; // Tier 2: business verification
  business_email: string | null; // Tier 2: business verification
  business_phone: string | null; // Tier 2: business verification
  position_title: string | null; // Tier 2: business verification
  created_at: string;
}

export interface PortfolioItem {
  id: string;
  user_id: string;
  image_url: string;
  media_type: "image" | "video";
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  venue_id: string;
  promoter_id: string | null;
  qr_code: string;
  status: "active" | "used" | "refunded";
  price_paid: number;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  venue_id: string | null;
  content: string | null;
  media_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostWithVenue extends Post {
  profiles: Profile;
  venues: Venue | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      venues: {
        Row: Venue;
        Insert: Partial<Venue>;
        Update: Partial<Venue>;
      };
      venue_claims: {
        Row: VenueClaim;
        Insert: Partial<VenueClaim>;
        Update: Partial<VenueClaim>;
      };
      portfolio_items: {
        Row: PortfolioItem;
        Insert: Partial<PortfolioItem>;
        Update: Partial<PortfolioItem>;
      };
      tickets: {
        Row: Ticket;
        Insert: Partial<Ticket>;
        Update: Partial<Ticket>;
      };
    };
  };
}
