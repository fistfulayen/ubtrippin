import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

interface AffiliateLandingPageProps {
  params: Promise<{ code: string }>
}

const AFFILIATE_CODE_RE = /^[A-Z0-9]{3,32}$/

function normalizeAffiliateCode(raw: string): string | null {
  const normalized = raw.trim().toUpperCase()
  return AFFILIATE_CODE_RE.test(normalized) ? normalized : null
}

export default async function AffiliateLandingPage({ params }: AffiliateLandingPageProps) {
  const { code } = await params
  const normalizedCode = normalizeAffiliateCode(code)

  if (!normalizedCode) {
    redirect('/')
  }

  const cookieStore = await cookies()
  cookieStore.set('aff', normalizedCode, {
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days
    httpOnly: true,
    sameSite: 'lax',
  })

  redirect('/login')
}
