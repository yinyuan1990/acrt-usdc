import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (copies only needed node_modules).
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
