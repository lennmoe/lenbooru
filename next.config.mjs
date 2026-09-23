import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp", "adm-zip", "discord.js"],
  outputFileTracingRoot: __dirname,
  // dev only: allow the dev server to be used through a tunnel (VS Code port forwarding, etc.)
  allowedDevOrigins: ["*.devtunnels.ms", "*.trycloudflare.com", "*.ngrok-free.app"],
};

export default nextConfig;
