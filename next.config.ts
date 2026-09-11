import type { NextConfig } from "next";

/** Backend origin for proxying `/uploads` in local/dev so links never hit :3000. */
function uploadsProxyDestination(): string | null {
  const fromEnv =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv.replace(/\/api\/?$/i, "")).origin;
    } catch {
      /* fall through */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5000";
  }
  return null;
}

const uploadOrigin = uploadsProxyDestination();

const nextConfig: NextConfig = {
  async rewrites() {
    if (!uploadOrigin) return [];
    return [
      {
        source: "/uploads/:path*",
        destination: `${uploadOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
