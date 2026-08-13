import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { loadEncryptedEnv } from "./scripts/load-encrypted-env";

loadEncryptedEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: process.env.NODE_ENV === "production" ? "tsx prisma/seed.ts" : "tsx prisma/seed-dev.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Only needed to diff the migrations directory against the schema - the drift check CI runs
    // (`npm run db:validate`) points this at a scratch database. Unset everywhere else.
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: env("SHADOW_DATABASE_URL") } : {}),
  },
});
