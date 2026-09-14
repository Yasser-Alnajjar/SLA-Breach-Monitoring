import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["poking-hypertext-fade.ngrok-free.dev"],
  // Self-contained server bundle for the Docker image (docs/deployment.md) —
  // the tracing root is the monorepo root so workspace packages under
  // packages/* are traced correctly instead of just this app's own tree.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
