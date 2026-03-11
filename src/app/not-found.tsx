import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16">
      {/* Trippin guy */}
      <Image
        src="/runner_transparent.png"
        alt="UBTRIPPIN"
        width={200}
        height={200}
        className="w-32 sm:w-40 mb-8"
        priority
      />

      {/* 404 */}
      <p className="text-6xl sm:text-8xl font-bold text-slate-200 tracking-tighter mb-2">
        404
      </p>
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-3">
        This page doesn&apos;t exist
      </h1>
      <p className="text-slate-500 text-center max-w-md mb-10 leading-relaxed">
        You might have followed a bad link, or the page may have moved.
      </p>

      {/* What we do */}
      <div className="border-t border-slate-200 pt-8 mb-10 max-w-md text-center">
        <p className="text-sm text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-800">UB Trippin</span> organizes your travel.
          Forward a booking email, your trip appears — flights, hotels, trains, concerts.
          Share with family. Remember your favorite places.
        </p>
      </div>

      {/* CTA */}
      <Link
        href="/"
        className="px-8 py-4 text-sm tracking-widest uppercase bg-slate-800 text-white hover:bg-indigo-800 transition-colors font-medium shadow-lg hover:scale-105"
      >
        Go to Homepage
      </Link>
    </div>
  )
}
