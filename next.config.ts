import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./data/**/*", "./refs/**/*", "./.worktrees/**/*"],
  },
};
export default config;
