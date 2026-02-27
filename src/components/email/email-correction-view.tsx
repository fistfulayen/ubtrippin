'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, FileText, Shield } from 'lucide-react'
import { sanitizeHtml, formatDateTime } from '@/lib/utils'
import { ExtractionEditor, type ExtractedItemData } from './extraction-editor'
import { AttachmentViewer } from './attachment-viewer'
import { ReparseButton } from './reparse-button'

interface SourceEmailData {
  id: string
  subject: string | null
  from_email: string
  body_text: string | null
  body_html: string | null
  attachment_text: string | null
  attachments_json: Array<{ filename: string; content_type: string }>
  extracted_json: {
    doc_type?: string
    overall_confidence?: number
    items?: ExtractedItemData[]
  } | null
  parse_status: string
  parse_error: string | null
  auth_results: {
    spf?: string
    dkim?: string
    dmarc?: string
  } | null
  received_at: string
}

interface EmailCorrectionViewProps {
  email: SourceEmailData
}

export function EmailCorrectionView({ email }: EmailCorrectionViewProps) {
  const [items, setItems] = useState<ExtractedItemData[]>(
    email.extracted_json?.items || []
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Reset items when email changes
  useEffect(() => {
    setItems(email.extracted_json?.items || [])
  }, [email.id, email.extracted_json])

  const handleSave = async (createExample: boolean) => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const response = await fetch(`/api/emails/${email.id}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrected_items: items,
          create_example: createExample,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save corrections')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save corrections:', error)
      alert(error instanceof Error ? error.message : 'Failed to save corrections')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
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
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-sm text-green-600">Saved!</span>
          )}
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

            <AttachmentViewer
              attachmentText={email.attachment_text}
              attachments={email.attachments_json || []}
            />
          </CardContent>
        </Card>

        {/* Extracted data - Editable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extracted Data
              {email.extracted_json?.overall_confidence !== undefined && (
                <span className="ml-auto text-sm font-normal text-gray-500">
                  {Math.round(email.extracted_json.overall_confidence * 100)}% confidence
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {email.parse_error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <p>{email.parse_error}</p>
                {email.parse_error.includes('Upgrade to Pro') && (
                  <Link href="/settings/billing" className="mt-2 inline-block font-medium underline underline-offset-2">
                    Upgrade in Billing
                  </Link>
                )}
              </div>
            )}

            <ExtractionEditor
              items={items}
              onChange={setItems}
              onSave={handleSave}
              isSaving={isSaving}
            />
          </CardContent>
        </Card>
      </div>

      {/* Auth results */}
      {email.auth_results && (
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
                <Badge variant={email.auth_results.spf === 'pass' ? 'success' : 'secondary'}>
                  {email.auth_results.spf || 'N/A'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">DKIM:</span>
                <Badge variant={email.auth_results.dkim === 'pass' ? 'success' : 'secondary'}>
                  {email.auth_results.dkim || 'N/A'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">DMARC:</span>
                <Badge variant={email.auth_results.dmarc === 'pass' ? 'success' : 'secondary'}>
                  {email.auth_results.dmarc || 'N/A'}
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
          {JSON.stringify(email.extracted_json, null, 2)}
        </pre>
      </details>
    </div>
  )
}
