export const metadata = {
  title: 'Terms of Service — UBTRIPPIN',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-[#1e1b4b]">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: February 21, 2026</p>

      <div className="space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3">What This Is</h2>
          <p>
            UB Trippin is a travel organization service. You forward your booking emails
            to us, and we turn them into organized trip itineraries. These terms govern
            your use of the service at ubtrippin.xyz.
          </p>
          <p className="mt-3">
            By using UB Trippin, you agree to these terms. If you don&apos;t agree, don&apos;t
            use the service. (We&apos;ll be sorry to see you go, but we respect the choice.)
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Your Account</h2>
          <p>
            You sign in with Google. You&apos;re responsible for your Google account&apos;s
            security — we can&apos;t help if someone else has access to it. One account
            per person, please. Your account is yours; don&apos;t share access or let
            others use it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">What You Can Do</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Forward booking emails to create trip itineraries</li>
            <li>View, edit, and organize your trips</li>
            <li>Export trips as PDF or markdown</li>
            <li>Share trips via generated links</li>
            <li>Delete any of your data at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">What You Shouldn&apos;t Do</h2>
          <p>The usual things reasonable people don&apos;t do:</p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>Try to access other people&apos;s trips or data</li>
            <li>Send us emails containing malware or intentionally malicious content</li>
            <li>Attempt to overwhelm the service with automated requests</li>
            <li>Use the service for anything illegal</li>
            <li>Reverse engineer the service (though the code is open source, so you can just read it)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Your Data</h2>
          <p>
            Your trip data belongs to you. We store it to provide the service. You can
            export it or delete it at any time. See our{' '}
            <a href="/privacy" className="underline">Privacy Policy</a> for the full
            details on how we handle your data.
          </p>
          <p className="mt-3">
            When you forward an email to us, you&apos;re giving us permission to process
            its contents to extract travel information. We use AI for this, which means
            the email content is sent to our AI provider (Anthropic) for processing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">AI and Accuracy</h2>
          <p>
            Our AI extraction is good but not perfect. It might misread a gate number,
            get a time zone wrong, or confuse your hotel with a restaurant. (We&apos;re
            working on it.) Always verify important details against your original
            booking confirmations. We are not liable for missed flights because our
            AI misread a departure time.
          </p>
          <p className="mt-3">
            You can correct any extraction errors, and those corrections help us improve.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">The Service</h2>
          <p>
            UB Trippin is provided &quot;as is.&quot; We do our best to keep it running,
            accurate, and secure, but we can&apos;t guarantee 100% uptime or 100%
            extraction accuracy. We&apos;re a small team building something new.
          </p>
          <p className="mt-3">
            We may change, update, or discontinue features. If we ever shut down the
            service entirely, we&apos;ll give you reasonable notice and a way to export
            your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Liability</h2>
          <p>
            To the extent permitted by law, UB Trippin&apos;s liability is limited to
            the amount you&apos;ve paid us for the service. (Which, if you&apos;re on
            the free tier, is nothing. We acknowledge the mathematical implications.)
          </p>
          <p className="mt-3">
            We are not responsible for: travel plans that go wrong, bookings that
            change after you imported them, AI extraction errors, or anything that
            happens during your actual trip. We organize information — we don&apos;t
            operate airlines.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Open Source</h2>
          <p>
            UB Trippin is open source under the{' '}
            <a href="https://github.com/fistfulayen/ubtrippin" className="underline">AGPL-3.0 license</a>.
            You can read the code, contribute to it, or run your own instance. The
            license means that if you modify and host it, you need to share your
            modifications too.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Changes to These Terms</h2>
          <p>
            We may update these terms. If the changes are significant, we&apos;ll let
            you know. Continued use after changes means you accept them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Governing Law</h2>
          <p>
            These terms are governed by the laws of France. Any disputes will be
            resolved in the courts of Paris.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Contact</h2>
          <p>
            Questions about these terms:{' '}
            <a href="mailto:hello@ubtrippin.xyz" className="underline">hello@ubtrippin.xyz</a>
          </p>
        </section>

        <section className="border-t pt-6 text-sm text-gray-500 italic">
          <p>
            These terms were written to be understood, not to be weaponized. If
            something reads like it was designed to trick you, that wasn&apos;t the
            intent — let us know and we&apos;ll fix it.
          </p>
        </section>
      </div>
    </div>
  )
}
