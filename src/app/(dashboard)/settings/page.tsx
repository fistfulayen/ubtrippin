import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AllowedSendersList } from '@/components/settings/allowed-senders-list'
import { AddSenderForm } from '@/components/settings/add-sender-form'
import { ApiKeysSection } from '@/components/settings/api-keys-section'
import { CalendarFeedSection } from '@/components/settings/calendar-feed-section'
import { SettingsNav } from '@/components/settings/settings-nav'
import { Mail, User, Info, Key, Rss } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import type { Profile, AllowedSender } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  // Type assertion needed due to Supabase codegen quirks
  const profile = profileData as Profile | null
  const isPro = profile?.subscription_tier === 'pro'

  const { data: sendersData } = await supabase
    .from('allowed_senders')
    .select('*')
    .order('created_at', { ascending: false })

  const allowedSenders: AllowedSender[] = sendersData || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">
          Manage your account and email settings
        </p>
      </div>

      <SettingsNav />

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <UserAvatar src={profile?.avatar_url} name={profile?.full_name} email={user?.email} size="lg" />
            <div>
              <p className="font-medium text-gray-900">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allowed senders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Allowed Sender Emails
          </CardTitle>
          <CardDescription>
            Add email addresses you&apos;ll forward booking emails from. Only emails from
            these addresses will be processed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info box */}
          <div className="rounded-lg bg-[#ffffff] border border-[#cbd5e1] p-4 flex gap-3">
            <Info className="h-5 w-5 text-[#4f46e5] shrink-0 mt-0.5" />
            <div className="text-sm text-[#1e293b]">
              <p className="font-medium mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Add your email address(es) below</li>
                <li>Forward booking confirmations from that email to <strong>trips@ubtrippin.xyz</strong></li>
                <li>We&apos;ll extract the trip details and add them to your account</li>
              </ol>
            </div>
          </div>

          {/* Add form */}
          <AddSenderForm />

          {/* List */}
          <AllowedSendersList senders={allowedSenders || []} />
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Generate API keys for programmatic access to your UB Trippin data (agents, integrations, CI/CD pipelines).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysSection />
        </CardContent>
      </Card>

      {/* Calendar Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            Calendar Feed
          </CardTitle>
          <CardDescription>
            Subscribe to a live calendar feed of all your trips in Google Calendar, Apple Calendar, or any .ics-compatible app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarFeedSection isPro={isPro} />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Forwarding Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Gmail</h4>
            <p>
              Open the email, click the three dots menu (⋮), select &quot;Forward&quot;, and
              send to trips@ubtrippin.xyz
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Outlook</h4>
            <p>
              Open the email, click &quot;Forward&quot; in the toolbar, and send to
              trips@ubtrippin.xyz
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Apple Mail</h4>
            <p>
              Open the email, click the forward arrow (→), and send to
              trips@ubtrippin.xyz
            </p>
          </div>
          <div className="rounded-lg bg-gray-100 p-3 font-mono text-center">
            trips@ubtrippin.xyz
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
