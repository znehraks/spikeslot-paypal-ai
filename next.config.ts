import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.SPIKESLOT_BUILD_DIR || ".next",
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./data/**/*", "./refs/**/*", "./.worktrees/**/*"],
  },
};
export default config;
