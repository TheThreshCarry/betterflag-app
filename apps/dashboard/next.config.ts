import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@shipos/core", "@shipos/db"],
  typedRoutes: false,
};

export default nextConfig;
