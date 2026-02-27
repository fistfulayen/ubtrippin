import { Users } from 'lucide-react'

import { SettingsNav } from '@/components/settings/settings-nav'
import { FamilySettings } from '@/components/settings/family-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsFamilyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: planData } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  const plan = planData as { subscription_tier?: string | null } | null
  const subscriptionTier = plan?.subscription_tier === 'pro' ? 'pro' : 'free'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Family</h1>
        <p className="text-gray-600">
          Sharing is caring. Family members share trips, loyalty, guides, and preferences.
        </p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Family Sharing
          </CardTitle>
          <CardDescription>
            Join together to share travel context automatically. No per-item toggles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FamilySettings currentUserId={user.id} subscriptionTier={subscriptionTier} />
        </CardContent>
      </Card>
    </div>
  )
}
