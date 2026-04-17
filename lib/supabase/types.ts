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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          enabled: boolean
          environment: string
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string | null
          organization_id: string
          permissions: Json | null
          prefix: string
          rate_limit_enabled: boolean
          rate_limit_max: number
          rate_limit_time_window: number
          start: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name?: string | null
          organization_id: string
          permissions?: Json | null
          prefix: string
          rate_limit_enabled?: boolean
          rate_limit_max?: number
          rate_limit_time_window?: number
          start?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string | null
          organization_id?: string
          permissions?: Json | null
          prefix?: string
          rate_limit_enabled?: boolean
          rate_limit_max?: number
          rate_limit_time_window?: number
          start?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_label_assignments: {
        Row: {
          changelog_id: string
          id: string
          label_id: string
        }
        Insert: {
          changelog_id: string
          id?: string
          label_id: string
        }
        Update: {
          changelog_id?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_label_assignments_changelog_id_fkey"
            columns: ["changelog_id"]
            isOneToOne: false
            referencedRelation: "changelogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changelog_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "changelog_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_subscriptions: {
        Row: {
          customer_id: string
          id: string
          organization_id: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          customer_id: string
          id?: string
          organization_id: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          customer_id?: string
          id?: string
          organization_id?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "changelog_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changelog_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      changelogs: {
        Row: {
          author_id: string | null
          content: Json | null
          created_at: string
          deployed_at: string | null
          id: string
          organization_id: string
          published_at: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          author_id?: string | null
          content?: Json | null
          created_at?: string
          deployed_at?: string | null
          id?: string
          organization_id: string
          published_at?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          author_id?: string | null
          content?: Json | null
          created_at?: string
          deployed_at?: string | null
          id?: string
          organization_id?: string
          published_at?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "changelogs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_media: {
        Row: {
          created_at: string
          id: string
          media_asset_id: string | null
          metadata: Json | null
          mime_type: string
          organization_id: string
          size: number
          slug: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_asset_id?: string | null
          metadata?: Json | null
          mime_type: string
          organization_id: string
          size: number
          slug: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_asset_id?: string | null
          metadata?: Json | null
          mime_type?: string
          organization_id?: string
          size?: number
          slug?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_types: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          schema: Json
          slug: string
          status: Database["public"]["Enums"]["content_type_status"] | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          schema?: Json
          slug: string
          status?: Database["public"]["Enums"]["content_type_status"] | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          schema?: Json
          slug?: string
          status?: Database["public"]["Enums"]["content_type_status"] | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          name: string | null
          organization_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          organization_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          content_type_id: string
          created_at: string
          data: Json
          id: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["entry_status"] | null
          updated_at: string
        }
        Insert: {
          content_type_id: string
          created_at?: string
          data?: Json
          id?: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["entry_status"] | null
          updated_at?: string
        }
        Update: {
          content_type_id?: string
          created_at?: string
          data?: Json
          id?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["entry_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_relations: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          organization_id: string
          type: string
          value: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          organization_id: string
          type: string
          value: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          organization_id?: string
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_relations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_relations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          environment: string
          id: string
          key: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          environment?: string
          id?: string
          key: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          environment?: string
          id?: string
          key?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      global_configs: {
        Row: {
          created_at: string
          data: Json
          description: string | null
          environment: string
          id: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          description?: string | null
          environment?: string
          id?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          description?: string | null
          environment?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          inviter_id: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          inviter_id: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kv_sync_retries: {
        Row: {
          attempts: number
          created_at: string
          id: string
          key: string
          last_error: string | null
          operation: string
          payload: Json | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          key: string
          last_error?: string | null
          operation: string
          payload?: Json | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          key?: string
          last_error?: string | null
          operation?: string
          payload?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          created_at: string
          folder: string
          id: string
          key: string
          mime_type: string
          name: string
          organization_id: string
          size: number
          type: string
          updated_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          folder?: string
          id?: string
          key: string
          mime_type: string
          name: string
          organization_id: string
          size: number
          type: string
          updated_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          folder?: string
          id?: string
          key?: string
          mime_type?: string
          name?: string
          organization_id?: string
          size?: number
          type?: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          parent_path: string
          path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          parent_path?: string
          path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_path?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          metadata: Json | null
          organization_id: string | null
          paid_at: string | null
          polar_customer_id: string
          polar_order_id: string
          product_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          metadata?: Json | null
          organization_id?: string | null
          paid_at?: string | null
          polar_customer_id: string
          polar_order_id: string
          product_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          metadata?: Json | null
          organization_id?: string | null
          paid_at?: string | null
          polar_customer_id?: string
          polar_order_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_polar_customer_id_fkey"
            columns: ["polar_customer_id"]
            isOneToOne: false
            referencedRelation: "polar_customers"
            referencedColumns: ["polar_customer_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo: string | null
          metadata: Json | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo?: string | null
          metadata?: Json | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo?: string | null
          metadata?: Json | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      polar_customers: {
        Row: {
          created_at: string
          organization_id: string | null
          polar_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id?: string | null
          polar_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string | null
          polar_customer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polar_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_organization_id: string | null
          created_at: string
          display_username: string | null
          email: string
          id: string
          image: string | null
          is_super_admin: boolean
          name: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string
          display_username?: string | null
          email: string
          id: string
          image?: string | null
          is_super_admin?: boolean
          name?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string
          display_username?: string | null
          email?: string
          id?: string
          image?: string | null
          is_super_admin?: boolean
          name?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          changes: Json
          content_type_id: string
          created_at: string
          from_version: number
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["schema_migration_status"] | null
          to_version: number
        }
        Insert: {
          changes: Json
          content_type_id: string
          created_at?: string
          from_version: number
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["schema_migration_status"] | null
          to_version: number
        }
        Update: {
          changes?: Json
          content_type_id?: string
          created_at?: string
          from_version?: number
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["schema_migration_status"] | null
          to_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "schema_migrations_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schema_migrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          metadata: Json | null
          organization_id: string | null
          polar_customer_id: string
          polar_subscription_id: string
          product_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          metadata?: Json | null
          organization_id?: string | null
          polar_customer_id: string
          polar_subscription_id: string
          product_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          metadata?: Json | null
          organization_id?: string | null
          polar_customer_id?: string
          polar_subscription_id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_polar_customer_id_fkey"
            columns: ["polar_customer_id"]
            isOneToOne: false
            referencedRelation: "polar_customers"
            referencedColumns: ["polar_customer_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organization_id: { Args: never; Returns: string }
      current_organization_role: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_member_of: { Args: { org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      content_type_status: "draft" | "active" | "deprecated"
      entry_status: "draft" | "published" | "archived"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      member_role: "owner" | "admin" | "member"
      schema_migration_status: "pending" | "done" | "error"
      subscription_status:
        | "incomplete"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
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
      content_type_status: ["draft", "active", "deprecated"],
      entry_status: ["draft", "published", "archived"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      member_role: ["owner", "admin", "member"],
      schema_migration_status: ["pending", "done", "error"],
      subscription_status: [
        "incomplete",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
  },
} as const
