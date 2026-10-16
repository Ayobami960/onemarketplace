import type { NextConfig } from "next";

/*
 * ImageKit serves images from the URL endpoint configured via IMAGEKIT_END_POINT.
 * That is typically a CloudFront distribution (ik********.cloudfront.net) or a
 * custom domain. The *.imagekit.net hostname is the API endpoint, not the CDN.
 *
 * Allow the common ImageKit CDN hostnames plus any custom domain that uses the
 * /avatars and /onemarketplace path prefixes.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/avatars/**",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/onemarketplace/**",
      },
      {
        protocol: "https",
        hostname: "*.imagekit.net",
        pathname: "/avatars/**",
      },
      {
        protocol: "https",
        hostname: "*.imagekit.net",
        pathname: "/onemarketplace/**",
      },
    ],
  },
};

export default nextConfig;
