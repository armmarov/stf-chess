# STF Supreme Chess

Mobile-first attendance & payment management web app for a chess coaching club.

Pre-attendance confirmation by students, live attendance marking by teachers, digital payment receipts, and an in-app notification stream — all in one place.

## Roles

- **Admin** — full CRUD over users, sessions, payments, and fee configuration
- **Teacher** — creates sessions, marks attendance (present + cash), reviews receipts, manages students
- **Coach** — reserved (no Phase 1 UI)
- **Student** — confirms pre-attendance, uploads payment receipts, views own history

## Tech stack

- **Frontend:** Vue 3 (Composition API) + TypeScript + Vite + Tailwind CSS + Pinia + Vue Router
- **Backend:** Node.js + Express + TypeScript + Prisma ORM + Zod validation
- **Database:** PostgreSQL
- **Auth:** JWT in `httpOnly` + `Secure` cookie, bcrypt password hashing
- **PDF receipts:** `pdfkit`
- **Testing:** Jest + Supertest (backend), Vitest ready (frontend)

## Features

- Username + password auth with role-based route guards
- Session CRUD with soft-cancel, attendance marking, and aggregated stats
- Pre-attendance with a 10-minute cutoff before session start
- Payment flow: student upload → admin/teacher review → approve/reject → PDF receipt download
- Historical fee snapshot on payments (admin fee changes don't re-price past records)
- Dashboard overview stats per role
- In-app notifications for 6 key events (polling-based)
- Mobile-first UI with hamburger menu, confirm dialogs on destructive actions, WhatsApp-clickable phones

## Quick start

Requires Node.js 18+, PostgreSQL 14+.

### Backend

```bash
cd backend
npm install
cp .env.example .env         # edit DATABASE_URL, JWT_SECRET (>=16 chars), UPLOADS_DIR, CORS_ORIGIN
npx prisma migrate deploy    # applies migrations
npx prisma db seed           # creates admin/teacher/student + a future session + default fee
npm run dev                  # starts on http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env         # set VITE_API_BASE_URL (defaults to http://localhost:3000/api)
npm run dev                  # Vite on http://localhost:5173
```

### Seed accounts

| Role    | Username   | Password     |
|---------|------------|--------------|
| Admin   | `admin`    | `admin123`   |
| Teacher | `teacher1` | `teacher123` |
| Student | `student1` | `student123` |

Change these via the admin Users page before exposing the app publicly.

## Project layout

```
backend/            # Express + TS API
  prisma/           # schema + migrations + seed
  src/
    modules/        # auth, users, sessions, attendance, payments, config, notifications, dashboard
    middleware/     # auth, roleGuard, upload, errorHandler
    config/, utils/
  tests/            # Jest + Supertest
frontend/           # Vue 3 + TS SPA
  src/
    api/            # typed axios clients per resource
    components/     # AppButton, AppIcon, AppHeaderNav, AppConfirmDialog, StatCard, ...
    layouts/        # AdminLayout, TeacherLayout, StudentLayout, AppLayout
    pages/          # route views (admin/, teacher/, student/, sessions/, payments/, attendance/)
    router/, stores/, utils/, composables/
docs/
  api/openapi.yaml  # OpenAPI 3.1 spec
  design/           # architecture, data model, auth, session lifecycle, attendance, payments, notifications
  decisions/        # ADRs
REQUIREMENTS.md     # Phase 1 functional + non-functional requirements
```

## Deployment notes

- **PostgreSQL**: single instance; back up with `pg_dump` on a schedule.
- **Uploads**: configurable via `UPLOADS_DIR` env. Production tip: `/opt/stf/data` or similar, owned by the app user, on a persistent volume. Back up with `rsync` separately from the DB.
- **PM2** (typical deploy):
  ```bash
  cd backend && npm ci && npx prisma migrate deploy && npm run build
  pm2 start npm --name stf-be -- run start
  cd ../frontend && npm ci && npm run build
  # serve frontend/dist via nginx / static host
  ```
- **Nginx** reverse proxy terminates TLS, forwards `/api` to the backend, serves the SPA build.
- **CORS**: set `CORS_ORIGIN` to your frontend origin.
- **Scaling**: for multiple backend instances, switch `UPLOADS_DIR` to S3-compatible storage (Cloudflare R2 etc.).

## Testing

```bash
cd backend
cp .env.test.example .env.test   # point DATABASE_URL_TEST at a separate db
createdb stf_test
npm test
```

Coverage focuses on integration: auth guards, business rules (pre-attendance cutoff, fee snapshot, soft-cancel, review state machine), and the 6 notification event emissions.

## Documentation

- [`REQUIREMENTS.md`](./REQUIREMENTS.md) — product + functional spec
- [`docs/design/`](./docs/design/) — architecture, data model, flows
- [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) — complete API spec
- [`docs/decisions/`](./docs/decisions/) — ADRs

## License

[MIT](./LICENSE)
