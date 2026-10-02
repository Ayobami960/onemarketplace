import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        hostname: "img.clerk.com*"
      }
    ]
  }
};

export default nextConfig;
