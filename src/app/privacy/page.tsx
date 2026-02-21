export const metadata = {
  title: 'Privacy Policy — UBTRIPPIN',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-[#2a2419]">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: February 21, 2026</p>

      <div className="space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3">The Short Version</h2>
          <p>
            UB Trippin organizes your travel plans. To do that, we need to read your booking
            emails and store your trip data. We treat that data the way we&apos;d want ours
            treated: carefully, privately, and never sold to anyone. That&apos;s it. That&apos;s
            the policy.
          </p>
          <p className="mt-3">
            What follows is the longer version, because lawyers exist and Google requires it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">What We Collect</h2>
          <p><strong>Account information:</strong> Your name and email address from Google when you sign in. We don&apos;t ask for your password — Google handles authentication.</p>
          <p className="mt-3"><strong>Travel data:</strong> When you forward booking confirmation emails to us, we extract trip details — flights, hotels, trains, restaurants, activities. This includes dates, times, locations, confirmation codes, and traveler names.</p>
          <p className="mt-3"><strong>Email content:</strong> We store the content of emails you forward to us for processing and so you can review what was extracted. We do not access your email inbox — you choose what to send us.</p>
          <p className="mt-3"><strong>Usage data:</strong> Basic server logs (IP addresses, browser type, pages visited). We don&apos;t use tracking cookies or analytics services.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">How We Use It</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To create and organize your trip itineraries</li>
            <li>To extract travel details from your forwarded emails using AI</li>
            <li>To generate PDFs and shareable trip pages</li>
            <li>To improve our extraction accuracy (we learn from corrections you make)</li>
          </ul>
          <p className="mt-3">We do not use your data for advertising. We do not sell your data. We do not share your data with third parties except as described below.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
          <p>We use a small number of services to operate:</p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li><strong>Supabase</strong> — database and authentication (your data is stored here)</li>
            <li><strong>Vercel</strong> — hosting and deployment</li>
            <li><strong>Resend</strong> — email processing (receives your forwarded booking emails)</li>
            <li><strong>Anthropic (Claude)</strong> — AI extraction of travel details from email content</li>
          </ul>
          <p className="mt-3">
            When you forward an email, its content is sent to Anthropic&apos;s API for extraction.
            Anthropic does not use API inputs for training. Your email content is processed and
            not retained by Anthropic beyond what&apos;s needed to complete the request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Data Storage and Security</h2>
          <p>
            Your data is stored in Supabase (hosted in the EU — Ireland). We use row-level
            security so users can only access their own trips. All connections are encrypted
            via TLS. We don&apos;t store passwords — authentication is handled entirely by Google OAuth.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
          <p>You can:</p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li><strong>Access</strong> all your data through the app at any time</li>
            <li><strong>Delete</strong> any trip, item, or your entire account</li>
            <li><strong>Export</strong> your trips as PDF or markdown</li>
            <li><strong>Correct</strong> any extracted data that&apos;s wrong</li>
          </ul>
          <p className="mt-3">
            If you want to delete your account entirely, email us at{' '}
            <a href="mailto:privacy@ubtrippin.xyz" className="underline">privacy@ubtrippin.xyz</a>{' '}
            and we&apos;ll remove everything within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Children</h2>
          <p>
            UB Trippin is not designed for children under 16. We don&apos;t knowingly collect
            data from minors. If you believe we have, contact us and we&apos;ll delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Changes</h2>
          <p>
            If we change this policy in any meaningful way, we&apos;ll update the date at the
            top and, if the change is significant, notify you via the app. We won&apos;t
            quietly make your data less private.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Contact</h2>
          <p>
            Questions, concerns, or requests:{' '}
            <a href="mailto:privacy@ubtrippin.xyz" className="underline">privacy@ubtrippin.xyz</a>
          </p>
        </section>

        <section className="border-t pt-6 text-sm text-gray-500 italic">
          <p>
            We wrote this policy to be readable by humans, not just lawyers. If something
            is unclear, that&apos;s our fault — ask us and we&apos;ll explain.
          </p>
        </section>
      </div>
    </div>
  )
}
