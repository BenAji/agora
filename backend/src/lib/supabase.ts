import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Database types and enums
export type UserRole = 'IR_ADMIN' | 'ANALYST_MANAGER' | 'INVESTMENT_ANALYST'
export type EventType = 'EARNINGS_CALL' | 'INVESTOR_MEETING' | 'CONFERENCE' | 'ROADSHOW' | 'ANALYST_DAY' | 'PRODUCT_LAUNCH' | 'OTHER'
export type RSVPStatus = 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'PENDING'
export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED'

// Database interfaces
export interface User {
  userID: string
  firstName: string
  lastName: string
  username: string
  password: string
  email: string
  role: UserRole
  managerID: string | null
  companyID: string | null
  start: string | null
  end: string | null
  createdAt: string
  updatedAt: string
}

export interface Event {
  eventID: string
  eventName: string
  tickerSymbol: string | null
  gicsSector: string | null
  gicsSubSector: string | null
  eventType: EventType
  location: string | null
  hostCompany: string | null
  companyID: string | null
  startDate: string
  endDate: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface RSVP {
  rsvpID: string
  userID: string
  eventID: string
  status: RSVPStatus
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  subID: string
  subStart: string
  subEnd: string | null
  userID: string
  gicsSector: string | null
  gicsSubCategory: string | null
  status: SubscriptionStatus
  createdAt: string
  updatedAt: string
}

export interface GICSCompany {
  companyID: string
  tickerSymbol: string
  companyName: string
  gicsSector: string
  gicsSubCategory: string
  createdAt: string
  updatedAt: string
}

export interface UserCompany {
  companyID: string
  companyName: string
  location: string | null
  createdAt: string
  updatedAt: string
} 