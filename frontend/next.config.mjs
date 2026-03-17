/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker standalone image (copies only needed files)
  output: "standalone",
  // Make backend URL configurable at build/runtime
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || "",
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
