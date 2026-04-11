import type { NextConfig } from "next";

// SECURITY: Content Security Policy
// Tightened per OWASP recommendations. Adjust 'connect-src' / 'img-src' if you add new third-party services.
// TODO: Replace 'unsafe-inline' with nonce-based CSP via middleware
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co https://api.unsplash.com;
  frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;
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
  images: {
    remotePatterns: [
      // Supabase Storage — cover images, feedback images, ticket attachments
      { protocol: 'https', hostname: '*.supabase.co' },
      // Unsplash — guide cover images, city hero images
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      // Outgoing — activity images via Cloudflare Images
      { protocol: 'https', hostname: 'imagedelivery.net' },
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
  async redirects() {
    return [
      // PRD-049: Standard SaaS entry points
      { source: '/signup', destination: '/login', permanent: true },
      { source: '/pricing', destination: '/#pricing', permanent: true },
      { source: '/blog', destination: '/dispatches', permanent: true },
      { source: '/blog/:slug', destination: '/dispatches/:slug', permanent: true },
    ];
  },
};

export default nextConfig;
