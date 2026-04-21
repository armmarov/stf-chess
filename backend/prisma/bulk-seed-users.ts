import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const USERS_FILE = process.argv[2] ?? '/home/armmarov/Downloads/USER_STF.txt';

// Strip invisible Unicode (zero-width joiners, BOM, etc.) from copy-paste.
function clean(s: string): string {
  return s.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '').trim();
}

function roleFromLabel(label: string): Role {
  const l = clean(label).toLowerCase();
  if (l === 'student') return Role.student;
  if (l === 'teacher') return Role.teacher;
  if (l === 'admin') return Role.admin;
  if (l === 'coach') return Role.coach;
  throw new Error(`Unknown role: ${label}`);
}

async function upsertUser(opts: {
  name: string;
  username: string;
  password: string;
  role: Role;
  className?: string | null;
}) {
  const passwordHash = await bcrypt.hash(opts.password, SALT_ROUNDS);
  return prisma.user.upsert({
    where: { username: opts.username },
    update: {
      name: opts.name,
      passwordHash,
      role: opts.role,
      className: opts.className ?? null,
      isActive: true,
    },
    create: {
      name: opts.name,
      username: opts.username,
      passwordHash,
      role: opts.role,
      className: opts.className ?? null,
      isActive: true,
    },
  });
}

async function main() {
  // 1. Admin override
  await upsertUser({
    name: 'Administrator',
    username: 'admin',
    password: 'stfpass123',
    role: Role.admin,
  });
  console.log('  ✓ admin (password: stfpass123)');

  // 2. Parse file
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  const lines = raw.split('\n').map(clean).filter((l) => l.length > 0);

  let ok = 0, fail = 0;
  for (const line of lines) {
    const parts = line.split(',').map(clean);
    if (parts.length < 4) {
      console.warn(`  ✗ skip (not enough fields): ${line}`);
      fail++;
      continue;
    }

    const [name, username, password, roleLabel, classNameRaw] = parts;
    try {
      const role = roleFromLabel(roleLabel);
      const className = role === Role.student ? (classNameRaw ? clean(classNameRaw) : null) : null;
      await upsertUser({ name, username, password, role, className });
      console.log(`  ✓ ${username.padEnd(14)} ${role}${className ? ' · ' + className : ''}`);
      ok++;
    } catch (e) {
      console.warn(`  ✗ ${username}: ${(e as Error).message}`);
      fail++;
    }
  }

  console.log(`\nDone. Upserted: ${ok}, Failed: ${fail}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
