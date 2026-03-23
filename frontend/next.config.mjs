/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is only for Docker self-hosting — Vercel handles its own output.
  // Enable only when DOCKER=true so Railway/Docker builds still work.
  ...(process.env.DOCKER === "true" ? { output: "standalone" } : {}),

  // Rewrite SPA tab routes → homepage (tab is set via hash/query on the client)
  async redirects() {
    return [
      { source: "/store",       destination: "/?tab=marketplace", permanent: false },
      { source: "/worlds",      destination: "/?tab=city",        permanent: false },
      { source: "/playground",  destination: "/?tab=playground",  permanent: false },
      { source: "/developer",   destination: "/?tab=developer",   permanent: false },
      { source: "/challenges",  destination: "/?tab=challenges",  permanent: false },
    ];
  },

  // Security headers for production
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",            value: "DENY" },
          { key: "X-XSS-Protection",           value: "1; mode=block" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
