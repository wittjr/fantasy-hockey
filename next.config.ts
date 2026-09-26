import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB; the projections spreadsheet upload runs ~2MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
