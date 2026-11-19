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
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "bookmybota-backend.onrender.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/**",
      },
    ],
  },
  // Prefer Turbopack in `npm run dev` (lower RAM than webpack on 8–16GB laptops).
  // Keep empty turbopack block so Next does not warn when configs are inspected.
  turbopack: {},
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "recharts",
      "framer-motion",
      "motion",
      "swiper",
      "sonner",
    ],
  },
  async rewrites() {
    if (!uploadOrigin) return [];
    return [
      {
        source: "/uploads/:path*",
        destination: `${uploadOrigin}/uploads/:path*`,
      },
    ];
  },
  // Fallback for `npm run dev:webpack` only — dampens watch thrash on slow / synced disks.
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
        aggregateTimeout: 1000,
        poll: false,
      };
    }
    return config;
  },
};

export default nextConfig;