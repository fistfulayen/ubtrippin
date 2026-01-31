import type { Database } from '@/types/database'

export type TripInsert = Database['public']['Tables']['trips']['Insert']
export type TripUpdate = Database['public']['Tables']['trips']['Update']
export type TripItemInsert = Database['public']['Tables']['trip_items']['Insert']
export type TripItemUpdate = Database['public']['Tables']['trip_items']['Update']
export type SourceEmailInsert = Database['public']['Tables']['source_emails']['Insert']
export type SourceEmailUpdate = Database['public']['Tables']['source_emails']['Update']
