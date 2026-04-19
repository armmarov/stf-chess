# Architecture

## High-Level Diagram

```
┌─────────────────────┐       HTTPS/JSON       ┌──────────────────────┐
│  Browser (Mobile)   │ ─────────────────────► │  Express API Server  │
│  Vue 3 SPA          │ ◄───────────────────── │  (Node.js/TypeScript)│
│  - Vue Router       │      JWT httpOnly cookie│  - Auth middleware   │
│  - Pinia stores     │                         │  - Role guards       │
│  - Tailwind UI      │                         │  - REST controllers  │
└─────────────────────┘                         └──────────┬───────────┘
                                                           │
                                            ┌──────────────┼──────────────┐
                                            ▼              ▼              ▼
                                   ┌────────────────┐ ┌──────────┐ ┌──────────────┐
                                   │  PostgreSQL    │ │ /uploads │ │  .env / logs │
                                   │  (Prisma ORM)  │ │ receipts │ │              │
                                   └────────────────┘ └──────────┘ └──────────────┘
```

## Frontend (Vue 3)

**Stack:** Vue 3 Composition API · Vite · Vue Router · Pinia · Tailwind CSS · axios · vee-validate + Zod

**Folder layout:**
```
frontend/
  src/
    api/          # axios clients per resource
    assets/       # logo-transparent.png, icons
    components/   # shared UI (Button, Input, Card, Checkbox, Modal, Toast)
    layouts/      # AdminLayout, TeacherLayout, StudentLayout
    pages/        # route-level views (see REQUIREMENTS.md §7)
    router/       # vue-router, route guards
    stores/       # Pinia: authStore, sessionStore, studentStore, paymentStore
    utils/
    App.vue
    main.ts
```

**Route guards:** protected routes verify auth token and role via `authStore` before rendering.

**API layer:** single axios instance with base URL `/api`, auth interceptor (cookie is sent automatically), and global error handler.

## Backend (Express / Node.js)

**Stack:** Node.js · Express · TypeScript · Prisma · Zod · multer · bcrypt · jsonwebtoken · helmet

**Layered architecture:**
```
backend/
  src/
    config/         # env vars, db client, logger
    middleware/     # authMiddleware, roleGuard, errorHandler, uploadMiddleware
    modules/
      auth/         # routes, controller, service
      users/        # routes, controller, service
      sessions/     # routes, controller, service
      attendance/   # routes, controller, service
      payments/     # routes, controller, service
      config/       # fee config routes, controller, service
    utils/
    app.ts          # Express app setup
    server.ts       # HTTP listen
  prisma/
    schema.prisma
    migrations/
  uploads/          # receipt files (gitignored)
```

**Request lifecycle:**
1. `helmet` — security headers
2. `authMiddleware` — verify JWT from httpOnly cookie
3. `roleGuard(roles[])` — check user role against allowed set
4. Controller → Service → Prisma → PostgreSQL
5. `errorHandler` — normalised JSON error responses

**File uploads:** multer with disk storage; MIME type + extension + size (≤5 MB) validated before save; stored with UUID filename outside web root; served only via authenticated download endpoint.

## Security Measures

- HTTPS enforced in production; HSTS header via helmet
- JWT in `httpOnly + Secure + SameSite=Lax` cookie
- Rate limiting on `POST /api/auth/login`
- Zod validation on every endpoint
- Role enforcement server-side (never trust client)
- File type + size check before storage

## Deployment Options

### Option A — PaaS (recommended for Phase 1)
- **Railway** or **Render**: hosts Express app + managed PostgreSQL
- HTTPS automatic, free/cheap tier, zero server maintenance
- Persistent volume for `/uploads` (or migrate to S3-compatible storage later)

### Option B — VPS
- Single VPS (DigitalOcean / Linode / Vultr, ~$5–10/mo)
- Nginx reverse proxy + Let's Encrypt HTTPS
- Node.js under `pm2` or `systemd`
- PostgreSQL on same host; daily `pg_dump` cron; `/uploads` rsynced off-box

**Common to both:** `.env` for secrets (not committed); frontend built to static assets served by Express or Nginx.

See `REQUIREMENTS.md §9.6` for deployment decision rationale.
