import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use fairops as workspace root so Turbopack doesn't warn about multiple lockfiles
  turbopack: { root: process.cwd() },
  // Native .node addons must be loaded at runtime, not bundled
  serverExternalPackages: ['@napi-rs/canvas'],
};

export default nextConfig;
