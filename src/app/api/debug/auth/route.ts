import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  // Check which supabase cookies exist
  const sbCookies = allCookies.filter(c => 
    c.name.includes('sb-') || c.name.includes('supabase')
  )

  const supabase = await createClient()
  
  // Test getClaims (local JWT validation)
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  
  // Test getUser (network call to auth server)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  
  // Test a simple RLS query
  let rlsResult = null
  let rlsError = null
  if (userData?.user) {
    const { data, error } = await supabase
      .from('trips')
      .select('id, title')
      .limit(3)
    rlsResult = data
    rlsError = error
  }

  return NextResponse.json({
    cookieCount: allCookies.length,
    sbCookieNames: sbCookies.map(c => c.name),
    sbCookieLengths: sbCookies.map(c => ({ name: c.name, len: c.value.length })),
    claims: claimsData ? { sub: claimsData.claims?.sub, role: claimsData.claims?.role } : null,
    claimsError: claimsError?.message || null,
    user: userData?.user ? { id: userData.user.id, email: userData.user.email } : null,
    userError: userError?.message || null,
    rlsTrips: rlsResult,
    rlsError: rlsError?.message || null,
  })
}
