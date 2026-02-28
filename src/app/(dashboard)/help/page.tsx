import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown, ExternalLink } from 'lucide-react'

import { HelpSearch } from './help-search'
import { HelpSidebar } from './help-sidebar'

interface HelpSection {
  id: string
  title: string
  searchText: string
  content: React.ReactNode
}

export const metadata: Metadata = {
  title: 'Help Center — UBTRIPPIN',
  description: 'User documentation for using UBTRIPPIN travel planning features.',
}

const sections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    searchText:
      'forward bookings supported types flights trains hotels cars restaurants activities extraction missing data correction',
    content: (
      <>
        <p>
          Forward booking confirmations to <strong>trips@ubtrippin.xyz</strong>. Most imports are processed in under 30 seconds.
        </p>
        <p>Supported reservation types include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Flights</li>
          <li>Trains</li>
          <li>Hotels</li>
          <li>Cars</li>
          <li>Restaurants</li>
          <li>Activities</li>
        </ul>
        <p>
          If extraction misses details, open the message in <Link href="/inbox" className="text-indigo-600 hover:text-indigo-500">Inbox</Link> and correct the parsed fields, or add the missing reservation manually in your trip.
        </p>
      </>
    ),
  },
  {
    id: 'managing-trips',
    title: 'Managing Trips',
    searchText:
      'auto created ai named edit details dates cover image add manually delete trip item merge',
    content: (
      <>
        <p>
          Trips are automatically created from your forwarded emails and named based on destination, dates, and context. You can rename any trip at any time.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Edit title, date range, location, travelers, and notes from the trip page.</li>
          <li>Pick or refresh trip cover images.</li>
          <li>Add missing items manually from <strong>Add item</strong>.</li>
          <li>Delete individual items or remove an entire trip.</li>
          <li>Merge duplicate trips if reservations were split across multiple imports.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing-collaboration',
    title: 'Sharing & Collaboration',
    searchText:
      'public share link collaborator invite viewer editor permissions owner pro',
    content: (
      <>
        <p>
          You can share a trip as a public read-only page using a share link, and you can invite collaborators for in-app collaboration.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Public share links show trip timeline details but hide sensitive booking fields.</li>
          <li>Collaborator invites support viewer and editor roles.</li>
          <li>Only the trip owner can manage collaborators or remove access.</li>
          <li>Collaborator invitations are a Pro feature.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'calendar',
    title: 'Calendar Sync',
    searchText:
      'google apple outlook ical sync refresh frequency hourly events one way pro',
    content: (
      <>
        <p>
          UBTRIPPIN provides a private calendar feed URL that works with Google Calendar, Apple Calendar, Outlook, and other iCal-compatible apps.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Generate your feed in <Link href="/settings" className="text-indigo-600 hover:text-indigo-500">Settings</Link> under Calendar Feed.</li>
          <li>Use <strong>Add to Google Calendar</strong> or <strong>Add to Apple Calendar</strong> shortcuts, or paste the feed URL into Outlook.</li>
          <li>Feed updates approximately hourly.</li>
          <li>Events include trip and booking details like flights, hotel stays, and activities.</li>
          <li>Sync is one-way (UBTRIPPIN to your calendar app).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'loyalty',
    title: 'Loyalty Programs',
    searchText:
      'frequent flyer number hotel loyalty encrypted storage at rest preferred traveler',
    content: (
      <>
        <p>
          Store your frequent flyer and loyalty program numbers in Loyalty so you and your agents can reuse them during booking.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Add programs by airline, hotel, car rental, or other provider.</li>
          <li>Set preferred programs and traveler-specific entries.</li>
          <li>Loyalty numbers are encrypted at rest.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'city-guides',
    title: 'City Guides',
    searchText: 'create guide city add places map share token links restaurants hotels favorites',
    content: (
      <>
        <p>
          Use City Guides to build reusable collections of places for destinations you visit often.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create a guide from <Link href="/guides" className="text-indigo-600 hover:text-indigo-500">Guides</Link> and add entries (restaurants, cafes, hotels, museums, and more).</li>
          <li>View guide entries on an interactive map.</li>
          <li>Share guides with a public link when you want others to browse your recommendations.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'family-sharing',
    title: 'Family Sharing',
    searchText:
      'create family invite members shared trips loyalty guides profiles pro required',
    content: (
      <>
        <p>
          Family Sharing creates a shared travel context across accepted members.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create a family and send invites from <Link href="/settings/family" className="text-indigo-600 hover:text-indigo-500">Settings → Family</Link>.</li>
          <li>Shared data includes trips, loyalty programs, profiles/preferences, and city guides.</li>
          <li>Creating a family and inviting members requires Pro for the inviter.</li>
          <li>Accepted members can be on free or Pro plans.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'developers-agents',
    title: 'For Developers & Agents',
    searchText:
      'rest api docs mcp server openclaw skill webhooks notifications integrations',
    content: (
      <>
        <p>
          UBTRIPPIN is agent-friendly with REST APIs, MCP support, and webhook events.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            REST API reference:{' '}
            <a
              href="https://github.com/fistfulayen/ubtrippin/blob/main/docs/API.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
            >
              docs/API.md <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
          <li>
            MCP server docs:{' '}
            <a
              href="https://github.com/fistfulayen/ubtrippin/blob/main/mcp/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
            >
              mcp/README.md <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
          <li>
            OpenClaw skill and agent setup:{' '}
            <a
              href="/docs/agents"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Agent integration docs
            </a>
          </li>
          <li>
            Webhook notifications:{' '}
            <Link href="/settings/webhooks" className="text-indigo-600 hover:text-indigo-500">Settings → Webhooks</Link>{' '}
            and{' '}
            <a
              href="https://github.com/fistfulayen/ubtrippin/blob/main/docs/WEBHOOKS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
            >
              docs/WEBHOOKS.md <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'billing-pro',
    title: 'Billing & Pro',
    searchText:
      'free vs pro early adopter pricing manage subscription portal upgrade billing',
    content: (
      <>
        <p>
          UBTRIPPIN has free and Pro tiers. Free includes core trip management and extraction. Pro adds advanced collaboration and automation features.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Check your current plan in <Link href="/settings/billing" className="text-indigo-600 hover:text-indigo-500">Settings → Billing</Link>.</li>
          <li>Use Billing to upgrade, manage, or cancel your subscription.</li>
          <li>Early adopter pricing appears in-app when spots are available.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ',
    searchText:
      'wrong email work travel private data delete account privacy',
    content: (
      <>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800">What if I forward the wrong email?</h3>
            <p>
              Delete the incorrect item from the trip (or delete the whole trip if needed). If the import is still processing, wait for completion and then remove it from your dashboard.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Can I use it for work travel?</h3>
            <p>
              Yes. Many users run personal and work trips side by side. You can keep separate trips, share selected itineraries, and invite collaborators when needed.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Is my data private?</h3>
            <p>
              Data is access-controlled per user account, and loyalty numbers are encrypted at rest. You control public sharing per trip and can turn it off at any time.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">How do I delete my account?</h3>
            <p>
              Email{' '}
              <a href="mailto:privacy@ubtrippin.xyz" className="text-indigo-600 hover:text-indigo-500">
                privacy@ubtrippin.xyz
              </a>{' '}
              to request full account deletion.
            </p>
          </div>
        </div>
      </>
    ),
  },
]

export default function HelpPage() {
  const sectionMeta = sections.map(({ id, title, searchText }) => ({ id, title, searchText }))
  const sidebarSections = sections.map(({ id, title }) => ({ id, title }))

  return (
    <div className="mx-auto max-w-6xl text-slate-800">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Help Center</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Find quick answers for forwarding bookings, managing trips, sharing with others, syncing calendars, and using UBTRIPPIN with agents.
        </p>
        <HelpSearch sections={sectionMeta} />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <HelpSidebar sections={sidebarSections} />

        <div className="space-y-4">
          <p
            id="help-no-results"
            hidden
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600"
          >
            No matching sections found. Try a different keyword.
          </p>

          {sections.map((section) => (
            <details
              key={section.id}
              id={section.id}
              open
              className="group scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4"
            >
              <summary className="flex list-none cursor-pointer items-start justify-between gap-3 md:cursor-default md:pointer-events-none">
                <h2 className="text-xl font-semibold text-indigo-600">{section.title}</h2>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 md:hidden" />
              </summary>
              <div className="mt-4 border-t border-slate-100 pt-4 text-sm leading-7 text-slate-700">
                {section.content}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
