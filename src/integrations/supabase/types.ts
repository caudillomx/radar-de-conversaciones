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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          batch_attempts: Json
          batches_done: number
          batches_total: number
          codebook: Json | null
          comment_count: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          locked_until: string | null
          model: string | null
          progress_at: string
          result: Json | null
          sample: Json | null
          stage: string
          status: string
          study_id: string
          synthesis: Json | null
        }
        Insert: {
          batch_attempts?: Json
          batches_done?: number
          batches_total?: number
          codebook?: Json | null
          comment_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          locked_until?: string | null
          model?: string | null
          progress_at?: string
          result?: Json | null
          sample?: Json | null
          stage?: string
          status?: string
          study_id: string
          synthesis?: Json | null
        }
        Update: {
          batch_attempts?: Json
          batches_done?: number
          batches_total?: number
          codebook?: Json | null
          comment_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          locked_until?: string | null
          model?: string | null
          progress_at?: string
          result?: Json | null
          sample?: Json | null
          stage?: string
          status?: string
          study_id?: string
          synthesis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_labels: {
        Row: {
          account_type: string | null
          age: string | null
          analysis_id: string
          comment_id: string
          country: string | null
          created_at: string
          gender: string | null
          human_sentiment: string | null
          human_stance: string | null
          id: string
          language: string | null
          narrative: string | null
          reviewed_at: string | null
          sentiment: string | null
          stance: string | null
        }
        Insert: {
          account_type?: string | null
          age?: string | null
          analysis_id: string
          comment_id: string
          country?: string | null
          created_at?: string
          gender?: string | null
          human_sentiment?: string | null
          human_stance?: string | null
          id?: string
          language?: string | null
          narrative?: string | null
          reviewed_at?: string | null
          sentiment?: string | null
          stance?: string | null
        }
        Update: {
          account_type?: string | null
          age?: string | null
          analysis_id?: string
          comment_id?: string
          country?: string | null
          created_at?: string
          gender?: string | null
          human_sentiment?: string | null
          human_stance?: string | null
          id?: string
          language?: string | null
          narrative?: string | null
          reviewed_at?: string | null
          sentiment?: string | null
          stance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_labels_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_labels_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author: string | null
          created_at: string
          external_id: string | null
          id: string
          is_reply: boolean
          likes: number
          parent_external_id: string | null
          published_at: string | null
          raw: Json | null
          source_id: string
          text: string
          url: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_reply?: boolean
          likes?: number
          parent_external_id?: string | null
          published_at?: string | null
          raw?: Json | null
          source_id: string
          text: string
          url?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_reply?: boolean
          likes?: number
          parent_external_id?: string | null
          published_at?: string | null
          raw?: Json | null
          source_id?: string
          text?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          apify_dataset_id: string | null
          apify_run_id: string | null
          comment_count: number
          created_at: string
          error: string | null
          extra_pass: boolean
          finished_at: string | null
          id: string
          include_replies: boolean
          max_comments: number
          platform: string
          post_id: string | null
          recheck_at: string | null
          rechecked: boolean
          started_at: string | null
          status: string
          study_id: string
          url: string
        }
        Insert: {
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          comment_count?: number
          created_at?: string
          error?: string | null
          extra_pass?: boolean
          finished_at?: string | null
          id?: string
          include_replies?: boolean
          max_comments?: number
          platform: string
          post_id?: string | null
          recheck_at?: string | null
          rechecked?: boolean
          started_at?: string | null
          status?: string
          study_id: string
          url: string
        }
        Update: {
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          comment_count?: number
          created_at?: string
          error?: string | null
          extra_pass?: boolean
          finished_at?: string | null
          id?: string
          include_replies?: boolean
          max_comments?: number
          platform?: string
          post_id?: string | null
          recheck_at?: string | null
          rechecked?: boolean
          started_at?: string | null
          status?: string
          study_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          client: string | null
          created_at: string
          id: string
          kind: string
          stance_target: string | null
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          id?: string
          kind?: string
          stance_target?: string | null
          title: string
          topic?: string
          updated_at?: string
        }
        Update: {
          client?: string | null
          created_at?: string
          id?: string
          kind?: string
          stance_target?: string | null
          title?: string
          topic?: string
          updated_at?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
