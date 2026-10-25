export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      client_packages: {
        Row: {
          client_id: string;
          created_at: string;
          end_date: string;
          id: string;
          plan_id: string;
          plan_name_snapshot: string;
          posts_total: number;
          request_id: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["package_status"];
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          end_date: string;
          id?: string;
          plan_id: string;
          plan_name_snapshot: string;
          posts_total: number;
          request_id?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["package_status"];
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          end_date?: string;
          id?: string;
          plan_id?: string;
          plan_name_snapshot?: string;
          posts_total?: number;
          request_id?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["package_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_packages_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_packages_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          archived_at: string | null;
          business_name: string;
          created_at: string;
          display_name: string;
          email: string;
          id: string;
          phone: string;
          profession: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          business_name: string;
          created_at?: string;
          display_name: string;
          email: string;
          id?: string;
          phone?: string;
          profession?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          business_name?: string;
          created_at?: string;
          display_name?: string;
          email?: string;
          id?: string;
          phone?: string;
          profession?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      internal_notes: {
        Row: {
          body: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          post_id: string | null;
        };
        Insert: {
          body: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          post_id?: string | null;
        };
        Update: {
          body?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          post_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "internal_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internal_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internal_notes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          created_at: string;
          default_times: string[];
          default_weekdays: number[];
          id: string;
          name: string;
          period_days: number;
          posts_per_period: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          default_times?: string[];
          default_weekdays?: number[];
          id?: string;
          name: string;
          period_days: number;
          posts_per_period: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          default_times?: string[];
          default_weekdays?: number[];
          id?: string;
          name?: string;
          period_days?: number;
          posts_per_period?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_events: {
        Row: {
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          client_id: string;
          created_at: string;
          detail: Json;
          id: number;
          kind: string;
          post_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          client_id: string;
          created_at?: string;
          detail?: Json;
          id?: never;
          kind: string;
          post_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          client_id?: string;
          created_at?: string;
          detail?: Json;
          id?: never;
          kind?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_events_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_media: {
        Row: {
          created_at: string;
          height: number;
          id: string;
          position: number;
          post_id: string;
          storage_path: string;
          width: number;
        };
        Insert: {
          created_at?: string;
          height: number;
          id?: string;
          position: number;
          post_id: string;
          storage_path: string;
          width: number;
        };
        Update: {
          created_at?: string;
          height?: number;
          id?: string;
          position?: number;
          post_id?: string;
          storage_path?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          caption: string | null;
          client_id: string;
          client_package_id: string;
          created_at: string;
          format: Database["public"]["Enums"]["post_format"];
          id: string;
          published_at: string | null;
          published_by: Database["public"]["Enums"]["publisher"] | null;
          published_by_user: string | null;
          scheduled_date: string;
          scheduled_time: string;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          caption?: string | null;
          client_id: string;
          client_package_id: string;
          created_at?: string;
          format?: Database["public"]["Enums"]["post_format"];
          id?: string;
          published_at?: string | null;
          published_by?: Database["public"]["Enums"]["publisher"] | null;
          published_by_user?: string | null;
          scheduled_date: string;
          scheduled_time: string;
          status?: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          caption?: string | null;
          client_id?: string;
          client_package_id?: string;
          created_at?: string;
          format?: Database["public"]["Enums"]["post_format"];
          id?: string;
          published_at?: string | null;
          published_by?: Database["public"]["Enums"]["publisher"] | null;
          published_by_user?: string | null;
          scheduled_date?: string;
          scheduled_time?: string;
          status?: Database["public"]["Enums"]["post_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_client_package_id_client_id_fkey";
            columns: ["client_package_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "client_packages";
            referencedColumns: ["id", "client_id"];
          },
          {
            foreignKeyName: "posts_published_by_user_fkey";
            columns: ["published_by_user"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          blocked_at: string | null;
          created_at: string;
          full_name: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          blocked_at?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          blocked_at?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_post_status: {
        Args: {
          p_post_id: string;
          p_status: Database["public"]["Enums"]["post_status"];
        };
        Returns: {
          caption: string | null;
          client_id: string;
          client_package_id: string;
          created_at: string;
          format: Database["public"]["Enums"]["post_format"];
          id: string;
          published_at: string | null;
          published_by: Database["public"]["Enums"]["publisher"] | null;
          published_by_user: string | null;
          scheduled_date: string;
          scheduled_time: string;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "posts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assign_plan: {
        Args: {
          p_client_id: string;
          p_plan_id: string;
          p_request_id: string;
          p_slots: Json;
          p_start_date: string;
        };
        Returns: {
          client_id: string;
          created_at: string;
          end_date: string;
          id: string;
          plan_id: string;
          plan_name_snapshot: string;
          posts_total: number;
          request_id: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["package_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "client_packages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_client_id: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      log_post_event: {
        Args: {
          p_client_id: string;
          p_detail: Json;
          p_kind: string;
          p_post_id: string;
        };
        Returns: undefined;
      };
      reorder_post_media: {
        Args: { p_media_ids: string[]; p_post_id: string };
        Returns: {
          created_at: string;
          height: number;
          id: string;
          position: number;
          post_id: string;
          storage_path: string;
          width: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "post_media";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_post_published: {
        Args: { p_post_id: string; p_published: boolean };
        Returns: {
          caption: string | null;
          client_id: string;
          client_package_id: string;
          created_at: string;
          format: Database["public"]["Enums"]["post_format"];
          id: string;
          published_at: string | null;
          published_by: Database["public"]["Enums"]["publisher"] | null;
          published_by_user: string | null;
          scheduled_date: string;
          scheduled_time: string;
          status: Database["public"]["Enums"]["post_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "posts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "admin" | "client";
      package_status: "active" | "ended" | "cancelled";
      post_format: "single" | "carousel";
      post_status: "draft" | "ready" | "published";
      publisher: "client" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "client"],
      package_status: ["active", "ended", "cancelled"],
      post_format: ["single", "carousel"],
      post_status: ["draft", "ready", "published"],
      publisher: ["client", "admin"],
    },
  },
} as const;
