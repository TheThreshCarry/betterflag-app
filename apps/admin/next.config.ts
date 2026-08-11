import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@betterflag/core", "@betterflag/db"],
  typedRoutes: false,
};

export default nextConfig;
