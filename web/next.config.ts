import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (copies only needed node_modules).
  output: "standalone",
  poweredByHeader: false,
  // Static one-off pages under public/<dir>/index.html, reachable at /<dir>.
  async rewrites() {
    return [{ source: "/compare", destination: "/compare/index.html" }];
  },
};

export default nextConfig;
