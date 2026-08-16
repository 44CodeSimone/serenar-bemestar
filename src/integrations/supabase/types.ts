export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string;
          id: string;
          messages: Json;
          summary: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          messages?: Json;
          summary?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          messages?: Json;
          summary?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_knowledge: {
        Row: {
          active: boolean;
          category: string | null;
          content: string;
          created_at: string;
          display_order: number;
          id: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category?: string | null;
          content: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          topic: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category?: string | null;
          content?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      anamnesis_answers: {
        Row: {
          anamnesis_id: string;
          answer: Json;
          created_at: string;
          id: string;
          question_id: string;
          updated_at: string;
        };
        Insert: {
          anamnesis_id: string;
          answer: Json;
          created_at?: string;
          id?: string;
          question_id: string;
          updated_at?: string;
        };
        Update: {
          anamnesis_id?: string;
          answer?: Json;
          created_at?: string;
          id?: string;
          question_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anamnesis_answers_anamnesis_id_fkey";
            columns: ["anamnesis_id"];
            isOneToOne: false;
            referencedRelation: "client_anamneses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anamnesis_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "anamnesis_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      anamnesis_questions: {
        Row: {
          active: boolean;
          created_at: string;
          display_order: number;
          field_type: string;
          help_text: string | null;
          id: string;
          label: string;
          options: Json | null;
          question_key: string;
          required: boolean;
          template_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_order?: number;
          field_type: string;
          help_text?: string | null;
          id?: string;
          label: string;
          options?: Json | null;
          question_key: string;
          required?: boolean;
          template_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_order?: number;
          field_type?: string;
          help_text?: string | null;
          id?: string;
          label?: string;
          options?: Json | null;
          question_key?: string;
          required?: boolean;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anamnesis_questions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "anamnesis_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      anamnesis_templates: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          retired_at: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          retired_at?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          retired_at?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          calendar_slot_id: string | null;
          cancelled_at: string | null;
          client_id: string | null;
          confirmed_at: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          handled_by: string | null;
          id: string;
          internal_notes: string | null;
          notes: string | null;
          phone: string;
          preferred_date: string | null;
          preferred_time: string | null;
          service: string;
          service_id: string | null;
          source: string | null;
          status: string;
          submitted_at: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          calendar_slot_id?: string | null;
          cancelled_at?: string | null;
          client_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          handled_by?: string | null;
          id?: string;
          internal_notes?: string | null;
          notes?: string | null;
          phone: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          service: string;
          service_id?: string | null;
          source?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          calendar_slot_id?: string | null;
          cancelled_at?: string | null;
          client_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          handled_by?: string | null;
          id?: string;
          internal_notes?: string | null;
          notes?: string | null;
          phone?: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          service?: string;
          service_id?: string | null;
          source?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_appointments_calendar_slot";
            columns: ["calendar_slot_id"];
            isOneToOne: false;
            referencedRelation: "calendar_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      blog_posts: {
        Row: {
          author_id: string | null;
          category: string | null;
          content: string | null;
          cover_image_url: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_keywords: string | null;
          seo_title: string | null;
          slug: string;
          status: string;
          tags: Json | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          category?: string | null;
          content?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_keywords?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: string;
          tags?: Json | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          category?: string | null;
          content?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_keywords?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: string;
          tags?: Json | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_slots: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          end_time: string;
          id: string;
          notes: string | null;
          professional_name: string | null;
          published: boolean;
          reserved_at: string | null;
          slot_date: string;
          start_time: string;
          status: Database["public"]["Enums"]["calendar_slot_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_time: string;
          id?: string;
          notes?: string | null;
          professional_name?: string | null;
          published?: boolean;
          reserved_at?: string | null;
          slot_date: string;
          start_time: string;
          status?: Database["public"]["Enums"]["calendar_slot_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_time?: string;
          id?: string;
          notes?: string | null;
          professional_name?: string | null;
          published?: boolean;
          reserved_at?: string | null;
          slot_date?: string;
          start_time?: string;
          status?: Database["public"]["Enums"]["calendar_slot_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      client_anamneses: {
        Row: {
          client_id: string;
          completed_at: string | null;
          created_at: string;
          filled_by: string;
          guardian_id: string | null;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          completed_at?: string | null;
          created_at?: string;
          filled_by: string;
          guardian_id?: string | null;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          completed_at?: string | null;
          created_at?: string;
          filled_by?: string;
          guardian_id?: string | null;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_anamneses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_anamneses_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_anamneses_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "anamnesis_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      client_consents: {
        Row: {
          client_id: string;
          collection_channel: string;
          consent_type: string;
          created_at: string;
          evidence_document_id: string | null;
          expires_at: string | null;
          granted: boolean;
          granted_at: string;
          guardian_id: string | null;
          id: string;
          legal_basis: string;
          recorded_by: string | null;
          revoked_at: string | null;
          term_hash: string | null;
          term_version: string;
        };
        Insert: {
          client_id: string;
          collection_channel: string;
          consent_type: string;
          created_at?: string;
          evidence_document_id?: string | null;
          expires_at?: string | null;
          granted: boolean;
          granted_at?: string;
          guardian_id?: string | null;
          id?: string;
          legal_basis: string;
          recorded_by?: string | null;
          revoked_at?: string | null;
          term_hash?: string | null;
          term_version: string;
        };
        Update: {
          client_id?: string;
          collection_channel?: string;
          consent_type?: string;
          created_at?: string;
          evidence_document_id?: string | null;
          expires_at?: string | null;
          granted?: boolean;
          granted_at?: string;
          guardian_id?: string | null;
          id?: string;
          legal_basis?: string;
          recorded_by?: string | null;
          revoked_at?: string | null;
          term_hash?: string | null;
          term_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_consents_evidence_document_id_fkey";
            columns: ["evidence_document_id"];
            isOneToOne: false;
            referencedRelation: "client_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_consents_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
        ];
      };
      client_documents: {
        Row: {
          archived_at: string | null;
          client_id: string;
          created_at: string;
          document_type: string;
          file_size: number;
          id: string;
          mime_type: string;
          original_filename: string;
          related_entity_id: string | null;
          related_entity_type: string | null;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          archived_at?: string | null;
          client_id: string;
          created_at?: string;
          document_type: string;
          file_size: number;
          id?: string;
          mime_type: string;
          original_filename: string;
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          storage_path: string;
          uploaded_by: string;
        };
        Update: {
          archived_at?: string | null;
          client_id?: string;
          created_at?: string;
          document_type?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_guardians: {
        Row: {
          authorization_granted_at: string | null;
          authorization_version: string | null;
          client_id: string;
          created_at: string;
          guardian_id: string;
          id: string;
          is_primary: boolean;
          legal_authority_confirmed: boolean;
          relationship: string;
          revoked_at: string | null;
          updated_at: string;
          valid_from: string;
          valid_until: string | null;
        };
        Insert: {
          authorization_granted_at?: string | null;
          authorization_version?: string | null;
          client_id: string;
          created_at?: string;
          guardian_id: string;
          id?: string;
          is_primary?: boolean;
          legal_authority_confirmed?: boolean;
          relationship: string;
          revoked_at?: string | null;
          updated_at?: string;
          valid_from?: string;
          valid_until?: string | null;
        };
        Update: {
          authorization_granted_at?: string | null;
          authorization_version?: string | null;
          client_id?: string;
          created_at?: string;
          guardian_id?: string;
          id?: string;
          is_primary?: boolean;
          legal_authority_confirmed?: boolean;
          relationship?: string;
          revoked_at?: string | null;
          updated_at?: string;
          valid_from?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_guardians_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_guardians_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
        ];
      };
      client_preferences: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          preference_key: string;
          preference_value: Json;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          preference_key: string;
          preference_value: Json;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          preference_key?: string;
          preference_value?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_preferences_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_sessions: {
        Row: {
          appointment_id: string | null;
          client_id: string;
          client_report: string | null;
          created_at: string;
          duration_minutes: number | null;
          id: string;
          professional_summary: string | null;
          professional_user_id: string;
          recommendations: string | null;
          service_id: string | null;
          session_ended_at: string | null;
          session_started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          client_id: string;
          client_report?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          professional_summary?: string | null;
          professional_user_id: string;
          recommendations?: string | null;
          service_id?: string | null;
          session_ended_at?: string | null;
          session_started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          client_id?: string;
          client_report?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          professional_summary?: string | null;
          professional_user_id?: string;
          recommendations?: string | null;
          service_id?: string | null;
          session_ended_at?: string | null;
          session_started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_sessions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_sessions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_sessions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          auth_user_id: string | null;
          birth_date: string;
          city: string | null;
          cpf: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          mother_name: string | null;
          notes: string | null;
          phone: string;
          profession: string | null;
          source: string;
          status: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          auth_user_id?: string | null;
          birth_date: string;
          city?: string | null;
          cpf?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          mother_name?: string | null;
          notes?: string | null;
          phone: string;
          profession?: string | null;
          source: string;
          status?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          auth_user_id?: string | null;
          birth_date?: string;
          city?: string | null;
          cpf?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          mother_name?: string | null;
          notes?: string | null;
          phone?: string;
          profession?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      faq_items: {
        Row: {
          active: boolean;
          answer: string;
          category: string | null;
          created_at: string;
          display_order: number;
          id: string;
          question: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          answer: string;
          category?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          question: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          answer?: string;
          category?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          question?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guardians: {
        Row: {
          cpf: string;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          phone: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          cpf: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          phone: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          cpf?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          consent: boolean;
          converted_client_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          interest: string | null;
          metadata: Json | null;
          name: string;
          notes: string | null;
          phone: string | null;
          service: string | null;
          source: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          consent?: boolean;
          converted_client_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          interest?: string | null;
          metadata?: Json | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          service?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          consent?: boolean;
          converted_client_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          interest?: string | null;
          metadata?: Json | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          service?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey";
            columns: ["converted_client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          aftercare: string | null;
          benefits: Json | null;
          contraindications: string | null;
          created_at: string;
          description: string | null;
          display_order: number;
          duration: string | null;
          featured: boolean;
          id: string;
          image_url: string | null;
          name: string;
          preparation: string | null;
          price_cents: number | null;
          price_label: string | null;
          short_description: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          aftercare?: string | null;
          benefits?: Json | null;
          contraindications?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          duration?: string | null;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          name: string;
          preparation?: string | null;
          price_cents?: number | null;
          price_label?: string | null;
          short_description?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          aftercare?: string | null;
          benefits?: Json | null;
          contraindications?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          duration?: string | null;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          name?: string;
          preparation?: string | null;
          price_cents?: number | null;
          price_label?: string | null;
          short_description?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      session_notes: {
        Row: {
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          note_type: string;
          session_id: string;
          supersedes_note_id: string | null;
        };
        Insert: {
          content: string;
          created_at?: string;
          created_by: string;
          id?: string;
          note_type: string;
          session_id: string;
          supersedes_note_id?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          note_type?: string;
          session_id?: string;
          supersedes_note_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_notes_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "client_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_notes_supersedes_note_id_fkey";
            columns: ["supersedes_note_id"];
            isOneToOne: false;
            referencedRelation: "session_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      site_images: {
        Row: {
          alt: string;
          caption: string | null;
          created_at: string;
          id: string;
          is_public: boolean;
          mime: string | null;
          public_url: string;
          size_bytes: number | null;
          storage_path: string;
          tag: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          alt?: string;
          caption?: string | null;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          mime?: string | null;
          public_url: string;
          size_bytes?: number | null;
          storage_path: string;
          tag?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          alt?: string;
          caption?: string | null;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          mime?: string | null;
          public_url?: string;
          size_bytes?: number | null;
          storage_path?: string;
          tag?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      slot_exceptions: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          end_date: string;
          end_time: string | null;
          id: string;
          name: string;
          professional_name: string | null;
          reason: string | null;
          start_date: string;
          start_time: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_date: string;
          end_time?: string | null;
          id?: string;
          name: string;
          professional_name?: string | null;
          reason?: string | null;
          start_date: string;
          start_time?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_date?: string;
          end_time?: string | null;
          id?: string;
          name?: string;
          professional_name?: string | null;
          reason?: string | null;
          start_date?: string;
          start_time?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      slot_templates: {
        Row: {
          active: boolean;
          available_times: Json;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          favorite: boolean;
          id: string;
          name: string;
          professional_name: string | null;
          updated_at: string;
          updated_by: string | null;
          valid_from: string | null;
          valid_until: string | null;
          weekdays: number[];
        };
        Insert: {
          active?: boolean;
          available_times: Json;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          favorite?: boolean;
          id?: string;
          name: string;
          professional_name?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          weekdays: number[];
        };
        Update: {
          active?: boolean;
          available_times?: Json;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          favorite?: boolean;
          id?: string;
          name?: string;
          professional_name?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          weekdays?: number[];
        };
        Relationships: [];
      };
      testimonials: {
        Row: {
          active: boolean;
          authorized: boolean;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          rating: number | null;
          service: string | null;
          text: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          authorized?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          name: string;
          rating?: number | null;
          service?: string | null;
          text: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          authorized?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          rating?: number | null;
          service?: string | null;
          text?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_consents: {
        Row: {
          consent_type: string;
          granted: boolean;
          granted_at: string;
          id: string;
          ip_address: string | null;
          revoked_at: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          consent_type: string;
          granted: boolean;
          granted_at?: string;
          id?: string;
          ip_address?: string | null;
          revoked_at?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          consent_type?: string;
          granted?: boolean;
          granted_at?: string;
          id?: string;
          ip_address?: string | null;
          revoked_at?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      change_appointment_status: {
        Args: { p_appointment_id: string; p_new_status: string };
        Returns: {
          appointment_id: string;
          appointment_status: string;
          calendar_slot_id: string;
          changed_at: string;
          previous_status: string;
        }[];
      };
      create_prebooking: {
        Args: {
          p_calendar_slot_id: string;
          p_email: string;
          p_full_name: string;
          p_notes: string;
          p_phone: string;
          p_service_id: string;
        };
        Returns: {
          appointment_id: string;
          appointment_status: string;
          slot_id: string;
          submitted_at: string;
        }[];
      };
      get_my_appointments: {
        Args: never;
        Returns: {
          calendar_slot_id: string;
          cancelled_at: string;
          confirmed_at: string;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          notes: string;
          phone: string;
          preferred_date: string;
          preferred_time: string;
          service: string;
          status: string;
          submitted_at: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "client" | "owner";
      calendar_slot_status: "open" | "reserved" | "blocked";
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
  public: {
    Enums: {
      app_role: ["admin", "client", "owner"],
      calendar_slot_status: ["open", "reserved", "blocked"],
    },
  },
} as const;
