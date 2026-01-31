import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, sanitizeHtml } from '@/lib/utils'
import { ArrowLeft, Mail, Shield, FileText } from 'lucide-react'
import Link from 'next/link'
import { ReparseButton } from '@/components/email/reparse-button'
import type { SourceEmail } from '@/types/database'

interface EmailDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function EmailDetailPage({ params }: EmailDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: emailData, error } = await supabase
    .from('source_emails')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !emailData) {
    notFound()
  }

  const email: SourceEmail = emailData

  const extractedData = email.extracted_json as {
    doc_type?: string
    overall_confidence?: number
    items?: Array<{
      kind: string
      provider: string | null
      confirmation_code: string | null
      start_date: string
      start_location: string | null
      end_location: string | null
    }>
  } | null

  const authResults = email.auth_results as {
    spf?: string
    dkim?: string
    dmarc?: string
  } | null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/inbox"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to inbox
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {email.subject || '(no subject)'}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
            <span>From: {email.from_email}</span>
            <span>•</span>
            <span>{formatDateTime(email.received_at)}</span>
          </div>
        </div>
        <Badge
          variant={
            email.parse_status === 'completed'
              ? 'success'
              : email.parse_status === 'failed'
              ? 'error'
              : email.parse_status === 'unassigned'
              ? 'warning'
              : 'secondary'
          }
        >
          {email.parse_status}
        </Badge>
      </div>

      {/* Actions */}
      {email.parse_status !== 'processing' && (
        <ReparseButton emailId={email.id} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {email.body_text ? (
              <div className="max-h-96 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm font-mono whitespace-pre-wrap">
                {email.body_text}
              </div>
            ) : email.body_html ? (
              <div
                className="max-h-96 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm prose prose-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body_html) }}
              />
            ) : (
              <p className="text-gray-500">No content available</p>
            )}
          </CardContent>
        </Card>

        {/* Extracted data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extracted Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            {email.parse_error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {email.parse_error}
              </div>
            )}

            {extractedData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Document type:</span>
                  <span className="font-medium">{extractedData.doc_type || 'Unknown'}</span>
                </div>

                {extractedData.overall_confidence !== undefined && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Confidence:</span>
                    <span className="font-medium">
                      {Math.round(extractedData.overall_confidence * 100)}%
                    </span>
                  </div>
                )}

                {extractedData.items && extractedData.items.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">
                      Extracted Items ({extractedData.items.length})
                    </h4>
                    {extractedData.items.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border bg-gray-50 p-3 text-sm"
                      >
                        <div className="font-medium capitalize">{item.kind}</div>
                        {item.provider && (
                          <div className="text-gray-600">{item.provider}</div>
                        )}
                        {item.confirmation_code && (
                          <div className="font-mono text-xs text-amber-700">
                            {item.confirmation_code}
                          </div>
                        )}
                        {(item.start_location || item.end_location) && (
                          <div className="text-gray-500 text-xs mt-1">
                            {item.start_location}
                            {item.end_location && ` → ${item.end_location}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No items extracted</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No extraction data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auth results */}
      {authResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Email Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">SPF:</span>
                <Badge
                  variant={authResults.spf === 'pass' ? 'success' : 'secondary'}
                >
                  {authResults.spf || 'N/A'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">DKIM:</span>
                <Badge
                  variant={authResults.dkim === 'pass' ? 'success' : 'secondary'}
                >
                  {authResults.dkim || 'N/A'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">DMARC:</span>
                <Badge
                  variant={authResults.dmarc === 'pass' ? 'success' : 'secondary'}
                >
                  {authResults.dmarc || 'N/A'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw JSON (collapsed) */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
          View raw extraction JSON
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-300">
          {JSON.stringify(extractedData, null, 2)}
        </pre>
      </details>
    </div>
  )
}
