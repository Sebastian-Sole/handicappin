export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      Course: {
        Row: {
          courseRating: number
          eighteenHolePar: number
          id: number
          name: string
          nineHolePar: number
          slopeRating: number
        }
        Insert: {
          courseRating: number
          eighteenHolePar: number
          id?: number
          name: string
          nineHolePar: number
          slopeRating: number
        }
        Update: {
          courseRating?: number
          eighteenHolePar?: number
          id?: number
          name?: string
          nineHolePar?: number
          slopeRating?: number
        }
        Relationships: []
      }
      Hole: {
        Row: {
          hcp: number
          holeNumber: number
          id: number
          par: number
          roundId: number
          strokes: number
          userId: string
        }
        Insert: {
          hcp: number
          holeNumber: number
          id?: number
          par: number
          roundId: number
          strokes: number
          userId: string
        }
        Update: {
          hcp?: number
          holeNumber?: number
          id?: number
          par?: number
          roundId?: number
          strokes?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Hole_roundId_fkey"
            columns: ["roundId"]
            isOneToOne: false
            referencedRelation: "Round"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Hole_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      Profile: {
        Row: {
          email: string
          handicapIndex: number
          id: string
          name: string | null
        }
        Insert: {
          email: string
          handicapIndex: number
          id: string
          name?: string | null
        }
        Update: {
          email?: string
          handicapIndex?: number
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      Round: {
        Row: {
          adjustedGrossScore: number
          courseId: number
          createdAt: string
          existingHandicapIndex: number
          id: number
          notes: string | null
          parPlayed: number
          scoreDifferential: number
          teeTime: string
          totalStrokes: number
          updatedHandicapIndex: number
          userId: string
        }
        Insert: {
          adjustedGrossScore: number
          courseId: number
          createdAt?: string
          existingHandicapIndex: number
          id?: number
          notes?: string | null
          parPlayed: number
          scoreDifferential: number
          teeTime: string
          totalStrokes: number
          updatedHandicapIndex?: number
          userId: string
        }
        Update: {
          adjustedGrossScore?: number
          courseId?: number
          createdAt?: string
          existingHandicapIndex?: number
          id?: number
          notes?: string | null
          parPlayed?: number
          scoreDifferential?: number
          teeTime?: string
          totalStrokes?: number
          updatedHandicapIndex?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Round_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Round_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
