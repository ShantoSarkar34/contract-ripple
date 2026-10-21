import type { NextConfig } from "next";

/**
 * Optional same-origin proxy for the API. When `API_PROXY_TARGET` is set to the
 * API origin (for example `https://contractripple-api.vercel.app`), the
 * frontend can use `NEXT_PUBLIC_API_BASE_URL=/api/v1`. Browser requests then
 * stay same-origin, which keeps the API session cookie first-party and avoids
 * third-party-cookie restrictions. Without it, the frontend talks to the API
 * origin directly and cross-site cookies must be enabled there.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    if (!apiProxyTarget) {
      return [];
    }
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
