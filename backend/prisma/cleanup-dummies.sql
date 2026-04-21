-- Remove dummy seed data left over from prisma/seed.ts.
-- Does NOT touch the 'admin' user, real students/teachers, or the session_fee config.
-- Run: psql "$DATABASE_URL" -f prisma/cleanup-dummies.sql

BEGIN;

-- Dummy session created by seed.ts ("Seed session" at Chess Club Room)
DELETE FROM sessions
WHERE id = '00000000-0000-4000-a000-000000000001';

-- Dummy users teacher1 / student1
DELETE FROM users
WHERE username IN ('teacher1', 'student1');

COMMIT;
