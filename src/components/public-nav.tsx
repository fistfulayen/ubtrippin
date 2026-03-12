import Link from 'next/link'
import Image from 'next/image'

export function PublicNav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-sm border-b border-[#cbd5e1]">
      <div className="flex items-center gap-8">
        <Link href="/">
          <Image
            src="/ubtrippin_logo_simple.png"
            alt="UBTRIPPIN"
            width={160}
            height={55}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm tracking-wide text-[#1e293b]">
          <Link href="/#features" className="hover:text-[#312e81] transition-colors">Features</Link>
          <Link href="/demo" className="hover:text-[#312e81] transition-colors">Demo</Link>
          <Link href="/#pricing" className="hover:text-[#312e81] transition-colors">Pricing</Link>
          <Link href="/cities" className="hover:text-[#312e81] transition-colors">Events</Link>
          <Link href="/#agents" className="hover:text-[#312e81] transition-colors">For Agents</Link>
          <Link href="/dispatches" className="hover:text-[#312e81] transition-colors">Story</Link>
        </div>
      </div>
      <Link
        href="/login"
        className="px-5 py-2 text-sm tracking-widest uppercase bg-[#1e293b] text-white hover:bg-[#312e81] transition-colors font-medium"
      >
        Get Started Free
      </Link>
    </nav>
  )
}
