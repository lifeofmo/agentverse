/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is only for Docker self-hosting — Vercel handles its own output.
  // Enable only when DOCKER=true so Railway/Docker builds still work.
  ...(process.env.DOCKER === "true" ? { output: "standalone" } : {}),

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
