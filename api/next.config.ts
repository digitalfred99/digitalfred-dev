import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["typeorm", "pg", "bcrypt"],
  experimental: {
    agentFeedback: true,
  },
};

export default nextConfig;
