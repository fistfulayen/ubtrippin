import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Agent Integration — UBTRIPPIN',
  description:
    'Connect your AI agent to UBTRIPPIN. Setup guides for OpenClaw, Claude Desktop, Cursor, ChatGPT, and the REST API.',
}

export default function AgentDocsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#f5f3ef' }}>
      {/* ─── Nav ─── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(245,243,239,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #cbd5e1',
        }}
      >
        <Link href="/">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={140}
            height={32}
            priority
          />
        </Link>
        <Link
          href="/trips"
          className="text-sm font-medium px-4 py-2 rounded-full"
          style={{ background: '#1a1a2e', color: '#fff' }}
        >
          Open App →
        </Link>
      </nav>

      {/* ─── Hero ─── */}
      <div className="pt-28 pb-12 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6" style={{ background: '#e0f2fe', color: '#0369a1' }}>
          Agent Integration
        </div>
        <h1 className="text-4xl font-bold mb-4" style={{ color: '#1a1a2e' }}>
          Your AI Agent + UBTRIPPIN
        </h1>
        <p className="text-lg" style={{ color: '#475569' }}>
          UBTRIPPIN is built for agents. Your trips, your guide entries, your calendar — all accessible via MCP, REST API, or CLI. Two-minute setup.
        </p>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-10">

        {/* ─── Quick-pick ─── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { name: 'OpenClaw', anchor: '#openclaw', emoji: '🦞' },
            { name: 'Claude / Cursor', anchor: '#mcp', emoji: '⚡' },
            { name: 'ChatGPT', anchor: '#chatgpt', emoji: '🤖' },
            { name: 'REST API', anchor: '#rest', emoji: '🔌' },
          ].map((item) => (
            <a
              key={item.anchor}
              href={item.anchor}
              className="flex flex-col items-center justify-center rounded-xl py-4 text-sm font-medium transition-colors"
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                color: '#334155',
              }}
            >
              <span className="text-2xl mb-1">{item.emoji}</span>
              {item.name}
            </a>
          ))}
        </div>

        {/* ─── OpenClaw ─── */}
        <Section id="openclaw" title="OpenClaw Skill" badge="Recommended">
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            If you run <strong>OpenClaw</strong> (the AI agent shell), install the UBTRIPPIN skill with one command. Your agent gains full trip + guide management, calendar access, and import tools — no config files required.
          </p>
          <CodeBlock>openclaw skill install ubtrippin</CodeBlock>
          <p className="text-sm mt-4" style={{ color: '#475569' }}>
            The skill will prompt you for your API key on first use. Generate one in{' '}
            <Link href="/settings" style={{ color: '#2563eb' }}>Settings → API Keys</Link>.
          </p>
          <CapabilityList items={[
            'List, create, update, and delete trips',
            'Add and search itinerary items',
            'Manage city guide entries',
            'Retrieve your iCal calendar feed URL',
            'Check activation status',
            'Invite and manage trip collaborators',
          ]} />
          <p className="text-sm mt-4" style={{ color: '#64748b' }}>
            Source: <a href="https://clawhub.com/skills/ubtrippin" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>clawhub.com/skills/ubtrippin</a>
          </p>
        </Section>

        {/* ─── MCP (Claude Desktop / Cursor / Windsurf) ─── */}
        <Section id="mcp" title="MCP Server — Claude Desktop, Cursor, Windsurf" badge="MCP v1.5">
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            The <code className="px-1 py-0.5 rounded text-xs" style={{ background: '#f1f5f9' }}>ubtrippin-mcp</code> package exposes all UBTRIPPIN tools via the{' '}
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Model Context Protocol</a>.
            Works with any MCP-compatible client.
          </p>

          <h3 className="text-sm font-semibold mb-2 mt-5" style={{ color: '#1a1a2e' }}>1. Generate an API key</h3>
          <p className="text-sm mb-3" style={{ color: '#475569' }}>
            Go to <Link href="/settings" style={{ color: '#2563eb' }}>Settings → API Keys</Link> and create a key. Copy it — you&apos;ll need it in the next step.
          </p>

          <h3 className="text-sm font-semibold mb-2 mt-5" style={{ color: '#1a1a2e' }}>2. Add to your MCP config</h3>
          <p className="text-sm mb-2" style={{ color: '#475569' }}>
            Open your MCP config file and add the UBTRIPPIN server:
          </p>
          <CodeBlock>{`{
  "mcpServers": {
    "ubtrippin": {
      "command": "npx",
      "args": ["-y", "ubtrippin-mcp"],
      "env": {
        "UBTRIPPIN_API_KEY": "your_api_key_here"
      }
    }
  }
}`}</CodeBlock>
          <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>
            Config file location: Claude Desktop → <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) or <code>%APPDATA%\Claude\claude_desktop_config.json</code> (Windows).
          </p>

          <h3 className="text-sm font-semibold mb-2 mt-5" style={{ color: '#1a1a2e' }}>3. Restart Claude / Cursor</h3>
          <p className="text-sm mb-3" style={{ color: '#475569' }}>
            Your AI will now have access to all UBTRIPPIN tools. Try: <em>&quot;Show me my upcoming trips&quot;</em> or <em>&quot;Add a note to my Tokyo trip.&quot;</em>
          </p>

          <CapabilityList items={[
            '30+ tools — trips, items, guides, collaborators, notifications',
            'Calendar feed URL retrieval',
            'Activation status check',
            'Cover image search',
            'Full read/write access',
          ]} />

          <p className="text-sm mt-4" style={{ color: '#64748b' }}>
            npm: <a href="https://www.npmjs.com/package/ubtrippin-mcp" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>npmjs.com/package/ubtrippin-mcp</a>{' '}
            · Docs: <a href="https://github.com/ubtrippin/ubtrippin/blob/main/mcp/README.md" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>mcp/README.md</a>
          </p>
        </Section>

        {/* ─── ChatGPT ─── */}
        <Section id="chatgpt" title="ChatGPT (Custom GPT via Actions)">
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            You can connect UBTRIPPIN to ChatGPT as a Custom GPT with Actions. This uses the REST API directly.
          </p>
          <ol className="space-y-4 text-sm" style={{ color: '#475569' }}>
            <li>
              <strong className="text-slate-800">1. Create a Custom GPT</strong>
              <p className="mt-1">Go to <a href="https://chat.openai.com/gpts/editor" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>chat.openai.com/gpts/editor</a> and start a new GPT.</p>
            </li>
            <li>
              <strong className="text-slate-800">2. Add an Action</strong>
              <p className="mt-1">In the Configure tab, click <strong>Add actions</strong>. Import the OpenAPI schema from:</p>
              <CodeBlock>https://www.ubtrippin.xyz/api/v1/openapi.json</CodeBlock>
            </li>
            <li>
              <strong className="text-slate-800">3. Set authentication</strong>
              <p className="mt-1">Choose <strong>API Key</strong>, header name <code className="px-1 py-0.5 rounded text-xs" style={{ background: '#f1f5f9' }}>Authorization</code>, format <code className="px-1 py-0.5 rounded text-xs" style={{ background: '#f1f5f9' }}>Bearer {'<key>'}</code>.</p>
              <p className="mt-1">Generate your key at <Link href="/settings" style={{ color: '#2563eb' }}>Settings → API Keys</Link>.</p>
            </li>
            <li>
              <strong className="text-slate-800">4. Save and test</strong>
              <p className="mt-1">Ask your GPT: <em>&quot;List my upcoming trips.&quot;</em></p>
            </li>
          </ol>
        </Section>

        {/* ─── REST API ─── */}
        <Section id="rest" title="REST API" badge="v1">
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            Use the REST API directly from any agent, script, or automation tool.
          </p>

          <h3 className="text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>Authentication</h3>
          <p className="text-sm mb-2" style={{ color: '#475569' }}>
            All endpoints require an API key. Generate one at <Link href="/settings" style={{ color: '#2563eb' }}>Settings → API Keys</Link>.
          </p>
          <CodeBlock>{`curl https://www.ubtrippin.xyz/api/v1/trips \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</CodeBlock>

          <h3 className="text-sm font-semibold mb-2 mt-6" style={{ color: '#1a1a2e' }}>Key Endpoints</h3>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th className="text-left px-4 py-2 font-semibold" style={{ color: '#64748b' }}>Method</th>
                  <th className="text-left px-4 py-2 font-semibold" style={{ color: '#64748b' }}>Endpoint</th>
                  <th className="text-left px-4 py-2 font-semibold" style={{ color: '#64748b' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['GET', '/api/v1/trips', 'List all trips'],
                  ['POST', '/api/v1/trips', 'Create a trip'],
                  ['GET', '/api/v1/trips/:id', 'Get trip details + items'],
                  ['PATCH', '/api/v1/trips/:id', 'Update a trip'],
                  ['DELETE', '/api/v1/trips/:id', 'Delete a trip'],
                  ['GET', '/api/v1/trips/upcoming', 'Next 30 days'],
                  ['POST', '/api/v1/trips/:id/items', 'Add item to trip'],
                  ['GET', '/api/v1/guides', 'List city guides'],
                  ['GET', '/api/v1/activation/status', 'Activation funnel state'],
                  ['GET', '/api/v1/calendar', 'iCal feed URL'],
                  ['GET', '/api/v1/imports', 'List import jobs'],
                  ['POST', '/api/v1/imports', 'Create import job (Pro)'],
                  ['GET', '/api/v1/imports/:id', 'Check import status'],
                ].map(([method, path, desc], i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td className="px-4 py-2">
                      <span
                        className="px-1.5 py-0.5 rounded font-mono font-bold"
                        style={{
                          background: method === 'GET' ? '#dcfce7' : method === 'POST' ? '#dbeafe' : method === 'PATCH' ? '#fef9c3' : '#fee2e2',
                          color: method === 'GET' ? '#166534' : method === 'POST' ? '#1d4ed8' : method === 'PATCH' ? '#854d0e' : '#991b1b',
                          fontSize: '10px',
                        }}
                      >
                        {method}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono" style={{ color: '#334155' }}>{path}</td>
                    <td className="px-4 py-2" style={{ color: '#475569' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-4" style={{ color: '#64748b' }}>
            Full reference: <a href="https://github.com/ubtrippin/ubtrippin/blob/main/docs/API.md" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>docs/API.md</a>
          </p>
        </Section>

        {/* ─── Activation status ─── */}
        <Section id="activation" title="Check Activation Status">
          <p className="text-sm mb-4" style={{ color: '#475569' }}>
            Your agent can check whether you&apos;ve forwarded an email yet and where you are in the activation funnel:
          </p>
          <CodeBlock>{`curl https://www.ubtrippin.xyz/api/v1/activation/status \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response:
{
  "activated": true,
  "first_forward_at": "2026-02-20T14:22:00Z",
  "activated_at": "2026-02-20T14:22:00Z",
  "second_trip_at": "2026-02-21T09:15:00Z"
}`}</CodeBlock>
        </Section>

        {/* ─── Support ─── */}
        <div className="text-center pt-4">
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Need help?{' '}
            <a href="mailto:support@ubtrippin.xyz" style={{ color: '#2563eb' }}>
              support@ubtrippin.xyz
            </a>
            {' '}·{' '}
            <Link href="/settings" style={{ color: '#2563eb' }}>
              Get your API key →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  id,
  title,
  badge,
  children,
}: {
  id: string
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div id={id} className="rounded-2xl p-6 scroll-mt-24" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold" style={{ color: '#1a1a2e' }}>
          {title}
        </h2>
        {badge && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#f0fdf4', color: '#166534' }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="rounded-xl text-xs overflow-x-auto p-4"
      style={{ background: '#1e293b', color: '#e2e8f0', lineHeight: '1.6' }}
    >
      <code>{children}</code>
    </pre>
  )
}

function CapabilityList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
          <span className="mt-0.5 text-green-500 flex-shrink-0">✓</span>
          {item}
        </li>
      ))}
    </ul>
  )
}
