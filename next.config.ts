import type { NextConfig } from "next";

// SECURITY: Content Security Policy
// Tightened per OWASP recommendations. Adjust 'connect-src' / 'img-src' if you add new third-party services.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://images.unsplash.com https://pics.avs.io https://*.supabase.co https://lh3.googleusercontent.com https://www.google.com https://t0.gstatic.com https://t1.gstatic.com https://t2.gstatic.com https://t3.gstatic.com;
  font-src 'self';
  connect-src 'self' https://*.supabase.co https://api.unsplash.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\n/g, " ").trim();

const securityHeaders = [
  // SECURITY: Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // SECURITY: Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // SECURITY: Referrer policy — don't leak full URL to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SECURITY: Permissions policy — disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // SECURITY: HSTS — force HTTPS for 1 year (enable once confirmed HTTPS-only)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // SECURITY: Content Security Policy
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'pics.avs.io' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'cqijgtijuselspyzpphf.supabase.co' },
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: 't0.gstatic.com' },
      { protocol: 'https', hostname: 't1.gstatic.com' },
      { protocol: 'https', hostname: 't2.gstatic.com' },
      { protocol: 'https', hostname: 't3.gstatic.com' },
    ],
  },
  // SECURITY: Apply security headers to all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
