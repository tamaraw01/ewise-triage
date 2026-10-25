import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:asset(samples|map-photos|map-atlas)/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
    }, {
      source: "/gallery/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" }],
    }, {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
