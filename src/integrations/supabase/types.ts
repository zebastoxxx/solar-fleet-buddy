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
      alerts: {
        Row: {
          created_at: string | null
          id: string
          machine_id: string | null
          message: string
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          machine_id?: string | null
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          severity: string
          tenant_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          machine_id?: string | null
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "alerts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string | null
          tax_id: string | null
          tenant_id: string
          type: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          tax_id?: string | null
          tenant_id: string
          type?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          tax_id?: string | null
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          amount: number
          category_id: string | null
          cost_date: string
          cost_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          entry_type: string | null
          id: string
          imported_from: string | null
          invoice_number: string | null
          invoice_url: string | null
          machine_id: string | null
          notes: string | null
          project_id: string | null
          source: string
          source_id: string | null
          supplier_id: string | null
          tenant_id: string
          work_order_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          cost_date: string
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entry_type?: string | null
          id?: string
          imported_from?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          machine_id?: string | null
          notes?: string | null
          project_id?: string | null
          source: string
          source_id?: string | null
          supplier_id?: string | null
          tenant_id: string
          work_order_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          cost_date?: string
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entry_type?: string | null
          id?: string
          imported_from?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          machine_id?: string | null
          notes?: string | null
          project_id?: string | null
          source?: string
          source_id?: string | null
          supplier_id?: string | null
          tenant_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "cost_entries_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_acts: {
        Row: {
          act_type: string
          delivered_at: string | null
          id: string
          items: Json
          kit_id: string | null
          notes: string | null
          personnel_id: string | null
          received_at: string | null
          signature_delivery_url: string | null
          signature_receipt_url: string | null
          tenant_id: string
          work_order_id: string | null
        }
        Insert: {
          act_type: string
          delivered_at?: string | null
          id?: string
          items: Json
          kit_id?: string | null
          notes?: string | null
          personnel_id?: string | null
          received_at?: string | null
          signature_delivery_url?: string | null
          signature_receipt_url?: string | null
          tenant_id: string
          work_order_id?: string | null
        }
        Update: {
          act_type?: string
          delivered_at?: string | null
          id?: string
          items?: Json
          kit_id?: string | null
          notes?: string | null
          personnel_id?: string | null
          received_at?: string | null
          signature_delivery_url?: string | null
          signature_receipt_url?: string | null
          tenant_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_acts_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "inventory_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_acts_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_acts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_acts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          tenant_id: string
          type: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_consumables: {
        Row: {
          active: boolean | null
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string | null
          id: string
          name: string
          stock_current: number | null
          stock_minimum: number | null
          supplier_id: string | null
          tenant_id: string
          unit: string
          unit_cost: number | null
        }
        Insert: {
          active?: boolean | null
          category: Database["public"]["Enums"]["inventory_category"]
          created_at?: string | null
          id?: string
          name: string
          stock_current?: number | null
          stock_minimum?: number | null
          supplier_id?: string | null
          tenant_id: string
          unit: string
          unit_cost?: number | null
        }
        Update: {
          active?: boolean | null
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string | null
          id?: string
          name?: string
          stock_current?: number | null
          stock_minimum?: number | null
          supplier_id?: string | null
          tenant_id?: string
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_consumables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_kit_items: {
        Row: {
          consumable_id: string | null
          id: string
          is_returnable: boolean | null
          item_type: string
          kit_id: string | null
          quantity: number
          tool_id: string | null
        }
        Insert: {
          consumable_id?: string | null
          id?: string
          is_returnable?: boolean | null
          item_type: string
          kit_id?: string | null
          quantity: number
          tool_id?: string | null
        }
        Update: {
          consumable_id?: string | null
          id?: string
          is_returnable?: boolean | null
          item_type?: string
          kit_id?: string | null
          quantity?: number
          tool_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_kit_items_consumable_id_fkey"
            columns: ["consumable_id"]
            isOneToOne: false
            referencedRelation: "inventory_consumables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "inventory_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_kit_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "inventory_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_kits: {
        Row: {
          created_at: string | null
          id: string
          machine_id: string | null
          name: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          machine_id?: string | null
          name: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          machine_id?: string | null
          name?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_kits_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "inventory_kits_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_kits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          item_type: string
          movement_type: string
          quantity: number
          reason: string | null
          registered_by: string
          related_ot_id: string | null
          related_project_id: string | null
          tenant_id: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          item_type: string
          movement_type: string
          quantity: number
          reason?: string | null
          registered_by: string
          related_ot_id?: string | null
          related_project_id?: string | null
          tenant_id: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          item_type?: string
          movement_type?: string
          quantity?: number
          reason?: string | null
          registered_by?: string
          related_ot_id?: string | null
          related_project_id?: string | null
          tenant_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_related_ot_id_fkey"
            columns: ["related_ot_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inventory_movements_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_tools: {
        Row: {
          assigned_to_ot: string | null
          assigned_to_person: string | null
          category: string | null
          created_at: string | null
          id: string
          internal_code: string | null
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["tool_status"] | null
          tenant_id: string
        }
        Insert: {
          assigned_to_ot?: string | null
          assigned_to_person?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          internal_code?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["tool_status"] | null
          tenant_id: string
        }
        Update: {
          assigned_to_ot?: string | null
          assigned_to_person?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          internal_code?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["tool_status"] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_tools_assigned_to_ot_fkey"
            columns: ["assigned_to_ot"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_tools_assigned_to_person_fkey"
            columns: ["assigned_to_person"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_tools_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_conditions: {
        Row: {
          condition_pct: number | null
          id: string
          item_name: string
          last_updated: string | null
          machine_id: string | null
          updated_by: string | null
        }
        Insert: {
          condition_pct?: number | null
          id?: string
          item_name: string
          last_updated?: string | null
          machine_id?: string | null
          updated_by?: string | null
        }
        Update: {
          condition_pct?: number | null
          id?: string
          item_name?: string
          last_updated?: string | null
          machine_id?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_conditions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_conditions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_conditions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_documents: {
        Row: {
          doc_type: string | null
          expiry_date: string | null
          file_url: string
          id: string
          machine_id: string | null
          name: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          doc_type?: string | null
          expiry_date?: string | null
          file_url: string
          id?: string
          machine_id?: string | null
          name: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          doc_type?: string | null
          expiry_date?: string | null
          file_url?: string
          id?: string
          machine_id?: string | null
          name?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_documents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_documents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_maintenance_alerts: {
        Row: {
          active: boolean | null
          alert_name: string
          calendar_interval_days: number | null
          created_at: string | null
          horometer_interval: number | null
          id: string
          last_triggered_at: string | null
          machine_id: string
          next_trigger_value: number | null
          start_date: string | null
          tenant_id: string
          trigger_type: string
        }
        Insert: {
          active?: boolean | null
          alert_name: string
          calendar_interval_days?: number | null
          created_at?: string | null
          horometer_interval?: number | null
          id?: string
          last_triggered_at?: string | null
          machine_id: string
          next_trigger_value?: number | null
          start_date?: string | null
          tenant_id: string
          trigger_type?: string
        }
        Update: {
          active?: boolean | null
          alert_name?: string
          calendar_interval_days?: number | null
          created_at?: string | null
          horometer_interval?: number | null
          id?: string
          last_triggered_at?: string | null
          machine_id?: string
          next_trigger_value?: number | null
          start_date?: string | null
          tenant_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_maintenance_alerts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machine_maintenance_alerts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_maintenance_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          active: boolean | null
          brand: string | null
          cover_photo_url: string | null
          created_at: string | null
          current_project_id: string | null
          engine_model: string | null
          fuel_type: string | null
          horometer_current: number | null
          id: string
          internal_code: string
          max_capacity: string | null
          max_height: string | null
          model: string | null
          monthly_cost_estimate: number | null
          name: string
          notes: string | null
          plate_number: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["machine_status"] | null
          tenant_id: string
          type: Database["public"]["Enums"]["machine_type"]
          weight_kg: number | null
          year: number | null
        }
        Insert: {
          active?: boolean | null
          brand?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          current_project_id?: string | null
          engine_model?: string | null
          fuel_type?: string | null
          horometer_current?: number | null
          id?: string
          internal_code: string
          max_capacity?: string | null
          max_height?: string | null
          model?: string | null
          monthly_cost_estimate?: number | null
          name: string
          notes?: string | null
          plate_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["machine_status"] | null
          tenant_id: string
          type: Database["public"]["Enums"]["machine_type"]
          weight_kg?: number | null
          year?: number | null
        }
        Update: {
          active?: boolean | null
          brand?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          current_project_id?: string | null
          engine_model?: string | null
          fuel_type?: string | null
          horometer_current?: number | null
          id?: string
          internal_code?: string
          max_capacity?: string | null
          max_height?: string | null
          model?: string | null
          monthly_cost_estimate?: number | null
          name?: string
          notes?: string | null
          plate_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["machine_status"] | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["machine_type"]
          weight_kg?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "machines_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel: {
        Row: {
          certifications: Json | null
          contract_type: string
          created_at: string | null
          email: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          id_number: string | null
          monthly_salary: number | null
          notes: string | null
          phone: string | null
          specialty: string | null
          status: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["personnel_type"]
          user_id: string | null
        }
        Insert: {
          certifications?: Json | null
          contract_type?: string
          created_at?: string | null
          email?: string | null
          full_name: string
          hourly_rate?: number | null
          id?: string
          id_number?: string | null
          monthly_salary?: number | null
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          status?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["personnel_type"]
          user_id?: string | null
        }
        Update: {
          certifications?: Json | null
          contract_type?: string
          created_at?: string | null
          email?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          id_number?: string | null
          monthly_salary?: number | null
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          status?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["personnel_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      preop_items: {
        Row: {
          id: string
          is_critical: boolean | null
          item_label: string
          observation: string | null
          record_id: string | null
          result: string
          section: string
        }
        Insert: {
          id?: string
          is_critical?: boolean | null
          item_label: string
          observation?: string | null
          record_id?: string | null
          result: string
          section: string
        }
        Update: {
          id?: string
          is_critical?: boolean | null
          item_label?: string
          observation?: string | null
          record_id?: string | null
          result?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "preop_items_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "preop_records"
            referencedColumns: ["id"]
          },
        ]
      }
      preop_records: {
        Row: {
          created_at: string | null
          critical_failures_count: number | null
          digital_signature_url: string | null
          has_critical_failures: boolean | null
          horometer_value: number
          hours_worked: number | null
          id: string
          machine_id: string | null
          machine_status_at_close: string | null
          observations: string | null
          offline_created: boolean | null
          operator_id: string | null
          project_id: string | null
          record_type: string
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          critical_failures_count?: number | null
          digital_signature_url?: string | null
          has_critical_failures?: boolean | null
          horometer_value: number
          hours_worked?: number | null
          id?: string
          machine_id?: string | null
          machine_status_at_close?: string | null
          observations?: string | null
          offline_created?: boolean | null
          operator_id?: string | null
          project_id?: string | null
          record_type: string
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          critical_failures_count?: number | null
          digital_signature_url?: string | null
          has_critical_failures?: boolean | null
          horometer_value?: number
          hours_worked?: number | null
          id?: string
          machine_id?: string | null
          machine_status_at_close?: string | null
          observations?: string | null
          offline_created?: boolean | null
          operator_id?: string | null
          project_id?: string | null
          record_type?: string
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preop_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "preop_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preop_records_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preop_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "preop_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preop_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_machines: {
        Row: {
          assigned_date: string | null
          id: string
          machine_id: string | null
          notes: string | null
          project_id: string | null
          removed_date: string | null
        }
        Insert: {
          assigned_date?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          project_id?: string | null
          removed_date?: string | null
        }
        Update: {
          assigned_date?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          project_id?: string | null
          removed_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "project_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_machines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_machines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_personnel: {
        Row: {
          end_date: string | null
          id: string
          personnel_id: string | null
          project_id: string | null
          role_in_project: string | null
          start_date: string | null
        }
        Insert: {
          end_date?: string | null
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          role_in_project?: string | null
          start_date?: string | null
        }
        Update: {
          end_date?: string | null
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          role_in_project?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_personnel_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personnel_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_personnel_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          budget: number | null
          city: string | null
          client_id: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date_actual: string | null
          end_date_estimated: string | null
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          tenant_id: string
        }
        Insert: {
          address?: string | null
          budget?: number | null
          city?: string | null
          client_id?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date_actual?: string | null
          end_date_estimated?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tenant_id: string
        }
        Update: {
          address?: string | null
          budget?: number | null
          city?: string | null
          client_id?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date_actual?: string | null
          end_date_estimated?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_conversations: {
        Row: {
          created_at: string | null
          id: string
          messages: Json
          tenant_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json
          tenant_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          rating: number | null
          specialty: string | null
          status: string | null
          tax_id: string | null
          tenant_id: string
          type: string | null
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          rating?: number | null
          specialty?: string | null
          status?: string | null
          tax_id?: string | null
          tenant_id: string
          type?: string | null
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          rating?: number | null
          specialty?: string | null
          status?: string | null
          tax_id?: string | null
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          detail: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          module: string
          tenant_id: string
          user_id: string | null
          user_name: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string | null
          detail?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          module: string
          tenant_id: string
          user_id?: string | null
          user_name: string
          user_role: string
        }
        Update: {
          action?: string
          created_at?: string | null
          detail?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          module?: string
          tenant_id?: string
          user_id?: string | null
          user_name?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          id: string
          logo_url: string | null
          monthly_maintenance_budget: number | null
          name: string
          phone: string | null
          tax_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          monthly_maintenance_budget?: number | null
          name: string
          phone?: string | null
          tax_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          monthly_maintenance_budget?: number | null
          name?: string
          phone?: string | null
          tax_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          digital_signature_url: string | null
          full_name: string
          id: string
          last_login: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          digital_signature_url?: string | null
          full_name: string
          id: string
          last_login?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          digital_signature_url?: string | null
          full_name?: string
          id?: string
          last_login?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_parts: {
        Row: {
          consumable_id: string | null
          id: string
          quantity: number
          registered_at: string | null
          registered_by: string | null
          unit_cost: number | null
          work_order_id: string | null
        }
        Insert: {
          consumable_id?: string | null
          id?: string
          quantity: number
          registered_at?: string | null
          registered_by?: string | null
          unit_cost?: number | null
          work_order_id?: string | null
        }
        Update: {
          consumable_id?: string | null
          id?: string
          quantity?: number
          registered_at?: string | null
          registered_by?: string | null
          unit_cost?: number | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_parts_consumable_id_fkey"
            columns: ["consumable_id"]
            isOneToOne: false
            referencedRelation: "inventory_consumables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parts_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_parts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_photos: {
        Row: {
          id: string
          photo_type: string | null
          photo_url: string
          uploaded_at: string | null
          uploaded_by: string | null
          work_order_id: string | null
        }
        Insert: {
          id?: string
          photo_type?: string | null
          photo_url: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          id?: string
          photo_type?: string | null
          photo_url?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_photos_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_technicians: {
        Row: {
          personnel_id: string
          work_order_id: string
        }
        Insert: {
          personnel_id: string
          work_order_id: string
        }
        Update: {
          personnel_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_technicians_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_technicians_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_timers: {
        Row: {
          event_type: string
          id: string
          pause_reason: string | null
          personnel_id: string | null
          ts: string | null
          work_order_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          pause_reason?: string | null
          personnel_id?: string | null
          ts?: string | null
          work_order_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          pause_reason?: string | null
          personnel_id?: string | null
          ts?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_timers_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_timers_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_tools: {
        Row: {
          assigned_at: string | null
          delivery_act_signed: boolean | null
          id: string
          returned_at: string | null
          tool_id: string | null
          work_order_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          delivery_act_signed?: boolean | null
          id?: string
          returned_at?: string | null
          tool_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          delivery_act_signed?: boolean | null
          id?: string
          returned_at?: string | null
          tool_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "inventory_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_tools_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_hours: number | null
          closed_at: string | null
          code: string
          created_at: string | null
          created_by: string | null
          estimated_hours: number | null
          external_cost: number | null
          id: string
          labor_cost: number | null
          location_type: Database["public"]["Enums"]["ot_location"]
          machine_id: string | null
          parts_cost: number | null
          priority: string | null
          problem_description: string | null
          problem_tags: string[] | null
          project_id: string | null
          signed_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ot_status"] | null
          supervisor_notes: string | null
          supervisor_signature_url: string | null
          supplier_id: string | null
          technician_notes: string | null
          technician_signature_url: string | null
          tenant_id: string
          total_cost: number | null
          type: Database["public"]["Enums"]["ot_type"]
        }
        Insert: {
          actual_hours?: number | null
          closed_at?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          estimated_hours?: number | null
          external_cost?: number | null
          id?: string
          labor_cost?: number | null
          location_type: Database["public"]["Enums"]["ot_location"]
          machine_id?: string | null
          parts_cost?: number | null
          priority?: string | null
          problem_description?: string | null
          problem_tags?: string[] | null
          project_id?: string | null
          signed_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ot_status"] | null
          supervisor_notes?: string | null
          supervisor_signature_url?: string | null
          supplier_id?: string | null
          technician_notes?: string | null
          technician_signature_url?: string | null
          tenant_id: string
          total_cost?: number | null
          type: Database["public"]["Enums"]["ot_type"]
        }
        Update: {
          actual_hours?: number | null
          closed_at?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          estimated_hours?: number | null
          external_cost?: number | null
          id?: string
          labor_cost?: number | null
          location_type?: Database["public"]["Enums"]["ot_location"]
          machine_id?: string | null
          parts_cost?: number | null
          priority?: string | null
          problem_description?: string | null
          problem_tags?: string[] | null
          project_id?: string | null
          signed_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ot_status"] | null
          supervisor_notes?: string | null
          supervisor_signature_url?: string | null
          supplier_id?: string | null
          technician_notes?: string | null
          technician_signature_url?: string | null
          tenant_id?: string
          total_cost?: number | null
          type?: Database["public"]["Enums"]["ot_type"]
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_financials"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "work_orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      machine_financials: {
        Row: {
          internal_code: string | null
          machine_id: string | null
          machine_name: string | null
          machine_type: Database["public"]["Enums"]["machine_type"] | null
          profit: number | null
          profit_margin_pct: number | null
          tenant_id: string | null
          total_expenses: number | null
          total_income: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_financials: {
        Row: {
          budget: number | null
          budget_used_pct: number | null
          client_name: string | null
          profit: number | null
          profit_margin_pct: number | null
          project_id: string | null
          project_name: string | null
          tenant_id: string | null
          total_expenses: number | null
          total_income: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role: { Args: never; Returns: string }
      get_user_tenant_id: { Args: never; Returns: string }
      update_ot_parts_cost: { Args: { ot_id: string }; Returns: undefined }
    }
    Enums: {
      inventory_category:
        | "combustible"
        | "lubricante"
        | "refrigerante"
        | "desengrasante"
        | "grasas"
        | "filtros"
        | "otros"
      machine_status:
        | "activa_en_campo"
        | "disponible_bodega"
        | "en_campo_dañada"
        | "varada_bodega"
      machine_type:
        | "telehandler"
        | "manlift"
        | "tijera"
        | "hincadora"
        | "minicargador"
        | "retroexcavadora"
        | "camion_grua"
        | "otro"
      ot_location: "bodega_propia" | "campo_directo" | "taller_tercero"
      ot_status:
        | "creada"
        | "asignada"
        | "en_curso"
        | "pausada"
        | "cerrada"
        | "firmada"
      ot_type: "preventivo" | "correctivo" | "inspeccion" | "preparacion"
      personnel_type: "tecnico" | "operario"
      project_status: "activo" | "pausado" | "finalizado" | "prospecto"
      tool_status: "disponible" | "en_uso" | "en_reparacion" | "de_baja"
      user_role:
        | "superadmin"
        | "gerente"
        | "supervisor"
        | "tecnico"
        | "operario"
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
      inventory_category: [
        "combustible",
        "lubricante",
        "refrigerante",
        "desengrasante",
        "grasas",
        "filtros",
        "otros",
      ],
      machine_status: [
        "activa_en_campo",
        "disponible_bodega",
        "en_campo_dañada",
        "varada_bodega",
      ],
      machine_type: [
        "telehandler",
        "manlift",
        "tijera",
        "hincadora",
        "minicargador",
        "retroexcavadora",
        "camion_grua",
        "otro",
      ],
      ot_location: ["bodega_propia", "campo_directo", "taller_tercero"],
      ot_status: [
        "creada",
        "asignada",
        "en_curso",
        "pausada",
        "cerrada",
        "firmada",
      ],
      ot_type: ["preventivo", "correctivo", "inspeccion", "preparacion"],
      personnel_type: ["tecnico", "operario"],
      project_status: ["activo", "pausado", "finalizado", "prospecto"],
      tool_status: ["disponible", "en_uso", "en_reparacion", "de_baja"],
      user_role: ["superadmin", "gerente", "supervisor", "tecnico", "operario"],
    },
  },
} as const
