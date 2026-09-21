import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildSecurityHeaders } from "./security-headers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "outsmart-module-sensation.ngrok-free.dev",
    "192.168.1.46",
    "192.168.1.49",
  ],
  // Self-contained server bundle for the Docker image (docs/deployment.md) —
  // the tracing root is the monorepo root so workspace packages under
  // packages/* are traced correctly instead of just this app's own tree.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          isDev: process.env.NODE_ENV !== "production",
        }),
      },
    ];
  },
};

export default nextConfig;
