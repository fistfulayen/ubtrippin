import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If logged in, redirect to trips
  if (user) {
    redirect('/trips')
  }

  return (
    <div className="min-h-screen bg-[#f4ead5] relative overflow-hidden">
      {/* Vintage paper texture overlay */}
      <div className="fixed inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_20%_50%,rgba(139,69,19,0.03),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(139,69,19,0.03),transparent_50%)]" />

      {/* Ink splatters */}
      <div className="fixed top-[5%] right-[10%] w-8 h-8 bg-black/10 rounded-full blur-sm animate-float" />
      <div className="fixed bottom-[15%] right-[5%] w-4 h-4 bg-black/5 rounded-full blur-sm animate-float-delayed" />

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-6 py-12 max-w-6xl">
        {/* Header */}
        <header className="mb-20 animate-sketch-in">
          <div className="inline-block transform -rotate-1">
            <h1 className="text-7xl md:text-9xl font-black tracking-tight mb-2 sketch-text">
              UBTRIPPIN
            </h1>
            <div className="h-1 bg-black sketch-underline" />
          </div>
        </header>

        {/* Hero Section */}
        <section className="grid md:grid-cols-2 gap-12 mb-32 items-center">
          <div className="animate-slide-in-left">
            {/* Traveler illustration placeholder */}
            <div className="relative">
              <div className="sketch-border p-8 bg-white/50 backdrop-blur-sm transform rotate-1">
                <div className="aspect-square flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-8xl mb-4 animate-bounce-gentle">✈️</div>
                    <p className="text-2xl font-bold sketch-text">Email Your Trip Stuff</p>
                  </div>
                </div>
              </div>
              {/* Decorative corner fold */}
              <div className="absolute -top-3 -right-3 w-12 h-12 bg-black/5 transform rotate-45 sketch-border" />
            </div>
          </div>

          <div className="space-y-8 animate-slide-in-right">
            <div className="sketch-border p-8 bg-white/70 backdrop-blur-sm transform -rotate-1 hover:rotate-0 transition-transform duration-300">
              <h2 className="text-4xl md:text-5xl font-black mb-4 sketch-text leading-tight">
                I Organize It Fo Ya
              </h2>
              <p className="text-xl md:text-2xl leading-relaxed handwritten-text">
                Forward your flight confirmations, hotel bookings, and rental car emails to{' '}
                <span className="inline-block px-3 py-1 bg-black text-white font-bold transform -rotate-1">
                  trips@ubtrippin.xyz
                </span>
              </p>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Link
                href="/login"
                className="inline-block px-8 py-4 bg-black text-white text-xl font-bold sketch-border hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 hover:-rotate-1"
              >
                Get Started
              </Link>
              <a
                href="mailto:trips@ubtrippin.xyz"
                className="inline-block px-8 py-4 bg-white text-black text-xl font-bold sketch-border hover:bg-black hover:text-white transition-all duration-300 transform hover:scale-105 hover:rotate-1"
              >
                Send Email
              </a>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid md:grid-cols-3 gap-8 mb-32">
          <div className="sketch-border p-6 bg-white/60 backdrop-blur-sm transform rotate-1 hover:-rotate-1 transition-all duration-300 animate-fade-in-up delay-100">
            <div className="text-5xl mb-4 animate-bounce-gentle">📄</div>
            <h3 className="text-2xl font-black mb-3 sketch-text">Auto-Magic Parsing</h3>
            <p className="text-lg handwritten-text">
              AI extracts flights, hotels, cars, and activities from your confirmation emails
            </p>
          </div>

          <div className="sketch-border p-6 bg-white/60 backdrop-blur-sm transform -rotate-1 hover:rotate-1 transition-all duration-300 animate-fade-in-up delay-200">
            <div className="text-5xl mb-4 animate-bounce-gentle" style={{ animationDelay: '0.1s' }}>📅</div>
            <h3 className="text-2xl font-black mb-3 sketch-text">Smart Organization</h3>
            <p className="text-lg handwritten-text">
              Automatically groups related bookings into trips with dates and locations
            </p>
          </div>

          <div className="sketch-border p-6 bg-white/60 backdrop-blur-sm transform rotate-1 hover:-rotate-1 transition-all duration-300 animate-fade-in-up delay-300">
            <div className="text-5xl mb-4 animate-bounce-gentle" style={{ animationDelay: '0.2s' }}>🗺️</div>
            <h3 className="text-2xl font-black mb-3 sketch-text">Beautiful Itineraries</h3>
            <p className="text-lg handwritten-text">
              View your trip timeline and export to PDF for offline access
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-32 animate-fade-in-up delay-400">
          <div className="text-center mb-12">
            <h2 className="text-5xl md:text-6xl font-black sketch-text inline-block transform -rotate-1">
              How It Works
            </h2>
            <div className="h-1 w-32 bg-black mx-auto mt-4 sketch-underline" />
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: '1', title: 'Forward Emails', desc: 'Send confirmations to trips@ubtrippin.xyz' },
              { num: '2', title: 'AI Extracts', desc: 'We parse dates, locations, and details' },
              { num: '3', title: 'Organized Trip', desc: 'View your itinerary and export to PDF' }
            ].map((step, i) => (
              <div key={i} className="text-center animate-fade-in-up" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                <div className="inline-block sketch-border bg-black text-white w-20 h-20 flex items-center justify-center transform rotate-3 hover:-rotate-3 transition-transform duration-300 mb-6">
                  <span className="text-4xl font-black">{step.num}</span>
                </div>
                <h3 className="text-2xl font-black mb-2 sketch-text">{step.title}</h3>
                <p className="text-lg handwritten-text">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center mb-20 animate-fade-in-up delay-700">
          <div className="sketch-border p-12 bg-white/80 backdrop-blur-sm inline-block transform -rotate-1 hover:rotate-0 transition-all duration-300">
            <h2 className="text-4xl md:text-5xl font-black mb-6 sketch-text">
              Start Organizing Your Adventures
            </h2>
            <p className="text-xl md:text-2xl mb-8 handwritten-text max-w-2xl mx-auto">
              Sign in with Google to start forwarding your travel confirmations
            </p>
            <Link
              href="/login"
              className="inline-block px-12 py-6 bg-black text-white text-2xl font-bold sketch-border hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-110"
            >
              Get Started Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t-2 border-black/20 animate-fade-in">
          <p className="text-lg handwritten-text">
            Made with ✈️ by travelers, for travelers
          </p>
        </footer>
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Cabin+Sketch:wght@400;700&family=Patrick+Hand&display=swap');

        .sketch-text {
          font-family: 'Cabin Sketch', cursive;
          letter-spacing: 0.02em;
          text-shadow: 2px 2px 0px rgba(0,0,0,0.1);
        }

        .handwritten-text {
          font-family: 'Patrick Hand', cursive;
          letter-spacing: 0.01em;
        }

        .sketch-border {
          border: 3px solid black;
          box-shadow:
            4px 4px 0px rgba(0,0,0,0.8),
            -1px -1px 0px rgba(0,0,0,0.1);
          position: relative;
        }

        .sketch-border::before {
          content: '';
          position: absolute;
          inset: -3px;
          border: 1px solid rgba(0,0,0,0.2);
          pointer-events: none;
        }

        .sketch-underline {
          transform: skewY(-1deg);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        @keyframes sketch-in {
          from {
            opacity: 0;
            transform: translateY(-20px) rotate(-2deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotate(-1deg);
          }
        }

        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-50px) rotate(2deg);
          }
          to {
            opacity: 1;
            transform: translateX(0) rotate(1deg);
          }
        }

        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(50px) rotate(-2deg);
          }
          to {
            opacity: 1;
            transform: translateX(0) rotate(-1deg);
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes bounce-gentle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(10px, -10px) rotate(5deg);
          }
        }

        @keyframes float-delayed {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(-8px, 8px) rotate(-5deg);
          }
        }

        .animate-sketch-in {
          animation: sketch-in 0.8s ease-out;
        }

        .animate-slide-in-left {
          animation: slide-in-left 0.8s ease-out 0.2s both;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.8s ease-out 0.3s both;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out both;
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out 1s both;
        }

        .animate-bounce-gentle {
          animation: bounce-gentle 3s ease-in-out infinite;
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .delay-400 {
          animation-delay: 0.4s;
        }

        .delay-700 {
          animation-delay: 0.7s;
        }
      `}</style>
    </div>
  )
}
