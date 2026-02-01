export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TripItemKind = 'flight' | 'hotel' | 'train' | 'car' | 'restaurant' | 'activity' | 'other'
export type TripItemStatus = 'confirmed' | 'cancelled' | 'changed' | 'pending' | 'unknown'
export type EmailParseStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unassigned'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      allowed_senders: {
        Row: {
          id: string
          user_id: string
          email: string
          label: string | null
          verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          label?: string | null
          verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          label?: string | null
          verified?: boolean
          created_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          user_id: string
          title: string
          start_date: string | null
          end_date: string | null
          primary_location: string | null
          travelers: string[]
          notes: string | null
          cover_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          start_date?: string | null
          end_date?: string | null
          primary_location?: string | null
          travelers?: string[]
          notes?: string | null
          cover_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          start_date?: string | null
          end_date?: string | null
          primary_location?: string | null
          travelers?: string[]
          notes?: string | null
          cover_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_items: {
        Row: {
          id: string
          user_id: string
          trip_id: string | null
          kind: TripItemKind
          provider: string | null
          confirmation_code: string | null
          traveler_names: string[]
          start_ts: string | null
          end_ts: string | null
          start_date: string
          end_date: string | null
          start_location: string | null
          end_location: string | null
          summary: string | null
          details_json: Json
          status: TripItemStatus
          confidence: number
          needs_review: boolean
          source_email_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trip_id?: string | null
          kind: TripItemKind
          provider?: string | null
          confirmation_code?: string | null
          traveler_names?: string[]
          start_ts?: string | null
          end_ts?: string | null
          start_date: string
          end_date?: string | null
          start_location?: string | null
          end_location?: string | null
          summary?: string | null
          details_json?: Json
          status?: TripItemStatus
          confidence?: number
          needs_review?: boolean
          source_email_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string | null
          kind?: TripItemKind
          provider?: string | null
          confirmation_code?: string | null
          traveler_names?: string[]
          start_ts?: string | null
          end_ts?: string | null
          start_date?: string
          end_date?: string | null
          start_location?: string | null
          end_location?: string | null
          summary?: string | null
          details_json?: Json
          status?: TripItemStatus
          confidence?: number
          needs_review?: boolean
          source_email_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      source_emails: {
        Row: {
          id: string
          user_id: string | null
          from_email: string
          to_email: string | null
          subject: string | null
          body_text: string | null
          body_html: string | null
          attachment_text: string | null
          received_at: string
          resend_message_id: string | null
          raw_storage_path: string | null
          attachments_json: Json
          parse_status: EmailParseStatus
          parse_error: string | null
          extracted_json: Json | null
          auth_results: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          from_email: string
          to_email?: string | null
          subject?: string | null
          body_text?: string | null
          body_html?: string | null
          attachment_text?: string | null
          received_at?: string
          resend_message_id?: string | null
          raw_storage_path?: string | null
          attachments_json?: Json
          parse_status?: EmailParseStatus
          parse_error?: string | null
          extracted_json?: Json | null
          auth_results?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          from_email?: string
          to_email?: string | null
          subject?: string | null
          body_text?: string | null
          body_html?: string | null
          attachment_text?: string | null
          received_at?: string
          resend_message_id?: string | null
          raw_storage_path?: string | null
          attachments_json?: Json
          parse_status?: EmailParseStatus
          parse_error?: string | null
          extracted_json?: Json | null
          auth_results?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          entity_type: string
          entity_id: string
          action: string
          changes_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entity_type: string
          entity_id: string
          action: string
          changes_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          changes_json?: Json | null
          created_at?: string
        }
      }
      trip_pdfs: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          storage_path: string
          generated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          storage_path: string
          generated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          storage_path?: string
          generated_at?: string
        }
      }
      extraction_examples: {
        Row: {
          id: string
          user_id: string | null
          source_email_id: string | null
          email_subject: string | null
          email_body_snippet: string
          attachment_text_snippet: string | null
          corrected_extraction: Json
          provider_pattern: string | null
          item_kind: string | null
          is_global: boolean
          usage_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          source_email_id?: string | null
          email_subject?: string | null
          email_body_snippet: string
          attachment_text_snippet?: string | null
          corrected_extraction: Json
          provider_pattern?: string | null
          item_kind?: string | null
          is_global?: boolean
          usage_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          source_email_id?: string | null
          email_subject?: string | null
          email_body_snippet?: string
          attachment_text_snippet?: string | null
          corrected_extraction?: Json
          provider_pattern?: string | null
          item_kind?: string | null
          is_global?: boolean
          usage_count?: number
          created_at?: string
        }
      }
      extraction_corrections: {
        Row: {
          id: string
          user_id: string
          source_email_id: string
          field_path: string
          original_value: Json | null
          corrected_value: Json
          correction_type: 'added' | 'modified' | 'removed'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_email_id: string
          field_path: string
          original_value?: Json | null
          corrected_value: Json
          correction_type: 'added' | 'modified' | 'removed'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_email_id?: string
          field_path?: string
          original_value?: Json | null
          corrected_value?: Json
          correction_type?: 'added' | 'modified' | 'removed'
          created_at?: string
        }
      }
    }
  }
}

// Convenience types for common use
export type Profile = Database['public']['Tables']['profiles']['Row']
export type AllowedSender = Database['public']['Tables']['allowed_senders']['Row']
export type Trip = Database['public']['Tables']['trips']['Row']
export type TripItem = Database['public']['Tables']['trip_items']['Row']
export type SourceEmail = Database['public']['Tables']['source_emails']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type TripPdf = Database['public']['Tables']['trip_pdfs']['Row']
export type ExtractionExample = Database['public']['Tables']['extraction_examples']['Row']
export type ExtractionCorrection = Database['public']['Tables']['extraction_corrections']['Row']

// Trip with items for display
export interface TripWithItems extends Trip {
  items: TripItem[]
}

// Flight-specific details
export interface FlightDetails {
  flight_number?: string
  airline?: string
  departure_airport?: string
  arrival_airport?: string
  departure_terminal?: string
  arrival_terminal?: string
  departure_gate?: string
  arrival_gate?: string
  aircraft_type?: string
  cabin_class?: string
  seat?: string
  booking_reference?: string
}

// Hotel-specific details
export interface HotelDetails {
  hotel_name?: string
  address?: string
  room_type?: string
  check_in_time?: string
  check_out_time?: string
  booking_reference?: string
  contact_phone?: string
}

// Car rental details
export interface CarRentalDetails {
  rental_company?: string
  pickup_location?: string
  dropoff_location?: string
  vehicle_type?: string
  booking_reference?: string
}

// Train details
export interface TrainDetails {
  train_number?: string
  operator?: string
  departure_station?: string
  arrival_station?: string
  carriage?: string
  seat?: string
  booking_reference?: string
}
