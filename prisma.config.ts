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
  },
});
