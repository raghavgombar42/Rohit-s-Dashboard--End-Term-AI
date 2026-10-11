import type { NextConfig } from "next";

// cacheComponents is intentionally off: every page shows live pipeline state from Postgres,
// so we render per request (force-dynamic) instead of prerendering static shells.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
