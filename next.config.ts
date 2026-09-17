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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  // Next 16 defaults to Turbopack; empty block silences the webpack/turbopack mismatch
  // when tooling inspects this file without the --webpack flag.
  turbopack: {},
  async rewrites() {
    if (!uploadOrigin) return [];
    return [
      {
        source: "/uploads/:path*",
        destination: `${uploadOrigin}/uploads/:path*`,
      },
    ];
  },
  // OneDrive / cloud-synced Desktop folders can touch file mtimes and trigger
  // endless Fast Refresh ("Compiling…" loops). Applied when running `next dev --webpack`.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/dist/**",
          "**/coverage/**",
          "**/backend/dist/**",
        ],
        aggregateTimeout: 800,
      };
    }
    return config;
  },
};

export default nextConfig;