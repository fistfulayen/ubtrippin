'use client'

import { useState } from 'react'

const tabs = [
  { label: 'Skill', content: 'clawhub install ubtrippin' },
  {
    label: 'MCP',
    content: `{
  "mcpServers": {
    "ubtrippin": {
      "command": "npx",
      "args": ["ubtrippin-mcp"],
      "env": {
        "UBT_API_KEY": "ubt_k1_..."
      }
    }
  }
}`,
  },
  {
    label: 'API',
    content: `curl https://www.ubtrippin.xyz/api/v1/trips \\
  -H "Authorization: Bearer $UBT_API_KEY"`,
  },
  { label: 'CLI', content: 'ubt trips list' },
]

export function AgentTabs() {
  const [active, setActive] = useState(0)

  return (
    <div className="border border-[#1e293b] bg-[#1e293b] overflow-hidden">
      <div className="flex border-b border-slate-700">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`px-6 py-3 font-mono text-sm transition-colors ${
              active === i
                ? 'text-white bg-white/10 border-b-2 border-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <pre className="p-6 text-[#f8fafc] font-mono text-sm overflow-x-auto whitespace-pre leading-relaxed">
        {tabs[active].content}
      </pre>
    </div>
  )
}
