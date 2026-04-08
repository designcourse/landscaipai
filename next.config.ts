import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Keep heavy Remotion bundler/renderer code out of Vercel route bundles.
  // The route handlers only need @remotion/lambda/client, and the local
  // preview Player only needs @remotion/player + remotion (browser bundles).
  // Without this, route bundles balloon and hit Vercel's 50MB function limit.
  serverExternalPackages: [
    "@remotion/lambda",
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/media-parser",
    "remotion",
  ],
};

export default nextConfig;
