import type { NextConfig } from "next";

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK_API === 'true') {
  throw new Error("NEXT_PUBLIC_USE_MOCK_API=true is forbidden in production environment.");
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
