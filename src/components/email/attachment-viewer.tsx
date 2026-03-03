'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Download, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Attachment {
  filename: string
  content_type: string
  storage_path?: string | null
  is_noise?: boolean
  is_ticket?: boolean
}

interface AttachmentViewerProps {
  attachmentText: string | null
  attachments: Attachment[]
  emailId: string
}

export function AttachmentViewer({ attachmentText, attachments, emailId }: AttachmentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)

  if (!attachments.length && !attachmentText) {
    return null
  }

  const handleDownload = (index: number) => {
    setDownloading(index)
    // Redirect directly — works on mobile without popup blocker issues
    window.location.href = `/api/v1/inbox/${emailId}/attachments/${index}?redirect=1`
    setTimeout(() => setDownloading(null), 2000)
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4" />
          Attachments ({attachments.length})
        </h4>
        {attachmentText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-auto justify-start px-0 py-1 text-xs sm:h-8 sm:px-3 sm:justify-center"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Extracted Text
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Extracted Text
              </>
            )}
          </Button>
        )}
      </div>

      {/* Attachment list */}
      <div className="space-y-1">
        {attachments.map((att, index) => {
          const hasFile = !!att.storage_path
          const isNoise = att.is_noise
          const isTicket = att.is_ticket

          return (
            <div
              key={index}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                isNoise
                  ? 'bg-gray-50 text-gray-400'
                  : isTicket
                    ? 'bg-amber-50 text-gray-700 border border-amber-100'
                    : 'bg-gray-50 text-gray-600'
              }`}
            >
              <FileText className={`h-3.5 w-3.5 shrink-0 ${isTicket ? 'text-amber-500' : ''}`} />
              <span className="min-w-0 flex-1 break-all">
                {att.filename.replace(/^\//, '')}{' '}
                <span className="text-gray-400">({att.content_type})</span>
                {isTicket && (
                  <span className="ml-1 inline-flex rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                    ticket
                  </span>
                )}
                {isNoise && (
                  <span className="ml-1 inline-flex rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-400">
                    T&amp;C
                  </span>
                )}
              </span>
              {hasFile ? (
                <button
                  onClick={() => handleDownload(index)}
                  disabled={downloading === index}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <Download className="h-3 w-3" />
                  {downloading === index ? '…' : 'Download'}
                </button>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-gray-300">
                  <AlertCircle className="h-3 w-3" />
                  not stored
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Extracted text */}
      {isExpanded && attachmentText && (
        <div className="mt-3">
          <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-300 font-mono whitespace-pre-wrap">
            {attachmentText}
          </div>
        </div>
      )}
    </div>
  )
}
