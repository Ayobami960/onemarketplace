import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.imagekit.net",
        port: "",
        pathname: "/avatars/**",
      },
      {
        protocol: "https",
        hostname: "*.imagekit.net",
        port: "",
        pathname: "/onemarketplace/**",
      },
    ],
  },
};

export default nextConfig;
