import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "prisma-client/client";
import { logger } from "./logger";

const connectionString = `${process.env.DATABASE_URL}`;

const SLOW_QUERY_MS = Number(process.env.LOG_SLOW_QUERY_MS);

const adapter = new PrismaPg({ connectionString });

const basePrisma = new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const startedAt = performance.now();
      const target = model ? `${model}.${operation}` : operation;

      try {
        const result = await query(args);
        const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

        if (durationMs >= SLOW_QUERY_MS) {
          logger.warn("db.slow_query", { query: target, durationMs, args });
        } else {
          logger.debug("db.query", { query: target, durationMs });
        }

        return result;
      } catch (error) {
        logger.error("db.query_failed", {
          query: target,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          args,
          err: error,
        });
        throw error;
      }
    },
  },
});

export { prisma };
