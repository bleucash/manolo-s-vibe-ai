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
      posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          likes_count: number | null
          media_type: string | null
          media_url: string
          user_id: string
          venue_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number | null
          media_type?: string | null
          media_url: string
          user_id: string
          venue_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
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
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          city: string | null
          display_name: string | null
          full_name: string | null
          id: string
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
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          display_name?: string | null
          full_name?: string | null
          id: string
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
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          display_name?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          role_type?: Database["public"]["Enums"]["app_role"]
          sub_role?: string | null
          total_lifetime_spend?: number | null
          updated_at?: string | null
          username?: string | null
          venue_id?: string | null
          website?: string | null
        }
        Relationships: []
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
          address: string | null
          base_price: number | null
          capacity: number | null
          category: string | null
          commission_rate: number | null
          created_at: string
          description: string | null
          entry_price: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          location: string
          name: string
          owner_id: string | null
          settings: Json | null
          standard_commission: number | null
          table_min_spend: number | null
          venue_type: string | null
          vip_price: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          base_price?: number | null
          capacity?: number | null
          category?: string | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          entry_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location: string
          name: string
          owner_id?: string | null
          settings?: Json | null
          standard_commission?: number | null
          table_min_spend?: number | null
          venue_type?: string | null
          vip_price?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          base_price?: number | null
          capacity?: number | null
          category?: string | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          entry_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location?: string
          name?: string
          owner_id?: string | null
          settings?: Json | null
          standard_commission?: number | null
          table_min_spend?: number | null
          venue_type?: string | null
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
      scan_ticket: { Args: { _ticket_id: string }; Returns: Json }
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
