'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AttachmentViewerProps {
  attachmentText: string | null
  attachments: Array<{ filename: string; content_type: string }>
}

export function AttachmentViewer({ attachmentText, attachments }: AttachmentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!attachments.length && !attachmentText) {
    return null
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Attachments ({attachments.length})
        </h4>
        {attachmentText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs"
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
        {attachments.map((att, index) => (
          <div
            key={index}
            className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex items-center gap-2"
          >
            <FileText className="h-3 w-3" />
            {att.filename}
            <span className="text-gray-400">({att.content_type})</span>
          </div>
        ))}
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
