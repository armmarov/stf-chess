import { prisma } from './helpers/db';

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch {
    // DB not available in this environment — DB-dependent tests will fail individually
  }
});

afterAll(async () => {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors
  }
});
