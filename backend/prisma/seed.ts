import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Administrator',
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', SALT_ROUNDS),
      role: Role.admin,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'teacher1' },
    update: {},
    create: {
      name: 'Teacher One',
      username: 'teacher1',
      passwordHash: await bcrypt.hash('teacher123', SALT_ROUNDS),
      role: Role.teacher,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'student1' },
    update: {},
    create: {
      name: 'Student One',
      username: 'student1',
      passwordHash: await bcrypt.hash('student123', SALT_ROUNDS),
      role: Role.student,
      isActive: true,
    },
  });

  const sessionDate = new Date();
  sessionDate.setDate(sessionDate.getDate() + 7);

  const startTime = new Date(sessionDate);
  startTime.setHours(10, 0, 0, 0);

  const endTime = new Date(sessionDate);
  endTime.setHours(12, 0, 0, 0);

  await prisma.session.upsert({
    where: { id: '00000000-0000-4000-a000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-a000-000000000001',
      date: sessionDate,
      startTime,
      endTime,
      place: 'Chess Club Room',
      notes: 'Seed session',
      createdById: admin.id,
    },
  });

  await prisma.appConfig.upsert({
    where: { key: 'session_fee' },
    update: {},
    create: {
      key: 'session_fee',
      value: '50.00',
      updatedById: admin.id,
    },
  });

  console.log('Seed complete.');
  console.log('  admin    / admin123');
  console.log('  teacher1 / teacher123');
  console.log('  student1 / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
