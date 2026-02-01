import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { EmailCorrectionView } from '@/components/email/email-correction-view'

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

      <EmailCorrectionView email={emailData} />
    </div>
  )
}
