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
          country: string
          id: number
          name: string
          website: string | null
        }
        Insert: {
          approvalStatus?: string
          country?: string
          id?: number
          name: string
          website?: string | null
        }
        Update: {
          approvalStatus?: string
          country?: string
          id?: number
          name?: string
          website?: string | null
        }
        Relationships: []
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
      profile: {
        Row: {
          createdAt: string
          email: string
          handicapIndex: number
          id: string
          initialHandicapIndex: number
          name: string | null
          verified: boolean
        }
        Insert: {
          createdAt?: string
          email: string
          handicapIndex?: number
          id: string
          initialHandicapIndex?: number
          name?: string | null
          verified?: boolean
        }
        Update: {
          createdAt?: string
          email?: string
          handicapIndex?: number
          id?: string
          initialHandicapIndex?: number
          name?: string | null
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
      trigger_debug_log: {
        Row: {
          approval_status: string | null
          created_at: string | null
          http_post_result: Json | null
          id: number
          op: string
          payload: Json | null
          round_id: number | null
          service_role_key_prefix: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string | null
          created_at?: string | null
          http_post_result?: Json | null
          id?: number
          op: string
          payload?: Json | null
          round_id?: number | null
          service_role_key_prefix?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string | null
          created_at?: string | null
          http_post_result?: Json | null
          id?: number
          op?: string
          payload?: Json | null
          round_id?: number | null
          service_role_key_prefix?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
