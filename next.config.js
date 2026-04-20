/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// ── Content Security Policy ──────────────────────────────────────────────────
// frame-src 'none' is critical: the platform never embeds external iframes,
// so institutional filters don't need to whitelist any embedded origin.
// connect-src 'self': all API traffic flows through /api/* (Next.js rewrite),
// so the browser only connects to its own origin — firewall-friendly.
const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for styles; unsafe-eval only in dev (HMR)
  `script-src 'self' 'unsafe-inline' https://vercel.live${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // Fonts served locally via next/font — no external font CDN needed
  "font-src 'self'",
  // All API calls go through /api/* (Next.js rewrite) → same origin
  "connect-src 'self' https://*.supabase.co",
  // Never embed external content in iframes — key for institutional filters
  "frame-src https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  // Forces HTTPS for 2 years including subdomains (ignored on plain HTTP in dev)
  { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
  // Prevents the platform from being embedded in external iframes (clickjacking)
  { key: 'X-Frame-Options',            value: 'SAMEORIGIN' },
  // Stops browsers from MIME-sniffing responses away from the declared content-type
  { key: 'X-Content-Type-Options',     value: 'nosniff' },
  // Limits referrer to origin only when crossing origins
  { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
  // Restricts browser APIs not needed by an educational platform
  { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Content-Security-Policy',    value: CSP },
];

// ── Next.js config ───────────────────────────────────────────────────────────
const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },

  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: process.env.NODE_ENV !== 'production'
          ? 'http://localhost:3001/uploads/:path*'
          : 'https://usnbntftlguegjzadsgv.supabase.co/storage/v1/object/public/uploads/:path*'
      }
    ];
  },

  images: {
    // Allow Next.js to proxy any HTTPS image through /_next/image.
    // This means resource thumbnails are served from the platform's own origin,
    // not from i.ibb.co or other external CDNs — avoids firewall blocks.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'http',  hostname: '127.0.0.1' },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

module.exports = nextConfig;
