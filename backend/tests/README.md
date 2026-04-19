# Backend Tests

## Setup

### 1. Create the test database

```bash
createdb stf_test
```

### 2. Configure environment

Copy `.env.test.example` to `.env.test` and fill in your values:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` — at minimum, set `DATABASE_URL_TEST` to point at `stf_test`.

### 3. Run Prisma migrations against the test DB

```bash
DATABASE_URL=<your DATABASE_URL_TEST value> npx prisma migrate deploy
```

### 4. Run tests

```bash
npm test                # run once
npm run test:watch      # re-run on file changes
npm run test:coverage   # with coverage report
```

## Folder layout

```
tests/
  helpers/
    app.ts       — re-exports the Express app for Supertest
    db.ts        — prisma client pointed at stf_test + resetDb()
    auth.ts      — createUser(role, overrides), loginAs(role)
  integration/
    health.test.ts
    <module>/
      <endpoint>.test.ts
  unit/
    <module>/
      <service>.test.ts
  loadEnv.ts     — loaded via setupFiles; reads .env.test before any module import
  setup.ts       — global beforeAll/afterAll for Prisma connect/disconnect
```

## Conventions

- Every `describe` block that mutates the DB must call `resetDb()` in `beforeEach`.
- Never import `.env` or point any test at the dev/prod database.
- Secrets come from `.env.test` only — never hardcode them.
