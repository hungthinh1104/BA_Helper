import type { NextConfig } from "next";

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
  throw new Error("NEXT_PUBLIC_USE_MOCK_API=true is forbidden in production environment.");
}

/**
 * Resolve the backend origin the Next server proxies browser `/api/v1/*` calls
 * to. `rewrites()` runs at `next start`, so this reads the runtime env (no API
 * origin is baked into the client bundle). NextAuth stays on `/api/auth/*` and is
 * intentionally NOT proxied.
 */
function resolveApiProxyTarget(): string {
  const raw = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "";
  return raw.trim().replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    const target = resolveApiProxyTarget();
    if (!target) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
