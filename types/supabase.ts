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
      Course: {
        Row: {
          id: number
          isApproved: boolean
          name: string
        }
        Insert: {
          id?: number
          isApproved?: boolean
          name: string
        }
        Update: {
          id?: number
          isApproved?: boolean
          name?: string
        }
        Relationships: []
      }
      Hole: {
        Row: {
          hcp: number
          holeNumber: number
          id: number
          length: number
          par: number
          teeId: number
        }
        Insert: {
          hcp: number
          holeNumber: number
          id?: number
          length: number
          par: number
          teeId: number
        }
        Update: {
          hcp?: number
          holeNumber?: number
          id?: number
          length?: number
          par?: number
          teeId?: number
        }
        Relationships: [
          {
            foreignKeyName: "Hole_teeId_fkey"
            columns: ["teeId"]
            isOneToOne: false
            referencedRelation: "TeeInfo"
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
          verified: boolean
        }
        Insert: {
          email: string
          handicapIndex: number
          id: string
          name?: string | null
          verified?: boolean
        }
        Update: {
          email?: string
          handicapIndex?: number
          id?: string
          name?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      Round: {
        Row: {
          adjustedGrossScore: number
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
          updatedHandicapIndex?: number
          userId: string
        }
        Update: {
          adjustedGrossScore?: number
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
            foreignKeyName: "Round_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Round_teeId_fkey"
            columns: ["teeId"]
            isOneToOne: false
            referencedRelation: "TeeInfo"
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
      Score: {
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
            foreignKeyName: "Score_holeId_fkey"
            columns: ["holeId"]
            isOneToOne: false
            referencedRelation: "Hole"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Score_roundId_fkey"
            columns: ["roundId"]
            isOneToOne: false
            referencedRelation: "Round"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Score_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "Profile"
            referencedColumns: ["id"]
          },
        ]
      }
      TeeInfo: {
        Row: {
          courseId: number
          courseRating: number
          distanceMeasurement: string
          distances: number[]
          gender: string
          handicaps: number[]
          id: number
          inDistance: number
          inPar: number
          isApproved: boolean
          isArchived: boolean
          name: string
          outDistance: number
          outPar: number
          pars: number[]
          slopeRating: number
          totalDistance: number
          totalPar: number
          version: number
        }
        Insert: {
          courseId: number
          courseRating: number
          distanceMeasurement: string
          distances: number[]
          gender: string
          handicaps: number[]
          id?: number
          inDistance: number
          inPar: number
          isApproved?: boolean
          isArchived?: boolean
          name: string
          outDistance: number
          outPar: number
          pars: number[]
          slopeRating: number
          totalDistance: number
          totalPar: number
          version?: number
        }
        Update: {
          courseId?: number
          courseRating?: number
          distanceMeasurement?: string
          distances?: number[]
          gender?: string
          handicaps?: number[]
          id?: number
          inDistance?: number
          inPar?: number
          isApproved?: boolean
          isArchived?: boolean
          name?: string
          outDistance?: number
          outPar?: number
          pars?: number[]
          slopeRating?: number
          totalDistance?: number
          totalPar?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "TeeInfo_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
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

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
