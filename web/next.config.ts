import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "79.156.162.156",
    "79.*.*.*",
    "*.*.*.*",
    "100.90.190.11",
    "100.*.*.*",
    "192.168.1.119",
    "192.168.1.122",
    "192.168.*.*",
    "*.ts.net",
    "*.local",
    "*.orb.local",
  ],
};

export default nextConfig;
