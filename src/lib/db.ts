import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  supportAiPrisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.supportAiPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.supportAiPrisma = db;
}