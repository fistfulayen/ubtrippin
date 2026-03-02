import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer className="border-t border-[#cbd5e1] py-12">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 text-xs tracking-widest uppercase text-slate-500">
          <Link href="/api/v1/docs" className="hover:text-[#1e293b] transition-colors">Docs</Link>
          <span className="text-[#cbd5e1]">·</span>
          <Link href="/api/v1/docs" className="hover:text-[#1e293b] transition-colors">API Reference</Link>
          <span className="text-[#cbd5e1]">·</span>
          <a href="https://github.com/fistfulayen/ubtrippin" target="_blank" rel="noopener noreferrer" className="hover:text-[#1e293b] transition-colors">GitHub</a>
          <span className="text-[#cbd5e1]">·</span>
          <Link href="/privacy" className="hover:text-[#1e293b] transition-colors">Privacy</Link>
          <span className="text-[#cbd5e1]">·</span>
          <Link href="/terms" className="hover:text-[#1e293b] transition-colors">Terms</Link>
        </div>
        <p className="text-xs text-slate-400 font-mono">Made by humans and agents</p>
      </div>
    </footer>
  )
}
