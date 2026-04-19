# STF Supreme Chess — Attendance & Payment Management System

## 1. Overview

**Product name:** STF Supreme Chess

A mobile-first web application for managing student attendance and payments for chess coaching sessions. The system supports pre-attendance confirmation by students, actual attendance marking by teachers, and payment receipt uploads.

### 1.1 Branding

- **Website name:** STF Supreme Chess
- **Logo file:** `logo-transparent.png` (located at project root; to be placed in `frontend/src/assets/logo-transparent.png`)
- **Logo usage:**
  - App header / top nav (all pages)
  - Login page (centered, above the login form)
  - Browser favicon (derived from the same PNG)
  - Email / receipt headers (future phase)
- Logo should render cleanly on light backgrounds; preserve aspect ratio; minimum height ~32px in headers, larger on the login page.

## 2. Goals

- Simplify attendance tracking for chess coaching sessions.
- Allow students to confirm attendance in advance (pre-attendance).
- Allow teachers to mark actual attendance and cash payments on-site.
- Allow students to submit payment receipts digitally (Phase 1).
- Provide role-based access for admin, teacher, coach, and student.

## 3. User Roles

| Role        | Description                                                    |
|-------------|----------------------------------------------------------------|
| **Admin**   | Full system access; manages all users.                         |
| **Teacher** | Manages students, sessions, attendance, and cash payments.     |
| **Coach**   | Can view sessions and students (read-only for Phase 1).        |
| **Student** | Can pre-confirm attendance and upload payment receipts.        |

## 4. Functional Requirements

### 4.1 Authentication
- FR-1: All users must log in with email/username + password.
- FR-2: Passwords stored with secure hashing (bcrypt or similar).
- FR-3: Session-based or JWT authentication.
- FR-4: Logout functionality.

### 4.2 Admin Features
- FR-5: Register and manage (edit, deactivate) students.
- FR-6: Register and manage (edit, deactivate) teachers.
- FR-7: Register and manage (edit, deactivate) coaches.
- FR-8: View all sessions, attendance records, and payments.

### 4.3 Teacher / Admin Features — Session Management
- FR-9: Create new coaching session with:
  - Date
  - Start time / end time
  - Place / venue
  - Optional notes
- FR-10: Edit or cancel a session.
- FR-11: View list of upcoming and past sessions.

### 4.4 Teacher Features — Student Management
- FR-12: Add a new student (name, contact, etc.).
- FR-13: Deactivate a student (soft delete).
- FR-14: View student list.

### 4.5 Teacher Features — Attendance
- FR-15: View list of students for a given session, showing:
  - Pre-attendance status (student confirmed)
  - Actual attendance checkbox
  - Cash payment checkbox
- FR-16: Tick/untick actual attendance per student per session.
- FR-17: Tick/untick cash payment per student per session.
- FR-18: Save attendance updates.

### 4.6 Student Features
- FR-19: View upcoming sessions.
- FR-20: Tick pre-attendance for an upcoming session (confirm intent to attend).
- FR-21: Tick/untick pre-attendance up to **10 minutes before** session start time.
- FR-22: View payment history / status.
- FR-23: Upload payment receipt (image: JPG/PNG/PDF) for a session.
- FR-24: View own attendance history.

### 4.7 Coach Features
- Deferred to **Phase 2** (no coach-facing functionality in Phase 1; admin can still register coach accounts for future use).

### 4.8 Payment Review
- FR-25: Admin or teacher can view uploaded receipts and approve / reject a payment.
- FR-26: Payment status flows: `pending` → `approved` or `rejected`.

### 4.9 Fee Configuration
- FR-27: Admin can set / update a **fixed session fee** (single global value).
- FR-28: Historical payments retain the fee amount at the time of payment (do not recalculate on fee change).

## 5. Non-Functional Requirements

- NFR-1: **Mobile-first responsive UI** — usable on small screens (min 360px).
- NFR-2: Page load < 3 seconds on 4G.
- NFR-3: Secure file upload (type + size validation, max 5 MB).
- NFR-4: HTTPS in production.
- NFR-5: Basic input validation and CSRF protection.
- NFR-6: Simple, clean UI — minimal clicks for teachers marking attendance.

## 6. Data Model (Draft)

### User
- id, name, email, password_hash, role (admin/teacher/coach/student), phone, is_active, created_at

### Session
- id, date, start_time, end_time, place, notes, created_by (user_id), created_at

### PreAttendance
- id, session_id, student_id, confirmed_at

### Attendance
- id, session_id, student_id, present (bool), paid_cash (bool), marked_by (teacher_id), marked_at

