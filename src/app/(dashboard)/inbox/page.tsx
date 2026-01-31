import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { Mail, AlertCircle, CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import type { SourceEmail, EmailParseStatus } from '@/types/database'

const statusConfig: Record<EmailParseStatus, { label: string; icon: typeof Clock; variant: 'secondary' | 'default' | 'success' | 'error' | 'warning' }> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary' as const,
  },
  processing: {
    label: 'Processing',
    icon: Clock,
    variant: 'default' as const,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    variant: 'success' as const,
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'error' as const,
  },
  unassigned: {
    label: 'Unassigned',
    icon: HelpCircle,
    variant: 'warning' as const,
  },
}

export default async function InboxPage() {
  const supabase = await createClient()

  const { data: emailsData } = await supabase
    .from('source_emails')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(100)

  const emails: SourceEmail[] = emailsData || []
  const hasEmails = emails.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <p className="text-gray-600">
          View and manage emails received at trips@ubtrippin.xyz
        </p>
      </div>

      {!hasEmails ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Mail className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 font-semibold text-gray-900">No emails yet</h3>
          <p className="mt-2 text-sm text-gray-600">
            Forward booking emails to{' '}
            <strong className="text-gray-900">trips@ubtrippin.xyz</strong> to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => {
            const status = statusConfig[email.parse_status]
            const StatusIcon = status.icon

            return (
              <Link key={email.id} href={`/inbox/${email.id}`}>
                <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Status indicator */}
                      <div className="shrink-0 pt-1">
                        <StatusIcon
                          className={`h-5 w-5 ${
                            email.parse_status === 'completed'
                              ? 'text-green-500'
                              : email.parse_status === 'failed'
                              ? 'text-red-500'
                              : email.parse_status === 'unassigned'
                              ? 'text-yellow-500'
                              : 'text-gray-400'
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate group-hover:text-amber-700">
                            {email.subject || '(no subject)'}
                          </span>
                          <Badge variant={status.variant} className="shrink-0">
                            {status.label}
                          </Badge>
                        </div>

                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                          <span className="truncate">From: {email.from_email}</span>
                          <span>•</span>
                          <span className="shrink-0">
                            {formatDateTime(email.received_at)}
                          </span>
                        </div>

                        {email.parse_error && (
                          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {email.parse_error}
                          </div>
                        )}

                        {email.parse_status === 'completed' && email.extracted_json && (
                          <div className="mt-2 text-sm text-green-600">
                            {(email.extracted_json as { items?: unknown[] }).items?.length || 0} items extracted
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Help text */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">Email Status Guide</h3>
        <ul className="space-y-1">
          <li><strong>Pending/Processing:</strong> Email is being analyzed</li>
          <li><strong>Completed:</strong> Travel items successfully extracted and added to trips</li>
          <li><strong>Failed:</strong> Could not extract travel data (may not be a booking email)</li>
          <li><strong>Unassigned:</strong> Sender email not in your allowed senders list</li>
        </ul>
      </div>
    </div>
  )
}
