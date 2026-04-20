import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST,
    },
  },
});

/**
 * Truncates all tables in FK-safe order for test isolation.
 * Table names match @@map values in prisma/schema.prisma.
 * Update this list when new tables are added via migrations.
 */
export async function resetDb(): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRawUnsafe('TRUNCATE TABLE "notifications" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "tournament_interests" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "payments" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "attendances" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "pre_attendances" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "sessions" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "tournaments" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "app_configs" CASCADE'),
    prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE'),
  ]);
}
