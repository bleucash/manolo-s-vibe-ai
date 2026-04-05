export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summary"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          total_tickets: number
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price?: number
          total_tickets?: number
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          total_tickets?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          action_value: number | null
          created_at: string | null
          id: string
          interaction_type: string
          referrer_id: string | null
          referrer_type: string | null
          target_id: string
          target_type: string
          user_id: string | null
        }
        Insert: {
          action_value?: number | null
          created_at?: string | null
          id?: string
          interaction_type: string
          referrer_id?: string | null
          referrer_type?: string | null
          target_id: string
          target_type: string
          user_id?: string | null
        }
        Update: {
          action_value?: number | null
          created_at?: string | null
          id?: string
          interaction_type?: string
          referrer_id?: string | null
          referrer_type?: string | null
          target_id?: string
          target_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summary"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payout_history: {
        Row: {
          amount: number
          id: string
          processed_at: string
          promoter_id: string | null
          ticket_count: number
          venue_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          processed_at?: string
          promoter_id?: string | null
          ticket_count: number
          venue_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          processed_at?: string
          promoter_id?: string | null
          ticket_count?: number
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_history_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_history_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_handle: string
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_handle: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_handle?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          caption: string | null
          created_at: string | null
          display_order: number | null
          id: string
          media_type: string | null
          media_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          media_type?: string | null
          media_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          media_type?: string | null
          media_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          likes_count: number | null
          media_type: string | null
          media_url: string
          user_id: string
          venue_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          likes_count?: number | null
          media_type?: string | null
          media_url: string
          user_id: string
          venue_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          likes_count?: number | null
          media_type?: string | null
          media_url?: string
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_at: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          city: string | null
          current_venue_id: string | null
          display_name: string | null
          full_name: string | null
          hero_reel_url: string | null
          id: string
          is_active: boolean | null
          location: string | null
          role_type: Database["public"]["Enums"]["app_role"]
          sub_role: string | null
          total_lifetime_spend: number | null
          updated_at: string | null
          username: string | null
          venue_id: string | null
          website: string | null
        }
        Insert: {
          active_at?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          current_venue_id?: string | null
          display_name?: string | null
          full_name?: string | null
          hero_reel_url?: string | null
          id: string
          is_active?: boolean | null
          location?: string | null
          role_type?: Database["public"]["Enums"]["app_role"]
          sub_role?: string | null
          total_lifetime_spend?: number | null
          updated_at?: string | null
          username?: string | null
          venue_id?: string | null
          website?: string | null
        }
        Update: {
          active_at?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          current_venue_id?: string | null
          display_name?: string | null
          full_name?: string | null
          hero_reel_url?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          role_type?: Database["public"]["Enums"]["app_role"]
          sub_role?: string | null
          total_lifetime_spend?: number | null
          updated_at?: string | null
          username?: string | null
          venue_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_venue_id_fkey"
            columns: ["current_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          commission_earned: number | null
          created_at: string | null
          currency: string | null
          customer_segment: string | null
          event_date: string | null
          event_name: string | null
          id: string
          payment_intent_id: string | null
          price_paid: number
          promo_code: string | null
          promoter_id: string | null
          qr_code: string | null
          scanned_at: string | null
          status: string | null
          stripe_session_id: string | null
          user_id: string | null
          venue_id: string
          venue_name: string | null
        }
        Insert: {
          commission_earned?: number | null
          created_at?: string | null
          currency?: string | null
          customer_segment?: string | null
          event_date?: string | null
          event_name?: string | null
          id?: string
          payment_intent_id?: string | null
          price_paid: number
          promo_code?: string | null
          promoter_id?: string | null
          qr_code?: string | null
          scanned_at?: string | null
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
          venue_id: string
          venue_name?: string | null
        }
        Update: {
          commission_earned?: number | null
          created_at?: string | null
          currency?: string | null
          customer_segment?: string | null
          event_date?: string | null
          event_name?: string | null
          id?: string
          payment_intent_id?: string | null
          price_paid?: number
          promo_code?: string | null
          promoter_id?: string | null
          qr_code?: string | null
          scanned_at?: string | null
          status?: string | null
          stripe_session_id?: string | null
          user_id?: string | null
          venue_id?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_claims: {
        Row: {
          business_email: string
          business_phone: string | null
          created_at: string | null
          id: string
          legal_name: string
          position_title: string | null
          status: string | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          business_email: string
          business_phone?: string | null
          created_at?: string | null
          id?: string
          legal_name: string
          position_title?: string | null
          status?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          business_email?: string
          business_phone?: string | null
          created_at?: string | null
          id?: string
          legal_name?: string
          position_title?: string | null
          status?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_claims_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_followers: {
        Row: {
          created_at: string | null
          follower_id: string | null
          id: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          follower_id?: string | null
          id?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          follower_id?: string | null
          id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_followers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_staff: {
        Row: {
          commission_rate: number | null
          created_at: string
          id: string
          staff_role: string | null
          status: string | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          id?: string
          staff_role?: string | null
          status?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          id?: string
          staff_role?: string | null
          status?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_staff_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          active_at: string | null
          address: string | null
          base_price: number | null
          capacity: number | null
          category: string | null
          commission_rate: number | null
          created_at: string
          description: string | null
          entry_price: number | null
          event_flyer_url: string | null
          general_description: string | null
          hero_reel_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          location: string
          name: string
          owner_id: string | null
          settings: Json | null
          standard_commission: number | null
          subscription_tier: string | null
          table_min_spend: number | null
          ticketing_enabled: boolean | null
          venue_type: string | null
          vip_description: string | null
          vip_price: number | null
          website: string | null
        }
        Insert: {
          active_at?: string | null
          address?: string | null
          base_price?: number | null
          capacity?: number | null
          category?: string | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          entry_price?: number | null
          event_flyer_url?: string | null
          general_description?: string | null
          hero_reel_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location: string
          name: string
          owner_id?: string | null
          settings?: Json | null
          standard_commission?: number | null
          subscription_tier?: string | null
          table_min_spend?: number | null
          ticketing_enabled?: boolean | null
          venue_type?: string | null
          vip_description?: string | null
          vip_price?: number | null
          website?: string | null
        }
        Update: {
          active_at?: string | null
          address?: string | null
          base_price?: number | null
          capacity?: number | null
          category?: string | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          entry_price?: number | null
          event_flyer_url?: string | null
          general_description?: string | null
          hero_reel_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location?: string
          name?: string
          owner_id?: string | null
          settings?: Json | null
          standard_commission?: number | null
          subscription_tier?: string | null
          table_min_spend?: number | null
          ticketing_enabled?: boolean | null
          venue_type?: string | null
          vip_description?: string | null
          vip_price?: number | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      conversation_summary: {
        Row: {
          avatar_url: string | null
          conversation_id: string | null
          display_name: string | null
          is_read: boolean | null
          last_message_at: string | null
          last_message_content: string | null
          last_sender_id: string | null
          participant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["last_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_in_guest: {
        Args: { current_venue_id: string; qr_input: string }
        Returns: Json
      }
      cleanup_expired_posts: { Args: never; Returns: number }
      get_talent_spotlight: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          charge_score: number
          display_name: string
          hero_reel_url: string
          sub_role: string
          talent_id: string
          venue_id: string
        }[]
      }
      get_unpaid_commissions: {
        Args: { venue_id_input: string }
        Returns: {
          full_name: string
          promoter_id: string
          ticket_count: number
          total_unpaid: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_type: {
        Args: { _role_type: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_conversation: { Args: { target_user_id: string }; Returns: string }
      update_user_profile:
        | {
            Args: {
              p_avatar_url: string
              p_bio: string
              p_display_name: string
              p_role?: string
            }
            Returns: undefined
          }
        | { Args: { p_role_type: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "manager"
        | "staff"
        | "user"
        | "venue_manager"
        | "talent"
        | "guest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "manager",
        "staff",
        "user",
        "venue_manager",
        "talent",
        "guest",
      ],
    },
  },
} as const
