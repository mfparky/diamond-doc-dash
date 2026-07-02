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
      dashboard_settings: {
        Row: {
          achievement_from: string | null
          achievement_to: string | null
          created_at: string
          id: string
          leaderboard_from: string | null
          leaderboard_to: string | null
          updated_at: string
          user_id: string
          workouts_enabled: boolean
        }
        Insert: {
          achievement_from?: string | null
          achievement_to?: string | null
          created_at?: string
          id?: string
          leaderboard_from?: string | null
          leaderboard_to?: string | null
          updated_at?: string
          user_id: string
          workouts_enabled?: boolean
        }
        Update: {
          achievement_from?: string | null
          achievement_to?: string | null
          created_at?: string
          id?: string
          leaderboard_from?: string | null
          leaderboard_to?: string | null
          updated_at?: string
          user_id?: string
          workouts_enabled?: boolean
        }
        Relationships: []
      }
      game_pitches: {
        Row: {
          created_at: string
          game_id: string
          id: string
          inning: number
          is_opponent: boolean
          is_strike: boolean
          opponent_jersey: string | null
          outcome: string | null
          pitcher_id: string | null
          pitcher_name: string
          sequence: number
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          inning?: number
          is_opponent?: boolean
          is_strike: boolean
          opponent_jersey?: string | null
          outcome?: string | null
          pitcher_id?: string | null
          pitcher_name: string
          sequence: number
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          inning?: number
          is_opponent?: boolean
          is_strike?: boolean
          opponent_jersey?: string | null
          outcome?: string | null
          pitcher_id?: string | null
          pitcher_name?: string
          sequence?: number
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          opponent_name: string | null
          status: string
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          opponent_name?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          opponent_name?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lineups: {
        Row: {
          id: string
          user_id: string
          date: string
          batting_order: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          batting_order?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          batting_order?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      outings: {
        Row: {
          coach_notes: string | null
          created_at: string
          date: string
          event_type: string
          focus: string | null
          game_id: string | null
          id: string
          max_velocity: number | null
          notes: string | null
          pitch_count: number
          pitcher_id: string
          pitcher_name: string
          strikes: number | null
          team_id: string | null
          user_id: string | null
          video_1_pitch_type: number | null
          video_1_velocity: number | null
          video_2_pitch_type: number | null
          video_2_velocity: number | null
          video_url: string | null
          video_url_1: string | null
          video_url_2: string | null
        }
        Insert: {
          coach_notes?: string | null
          created_at?: string
          date: string
          event_type: string
          focus?: string | null
          game_id?: string | null
          id?: string
          max_velocity?: number | null
          notes?: string | null
          pitch_count: number
          pitcher_id: string
          pitcher_name: string
          strikes?: number | null
          team_id?: string | null
          user_id?: string | null
          video_1_pitch_type?: number | null
          video_1_velocity?: number | null
          video_2_pitch_type?: number | null
          video_2_velocity?: number | null
          video_url?: string | null
          video_url_1?: string | null
          video_url_2?: string | null
        }
        Update: {
          coach_notes?: string | null
          created_at?: string
          date?: string
          event_type?: string
          focus?: string | null
          game_id?: string | null
          id?: string
          max_velocity?: number | null
          notes?: string | null
          pitch_count?: number
          pitcher_id?: string
          pitcher_name?: string
          strikes?: number | null
          team_id?: string | null
          user_id?: string | null
          video_1_pitch_type?: number | null
          video_1_velocity?: number | null
          video_2_pitch_type?: number | null
          video_2_velocity?: number | null
          video_url?: string | null
          video_url_1?: string | null
          video_url_2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_locations: {
        Row: {
          created_at: string
          id: string
          is_strike: boolean
          outing_id: string
          pitch_number: number
          pitch_type: number
          pitcher_id: string
          team_id: string | null
          user_id: string | null
          x_location: number
          y_location: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_strike?: boolean
          outing_id: string
          pitch_number: number
          pitch_type: number
          pitcher_id: string
          team_id?: string | null
          user_id?: string | null
          x_location: number
          y_location: number
        }
        Update: {
          created_at?: string
          id?: string
          is_strike?: boolean
          outing_id?: string
          pitch_number?: number
          pitch_type?: number
          pitcher_id?: string
          team_id?: string | null
          user_id?: string | null
          x_location?: number
          y_location?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitch_locations_outing_id_fkey"
            columns: ["outing_id"]
            isOneToOne: false
            referencedRelation: "outings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_locations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pitcher_stat_snapshots: {
        Row: {
          id: string
          pitcher_id: string
          source_filename: string | null
          stats: Json
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          pitcher_id: string
          source_filename?: string | null
          stats?: Json
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          pitcher_id?: string
          source_filename?: string | null
          stats?: Json
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitcher_stat_snapshots_pitcher_id_fkey"
            columns: ["pitcher_id"]
            isOneToOne: false
            referencedRelation: "pitchers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          id: string
          user_id: string
          pitcher_id: string
          period_start: string
          period_end: string
          coach_context: string | null
          narrative_summary: string | null
          narrative_strengths: string | null
          narrative_areas: string | null
          snapshot_id: string | null
          metric_adjustments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pitcher_id: string
          period_start: string
          period_end: string
          coach_context?: string | null
          narrative_summary?: string | null
          narrative_strengths?: string | null
          narrative_areas?: string | null
          snapshot_id?: string | null
          metric_adjustments?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          pitcher_id?: string
          period_start?: string
          period_end?: string
          coach_context?: string | null
          narrative_summary?: string | null
          narrative_strengths?: string | null
          narrative_areas?: string | null
          snapshot_id?: string | null
          metric_adjustments?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_pitcher_id_fkey"
            columns: ["pitcher_id"]
            isOneToOne: false
            referencedRelation: "pitchers"
            referencedColumns: ["id"]
          },
        ]
      }
      pitchers: {
        Row: {
          baseball_iq_rating: string | null
          coachability_rating: string | null
          created_at: string
          effort_rating: string | null
          id: string
          max_weekly_pitches: number
          name: string
          pitch_types: Json | null
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          baseball_iq_rating?: string | null
          coachability_rating?: string | null
          created_at?: string
          effort_rating?: string | null
          id?: string
          max_weekly_pitches?: number
          name: string
          pitch_types?: Json | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          baseball_iq_rating?: string | null
          coachability_rating?: string | null
          created_at?: string
          effort_rating?: string | null
          id?: string
          max_weekly_pitches?: number
          name?: string
          pitch_types?: Json | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitchers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          achievement_from: string | null
          achievement_to: string | null
          created_at: string
          design_system: string | null
          id: string
          join_code: string
          leaderboard_from: string | null
          leaderboard_to: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          achievement_from?: string | null
          achievement_to?: string | null
          created_at?: string
          design_system?: string | null
          id?: string
          join_code?: string
          leaderboard_from?: string | null
          leaderboard_to?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          achievement_from?: string | null
          achievement_to?: string | null
          created_at?: string
          design_system?: string | null
          id?: string
          join_code?: string
          leaderboard_from?: string | null
          leaderboard_to?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_approvals: {
        Row: {
          approved_at: string | null
          created_at: string
          email: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          email: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          email?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_assignments: {
        Row: {
          attachment_url: string | null
          created_at: string
          description: string | null
          double_points: boolean
          expires_at: string | null
          frequency: number
          id: string
          is_catch_up: boolean
          pitcher_id: string
          requires_photo: boolean
          team_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          double_points?: boolean
          expires_at?: string | null
          frequency?: number
          id?: string
          is_catch_up?: boolean
          pitcher_id: string
          requires_photo?: boolean
          team_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          double_points?: boolean
          expires_at?: string | null
          frequency?: number
          id?: string
          is_catch_up?: boolean
          pitcher_id?: string
          requires_photo?: boolean
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_assignments_pitcher_id_fkey"
            columns: ["pitcher_id"]
            isOneToOne: false
            referencedRelation: "pitchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_completions: {
        Row: {
          assignment_id: string
          created_at: string
          day_of_week: number
          id: string
          notes: string | null
          photo_url: string | null
          pitcher_id: string
          week_start: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          day_of_week: number
          id?: string
          notes?: string | null
          photo_url?: string | null
          pitcher_id: string
          week_start: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          notes?: string | null
          photo_url?: string | null
          pitcher_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "workout_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_completions_pitcher_id_fkey"
            columns: ["pitcher_id"]
            isOneToOne: false
            referencedRelation: "pitchers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
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
