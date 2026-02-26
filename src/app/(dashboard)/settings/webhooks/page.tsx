import { Webhook } from 'lucide-react'

import { SettingsNav } from '@/components/settings/settings-nav'
import { WebhooksSection } from '@/components/settings/webhooks-section'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsWebhooksPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
        <p className="text-gray-600">
          Register callback endpoints to receive trip and item event notifications.
        </p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Endpoints
          </CardTitle>
          <CardDescription>
            Deliver signed JSON events to your systems in near real time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksSection subscriptionTier={subscriptionTier} />
        </CardContent>
      </Card>
    </div>
  )
}