### Payment
- id, student_id, session_id (nullable), amount, receipt_file_path, status (pending/approved/rejected), uploaded_at, reviewed_by, reviewed_at

### AppConfig
- id, key (e.g., `session_fee`), value, updated_by, updated_at

## 7. Page / Screen List

### Public
1. Login page

### Admin
2. Admin dashboard
3. Manage students
4. Manage teachers
5. Manage coaches
6. Manage sessions

### Teacher
7. Teacher dashboard (today's sessions)
8. Session list
9. New/edit session form
10. Session attendance view (tick attendance + cash)
11. Student list / add student

### Student
12. Student dashboard (upcoming sessions)
13. Session detail (pre-attendance toggle)
14. Payment upload page
15. Payment history
16. Attendance history

### Admin (additional)
17. Fee configuration page
18. Payment review page (list pending receipts, view, approve/reject)

### Teacher (additional)
19. Payment review page (same as admin)

### Coach
- _Phase 2 — not in Phase 1_

## 8. Tech Stack

- **Language:** **TypeScript** across both frontend and backend
- **Frontend:** Vue 3 (Composition API) + Vite + Vue Router + Pinia + Tailwind CSS
- **Backend:** Node.js + Express (TypeScript)
- **Database:** PostgreSQL (dev + prod); Prisma or Knex as ORM/query builder
- **File storage:** Local filesystem for Phase 1 (receipts in `/uploads`)
- **Auth:** JWT (access token) with httpOnly cookie; bcrypt for password hashing
- **Validation:** Zod (shared schemas) or express-validator
- **Testing:** Vitest (FE), Jest/Supertest (BE)

## 9. Architecture

### 9.1 High-Level Diagram

```
┌─────────────────────┐       HTTPS/JSON       ┌──────────────────────┐
│  Browser (Mobile)   │ ─────────────────────► │  Express API Server  │
│  Vue 3 SPA          │ ◄───────────────────── │  (Node.js)           │
│  - Vue Router       │       JWT cookie        │  - Auth middleware   │
│  - Pinia store      │                         │  - Role guards       │
│  - Tailwind UI      │                         │  - REST controllers  │
└─────────────────────┘                         └──────────┬───────────┘
                                                           │
                                            ┌──────────────┼──────────────┐
                                            ▼              ▼              ▼
                                   ┌────────────────┐ ┌──────────┐ ┌──────────────┐
                                   │  PostgreSQL    │ │ /uploads │ │ Logs / Env   │
                                   │  (users,       │ │ receipts │ │              │
                                   │  sessions,     │ │ (Phase 1)│ │              │
                                   │  attendance,   │ └──────────┘ └──────────────┘
                                   │  payments)     │
                                   └────────────────┘
```

### 9.2 Frontend (Vue 3)

- **Structure:** SPA served by Vite dev server in dev; static build served by Express or a CDN/Nginx in prod.
- **Routing:** `vue-router` with route guards based on auth + role.
- **State:** `Pinia` stores for `authStore`, `sessionStore`, `studentStore`, `paymentStore`.
- **API layer:** `axios` instance with base URL, auth interceptor, and error handling.
- **Styling:** Tailwind CSS, mobile-first utility classes; a small shared component library (Button, Input, Card, Checkbox, Modal, Toast).
- **Forms:** `vee-validate` + `zod` for schema-based validation.
- **Folder layout (suggested):**
  ```
  frontend/
    src/
      api/            # axios clients per resource
      assets/
      components/     # shared UI
      layouts/        # AdminLayout, TeacherLayout, StudentLayout
      pages/          # route-level views
      router/
      stores/         # pinia stores
      utils/
      App.vue
      main.ts
  ```

### 9.3 Backend (Express)

- **Layered architecture:**
  - `routes/` — Express routers per resource (auth, users, sessions, attendance, payments)
  - `controllers/` — request/response handling
  - `services/` — business logic
  - `repositories/` (or Prisma models) — DB access
  - `middleware/` — `authMiddleware`, `roleGuard`, `errorHandler`, `uploadMiddleware` (multer)
  - `validators/` — Zod schemas
  - `config/` — env, db, logger
- **Folder layout (suggested):**
  ```
  backend/
    src/
      config/
      middleware/
      modules/
        auth/
        users/
        sessions/
        attendance/
        payments/
      utils/
      app.ts
      server.ts
    prisma/           # or migrations/
    uploads/          # receipt files (gitignored)
  ```
- **Auth flow:** login → bcrypt compare → issue JWT in httpOnly cookie → middleware verifies on each protected request → role guard checks role.
- **File uploads:** `multer` with disk storage, file-type + size validation (max 5 MB, images/PDF only), unique filenames (uuid), served via authenticated download endpoint (not direct static).

### 9.4 REST API (Draft)

| Method | Path                                           | Role                   | Description                            |
|--------|------------------------------------------------|------------------------|----------------------------------------|
| POST   | `/api/auth/login`                              | public                 | Login, returns JWT cookie              |
| POST   | `/api/auth/logout`                             | any                    | Clear JWT cookie                       |
| GET    | `/api/auth/me`                                 | any                    | Current user                           |
| GET    | `/api/users`                                   | admin                  | List users (filter by role)            |
| POST   | `/api/users`                                   | admin                  | Create user (student/teacher/coach)    |
| PATCH  | `/api/users/:id`                               | admin, teacher(student)| Update / deactivate                    |
| GET    | `/api/sessions`                                | any                    | List sessions                          |
| POST   | `/api/sessions`                                | admin, teacher         | Create session                         |
| PATCH  | `/api/sessions/:id`                            | admin, teacher         | Update session                         |
| DELETE | `/api/sessions/:id`                            | admin, teacher         | Cancel session                         |
| POST   | `/api/sessions/:id/pre-attendance`             | student                | Toggle pre-attendance                  |
| GET    | `/api/sessions/:id/attendance`                 | teacher, admin         | Roster for marking                     |
| PUT    | `/api/sessions/:id/attendance`                 | teacher                | Bulk update attendance + cash flags    |
| POST   | `/api/payments`                                | student                | Upload receipt (multipart)             |
| GET    | `/api/payments`                                | student(own), admin, teacher | List payments                    |
| PATCH  | `/api/payments/:id/review`                     | admin, teacher         | Approve / reject                       |
| GET    | `/api/config/fee`                              | any                    | Get current session fee                |
| PUT    | `/api/config/fee`                              | admin                  | Update session fee                     |

### 9.5 Database (PostgreSQL)

- One schema, tables map to the data model in §6.
- Indexes on `users.email`, `sessions.date`, `attendance(session_id, student_id)` unique, `pre_attendance(session_id, student_id)` unique.
- Migrations managed via Prisma Migrate (or Knex).

### 9.6 Deployment (Phase 1)

> **Note on shared hosting:** Traditional cPanel-style shared hosting generally does **not** support Node.js + PostgreSQL (mostly PHP/MySQL). Recommended options below.

**Option A — PaaS (recommended for Phase 1):**
- **Railway** or **Render** — hosts the Express app and managed PostgreSQL in one place.
- Cheap/free tier, HTTPS automatic, zero server maintenance.
- File uploads: attach a persistent volume, or switch to S3-compatible storage (e.g., Cloudflare R2) in a later phase.

**Option B — VPS (more control):**
- Single VPS (DigitalOcean / Linode / Vultr, ~$5–10/mo) running:
  - Nginx (reverse proxy + HTTPS via Let's Encrypt)
  - Node.js process under `pm2` or `systemd`
  - PostgreSQL on the same host
- Backups: daily `pg_dump` cron; `/uploads` rsynced to off-box storage.

**Common to both:**
- Environment config via `.env` (not committed).
- Frontend built to static assets, served by Express (or Nginx / Railway static).

### 9.7 Security

- HTTPS enforced, HSTS header.
- JWT in httpOnly + Secure + SameSite=Lax cookie.
- `helmet` for standard security headers.
- Rate limiting on `/api/auth/login`.
- Input validation on every endpoint (Zod).
- File upload: MIME + extension + size check, store outside web root, serve via auth-guarded route.
- Role-based access enforced server-side (never trust FE).

## 10. Out of Scope (Phase 1)

- Coach-facing features (Phase 2)
- Password reset flow
- Online payment gateway (e.g., Stripe, FPX)
- Email/SMS notifications
- Automated receipt OCR / verification
- Reports & analytics dashboards
- Multi-language support (English only)
- Push notifications
- Session capacity limits

## 11. Resolved Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Auth | Username + password only; no password reset in Phase 1 |
| 2 | Coach role | Deferred to Phase 2 |
| 3 | Pre-attendance cutoff | 10 minutes before session start time |
| 4 | Payment verification | Admin **or** teacher can approve/reject |
| 5 | Session capacity | No limit |
| 6 | Student ↔ session assignment | Attendance open to all active students per session |
| 7 | Fees | Fixed global fee, editable by admin; historical payments preserve fee at time of payment |
| 8 | Language / typing | TypeScript on both FE and BE |
| 9 | Deployment | PaaS (Railway / Render) recommended; VPS as alternative; traditional shared hosting not suitable |
| 10 | UI language | English only |
