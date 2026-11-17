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
      categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          attribution_text: string | null
          attribution_url: string | null
          created_at: string
          description: string | null
          id: string
          information_reviewed_at: string | null
          legal_name: string | null
          name_normalized: string | null
          publication_status: string
          published_at: string | null
          slug: string
          trade_name: string
          updated_at: string
        }
        Insert: {
          attribution_text?: string | null
          attribution_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          information_reviewed_at?: string | null
          legal_name?: string | null
          name_normalized?: string | null
          publication_status?: string
          published_at?: string | null
          slug: string
          trade_name: string
          updated_at?: string
        }
        Update: {
          attribution_text?: string | null
          attribution_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          information_reviewed_at?: string | null
          legal_name?: string | null
          name_normalized?: string | null
          publication_status?: string
          published_at?: string | null
          slug?: string
          trade_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_branches: {
        Row: {
          attribution_text: string | null
          attribution_url: string | null
          company_id: string
          created_at: string
          id: string
          location_id: string
          name: string | null
          presence_status: string
          public_address: string | null
          publication_status: string
          updated_at: string
        }
        Insert: {
          attribution_text?: string | null
          attribution_url?: string | null
          company_id: string
          created_at?: string
          id?: string
          location_id: string
          name?: string | null
          presence_status?: string
          public_address?: string | null
          publication_status?: string
          updated_at?: string
        }
        Update: {
          attribution_text?: string | null
          attribution_url?: string | null
          company_id?: string
          created_at?: string
          id?: string
          location_id?: string
          name?: string | null
          presence_status?: string
          public_address?: string | null
          publication_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "directory_company_offerings"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_branches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          attribution_text: string | null
          attribution_url: string | null
          branch_id: string | null
          channel: string
          company_id: string
          contact_status: string
          created_at: string
          id: string
          label: string | null
          last_reviewed_at: string | null
          publication_status: string
          retired_at: string | null
          review_due_at: string | null
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          attribution_text?: string | null
          attribution_url?: string | null
          branch_id?: string | null
          channel: string
          company_id: string
          contact_status?: string
          created_at?: string
          id?: string
          label?: string | null
          last_reviewed_at?: string | null
          publication_status?: string
          retired_at?: string | null
          review_due_at?: string | null
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          attribution_text?: string | null
          attribution_url?: string | null
          branch_id?: string | null
          channel?: string
          company_id?: string
          contact_status?: string
          created_at?: string
          id?: string
          label?: string | null
          last_reviewed_at?: string | null
          publication_status?: string
          retired_at?: string | null
          review_due_at?: string | null
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_branch_id_fkey"
            columns: ["company_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "directory_company_offerings"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_offerings: {
        Row: {
          attribution_text: string | null
          attribution_url: string | null
          category_id: string
          company_id: string
          created_at: string
          id: string
          publication_status: string
          service_id: string | null
          updated_at: string
        }
        Insert: {
          attribution_text?: string | null
          attribution_url?: string | null
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          publication_status?: string
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          attribution_text?: string | null
          attribution_url?: string | null
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          publication_status?: string
          service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_offerings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_offerings_category_id_service_id_fkey"
            columns: ["category_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["category_id", "id"]
          },
          {
            foreignKeyName: "company_offerings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_offerings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "directory_company_offerings"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_url_aliases: {
        Row: {
          alias_slug: string
          created_at: string
          target_company_id: string
        }
        Insert: {
          alias_slug: string
          created_at?: string
          target_company_id: string
        }
        Update: {
          alias_slug?: string
          created_at?: string
          target_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_url_aliases_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_url_aliases_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "directory_company_offerings"
            referencedColumns: ["company_id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          default_locale: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_locale: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_locale?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      directory_markets: {
        Row: {
          code: string
          country_code: string
          created_at: string
          display_name: string
          id: string
          include_descendants: boolean
          launched_at: string | null
          location_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          display_name: string
          id?: string
          include_descendants?: boolean
          launched_at?: string | null
          location_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          display_name?: string
          id?: string
          include_descendants?: boolean
          launched_at?: string | null
          location_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_markets_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "directory_markets_country_code_location_id_fkey"
            columns: ["country_code", "location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["country_code", "id"]
          },
        ]
      }
      directory_pages: {
        Row: {
          category_id: string
          created_at: string
          id: string
          indexation_status: string
          introduction: string | null
          location_id: string | null
          market_id: string
          meta_description: string | null
          path: string
          publication_status: string
          published_at: string | null
          service_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          indexation_status?: string
          introduction?: string | null
          location_id?: string | null
          market_id: string
          meta_description?: string | null
          path: string
          publication_status?: string
          published_at?: string | null
          service_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          indexation_status?: string
          introduction?: string | null
          location_id?: string | null
          market_id?: string
          meta_description?: string | null
          path?: string
          publication_status?: string
          published_at?: string | null
          service_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_pages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_pages_category_id_service_id_fkey"
            columns: ["category_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["category_id", "id"]
          },
          {
            foreignKeyName: "directory_pages_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_pages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "directory_company_offerings"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "directory_pages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "directory_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          official_code: string | null
          parent_id: string | null
          reference_url: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          official_code?: string | null
          parent_id?: string | null
          reference_url?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          official_code?: string | null
          parent_id?: string | null
          reference_url?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "locations_country_code_parent_id_fkey"
            columns: ["country_code", "parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["country_code", "id"]
          },
        ]
      }
      offering_coverage: {
        Row: {
          attribution_text: string | null
          attribution_url: string | null
          coverage_status: string
          created_at: string
          id: string
          include_descendants: boolean
          location_id: string
          offering_id: string
          publication_status: string
          updated_at: string
        }
        Insert: {
          attribution_text?: string | null
          attribution_url?: string | null
          coverage_status: string
          created_at?: string
          id?: string
          include_descendants?: boolean
          location_id: string
          offering_id: string
          publication_status?: string
          updated_at?: string
        }
        Update: {
          attribution_text?: string | null
          attribution_url?: string | null
          coverage_status?: string
          created_at?: string
          id?: string
          include_descendants?: boolean
          location_id?: string
          offering_id?: string
          publication_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_coverage_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coverage_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "company_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coverage_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "directory_company_offerings"
            referencedColumns: ["offering_id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      directory_company_offerings: {
        Row: {
          category_id: string | null
          company_id: string | null
          company_slug: string | null
          coverage_status: string | null
          has_confirmed_coverage: boolean | null
          has_documented_presence: boolean | null
          market_code: string | null
          market_id: string | null
          offering_id: string | null
          service_id: string | null
          trade_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_offerings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_offerings_category_id_service_id_fkey"
            columns: ["category_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["category_id", "id"]
          },
        ]
      }
    }
    Functions: {
      search_directory: {
        Args: {
          p_category_id?: string
          p_confirmed_only?: boolean
          p_limit?: number
          p_market_code: string
          p_offset?: number
          p_presence_only?: boolean
          p_query?: string
          p_service_id?: string
        }
        Returns: {
          company_id: string
          company_slug: string
          has_confirmed_coverage: boolean
          has_documented_presence: boolean
          trade_name: string
        }[]
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
