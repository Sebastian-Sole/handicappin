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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      course: {
        Row: {
          approvalStatus: string
          city: string
          country: string
          id: number
          name: string
          website: string | null
        }
        Insert: {
          approvalStatus?: string
          city?: string
          country?: string
          id?: number
          name: string
          website?: string | null
        }
        Update: {
          approvalStatus?: string
          city?: string
          country?: string
          id?: number
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          created_at: string
          feature_updates: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_updates?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_updates?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      handicap_calculation_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_type: string
          id: number
          last_updated: string
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: number
          last_updated?: string
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: number
          last_updated?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handicap_calculation_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      hole: {
        Row: {
          distance: number
          hcp: number
          holeNumber: number
          id: number
          par: number
          teeId: number
        }
        Insert: {
          distance: number
          hcp: number
          holeNumber: number
          id?: number
          par: number
          teeId: number
        }
        Update: {
          distance?: number
          hcp?: number
          holeNumber?: number
          id?: number
          par?: number
          teeId?: number
        }
        Relationships: [
          {
            foreignKeyName: "hole_teeId_fkey"
            columns: ["teeId"]
            isOneToOne: false
            referencedRelation: "teeInfo"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          metadata: string | null
          otp_hash: string
          otp_type: string
          request_ip: string | null
          user_id: string | null
          verification_attempts: number
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          metadata?: string | null
          otp_hash: string
          otp_type: string
          request_ip?: string | null
          user_id?: string | null
          verification_attempts?: number
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          metadata?: string | null
          otp_hash?: string
          otp_type?: string
          request_ip?: string | null
          user_id?: string | null
          verification_attempts?: number
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      pending_email_changes: {
        Row: {
          cancel_token: string | null
          created_at: string
          expires_at: string
          id: string
          new_email: string
          old_email: string
          request_ip: string | null
          token_hash: string
          user_id: string
          verification_attempts: number
        }
        Insert: {
          cancel_token?: string | null
          created_at?: string
          expires_at: string
          id?: string
          new_email: string
          old_email: string
          request_ip?: string | null
          token_hash: string
          user_id: string
          verification_attempts?: number
        }
        Update: {
          cancel_token?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          new_email?: string
          old_email?: string
          request_ip?: string | null
          token_hash?: string
          user_id?: string
          verification_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "pending_email_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_lifetime_purchases: {
        Row: {
          checkout_session_id: string
          created_at: string
          id: number
          payment_intent_id: string | null
          plan: string
          price_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checkout_session_id: string
          created_at?: string
          id?: number
          payment_intent_id?: string | null
          plan: string
          price_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checkout_session_id?: string
          created_at?: string
          id?: number
          payment_intent_id?: string | null
          plan?: string
          price_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_lifetime_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          billing_version: number
          cancel_at_period_end: boolean
          createdAt: string
          current_period_end: number | null
          handicapIndex: number
          id: string
          initialHandicapIndex: number
          name: string | null
          plan_selected: string | null
          plan_selected_at: string | null
          subscription_status: string | null
          verified: boolean
        }
        Insert: {
          billing_version?: number
          cancel_at_period_end?: boolean
          createdAt?: string
          current_period_end?: number | null
          handicapIndex?: number
          id: string
          initialHandicapIndex?: number
          name?: string | null
          plan_selected?: string | null
          plan_selected_at?: string | null
          subscription_status?: string | null
          verified?: boolean
        }
        Update: {
          billing_version?: number
          cancel_at_period_end?: boolean
          createdAt?: string
          current_period_end?: number | null
          handicapIndex?: number
          id?: string
          initialHandicapIndex?: number
          name?: string | null
          plan_selected?: string | null
          plan_selected_at?: string | null
          subscription_status?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      round: {
        Row: {
          adjustedGrossScore: number
          adjustedPlayedScore: number
          approvalStatus: string
          courseHandicap: number
          courseId: number
          createdAt: string
          exceptionalScoreAdjustment: number
          existingHandicapIndex: number
          id: number
          notes: string | null
          parPlayed: number
          scoreDifferential: number
          teeId: number
          teeTime: string
          totalStrokes: number
          updatedHandicapIndex: number
          userId: string
        }
        Insert: {
          adjustedGrossScore: number
          adjustedPlayedScore: number
          approvalStatus?: string
          courseHandicap: number
          courseId: number
          createdAt?: string
          exceptionalScoreAdjustment?: number
          existingHandicapIndex: number
          id?: number
          notes?: string | null
          parPlayed: number
          scoreDifferential: number
          teeId: number
          teeTime: string
          totalStrokes: number
          updatedHandicapIndex: number
          userId: string
        }
        Update: {
          adjustedGrossScore?: number
          adjustedPlayedScore?: number
          approvalStatus?: string
          courseHandicap?: number
          courseId?: number
          createdAt?: string
          exceptionalScoreAdjustment?: number
          existingHandicapIndex?: number
          id?: number
          notes?: string | null
          parPlayed?: number
          scoreDifferential?: number
          teeId?: number
          teeTime?: string
          totalStrokes?: number
          updatedHandicapIndex?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "course"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_teeId_fkey"
            columns: ["teeId"]
            isOneToOne: false
            referencedRelation: "teeInfo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      score: {
        Row: {
          hcpStrokes: number
          holeId: number
          id: number
          roundId: number
          strokes: number
          userId: string
        }
        Insert: {
          hcpStrokes?: number
          holeId: number
          id?: number
          roundId: number
          strokes: number
          userId: string
        }
        Update: {
          hcpStrokes?: number
          holeId?: number
          id?: number
          roundId?: number
          strokes?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_holeId_fkey"
            columns: ["holeId"]
            isOneToOne: false
            referencedRelation: "hole"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_roundId_fkey"
            columns: ["roundId"]
            isOneToOne: false
            referencedRelation: "round"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      teeInfo: {
        Row: {
          approvalStatus: string
          courseId: number
          courseRating18: number
          courseRatingBack9: number
          courseRatingFront9: number
          distanceMeasurement: string
          gender: string
          id: number
          inDistance: number
          inPar: number
          isArchived: boolean
          name: string
          outDistance: number
          outPar: number
          slopeRating18: number
          slopeRatingBack9: number
          slopeRatingFront9: number
          totalDistance: number
          totalPar: number
          version: number
        }
        Insert: {
          approvalStatus?: string
          courseId: number
          courseRating18: number
          courseRatingBack9: number
          courseRatingFront9: number
          distanceMeasurement?: string
          gender: string
          id?: number
          inDistance: number
          inPar: number
          isArchived?: boolean
          name: string
          outDistance: number
          outPar: number
          slopeRating18: number
          slopeRatingBack9: number
          slopeRatingFront9: number
          totalDistance: number
          totalPar: number
          version?: number
        }
        Update: {
          approvalStatus?: string
          courseId?: number
          courseRating18?: number
          courseRatingBack9?: number
          courseRatingFront9?: number
          distanceMeasurement?: string
          gender?: string
          id?: number
          inDistance?: number
          inPar?: number
          isArchived?: boolean
          name?: string
          outDistance?: number
          outPar?: number
          slopeRating18?: number
          slopeRatingBack9?: number
          slopeRatingFront9?: number
          totalDistance?: number
          totalPar?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teeInfo_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "course"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error_message: string | null
          event_id: string
          event_type: string
          processed_at: string
          retry_count: number
          status: string
          user_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_id: string
          event_type: string
          processed_at?: string
          retry_count?: number
          status: string
          user_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_id?: string
          event_type?: string
          processed_at?: string
          retry_count?: number
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otps: { Args: never; Returns: undefined }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_public_course_count: { Args: never; Returns: number }
      get_public_round_count: { Args: never; Returns: number }
      get_public_user_count: { Args: never; Returns: number }
      process_handicap_no_rounds: {
        Args: { max_handicap: number; queue_job_id: number; user_id: string }
        Returns: Json
      }
      process_handicap_updates: {
        Args: {
          new_handicap_index: number
          queue_job_id: number
          round_updates: Json
          user_id: string
        }
        Returns: Json
      }
      setup_handicap_queue_cron: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
